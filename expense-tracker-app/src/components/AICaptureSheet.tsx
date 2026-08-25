import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Animated, KeyboardAvoidingView, Platform, Pressable,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ExpenseCategory, IncomeCategory, fmt, computeAccountBalance } from '../data';
import { COLORS } from '../theme';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET ?? '';

type Confidence = 'high' | 'medium' | 'low';

interface AiResult {
  kind: 'expense' | 'income';
  categoryId: string;
  isNewCategory: boolean;
  categoryLabel: string;
  categoryIcon: string;
  desc: string;
  amount: number;
  date: string;
  confidence: Confidence;
}

export interface AiConfirmPayload {
  type: 'expense' | 'income';
  catId: string;
  // ใส่มาก็ต่อเมื่อ catId ยังไม่มีอยู่จริง — ให้ App.tsx สร้างหมวดหมู่ใหม่นี้ก่อนบันทึกรายการ
  newCategory?: { label: string; icon: string };
  item: { desc: string; amt: number; date: string; receipt: boolean; accountId?: string };
}

// รายการที่กำลังแก้ไขอยู่ในหน้ายืนยัน — รองรับหลายรายการต่อ 1 คำสั่ง/สลิป
interface EditableItem {
  key: string;
  type: 'expense' | 'income';
  catId: string; // หมวดที่เลือกอยู่ตอนนี้ (อาจเป็นหมวดเดิม หรือหมวดใหม่ที่ AI เสนอ)
  desc: string;
  amt: string;
  date: string;
  confidence: Confidence;
  // หมวดใหม่ที่ AI เสนอไว้ (เก็บแยกจาก catId เพื่อให้สลับกลับไปเลือกหมวดใหม่นี้ได้แม้ผู้ใช้จะกดเลือกหมวดเดิมไปแล้ว)
  aiIsNewCategory: boolean;
  aiCategoryId: string;
  aiCategoryLabel: string;
  aiCategoryIcon: string;
  // บัญชีที่ใช้จ่าย — บังคับเลือกก่อนบันทึกได้เฉพาะรายการที่ type === 'expense'
  accountId?: string;
}

type Step = 'choose' | 'text-input' | 'loading' | 'confirm' | 'error';

interface Props {
  visible: boolean;
  cats: ExpenseCategory[];
  incomeCats: IncomeCategory[];
  onConfirm: (payload: AiConfirmPayload) => void;
  onClose: () => void;
}

