import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Pressable, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Bar from '../components/Bar';
import Donut from '../components/Donut';
import { ExpenseCategory, ExpenseItem, IncomeCategory, IncomeItem, TransferItem, fmt, MONTHS, WEEKLY_EXPENSE, WEEKLY_INCOME, getCurrentBuddhistYear, computeAccountBalance } from '../data';
import { COLORS, SHADOW } from '../theme';

const SORT_LABELS = ['จัดเรียง ↕', 'มาก → น้อย ↓', 'น้อย → มาก ↑', 'เกินงบก่อน ⚠'];
const INC_SORT_LABELS = ['จัดเรียง ↕', 'มาก → น้อย ↓', 'น้อย → มาก ↑'];

interface Props {
  cats: ExpenseCategory[];
  incomeCats: IncomeCategory[];
  transfers: TransferItem[];
  totalSpent: number;
  totalIncome: number;
  onCat: (id: string) => void;
  onAdd: () => void;
  onItemPress: (type: 'expense' | 'income', catId: string, item: ExpenseItem | IncomeItem) => void;
  onClearAll: () => void;
  onBackup: () => void;
  onEditCategory: (type: 'expense' | 'income', catId: string) => void;
  onOpenLockSettings: () => void;
  onOpenTransfer: () => void;
  syncStatus: 'idle' | 'syncing' | 'error';
}

