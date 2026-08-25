import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import CategoryDetailScreen from './src/screens/CategoryDetailScreen';
import AddItemSheet, { EditTarget } from './src/components/AddItemSheet';
import AICaptureSheet, { AiConfirmPayload } from './src/components/AICaptureSheet';
import NoteSheet, { NoteSavePayload } from './src/components/NoteSheet';
import BackupSheet, { BackupData } from './src/components/BackupSheet';
import CategoryEditSheet, { CategoryEditTarget, CategorySavePayload } from './src/components/CategoryEditSheet';
import LockScreen from './src/components/LockScreen';
import LockSettingsSheet from './src/components/LockSettingsSheet';

import { INIT_CATS, INIT_INCOME_CATS, ExpenseCategory, ExpenseItem, IncomeCategory, NoteItem, DEFAULT_NEW_CATEGORY_BUDGET, pickNewCategoryColor, computeAccountBalance, generateId } from './src/data';
import { COLORS } from './src/theme';
import {
  hashPin, isWebAuthnSupported, registerBiometricCredential, verifyBiometricCredential,
  PIN_HASH_KEY, BIOMETRIC_CRED_KEY, LOCK_ENABLED_KEY,
} from './src/security';

type Screen = 'home' | 'history';

const STORAGE_KEY = '@expense_tracker/data';

// ซิงค์ข้อมูลขึ้น cloud (Upstash Redis ผ่าน ai-proxy) — กันข้อมูลหายตอนเปลี่ยนลิงก์/origin/เครื่อง
// ใช้ backend + secret เดียวกับ AICaptureSheet.tsx
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET ?? '';
const SYNC_HEADERS = { 'Content-Type': 'application/json', 'x-app-secret': APP_SECRET };

// ซ่อม id รายการที่ชนกันภายในหมวดหมู่เดียวกัน (ดูคอมเมนต์ generateId ใน src/data/index.ts) —
// เจอ id ซ้ำ เก็บตัวแรกไว้เหมือนเดิม แจก id ใหม่ให้ตัวถัดๆ ไปที่ซ้ำ ไม่แตะข้อมูลอื่นเลย
function dedupeItemIds<T extends { id: number }>(items: T[]): { items: T[]; changed: boolean } {
  const seen = new Set<number>();
  let changed = false;
  const result = items.map(item => {
    if (seen.has(item.id)) {
      changed = true;
      return { ...item, id: generateId() };
    }
    seen.add(item.id);
    return item;
  });
  return { items: result, changed };
}

function repairDuplicateIds(cats: ExpenseCategory[], incomeCats: IncomeCategory[]) {
  let changed = false;
  const repairedCats = cats.map(c => {
    const r = dedupeItemIds(c.items);
    // เผื่อข้อมูลเก่าที่ spent/count เพี้ยนไปจาก items จริงแล้ว (เช่น บั๊ก filter โดน id ซ้ำลบพร้อมกัน
    // ก่อนโค้ดจุดนี้จะถูกแก้ — ดูคอมเมนต์ withRecomputedTotals) — คำนวณ spent/count จาก items ใหม่ให้ตรงเสมอ
    const spent = r.items.reduce((s, i) => s + i.amt, 0);
    const count = r.items.length;
    const totalsChanged = spent !== c.spent || count !== c.count;
    if (r.changed || totalsChanged) changed = true;
    return (r.changed || totalsChanged) ? { ...c, items: r.items, spent, count } : c;
  });
  const repairedIncomeCats = incomeCats.map(c => {
    const r = dedupeItemIds(c.items);
    if (r.changed) changed = true;
    return r.changed ? { ...c, items: r.items } : c;
  });
  return { cats: repairedCats, incomeCats: repairedIncomeCats, changed };
}

