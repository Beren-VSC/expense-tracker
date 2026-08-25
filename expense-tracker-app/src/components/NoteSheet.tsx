import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Animated, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { NoteItem, MONTHS_SHORT, getDaysInMonth } from '../data';
import { COLORS } from '../theme';

export interface NoteSavePayload {
  id?: number;
  title: string;
  day: number;
  month: number; // 0-11
  year: number;
}

interface Props {
  visible: boolean;
  editTarget: NoteItem | null; // null = เพิ่มใหม่
  onSave: (payload: NoteSavePayload) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function NoteSheet({ visible, editTarget, onSave, onDelete, onClose }: Props) {
  const now = new Date();
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(String(now.getDate()));
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(String(now.getFullYear()));

  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      if (editTarget) {
        setTitle(editTarget.title);
        setDay(String(editTarget.day));
        setMonth(editTarget.month);
        setYear(String(editTarget.year));
      } else {
        setTitle('');
        setDay(String(now.getDate()));
        setMonth(now.getMonth());
        setYear(String(now.getFullYear()));
      }
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible, editTarget]);

  const yearNum = Number(year);
  const dayNum = Number(day);
  const maxDay = yearNum > 0 ? getDaysInMonth(yearNum, month) : 31;
  const valid = title.trim().length > 0 && dayNum >= 1 && dayNum <= maxDay && yearNum > 2000;

  const handleSave = () => {
    if (!valid) return;
    onSave({ id: editTarget?.id, title: title.trim(), day: dayNum, month, year: yearNum });
    onClose();
  };

  const handleDelete = () => {
    if (!editTarget) return;
    onDelete(editTarget.id);
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
              {editTarget ? 'แก้ไข Note' : 'เพิ่ม Note'}
            </Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textMid }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
            <View style={{ gap: 6, marginTop: 4 }}>
              <Text style={s.fieldLabel}>รายการ</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder='เช่น "ค่าไฟบ้าน", "ผ่อนรถ"'
                placeholderTextColor={COLORS.textDim}
                style={s.input}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>เดือน</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {MONTHS_SHORT.map((m, i) => (
                    <TouchableOpacity key={m} onPress={() => setMonth(i)}
                      style={[s.monthChip, {
                        borderColor: month === i ? COLORS.accent : COLORS.border,
                        backgroundColor: month === i ? COLORS.accent + '18' : COLORS.surface,
                      }]}>
                      <Text style={{ fontSize: 12, fontWeight: month === i ? '600' : '400', color: month === i ? COLORS.accent : COLORS.textMid }}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.fieldLabel}>วันที่</Text>
                <TextInput
                  value={day}
                  onChangeText={v => setDay(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholderTextColor={COLORS.textDim}
                  style={s.input}
                />
              </View>
              <View style={{ flex: 1.4, gap: 6 }}>
                <Text style={s.fieldLabel}>ปี (ค.ศ.)</Text>
                <TextInput
                  value={year}
                  onChangeText={v => setYear(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholderTextColor={COLORS.textDim}
                  style={s.input}
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleSave} disabled={!valid}
              style={[s.saveBtn, { backgroundColor: valid ? COLORS.accent : COLORS.border }]}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                {editTarget ? 'บันทึกการแก้ไข' : 'บันทึก Note'}
              </Text>
            </TouchableOpacity>

            {editTarget && (
              <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.danger }}>🗑 ลบ Note นี้</Text>
              </TouchableOpacity>
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
  fieldLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.7 },
  monthChip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 20, borderWidth: 1.5 },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, fontSize: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.text },
  saveBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  deleteBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 2, borderWidth: 1.5, borderColor: COLORS.danger },
});
