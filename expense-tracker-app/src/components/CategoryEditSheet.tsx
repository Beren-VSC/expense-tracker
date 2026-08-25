import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Animated, KeyboardAvoidingView, Platform, Pressable, Alert,
} from 'react-native';
import { COLORS } from '../theme';

export interface CategoryEditTarget {
  type: 'expense' | 'income';
  id: string;
  name: string;
  icon: string;
  // ลบได้เฉพาะตอนที่หมวดนี้ "ไม่มีเงินเหลือ" แล้ว — รายจ่าย: ยังไม่เคยมีรายการ, รายรับ/บัญชี: คงเหลือเป็น 0
  canDelete: boolean;
  // เหตุผลที่ลบไม่ได้ตอนนี้ — ไว้โชว์อธิบายให้ผู้ใช้เข้าใจ (undefined เมื่อ canDelete = true)
  deleteBlockedReason?: string;
}

export interface CategorySavePayload {
  type: 'expense' | 'income';
  id: string;
  name: string;
  icon: string;
}

interface Props {
  visible: boolean;
  target: CategoryEditTarget | null;
  onSave: (payload: CategorySavePayload) => void;
  onDelete: (target: CategoryEditTarget) => void;
  onClose: () => void;
}

// ไอคอนให้เลือกไว — ครอบคลุมหมวดรายจ่าย/รายรับ/ช่องทางการเงินที่พบบ่อย
const ICON_PRESETS = [
  '💳', '💰', '💵', '💴', '💶', '💷', '🪙', '👛', '🏦', '📱', '💼', '🎯',
  '🍜', '☕', '🚇', '⛽', '🏠', '⚡', '💧', '💊', '🎬', '📦', '✈️', '🎓',
];

export default function CategoryEditSheet({ visible, target, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💳');
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible && target) {
      setName(target.name);
      setIcon(target.icon);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else if (!visible) {
      slideAnim.setValue(500);
    }
  }, [visible, target]);

  const valid = name.trim().length > 0 && icon.trim().length > 0;

  const handleSave = () => {
    if (!valid || !target) return;
    onSave({ type: target.type, id: target.id, name: name.trim(), icon: icon.trim() });
    onClose();
  };

  const handleDelete = () => {
    if (!target || !target.canDelete) return;
    const msg = `หมวดหมู่ "${target.name}" จะถูกลบถาวร รวมถึงประวัติรายการทั้งหมดในหมวดนี้ กู้คืนไม่ได้`;
    if (Platform.OS === 'web') {
      // react-native-web ไม่รองรับ Alert.alert จริง (เป็น no-op) — ต้องใช้ window.confirm บนเว็บแทน (เหมือน handleClearAll ใน HomeScreen.tsx)
      if (typeof window !== 'undefined' && window.confirm(`ลบหมวดหมู่นี้?\n${msg}`)) {
        onDelete(target);
        onClose();
      }
      return;
    }
    Alert.alert('ลบหมวดหมู่นี้?', msg, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => { onDelete(target); onClose(); } },
    ]);
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>แก้ไขหมวดหมู่</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textMid }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <View style={s.preview}>
                <Text style={{ fontSize: 30 }}>{icon || '❔'}</Text>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>ชื่อหมวดหมู่</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="เช่น TrueMoney"
                placeholderTextColor={COLORS.textDim}
                style={s.input}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>ไอคอน</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ICON_PRESETS.map(ic => (
                  <TouchableOpacity key={ic} onPress={() => setIcon(ic)}
                    style={[s.iconChip, { borderColor: icon === ic ? COLORS.accent : COLORS.border, backgroundColor: icon === ic ? COLORS.accent + '18' : COLORS.surface }]}>
                    <Text style={{ fontSize: 18 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.fieldLabel, { marginTop: 4 }]}>หรือพิมพ์ emoji เอง</Text>
              <TextInput
                value={icon}
                onChangeText={setIcon}
                placeholder="วาง emoji ที่นี่"
                placeholderTextColor={COLORS.textDim}
                style={s.input}
              />
            </View>

            <TouchableOpacity onPress={handleSave} disabled={!valid}
              style={[s.saveBtn, { backgroundColor: valid ? COLORS.accent : COLORS.border }]}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>บันทึก</Text>
            </TouchableOpacity>

            {/* ลบหมวดหมู่ — กดได้เฉพาะตอนไม่มีเงินเหลือในหมวดนี้แล้ว กันลบข้อมูลที่ยังใช้อยู่โดยไม่ตั้งใจ */}
            {target?.canDelete ? (
              <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.danger }}>🗑 ลบหมวดหมู่นี้</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.deleteHint}>
                <Text style={{ fontSize: 11, color: COLORS.textDim, textAlign: 'center' }}>
                  {target?.deleteBlockedReason ?? 'ลบหมวดหมู่นี้ไม่ได้ตอนนี้'}
                </Text>
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
  preview: { width: 64, height: 64, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.7 },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, fontSize: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.text },
  iconChip: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  deleteBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 2, borderWidth: 1.5, borderColor: COLORS.danger },
  deleteHint: { paddingVertical: 10, paddingHorizontal: 12 },
});
