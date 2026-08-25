import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Animated, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { ExpenseCategory, ExpenseItem, IncomeCategory, IncomeItem, fmt, computeAccountBalance } from '../data';
import { COLORS } from '../theme';

interface EditPayload { oldCatId: string; itemId: number; newCatId: string; updated: { desc: string; amt: number; date: string; accountId?: string } }
export interface EditTarget { type: 'expense' | 'income'; catId: string; item: ExpenseItem | IncomeItem }

interface Props {
  visible: boolean;
  cats: ExpenseCategory[];
  incomeCats: IncomeCategory[];
  editTarget: EditTarget | null;
  onEdit: (p: EditPayload) => void;
  onEditIncome: (p: EditPayload) => void;
  onDelete: (catId: string, itemId: number) => void;
  onDeleteIncome: (catId: string, itemId: number) => void;
  onClose: () => void;
}

// แก้ไข/ลบรายการที่บันทึกไว้แล้วเท่านั้น — การเพิ่มรายการใหม่ทำผ่าน AICaptureSheet (AI อ่านสลิป/แปลคำสั่ง) แทน
export default function AddItemSheet({
  visible, cats, incomeCats, editTarget,
  onEdit, onEditIncome, onDelete, onDeleteIncome, onClose,
}: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [catId, setCatId] = useState('food');
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState('May 27');
  // บัญชีที่ใช้จ่าย — บังคับระบุสำหรับรายจ่ายเท่านั้น (รายรับไม่ต้องมี เพราะตัวรายรับเองคือเงินเข้าบัญชี)
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible && editTarget) {
      setSaved(false);
      setType(editTarget.type);
      setCatId(editTarget.catId);
      setDesc(editTarget.item.desc);
      setAmt(String(editTarget.item.amt));
      setDate(editTarget.item.date);
      setAccountId(editTarget.type === 'expense' ? (editTarget.item as ExpenseItem).accountId : undefined);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else if (!visible) {
      slideAnim.setValue(500);
    }
  }, [visible, editTarget]);

  const handleSave = () => {
    if (!editTarget || !desc.trim() || !Number(amt)) return;
    if (type === 'expense' && !accountId) return;
    const updated = { desc, amt: Number(amt), date, ...(type === 'expense' ? { accountId } : {}) };
    const payload: EditPayload = { oldCatId: editTarget.catId, itemId: editTarget.item.id, newCatId: catId, updated };
    if (type === 'income') onEditIncome(payload);
    else onEdit(payload);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  const handleDelete = () => {
    if (!editTarget) return;
    if (type === 'income') onDeleteIncome(editTarget.catId, editTarget.item.id);
    else onDelete(editTarget.catId, editTarget.item.id);
    onClose();
  };

  const valid = desc.trim().length > 0 && Number(amt) > 0 && (type !== 'expense' || !!accountId);
  const activeCats = type === 'income' ? incomeCats : cats;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceAlt }} />
          </View>

          {/* Title */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>แก้ไขรายการ</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textMid }}>✕</Text>
            </TouchableOpacity>
          </View>

          {saved ? (
            <View style={s.successBox}>
              <View style={s.checkCircle}>
                <Text style={{ fontSize: 28 }}>✓</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text }}>บันทึกแล้ว!</Text>
              <Text style={{ fontSize: 13, color: COLORS.textDim }}>แก้ไขรายการเรียบร้อย</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
              {/* Category */}
              <View style={{ gap: 6, marginTop: 4 }}>
                <Text style={s.fieldLabel}>{type === 'income' ? 'ประเภทรายรับ' : 'หมวดหมู่'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {activeCats.map(c => (
                      <TouchableOpacity key={c.id} onPress={() => setCatId(c.id)}
                        style={[s.catChip, {
                          borderColor: catId === c.id ? c.color : COLORS.border,
                          backgroundColor: catId === c.id ? c.color + '18' : COLORS.surface,
                        }]}>
                        <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                        <Text style={{ fontSize: 11, fontWeight: catId === c.id ? '600' : '400', color: catId === c.id ? c.color : COLORS.textMid }}>{c.th}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Description */}
              <View style={{ gap: 6 }}>
                <Text style={s.fieldLabel}>รายละเอียด</Text>
                <TextInput
                  value={desc}
                  onChangeText={setDesc}
                  placeholder="เช่น MK Suki, Grab Food…"
                  placeholderTextColor={COLORS.textDim}
                  style={s.input}
                />
              </View>

              {/* Account (บังคับสำหรับรายจ่าย — ใช้หักเงินออกจากบัญชีที่เลือก) */}
              {type === 'expense' && (
                <View style={{ gap: 6 }}>
                  <Text style={s.fieldLabel}>บัญชีที่ใช้จ่าย *</Text>
                  {incomeCats.length === 0 ? (
                    <Text style={{ fontSize: 12, color: COLORS.textDim }}>ยังไม่มีบัญชีให้เลือก — เพิ่มรายรับเข้าบัญชีก่อน</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 5 }}>
                        {incomeCats.map(acc => {
                          const balance = computeAccountBalance(acc, cats);
                          return (
                            <TouchableOpacity key={acc.id} onPress={() => setAccountId(acc.id)}
                              style={[s.catChip, {
                                borderColor: accountId === acc.id ? acc.color : COLORS.border,
                                backgroundColor: accountId === acc.id ? acc.color + '18' : COLORS.surface,
                              }]}>
                              <Text style={{ fontSize: 13 }}>{acc.icon}</Text>
                              <Text style={{ fontSize: 11, fontWeight: accountId === acc.id ? '600' : '400', color: accountId === acc.id ? acc.color : COLORS.textMid }}>
                                {acc.th} · คงเหลือ {fmt(balance)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  )}
                </View>
              )}

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
                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="May 27"
                    placeholderTextColor={COLORS.textDim}
                    style={s.input}
                  />
                </View>
              </View>

              {/* Save button */}
              <TouchableOpacity onPress={handleSave} disabled={!valid}
                style={[s.saveBtn, { backgroundColor: valid ? (type === 'income' ? COLORS.income : COLORS.accent) : COLORS.border }]}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>บันทึกการแก้ไข</Text>
              </TouchableOpacity>

              {/* Delete button */}
              <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.danger }}>🗑 ลบรายการนี้</Text>
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
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  checkCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#4dcaa3', alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.7 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1.5 },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, fontSize: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.text },
  saveBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  deleteBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 2, borderWidth: 1.5, borderColor: COLORS.danger },
});