export default function App() {
  const [cats, setCats] = useState<ExpenseCategory[]>(INIT_CATS);
  const [incomeCats, setIncomeCats] = useState<IncomeCategory[]>(INIT_INCOME_CATS);
  const [screen, setScreen] = useState<Screen>('home');
  const [catId, setCatId] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [noteEditTarget, setNoteEditTarget] = useState<NoteItem | null>(null);
  const [showBackupSheet, setShowBackupSheet] = useState(false);
  const [categoryEditTarget, setCategoryEditTarget] = useState<CategoryEditTarget | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextPush = useRef(false); // กันดันข้อมูลกลับขึ้น cloud ทันทีหลังเพิ่งโหลดมันมา (เปลือง request เปล่าๆ)

  // ล็อกแอปด้วยรหัสผ่าน (+ Face ID/Touch ID ถ้าเบราว์เซอร์รองรับ) — ดูรายละเอียดใน src/security.ts
  const [lockConfigLoaded, setLockConfigLoaded] = useState(false);
  const [lockMode, setLockMode] = useState<'setup' | 'locked' | 'unlocked'>('unlocked');
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);
  const [lockEnabled, setLockEnabled] = useState(true);
  const [lockError, setLockError] = useState<string | null>(null);
  const [showLockSettings, setShowLockSettings] = useState(false);

  // โหลดข้อมูล — ลอง cloud ก่อนเสมอ (ข้อมูลล่าสุดข้ามเครื่อง/ลิงก์) ถ้าเรียกไม่ได้ค่อย fallback มาที่เครื่องนี้
  useEffect(() => {
    (async () => {
      let localData: { cats?: ExpenseCategory[]; incomeCats?: IncomeCategory[]; notes?: NoteItem[] } | null = null;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) localData = JSON.parse(raw);
      } catch (e) {
        console.warn('โหลดข้อมูลในเครื่องไม่สำเร็จ', e);
      }

      let usedCloud = false;
      let finalCats: ExpenseCategory[] = INIT_CATS;
      let finalIncomeCats: IncomeCategory[] = INIT_INCOME_CATS;
      let finalNotes: NoteItem[] = [];

      if (API_BASE_URL) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/data`, { headers: SYNC_HEADERS });
          if (res.ok) {
            const { data } = await res.json();
            if (data && Array.isArray(data.cats)) {
              finalCats = data.cats;
              finalIncomeCats = data.incomeCats ?? [];
              finalNotes = data.notes ?? [];
              usedCloud = true;
            }
          }
        } catch (e) {
          console.warn('ดึงข้อมูลจาก cloud ไม่สำเร็จ ใช้ข้อมูลในเครื่องแทน', e);
        }
      }

      if (!usedCloud && localData) {
        if (localData.cats) finalCats = localData.cats;
        if (localData.incomeCats) finalIncomeCats = localData.incomeCats;
        if (localData.notes) finalNotes = localData.notes;
      }

      // ซ่อม id รายการที่ชนกัน (บั๊กเก่า: เคยใช้ Date.now() ตรงๆ ทำให้หลายรายการที่เพิ่มพร้อมกัน
      // ได้ id ซ้ำ แล้วรายการหนึ่งหายไปจากลิสต์ที่แสดงเพราะ React key ชนกัน) — ไม่เสียข้อมูลใดๆ แค่แจก id ใหม่ให้ตัวที่ซ้ำ
      const { cats: repairedCats, incomeCats: repairedIncomeCats, changed } = repairDuplicateIds(finalCats, finalIncomeCats);

      // ข้ามการดันขึ้น cloud รอบแรกเฉพาะตอนที่ดึงมาจาก cloud แล้ว "ไม่มีอะไรต้องซ่อม" (ข้อมูลเหมือนเดิมทุกประการ)
      // ถ้าซ่อมข้อมูลไป ต้องดันกลับขึ้น cloud ทันทีเพื่อให้เครื่อง/ลิงก์อื่นเห็น id ที่แก้แล้วด้วย
      skipNextPush.current = usedCloud && !changed;
      setCats(repairedCats);
      setIncomeCats(repairedIncomeCats);
      setNotes(finalNotes);
      setIsLoaded(true);
    })();
  }, []);

  // โหลดการตั้งค่าล็อกแอป — แยก effect จากข้อมูลรายรับ-รายจ่ายเพราะเป็นคนละเรื่องกัน (ไม่เกี่ยวกับ cloud sync)
  useEffect(() => {
    (async () => {
      try {
        const [hash, cred, enabledRaw] = await Promise.all([
          AsyncStorage.getItem(PIN_HASH_KEY),
          AsyncStorage.getItem(BIOMETRIC_CRED_KEY),
          AsyncStorage.getItem(LOCK_ENABLED_KEY),
        ]);
        const enabled = enabledRaw !== '0'; // ค่าเริ่มต้น = เปิด (ยังไม่เคยตั้งค่าเลยแปลว่ายังไม่เคยปิด)
        setPinHash(hash);
        setBiometricCredentialId(cred);
        setLockEnabled(enabled);
        setLockMode(!hash ? 'setup' : (enabled ? 'locked' : 'unlocked'));
      } catch (e) {
        // อ่านการตั้งค่าล็อกไม่ได้ — ปล่อยผ่านเข้าแอปเลยดีกว่าล็อกผู้ใช้ออกจากข้อมูลตัวเอง
        console.warn('โหลดการตั้งค่าล็อกแอปไม่สำเร็จ', e);
        setLockMode('unlocked');
      } finally {
        setLockConfigLoaded(true);
      }
    })();
  }, []);

  // กลับมาล็อกอัตโนมัติเมื่อสลับแอป/พับหน้าจอไปแล้วกลับมา (เหมือนแอปธนาคาร) — เฉพาะตอนตั้งรหัสผ่านและเปิดใช้ล็อกไว้แล้ว
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && pinHash && lockEnabled) {
        setLockMode('locked');
      }
    });
    return () => sub.remove();
  }, [pinHash, lockEnabled]);

  // บันทึกข้อมูลทุกครั้งที่ cats/incomeCats/notes เปลี่ยน — เก็บลงเครื่อง (ทันที) + ดัน cloud (หน่วงเล็กน้อย กันยิงถี่)
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ cats, incomeCats, notes })).catch(e =>
      console.warn('บันทึกข้อมูลไม่สำเร็จ', e)
    );

    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    if (!API_BASE_URL) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const res = await fetch(`${API_BASE_URL}/api/data`, {
          method: 'POST',
          headers: SYNC_HEADERS,
          body: JSON.stringify({ cats, incomeCats, notes }),
        });
        setSyncStatus(res.ok ? 'idle' : 'error');
      } catch (e) {
        console.warn('ซิงค์ข้อมูลขึ้น cloud ไม่สำเร็จ', e);
        setSyncStatus('error');
      }
    }, 800);
  }, [cats, incomeCats, notes, isLoaded]);

  const totalSpent  = useMemo(() => cats.reduce((s, c) => s + c.spent, 0), [cats]);
  const totalIncome = useMemo(() => incomeCats.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.amt, 0), 0), [incomeCats]);

  // spent/count คำนวณจาก items เสมอ (ไม่บวก/ลบเลขแยกต่างหาก) — กันเลขเพี้ยนถ้า filter ดันไปโดนรายการ id ซ้ำ
  // เข้าด้วยกันมากกว่า 1 ตัว (เคยเกิดบั๊กนี้มาแล้ว: ลบรายการเดียวแต่ id ชนกับอีกรายการ กลาย เป็น items ถูกกรองออกไปพร้อมกัน 2 ตัว
  // แต่ spent/count เดิมลบแค่ 1 ตัว ทำให้ตัวเลขค้าง ไม่ตรงกับ items จริง)
  const withRecomputedTotals = (c: ExpenseCategory, items: ExpenseItem[]): ExpenseCategory => ({
    ...c, items, spent: items.reduce((s, i) => s + i.amt, 0), count: items.length,
  });

  const addItem = ({ catId: cId, item }: { catId: string; item: any }) => {
    setCats(cs => cs.map(c => c.id === cId ? withRecomputedTotals(c, [item, ...c.items]) : c));
  };
  const addIncome = ({ catId: cId, item }: { catId: string; item: any }) => {
    setIncomeCats(cs => cs.map(c => c.id === cId ? { ...c, items: [item, ...c.items] } : c));
  };

  const editItem = ({ oldCatId, itemId, newCatId, updated }: { oldCatId: string; itemId: number; newCatId: string; updated: any }) => {
    setCats(cs => {
      let removedItem: any = null;
      const removed = cs.map(c => {
        if (c.id !== oldCatId) return c;
        const item = c.items.find(i => i.id === itemId);
        if (!item) return c;
        removedItem = item;
        return withRecomputedTotals(c, c.items.filter(i => i.id !== itemId));
      });
      if (!removedItem) return cs;
      const newItem = { ...removedItem, ...updated };
      return removed.map(c => c.id === newCatId ? withRecomputedTotals(c, [newItem, ...c.items]) : c);
    });
  };
  const deleteItem = (cId: string, itemId: number) => {
    setCats(cs => cs.map(c => {
      if (c.id !== cId) return c;
      const item = c.items.find(i => i.id === itemId);
      if (!item) return c;
      return withRecomputedTotals(c, c.items.filter(i => i.id !== itemId));
    }));
  };

  const editIncome = ({ oldCatId, itemId, newCatId, updated }: { oldCatId: string; itemId: number; newCatId: string; updated: any }) => {
    setIncomeCats(cs => {
      let removedItem: any = null;
      const removed = cs.map(c => {
        if (c.id !== oldCatId) return c;
        const item = c.items.find(i => i.id === itemId);
        if (!item) return c;
        removedItem = item;
        return { ...c, items: c.items.filter(i => i.id !== itemId) };
      });
      if (!removedItem) return cs;
      const newItem = { ...removedItem, ...updated };
      return removed.map(c => c.id === newCatId ? { ...c, items: [newItem, ...c.items] } : c);
    });
  };
  const deleteIncome = (cId: string, itemId: number) => {
    setIncomeCats(cs => cs.map(c => c.id === cId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c));
  };

  const openEdit = (target: EditTarget) => {
    setEditTarget(target);
    setShowSheet(true);
  };
  const closeSheet = () => {
    setShowSheet(false);
    setEditTarget(null);
  };

  // สร้างหมวดหมู่ใหม่ที่ AI เสนอ (ถ้ายังไม่มี) ก่อนบันทึกรายการเข้าไป
  const ensureExpenseCategory = (id: string, label: string, icon: string) => {
    setCats(cs => cs.some(c => c.id === id) ? cs : [
      ...cs,
      { id, name: label, th: label, icon, color: pickNewCategoryColor(cs.length), budget: DEFAULT_NEW_CATEGORY_BUDGET, spent: 0, count: 0, items: [] },
    ]);
  };
  const ensureIncomeCategory = (id: string, label: string, icon: string) => {
    setIncomeCats(cs => cs.some(c => c.id === id) ? cs : [
      ...cs,
      { id, name: label, th: label, icon, color: pickNewCategoryColor(cs.length), items: [] },
    ]);
  };

  const confirmAiResult = (payload: AiConfirmPayload) => {
    if (payload.newCategory) {
      if (payload.type === 'income') ensureIncomeCategory(payload.catId, payload.newCategory.label, payload.newCategory.icon);
      else ensureExpenseCategory(payload.catId, payload.newCategory.label, payload.newCategory.icon);
    }
    if (payload.type === 'income') addIncome({ catId: payload.catId, item: { id: generateId(), ...payload.item } });
    else addItem({ catId: payload.catId, item: { id: generateId(), ...payload.item } });
  };

  const clearAllData = () => {
    setCats(INIT_CATS);
    setIncomeCats(INIT_INCOME_CATS);
  };

  const openAddNote = () => {
    setNoteEditTarget(null);
    setShowNoteSheet(true);
  };
  const openEditNote = (note: NoteItem) => {
    setNoteEditTarget(note);
    setShowNoteSheet(true);
  };
  const closeNoteSheet = () => {
    setShowNoteSheet(false);
    setNoteEditTarget(null);
  };
  const saveNote = (payload: NoteSavePayload) => {
    if (payload.id != null) {
      setNotes(ns => ns.map(n => n.id === payload.id ? { ...n, title: payload.title, day: payload.day, month: payload.month, year: payload.year } : n));
    } else {
      setNotes(ns => [{ id: generateId(), title: payload.title, day: payload.day, month: payload.month, year: payload.year, paid: false }, ...ns]);
    }
  };
  const deleteNote = (id: number) => {
    setNotes(ns => ns.filter(n => n.id !== id));
  };
  const toggleNotePaid = (id: number) => {
    setNotes(ns => ns.map(n => n.id === id ? { ...n, paid: !n.paid } : n));
  };

  // นำเข้าข้อมูลสำรอง (ใช้ย้ายข้อมูลข้ามลิงก์/origin เมื่อ URL เปลี่ยน) — แทนที่ข้อมูลปัจจุบันทั้งหมด
  const restoreBackup = (backup: BackupData) => {
    setCats(backup.cats);
    setIncomeCats(backup.incomeCats);
    setNotes(backup.notes);
  };

  // แก้ไขชื่อ/ไอคอนหมวดหมู่ — ใช้แก้ไอคอนที่ AI เลือกให้ตอนสร้างหมวดใหม่อัตโนมัติ (เช่น หมวดที่ AI ตั้งไอคอนซ้ำ/ไม่เหมาะ)
  const openEditCategory = (type: 'expense' | 'income', catId: string) => {
    const list = type === 'expense' ? cats : incomeCats;
    const cat = list.find(c => c.id === catId);
    if (!cat) return;

    // ลบได้เฉพาะตอน "ไม่มีเงินเหลือ" ในหมวดนี้แล้ว — กันลบข้อมูลที่ยังมีรายการ/เงินอยู่โดยไม่ตั้งใจ
    let canDelete: boolean;
    let deleteBlockedReason: string | undefined;
    if (type === 'expense') {
      const c = cat as ExpenseCategory;
      canDelete = c.spent === 0 && c.count === 0;
      deleteBlockedReason = canDelete ? undefined : 'ลบไม่ได้ เพราะยังมีรายการรายจ่ายบันทึกอยู่ในหมวดนี้';
    } else {
      const balance = computeAccountBalance(cat as IncomeCategory, cats);
      canDelete = Math.round(balance * 100) === 0;
      deleteBlockedReason = canDelete ? undefined : 'ลบไม่ได้ เพราะยังมีเงินเหลือในบัญชีนี้';
    }

    setCategoryEditTarget({ type, id: cat.id, name: cat.name, icon: cat.icon, canDelete, deleteBlockedReason });
  };
  const closeEditCategory = () => setCategoryEditTarget(null);
  const saveCategoryEdit = (payload: CategorySavePayload) => {
    if (payload.type === 'expense') {
      setCats(cs => cs.map(c => c.id === payload.id ? { ...c, name: payload.name, th: payload.name, icon: payload.icon } : c));
    } else {
      setIncomeCats(cs => cs.map(c => c.id === payload.id ? { ...c, name: payload.name, th: payload.name, icon: payload.icon } : c));
    }
  };
  const deleteCategory = (target: CategoryEditTarget) => {
    if (!target.canDelete) return; // เช็คซ้ำกันเรียกตรงๆ ข้ามเงื่อนไขที่ตั้งไว้ตอนเปิดชีท
    if (target.type === 'expense') {
      setCats(cs => cs.filter(c => c.id !== target.id));
    } else {
      setIncomeCats(cs => cs.filter(c => c.id !== target.id));
    }
  };

  // ตั้งรหัสผ่านครั้งแรก — เสนอเปิด Face ID/Touch ID ต่อทันทีถ้าเบราว์เซอร์รองรับ (ปฏิเสธได้ ไม่บังคับ)
  const handleSetupComplete = (pin: string) => {
    const hash = hashPin(pin);
    AsyncStorage.setItem(PIN_HASH_KEY, hash).catch(e => console.warn('บันทึกรหัสผ่านไม่สำเร็จ', e));
    AsyncStorage.setItem(LOCK_ENABLED_KEY, '1').catch(() => {});
    setPinHash(hash);
    setLockEnabled(true);
    setLockMode('unlocked');

    if (isWebAuthnSupported() && Platform.OS === 'web' && typeof window !== 'undefined') {
      const wantsBiometric = window.confirm('ตั้งรหัสผ่านเรียบร้อย ✅\n\nต้องการเปิดใช้ Face ID / Touch ID เพื่อปลดล็อกแอปเร็วขึ้นด้วยไหม?');
      if (wantsBiometric) {
        registerBiometricCredential().then(credId => {
          if (credId) {
            AsyncStorage.setItem(BIOMETRIC_CRED_KEY, credId).catch(() => {});
            setBiometricCredentialId(credId);
          } else {
            window.alert('ตั้งค่า Face ID / Touch ID ไม่สำเร็จ ลองใหม่ได้ภายหลังในเมนูตั้งค่าการล็อก');
          }
        });
      }
    }
  };

  const handleAttemptUnlock = (pin: string) => {
    if (pinHash && hashPin(pin) === pinHash) {
      setLockError(null);
      setLockMode('unlocked');
    } else {
      setLockError('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleBiometricUnlock = async () => {
    if (!biometricCredentialId) return;
    const ok = await verifyBiometricCredential(biometricCredentialId);
    if (ok) {
      setLockError(null);
      setLockMode('unlocked');
    } else {
      setLockError('ยืนยันตัวตนไม่สำเร็จ ลองใหม่หรือใส่รหัสผ่านแทน');
    }
  };

  // เมนูตั้งค่าล็อก (เปลี่ยนรหัส/เปิดปิด biometric/เปิดปิดการล็อก) — ต้องใส่รหัสผ่านปัจจุบันถูกก่อนเสมอ
  const verifyPinForSettings = (pin: string) => !!pinHash && hashPin(pin) === pinHash;

  const handleChangePin = (newPin: string) => {
    const hash = hashPin(newPin);
    AsyncStorage.setItem(PIN_HASH_KEY, hash).catch(e => console.warn('บันทึกรหัสผ่านไม่สำเร็จ', e));
    setPinHash(hash);
  };

  const handleToggleBiometric = (enable: boolean) => {
    if (!enable) {
      AsyncStorage.removeItem(BIOMETRIC_CRED_KEY).catch(() => {});
      setBiometricCredentialId(null);
      return;
    }
    registerBiometricCredential().then(credId => {
      if (credId) {
        AsyncStorage.setItem(BIOMETRIC_CRED_KEY, credId).catch(() => {});
        setBiometricCredentialId(credId);
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('ตั้งค่า Face ID / Touch ID ไม่สำเร็จ');
      }
    });
  };

  const handleToggleLockEnabled = (enable: boolean) => {
    AsyncStorage.setItem(LOCK_ENABLED_KEY, enable ? '1' : '0').catch(() => {});
    setLockEnabled(enable);
  };

  const activeCat = catId ? cats.find(c => c.id === catId) ?? null : null;

  if (!isLoaded || !lockConfigLoaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  if (lockMode !== 'unlocked') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <LockScreen
            mode={lockMode === 'setup' ? 'setup' : 'unlock'}
            error={lockError}
            onSetupComplete={handleSetupComplete}
            onAttemptUnlock={handleAttemptUnlock}
            biometric={biometricCredentialId ? { label: '👤 ปลดล็อกด้วย Face ID / Touch ID', onPress: handleBiometricUnlock } : null}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
          {/* Screen content */}
          {activeCat ? (
            <CategoryDetailScreen
              cat={activeCat}
              onBack={() => setCatId(null)}
              onItemPress={item => openEdit({ type: 'expense', catId: activeCat.id, item })}
            />
          ) : screen === 'history' ? (
            <HistoryScreen
              cats={cats}
              incomeCats={incomeCats}
              notes={notes}
              onAddNote={openAddNote}
              onEditNote={openEditNote}
              onTogglePaid={toggleNotePaid}
            />
          ) : (
            <HomeScreen
              cats={cats}
              incomeCats={incomeCats}
              totalSpent={totalSpent}
              totalIncome={totalIncome}
              onCat={id => setCatId(id)}
              onAdd={() => setShowCapture(true)}
              onItemPress={(type, cId, item) => openEdit({ type, catId: cId, item })}
              onClearAll={clearAllData}
              onBackup={() => setShowBackupSheet(true)}
              onEditCategory={openEditCategory}
              onOpenLockSettings={() => setShowLockSettings(true)}
              syncStatus={syncStatus}
            />
          )}

          {/* Bottom tab bar (hidden when in category detail) */}
          {!activeCat && (
            <View style={s.tabBar}>
              {([
                { id: 'home' as Screen,    label: 'หน้าหลัก', icon: '🏠' },
                { id: 'history' as Screen, label: 'ประวัติ',   icon: '📅' },
              ]).map(tab => (
                <TouchableOpacity key={tab.id} onPress={() => setScreen(tab.id)} style={s.tabItem}>
                  <Text style={{ fontSize: 20 }}>{tab.icon}</Text>
                  <Text style={[s.tabLabel, { color: screen === tab.id ? COLORS.accent : COLORS.textDim, fontWeight: screen === tab.id ? '600' : '400' }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <AddItemSheet
          visible={showSheet}
          cats={cats}
          incomeCats={incomeCats}
          editTarget={editTarget}
          onEdit={editItem}
          onEditIncome={editIncome}
          onDelete={deleteItem}
          onDeleteIncome={deleteIncome}
          onClose={closeSheet}
        />

        <AICaptureSheet
          visible={showCapture}
          cats={cats}
          incomeCats={incomeCats}
          onConfirm={confirmAiResult}
          onClose={() => setShowCapture(false)}
        />

        <NoteSheet
          visible={showNoteSheet}
          editTarget={noteEditTarget}
          onSave={saveNote}
          onDelete={deleteNote}
          onClose={closeNoteSheet}
        />

        <BackupSheet
          visible={showBackupSheet}
          data={{ cats, incomeCats, notes }}
          onImport={restoreBackup}
          onClose={() => setShowBackupSheet(false)}
        />

        <CategoryEditSheet
          visible={!!categoryEditTarget}
          target={categoryEditTarget}
          onSave={saveCategoryEdit}
          onDelete={deleteCategory}
          onClose={closeEditCategory}
        />

        <LockSettingsSheet
          visible={showLockSettings}
          biometricSupported={isWebAuthnSupported()}
          biometricEnabled={!!biometricCredentialId}
          lockEnabled={lockEnabled}
          verifyPin={verifyPinForSettings}
          onChangePin={handleChangePin}
          onToggleBiometric={handleToggleBiometric}
          onToggleLockEnabled={handleToggleLockEnabled}
          onClose={() => setShowLockSettings(false)}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
  },
});
