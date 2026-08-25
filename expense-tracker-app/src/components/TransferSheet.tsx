import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Animated, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { ExpenseCategory, IncomeCategory, TransferItem, fmt, MONTHS_SHORT, computeAccountBalance } from '../data';
import { COLORS } from '../theme';

export interface TransferPayload { fromAccountId: string; toAccountId: string; amt: number; date: string; note: string }

interface Props {
  visible: boolean;
  cats: ExpenseCategory[];
  incomeCats: IncomeCategory[]; // ใช้เป็น "บัญชี" ในแอปนี้
  transfers: TransferItem[];
  onTransfer: (payload: TransferPayload) => void;
  onDeleteTransfer: (id: number) => void;
  onClose: () => void;
}

const todayShort = (): string => {
  const d = new Date();
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

// โอนเงินระหว่างบัญชี (= ระหว่าง IncomeCategory สองช่อง) — ไม่กระทบยอดรายรับ/รายจ่ายรวม
// เพราะไม่ใช่เงินเข้า-ออกจากระบบจริง แค่ย้ายเงินของตัวเองระหว่างบัญชี (ดู computeAccountBalance ใน src/data/index.ts)
export default function TransferSheet({ visible, cats, incomeCats, transfers, onTransfer, onDeleteTransfer, onClose }: Props) {
  const [fromId, setFromId] = useState<string | undefined>(undefined);
  const [toId, setToId] = useState<string | undefined>(undefined);
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState(todayShort());
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      setSaved(false);
      setFromId(undefined);
      setToId(undefined);
      setAmt('');
      setDate(todayShort());
      setNote('');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible]);

  const fromAccount = incomeCats.find(a => a.id === fromId);
  const fromBalance = fromAccount ? computeAccountBalance(fromAccount, cats, transfers) : 0;
  const valid = !!fromId && !!toId && fromId !== toId && Number(amt) > 0;

  const handleSave = () => {
    if (!valid || !fromId || !toId) return;
    onTransfer({ fromAccountId: fromId, toAccountId: toId, amt: Number(amt), date, note: note.trim() });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setFromId(undefined);
      setToId(undefined);
      setAmt('');
      setNote('');
    }, 900);
  };

  const accountLabel = (id: string) => {
    const a = incomeCats.find(x => x.id === id);
    return a ? `${a.icon} ${a.th}` : id;
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>โอนเงินระหว่างบัญชี</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textMid }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
            {incomeCats.length < 2 ? (
              <Text style={{ fontSize: 12, color: COLORS.textDim, textAlign: 'center', paddingVertical: 24 }}>
                ต้องมีอย่างน้อย 2 บัญชีถึงจะโอนเงินระหว่างกันได้
              </Text>
            ) : saved ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}>
                <View style={s.checkCircle}><Text style={{ fontSize: 24 }}>✓</Text></View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>โอนเงินแล้ว!</Text>
              </View>
            ) : (
              <>
                {/* From */}
                <View style={{ gap: 6, marginTop: 4 }}>
                  <Text style={s.fieldLabel}>จากบัญชี</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      {incomeCats.map(a => {
                        const bal = computeAccountBalance(a, cats, transfers);
                        return (
                          <TouchableOpacity key={a.id} onPress={() => setFromId(a.id)}
                            style={[s.chip, {
                              borderColor: fromId === a.id ? a.color : COLORS.border,
                              backgroundColor: fromId === a.id ? a.color + '18' : COLORS.surface,
                            }]}>
                            <Text style={{ fontSize: 13 }}>{a.icon}</Text>
                            <Text style={{ fontSize: 11, fontWeight: fromId === a.id ? '600' : '400', color: fromId === a.id ? a.color : COLORS.textMid }}>
                              {a.th} · {fmt(bal)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* To */}
                <View style={{ gap: 6 }}>
                  <Text style={s.fieldLabel}>ไปบัญชี</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      {incomeCats.filter(a => a.id !== fromId).map(a => (
                        <TouchableOpacity key={a.id} onPress={() => setToId(a.id)}
                          style={[s.chip, {
                            borderColor: toId === a.id ? a.color : COLORS.border,
                            backgroundColor: toId === a.id ? a.color + '18' : COLORS.surface,
                          }]}>
                          <Text style={{ fontSize: 13 }}>{a.icon}</Text>
                          <Text style={{ fontSize: 11, fontWeight: toId === a.id ? '600' : '400', color: toId === a.id ? a.color : COLORS.textMid }}>{a.th}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  {!fromId && <Text style={{ fontSize: 11, color: COLORS.textDim }}>เลือก "จากบัญชี" ก่อน</Text>}
                </View>

                {/* Amount + Date */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1.4, gap: 6 }}>
                    <Text style={s.fieldLabel}>จำนวนเงิน (฿)</Text>
                    <TextInput
                      value={amt}
                      onChangeText={v => setAmt(v.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={COLORS.textDim}
                      keyboardType="decimal-pad"
                      style={s.input}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={s.fieldLabel}>วันที่</Text>
                    <TextInput value={date} onChangeText={setDate} placeholderTextColor={COLORS.textDim} style={s.input} />
                  </View>
                </View>
                {fromAccount && Number(amt) > fromBalance && (
                  <Text style={{ fontSize: 11, color: COLORS.danger, marginTop: -8 }}>
                    ⚠ จำนวนนี้มากกว่ายอดคงเหลือใน {fromAccount.th} ({fmt(fromBalance)}) — ยังบันทึกได้ แต่บัญชีจะติดลบ
                  </Text>
                )}

                {/* Note */}
                <View style={{ gap: 6 }}>
                  <Text style={s.fieldLabel}>บันทึกเพิ่มเติม (ไม่บังคับ)</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="เช่น เติมเงินเข้ากระเป๋าใช้จ่ายรายวัน"
                    placeholderTextColor={COLORS.textDim}
                    style={s.input}
                  />
                </View>

                <TouchableOpacity onPress={handleSave} disabled={!valid}
                  style={[s.saveBtn, { backgroundColor: valid ? COLORS.accent : COLORS.border }]}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>โอนเงิน</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ประวัติการโอนล่าสุด */}
            {transfers.length > 0 && (
              <View style={{ marginTop: 8, gap: 4 }}>
                <Text style={s.fieldLabel}>ประวัติการโอนล่าสุด</Text>
                {transfers.slice(0, 20).map(t => (
                  <View key={t.id} style={s.historyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.text }}>
                        {accountLabel(t.fromAccountId)} → {accountLabel(t.toAccountId)}
                      </Text>
                      <Text style={{ fontSize: 10, color: COLORS.textDim, marginTop: 1 }}>
                        {t.date}{t.note ? ` · ${t.note}` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text, marginRight: 8 }}>{fmt(t.amt)}</Text>
                    <TouchableOpacity onPress={() => onDeleteTransfer(t.id)} hitSlop={8}>
                      <Text style={{ fontSize: 12, color: COLORS.danger }}>ลบ</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  checkCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#4dcaa3', alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1.5 },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, fontSize: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.text },
  saveBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 2 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.border },
});