export default function HomeScreen({ cats, incomeCats, transfers, totalSpent, totalIncome, onCat, onAdd, onItemPress, onClearAll, onBackup, onEditCategory, onOpenLockSettings, onOpenTransfer, syncStatus }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'expense' | 'income'>('expense');
  const [mo, setMo] = useState(() => new Date().getMonth()); // เดือนปัจจุบันจริงเป็นค่าเริ่มต้นเสมอ
  // ปิดทุกหมวดหมู่ไว้ก่อนเสมอ — ห้าม default เปิดหมวดใดหมวดหนึ่งไว้ล่วงหน้า (เคยเปิด food/salary ค้างไว้โดยไม่ตั้งใจ)
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [incomeOpen, setIncomeOpen] = useState<Record<string, boolean>>({});
  const [sortMode, setSortMode] = useState(0);
  const [incSortMode, setIncSortMode] = useState(0);

  const topExp = [...cats].sort((a, b) => b.spent - a.spent).slice(0, 5);
  const maxExp = Math.max(...topExp.map(c => c.spent), 1);
  const incTotal = incomeCats.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.amt, 0), 0);
  const maxW = Math.max(...WEEKLY_EXPENSE);
  const maxIW = Math.max(...WEEKLY_INCOME);

  const sortedCats = useMemo(() => {
    if (sortMode === 1) return [...cats].sort((a, b) => b.spent - a.spent);
    if (sortMode === 2) return [...cats].sort((a, b) => a.spent - b.spent);
    if (sortMode === 3) return [...cats].sort((a, b) => (b.spent / b.budget) - (a.spent / a.budget));
    return cats;
  }, [cats, sortMode]);

  const sortedIncCats = useMemo(() => {
    // เรียงตามยอดคงเหลือจริง (หลังหักรายจ่าย/โอนออก บวกโอนเข้า) — ให้ตรงกับตัวเลขที่โชว์ในแต่ละแถว
    const bal = (c: IncomeCategory) => computeAccountBalance(c, cats, transfers);
    if (incSortMode === 1) return [...incomeCats].sort((a, b) => bal(b) - bal(a));
    if (incSortMode === 2) return [...incomeCats].sort((a, b) => bal(a) - bal(b));
    return incomeCats;
  }, [incomeCats, incSortMode, cats, transfers]);

  const weeklyData = view === 'income' ? WEEKLY_INCOME : WEEKLY_EXPENSE;
  const maxWeekly = view === 'income' ? maxIW : maxW;
  const weeklyColor = view === 'income' ? COLORS.income : COLORS.accent;

  const donutCats = view === 'income'
    ? incomeCats.map(c => ({ spent: c.items.reduce((s, i) => s + i.amt, 0), color: c.color, _isIncome: true }))
    : cats;

  const handleClearAll = () => {
    // react-native-web ไม่รองรับ Alert.alert จริง (เป็น no-op) — ต้องใช้ window.confirm บนเว็บแทน
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('ล้างข้อมูลทั้งหมด?\nรายรับ-รายจ่ายที่บันทึกไว้ทั้งหมดจะถูกลบถาวร กู้คืนไม่ได้')) {
        onClearAll();
      }
      return;
    }
    Alert.alert(
      'ล้างข้อมูลทั้งหมด?',
      'รายรับ-รายจ่ายที่บันทึกไว้ทั้งหมดจะถูกลบถาวร กู้คืนไม่ได้',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ล้างข้อมูล', style: 'destructive', onPress: onClearAll },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* HERO */}
      <View style={{ backgroundColor: COLORS.hero, paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 14 }}>
        {/* ล้างข้อมูลทั้งหมด */}
        <TouchableOpacity onPress={handleClearAll} hitSlop={10} style={[s.clearBtn, { top: insets.top + 4 }]}>
          <Text style={{ fontSize: 14 }}>🗑</Text>
        </TouchableOpacity>

        {/* สำรอง/กู้คืนข้อมูล — ย้ายข้อมูลข้ามลิงก์เมื่อ URL เปลี่ยน */}
        <TouchableOpacity onPress={onBackup} hitSlop={10} style={[s.clearBtn, { top: insets.top + 4, right: 52 }]}>
          <Text style={{ fontSize: 14 }}>💾</Text>
        </TouchableOpacity>

        {/* ตั้งค่าล็อกแอป (รหัสผ่าน + Face ID/Touch ID) */}
        <TouchableOpacity onPress={onOpenLockSettings} hitSlop={10} style={[s.clearBtn, { top: insets.top + 4, right: 88 }]}>
          <Text style={{ fontSize: 14 }}>🔒</Text>
        </TouchableOpacity>

        {/* โอนเงินระหว่างบัญชี */}
        <TouchableOpacity onPress={onOpenTransfer} hitSlop={10} style={[s.clearBtn, { top: insets.top + 4, right: 124 }]}>
          <Text style={{ fontSize: 14 }}>🔁</Text>
        </TouchableOpacity>

        {/* Month switcher */}
        <View style={s.monthRow}>
          <TouchableOpacity onPress={() => setMo(m => Math.max(0, m - 1))} hitSlop={12}>
            <Text style={s.chevron}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTHS[mo]} {getCurrentBuddhistYear()}</Text>
          <TouchableOpacity onPress={() => setMo(m => Math.min(11, m + 1))} hitSlop={12}>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Donut + balance */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Donut cats={donutCats} size={78} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={s.netLabel}>คงเหลือสุทธิ</Text>
              {syncStatus === 'syncing' && <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>☁ กำลังซิงค์...</Text>}
              {syncStatus === 'error' && <Text style={{ fontSize: 10, color: COLORS.danger }}>☁ ซิงค์ไม่สำเร็จ</Text>}
            </View>
            <Text style={s.netAmount}>{fmt(totalIncome - totalSpent)}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 4 }}>
              <Text style={{ fontSize: 11, color: '#6ee7b7', fontWeight: '500' }}>↑ {fmt(totalIncome)}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,140,140,0.85)', fontWeight: '500' }}>↓ {fmt(totalSpent)}</Text>
            </View>
            <Bar pct={totalSpent / Math.max(totalIncome, 1) * 100} color={COLORS.accent} h={5} bg="rgba(255,255,255,0.12)" />
          </View>
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 5, paddingBottom: 3 }}>
            {(view === 'income' ? incomeCats : cats).map(c => (
              <TouchableOpacity key={c.id} onPress={() => view === 'expense' && onCat(c.id)}
                style={s.chip}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.color }} />
                <Text style={s.chipText}>{c.th}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Weekly bar chart */}
        <View style={s.weeklyBox}>
          <Text style={s.weeklyLabel}>
            {view === 'income' ? 'รายรับรายสัปดาห์' : 'รายจ่ายรายสัปดาห์'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-end', height: 32, marginTop: 5 }}>
            {weeklyData.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                <View style={{
                  width: '100%',
                  height: v > 0 ? Math.max((v / maxWeekly) * 24, 3) : 2,
                  borderRadius: 2,
                  backgroundColor: v > 0 ? weeklyColor : 'rgba(255,255,255,0.1)',
                }} />
                <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>W{i + 1}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* VIEW TABS */}
      <View style={s.tabs}>
        {(['expense', 'income'] as const).map(v => (
          <TouchableOpacity key={v} onPress={() => setView(v)} style={[s.tab, view === v && { borderBottomColor: v === 'income' ? COLORS.income : COLORS.accent, borderBottomWidth: 2.5 }]}>
            <Text style={[s.tabText, { color: view === v ? (v === 'income' ? COLORS.income : COLORS.accent) : COLORS.textDim, fontWeight: view === v ? '600' : '400' }]}>
              {v === 'expense' ? '💸 รายจ่าย' : '💰 รายรับ'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CONTENT */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {view === 'expense' ? (
          <>
            {/* Top 5 chart */}
            <View style={[s.card, { margin: 0, borderRadius: 0, borderBottomWidth: 1, borderColor: COLORS.border }]}>
              <Text style={s.sectionLabel}>สัดส่วนรายจ่าย (Top 5)</Text>
              {topExp.map(cat => (
                <View key={cat.id} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ fontSize: 12, color: COLORS.text }}>{cat.icon} {cat.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: cat.color }}>{fmt(cat.spent)}</Text>
                      <Text style={{ fontSize: 10, color: COLORS.textDim }}>{totalSpent > 0 ? Math.round(cat.spent / totalSpent * 100) : 0}%</Text>
                    </View>
                  </View>
                  <Bar pct={cat.spent / maxExp * 100} color={cat.color} bg={COLORS.surfaceAlt} h={6} />
                </View>
              ))}
            </View>

            {/* Sort header */}
            <View style={s.sortRow}>
              <Text style={s.sortTitle}>หมวดหมู่</Text>
              <TouchableOpacity onPress={() => setSortMode(m => (m + 1) % SORT_LABELS.length)}>
                <Text style={{ fontSize: 12, color: sortMode > 0 ? COLORS.accent : COLORS.textDim, fontWeight: sortMode > 0 ? '600' : '400' }}>
                  {SORT_LABELS[sortMode]}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Category list */}
            {sortedCats.map(cat => {
              const pct = cat.spent / cat.budget * 100;
              const over = cat.spent > cat.budget;
              const isOpen = !!open[cat.id];
              return (
                <View key={cat.id}>
                  <TouchableOpacity onPress={() => setOpen(o => ({ ...o, [cat.id]: !o[cat.id] }))}
                    style={[s.catRow, { borderBottomWidth: 1, borderColor: COLORS.border }]}>
                    <TouchableOpacity onPress={() => onEditCategory('expense', cat.id)} style={[s.catIcon, { backgroundColor: cat.color + '20' }]}>
                      <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Text style={s.catName}>{cat.name}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: over ? COLORS.danger : COLORS.text }}>{fmt(cat.spent)}</Text>
                      </View>
                      <View style={{ marginTop: 3 }}>
                        <Text style={s.catSub}>{cat.count} รายการ</Text>
                      </View>
                      <View style={{ marginTop: 5 }}>
                        <Bar pct={pct} color={over ? COLORS.danger : cat.color} bg={COLORS.surfaceAlt} />
                      </View>
                    </View>
                    <Text style={{ fontSize: 10, color: COLORS.textDim, marginLeft: 6, transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>▼</Text>
                  </TouchableOpacity>

                  {isOpen && (
                    <>
                      {cat.items.map(item => (
                        <TouchableOpacity key={item.id} style={[s.itemRow, { borderLeftColor: cat.color }]} onPress={() => onItemPress('expense', cat.id, item)}>
                          <View style={[s.receiptIcon, { backgroundColor: item.receipt ? cat.color + '15' : COLORS.surfaceAlt, borderColor: item.receipt ? cat.color + '35' : COLORS.border }]}>
                            <Text style={{ fontSize: 16 }}>{item.receipt ? '🧾' : '—'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.text }}>{item.desc}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.textDim, marginTop: 1 }}>{item.date}</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>{fmt(item.amt)}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity onPress={() => onCat(cat.id)}
                        style={{ backgroundColor: COLORS.bg, borderBottomWidth: 1, borderColor: COLORS.border, padding: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: COLORS.accent, fontWeight: '500' }}>ดูทั้งหมด {cat.count} รายการ →</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}

            {/* Total card */}
            <View style={[s.totalCard, { backgroundColor: COLORS.hero }]}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>ยอดรวมรายจ่าย</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{fmt(totalSpent)}</Text>
            </View>
          </>
        ) : (
          <>
            {/* Income breakdown */}
            <View style={[s.card, { margin: 0, borderRadius: 0, borderBottomWidth: 1, borderColor: COLORS.border }]}>
              <Text style={s.sectionLabel}>สัดส่วนรายรับ</Text>
              {incomeCats.map(cat => {
                const amt = cat.items.reduce((s, i) => s + i.amt, 0);
                const pct = incTotal > 0 ? (amt / incTotal) * 100 : 0;
                return (
                  <View key={cat.id} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: COLORS.text }}>{cat.icon} {cat.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: cat.color }}>{fmt(amt)}</Text>
                        <Text style={{ fontSize: 10, color: COLORS.textDim }}>{Math.round(pct)}%</Text>
                      </View>
                    </View>
                    <Bar pct={pct} color={cat.color} bg={COLORS.surfaceAlt} h={6} />
                  </View>
                );
              })}
            </View>

            {/* Sort header */}
            <View style={s.sortRow}>
              <Text style={s.sortTitle}>แหล่งรายรับ</Text>
              <TouchableOpacity onPress={() => setIncSortMode(m => (m + 1) % INC_SORT_LABELS.length)}>
                <Text style={{ fontSize: 12, color: incSortMode > 0 ? COLORS.income : COLORS.textDim, fontWeight: incSortMode > 0 ? '600' : '400' }}>
                  {INC_SORT_LABELS[incSortMode]}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Income category list — ยอดที่โชว์ในแถวคือ "ยอดคงเหลือจริง" ของบัญชีนั้น
                (เงินรับเข้าทั้งหมด หักรายจ่าย/โอนออก บวกโอนเข้า) ไม่ใช่แค่ยอดรับดิบ */}
            {sortedIncCats.map(cat => {
              const balance = computeAccountBalance(cat, cats, transfers);
              const isOpen = !!incomeOpen[cat.id];
              return (
                <View key={cat.id}>
                  <TouchableOpacity onPress={() => setIncomeOpen(o => ({ ...o, [cat.id]: !o[cat.id] }))}
                    style={[s.catRow, { borderBottomWidth: 1, borderColor: COLORS.border }]}>
                    <TouchableOpacity onPress={() => onEditCategory('income', cat.id)} style={[s.catIcon, { backgroundColor: cat.color + '20' }]}>
                      <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Text style={s.catName}>{cat.name}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: balance < 0 ? COLORS.danger : cat.color }}>
                          {balance < 0 ? '-' : '+'}{fmt(Math.abs(balance))}
                        </Text>
                      </View>
                      <Text style={s.catSub}>{cat.items.length} รายการ</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: COLORS.textDim, marginLeft: 6, transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>▼</Text>
                  </TouchableOpacity>
                  {isOpen && cat.items.map(item => (
                    <TouchableOpacity key={item.id} style={[s.itemRow, { borderLeftColor: cat.color }]} onPress={() => onItemPress('income', cat.id, item)}>
                      <View style={[s.receiptIcon, { backgroundColor: cat.color + '15', borderColor: cat.color + '35' }]}>
                        <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.text }}>{item.desc}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.textDim, marginTop: 1 }}>{item.date}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: cat.color }}>+{fmt(item.amt)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}

            <View style={[s.totalCard, { backgroundColor: COLORS.income }]}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>รายรับทั้งหมด</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>+{fmt(totalIncome)}</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={onAdd} style={s.fab}>
        <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  clearBtn: { position: 'absolute', right: 16, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  chevron: { fontSize: 22, color: 'rgba(255,255,255,0.35)', paddingHorizontal: 6 },
  monthLabel: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.65)' },
  netLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.7, textTransform: 'uppercase', fontWeight: '500' },
  netAmount: { fontSize: 26, fontWeight: '700', color: '#fff', lineHeight: 30 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingVertical: 3, paddingLeft: 6, paddingRight: 9 },
  chipText: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  weeklyBox: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, paddingBottom: 5 },
  weeklyLabel: { fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13 },
  card: { backgroundColor: COLORS.surface, padding: 12 },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.bg, borderBottomWidth: 1, borderColor: COLORS.border },
  sortTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, paddingHorizontal: 16, backgroundColor: COLORS.surface },
  catIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  catSub: { fontSize: 11, color: COLORS.textDim },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingRight: 16, paddingLeft: 13, backgroundColor: COLORS.bg, borderBottomWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3 },
  receiptIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  totalCard: { margin: 12, borderRadius: 12, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 16, width: 50, height: 50, borderRadius: 16, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
});
