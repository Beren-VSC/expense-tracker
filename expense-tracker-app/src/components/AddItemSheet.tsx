import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Animated, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { ExpenseCategory, ExpenseItem, IncomeCategory, IncomeItem, fmt } from '../data';
import { COLORS } from '../theme';

interface AddPayload { catId: string; item: { id: number; desc: string; amt: number; date: string; receipt: boolean } }
interface EditPayload { oldCatId: string; itemId: number; newCatId: string; updated: { desc: string; amt: number; date: string } }
export interface EditTarget { type: 'expense' | 'income'; catId: string; item: ExpenseItem | IncomeItem }

interface Props {
  visible: boolean;
  cats: ExpenseCategory[];
  incomeCats: IncomeCategory[];
  editTarget?: EditTarget | null;
  onAdd: (p: AddPayload) => void;
  onAddIncome: (p: AddPayload) => void;
  onEdit: (p: EditPayload) => void;
  onEditIncome: (p: EditPayload) => void;
  onDelete: (catId: string, itemId: number) => void;
  onDeleteIncome: (catId: string, itemId: number) => void;
  onClose: () => void;
}

export default function AddItemSheet({
  visible, cats, incomeCats, editTarget,
  onAdd, onAddIncome, onEdit, onEditIncome, onDelete, onDeleteIncome, onClose,
}: Props) {
  const isEdit = !!editTarget;
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [catId, setCatId] = useState('food');
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState('May 27');
  const [saved, setSaved] = useState(false);

  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      setSaved(false);
      if (editTarget) {
        setType(editTarget.type);
        setCatId(editTarget.catId);
        setDesc(editTarget.item.desc);
        setAmt(String(editTarget.item.amt));
        setDate(editTarget.item.date);
      } else {
        setType('expense');
        setCatId('food');
        setDesc('');
        setAmt('');
      }
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible, editTarget]);

  const switchType = (t: 'expense' | 'income') => {
    if (isEdit) return; // ไม่ให้สลับ expense/income ระหว่างแก้ไข
    setType(t);
    setCatId(t === 'income' ? 'salary' : 'food');
    setDesc(''); setAmt('');
  };

  const handleSave = () => {
    if (!desc.trim() || !Number(amt)) return;
    if (isEdit && editTarget) {
      const updated = { desc, amt: Number(amt), date };
      const payload: EditPayload = { oldCatId: editTarget.catId, itemId: editTarget.item.id, newCatId: catId, updated };
      if (type === 'income') onEditIncome(payload);
      else onEdit(payload);
    } else {
      const item = { id: Date.now(), desc, amt: Number(amt), date, receipt: false };
      if (type === 'income') onAddIncome({ catId, item });
      else onAdd({ catId, item });
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  const handleDelete = () => {
    if (!editTarget) return;
    if (type === 'income') onDeleteIncome(editTarget.catId, editTarget.item.id);
    else onDelete(editTarget.catId, editTarget.item.id);
    onClose();
  };

  const valid = desc.trim().length > 0 && Number(amt) > 0;
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>{isEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการ'}</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textMid }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Type toggle */}
          <View style={[s.toggle, isEdit && { opacity: 0.5 }]}>
            {(['expense', 'income'] as const).map(t => (
              <TouchableOpacity key={t} disabled={isEdit} onPress={() => switchType(t)} style={[s.toggleBtn, type === t && {
                backgroundColor: COLORS.surface,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2
              }]}>
                <Text style={{ fontSize: 13, fontWeight: type === t ? '600' : '400', color: type === t ? (t === 'income' ? COLORS.income : COLORS.accent) : COLORS.textDim }}>
                  {t === 'expense' ? '💸 รายจ่าย' : '💰 รายรับ'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {saved ? (
            <View style={s.successBox}>
              <View style={s.checkCircle}>
                <Text style={{ fontSize: 28 }}>✓</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text }}>บันทึกแล้ว!</Text>
              <Text style={{ fontSize: 13, color: COLORS.textDim }}>{isEdit ? 'แก้ไขรายการเรียบร้อย' : 'รายการถูกเพิ่มเรียบร้อย'}</Text>
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
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  {isEdit ? 'บันทึกการแก้ไข' : (type === 'income' ? 'บันทึกรายรับ' : 'บันทึกรายจ่าย')}
                </Text>
              </TouchableOpacity>

              {/* Delete button (edit mode only) */}
              {isEdit && (
                <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.danger }}>🗑 ลบรายการนี้</Text>
                </TouchableOpacity>
              )}
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
  toggle: { flexDirection: 'row', backgroundColor: COLORS.surfaceAlt, borderRadius: 10, padding: 3, marginHorizontal: 16, marginBottom: 6 },
  toggleBtn: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center' },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  checkCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#4dcaa3', alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.7 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1.5 },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, fontSize: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.text },
  saveBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  deleteBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 2, borderWidth: 1.5, borderColor: COLORS.danger },
});