export default function AICaptureSheet({ visible, cats, incomeCats, onConfirm, onClose }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [fromImage, setFromImage] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);

  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      reset();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible]);

  const reset = () => {
    setStep('choose');
    setFromImage(false);
    setTextInput('');
    setErrorMsg('');
    setItems([]);
  };

  const applyAiResults = (results: AiResult[], viaImage: boolean) => {
    setFromImage(viaImage);
    setItems(results.map((r, i) => ({
      key: `${Date.now()}_${i}`,
      type: r.kind,
      catId: r.categoryId,
      desc: r.desc,
      amt: String(r.amount),
      date: r.date,
      confidence: r.confidence,
      aiIsNewCategory: r.isNewCategory,
      aiCategoryId: r.categoryId,
      aiCategoryLabel: r.categoryLabel,
      aiCategoryIcon: r.categoryIcon,
    })));
    setStep('confirm');
  };

  const updateItem = (key: string, patch: Partial<EditableItem>) => {
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it));
  };

  const removeItem = (key: string) => {
    setItems(prev => prev.filter(it => it.key !== key));
  };

  const callBackend = async (body: Record<string, unknown>, viaImage: boolean) => {
    setStep('loading');
    try {
      if (!API_BASE_URL) throw new Error('ยังไม่ได้ตั้งค่า EXPO_PUBLIC_API_BASE_URL');
      const res = await fetch(`${API_BASE_URL}/api/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-secret': APP_SECRET },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'AI อ่านข้อมูลไม่สำเร็จ');
      const results = (Array.isArray(json) ? json : [json]) as AiResult[];
      if (results.length === 0) throw new Error('AI ไม่พบรายการที่แยกได้');
      applyAiResults(results, viaImage);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setStep('error');
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg('ต้องอนุญาตเข้าถึงรูปภาพก่อนถึงจะแนบสลิปได้');
      setStep('error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    await callBackend({ mode: 'image', imageBase64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' }, true);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg('ต้องอนุญาตใช้กล้องก่อนถึงจะถ่ายสลิปได้');
      setStep('error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    await callBackend({ mode: 'image', imageBase64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' }, true);
  };

  const submitText = async () => {
    if (!textInput.trim()) return;
    await callBackend({ mode: 'text', text: textInput.trim() }, false);
  };

  const allValid = items.length > 0 && items.every(it =>
    it.desc.trim().length > 0 && Number(it.amt) > 0 && (it.type !== 'expense' || !!it.accountId)
  );

  const handleConfirmAll = () => {
    if (!allValid) return;
    items.forEach(it => {
      const usingNewCategory = it.aiIsNewCategory && it.catId === it.aiCategoryId;
      onConfirm({
        type: it.type,
        catId: it.catId,
        newCategory: usingNewCategory ? { label: it.aiCategoryLabel, icon: it.aiCategoryIcon } : undefined,
        item: { desc: it.desc.trim(), amt: Number(it.amt), date: it.date, receipt: fromImage, accountId: it.type === 'expense' ? it.accountId : undefined },
      });
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceAlt }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
              {step === 'confirm' ? `ยืนยันรายการ (${items.length})` : 'เพิ่มรายการด้วย AI'}
            </Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textMid }}>✕</Text>
            </TouchableOpacity>
          </View>

          {step === 'choose' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}>
              <TouchableOpacity style={s.bigOption} onPress={takePhoto}>
                <Text style={{ fontSize: 22 }}>📷</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.bigOptionTitle}>ถ่ายรูปสลิป</Text>
                  <Text style={s.bigOptionSub}>อ่านได้ทั้งใบเสร็จหลายรายการในรูปเดียว</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.bigOption} onPress={pickFromLibrary}>
                <Text style={{ fontSize: 22 }}>🖼️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.bigOptionTitle}>แนบรูปสลิปจากคลัง</Text>
                  <Text style={s.bigOptionSub}>เลือกรูปที่ถ่ายไว้แล้ว</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.bigOption} onPress={() => setStep('text-input')}>
                <Text style={{ fontSize: 22 }}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.bigOptionTitle}>พิมพ์บอก AI</Text>
                  <Text style={s.bigOptionSub}>สั่งได้หลายรายการพร้อมกัน เช่น "กาแฟ 60 บาท กับ BTS 45 บาท"</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {step === 'text-input' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
              <Text style={s.fieldLabel}>บอก AI ว่าเกิดอะไรขึ้น (พิมพ์หลายรายการพร้อมกันได้)</Text>
              <TextInput
                value={textInput}
                onChangeText={setTextInput}
                placeholder='เช่น "จ่ายค่ากาแฟ 50 บาท กับค่า BTS 40 บาท" หรือพิมพ์เป็นรายการหลายบรรทัด'
                placeholderTextColor={COLORS.textDim}
                style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]}
                multiline
                autoFocus
              />
              <TouchableOpacity onPress={submitText} disabled={!textInput.trim()}
                style={[s.saveBtn, { backgroundColor: textInput.trim() ? COLORS.accent : COLORS.border }]}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>ให้ AI แปลงเป็นรายการ</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'loading' && (
            <View style={s.centerBox}>
              <ActivityIndicator size="large" color={COLORS.accent} />
              <Text style={{ fontSize: 13, color: COLORS.textDim, marginTop: 12 }}>AI กำลังอ่านข้อมูล...</Text>
            </View>
          )}

          {step === 'error' && (
            <View style={s.centerBox}>
              <Text style={{ fontSize: 28 }}>⚠️</Text>
              <Text style={{ fontSize: 14, color: COLORS.text, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>{errorMsg}</Text>
              <TouchableOpacity onPress={reset} style={[s.saveBtn, { backgroundColor: COLORS.accent, marginTop: 16, paddingHorizontal: 24 }]}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>ลองใหม่</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'confirm' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
              {items.length === 0 && (
                <Text style={{ fontSize: 13, color: COLORS.textDim, textAlign: 'center', paddingVertical: 24 }}>
                  ไม่เหลือรายการแล้ว
                </Text>
              )}

              {items.map((it, idx) => {
                const activeCats = it.type === 'income' ? incomeCats : cats;
                return (
                  <View key={it.key} style={s.itemCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMid }}>
                        รายการที่ {idx + 1} · {it.type === 'income' ? '💰 รายรับ' : '💸 รายจ่าย'}
                      </Text>
                      <TouchableOpacity onPress={() => removeItem(it.key)} hitSlop={8}>
                        <Text style={{ fontSize: 12, color: COLORS.danger, fontWeight: '600' }}>ลบ ✕</Text>
                      </TouchableOpacity>
                    </View>

                    {it.confidence !== 'high' && (
                      <View style={[s.warnBox, { marginBottom: 8 }]}>
                        <Text style={{ fontSize: 11, color: COLORS.danger, fontWeight: '600' }}>
                          ⚠ AI ไม่ค่อยมั่นใจกับรายการนี้ กรุณาตรวจสอบ
                        </Text>
                      </View>
                    )}

                    <View style={{ gap: 6, marginBottom: 10 }}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          {it.aiIsNewCategory && (
                            <TouchableOpacity onPress={() => updateItem(it.key, { catId: it.aiCategoryId })}
                              style={[s.catChip, {
                                borderColor: it.catId === it.aiCategoryId ? COLORS.accent : COLORS.border,
                                backgroundColor: it.catId === it.aiCategoryId ? COLORS.accent + '18' : COLORS.surface,
                              }]}>
                              <Text style={{ fontSize: 13 }}>{it.aiCategoryIcon}</Text>
                              <Text style={{ fontSize: 11, fontWeight: it.catId === it.aiCategoryId ? '600' : '400', color: it.catId === it.aiCategoryId ? COLORS.accent : COLORS.textMid }}>
                                {it.aiCategoryLabel} ✨ใหม่
                              </Text>
                            </TouchableOpacity>
                          )}
                          {activeCats.map(c => (
                            <TouchableOpacity key={c.id} onPress={() => updateItem(it.key, { catId: c.id })}
                              style={[s.catChip, {
                                borderColor: it.catId === c.id ? c.color : COLORS.border,
                                backgroundColor: it.catId === c.id ? c.color + '18' : COLORS.surface,
                              }]}>
                              <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                              <Text style={{ fontSize: 11, fontWeight: it.catId === c.id ? '600' : '400', color: it.catId === c.id ? c.color : COLORS.textMid }}>{c.th}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>

                    <View style={{ gap: 6, marginBottom: 10 }}>
                      <TextInput
                        value={it.desc}
                        onChangeText={v => updateItem(it.key, { desc: v })}
                        placeholder="รายละเอียด"
                        placeholderTextColor={COLORS.textDim}
                        style={s.input}
                      />
                    </View>

                    {/* บัญชีที่ใช้จ่าย — บังคับระบุก่อนบันทึกได้ ใช้หักเงินออกจากบัญชีนั้น */}
                    {it.type === 'expense' && (
                      <View style={{ gap: 6, marginBottom: 10 }}>
                        <Text style={s.fieldLabel}>บัญชีที่ใช้จ่าย *</Text>
                        {incomeCats.length === 0 ? (
                          <Text style={{ fontSize: 12, color: COLORS.textDim }}>ยังไม่มีบัญชีให้เลือก — เพิ่มรายรับเข้าบัญชีก่อน</Text>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: 5 }}>
                              {incomeCats.map(acc => {
                                const balance = computeAccountBalance(acc, cats);
                                return (
                                  <TouchableOpacity key={acc.id} onPress={() => updateItem(it.key, { accountId: acc.id })}
                                    style={[s.catChip, {
                                      borderColor: it.accountId === acc.id ? acc.color : COLORS.border,
                                      backgroundColor: it.accountId === acc.id ? acc.color + '18' : COLORS.surface,
                                    }]}>
                                    <Text style={{ fontSize: 13 }}>{acc.icon}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: it.accountId === acc.id ? '600' : '400', color: it.accountId === acc.id ? acc.color : COLORS.textMid }}>
                                      {acc.th} · คงเหลือ {fmt(balance)}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </ScrollView>
                        )}
                        {!it.accountId && (
                          <Text style={{ fontSize: 11, color: COLORS.danger }}>⚠ ต้องเลือกบัญชีที่ใช้จ่ายก่อนบันทึก</Text>
                        )}
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1.4, gap: 6 }}>
                        <Text style={s.fieldLabel}>จำนวนเงิน (฿)</Text>
                        <TextInput
                          value={it.amt}
                          onChangeText={v => updateItem(it.key, { amt: v.replace(/[^0-9.]/g, '') })}
                          keyboardType="decimal-pad"
                          placeholderTextColor={COLORS.textDim}
                          style={s.input}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={s.fieldLabel}>วันที่</Text>
                        <TextInput
                          value={it.date}
                          onChangeText={v => updateItem(it.key, { date: v })}
                          placeholderTextColor={COLORS.textDim}
                          style={s.input}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity onPress={handleConfirmAll} disabled={!allValid}
                style={[s.saveBtn, { backgroundColor: allValid ? COLORS.accent : COLORS.border }]}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  ยืนยันบันทึกทั้งหมด{items.length > 0 ? ` (${items.length} รายการ)` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={reset} style={s.deleteBtn}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.textMid }}>ลองใหม่</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  bigOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  bigOptionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  bigOptionSub: { fontSize: 11, color: COLORS.textDim, marginTop: 2 },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  warnBox: { backgroundColor: COLORS.danger + '15', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: COLORS.danger + '40' },
  itemCard: { backgroundColor: COLORS.bg, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, padding: 12 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.7 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1.5 },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, fontSize: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text },
  saveBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  deleteBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 2, borderWidth: 1.5, borderColor: COLORS.border },
});
