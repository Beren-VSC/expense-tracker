import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Animated, KeyboardAvoidingView, Platform, Pressable, Alert,
} from 'react-native';
import { ExpenseCategory, IncomeCategory, NoteItem } from '../data';
import { COLORS } from '../theme';

// โครงข้อมูลสำรอง — ต้องตรงกับ payload ที่เก็บใน AsyncStorage (App.tsx)
export interface BackupData {
  cats: ExpenseCategory[];
  incomeCats: IncomeCategory[];
  notes: NoteItem[];
}

interface Props {
  visible: boolean;
  data: BackupData;
  onImport: (data: BackupData) => void;
  onClose: () => void;
}

type Tab = 'export' | 'import';

const isValidBackup = (v: any): v is BackupData =>
  v && Array.isArray(v.cats) && Array.isArray(v.incomeCats) && Array.isArray(v.notes);

export default function BackupSheet({ visible, data, onImport, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('export');
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      setTab('export');
      setPasteText('');
      setError('');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible]);

  const exportText = JSON.stringify(data);

  const confirm = (message: string, onOk: () => void) => {
    // react-native-web ไม่รองรับ Alert.alert (เป็น no-op) — ใช้ window.confirm บนเว็บแทน
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) onOk();
      return;
    }
    Alert.alert('ยืนยัน', message, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ยืนยัน', style: 'destructive', onPress: onOk },
    ]);
  };

  const handleImport = () => {
    setError('');
    let parsed: any;
    try {
      parsed = JSON.parse(pasteText.trim());
    } catch {
      setError('ข้อมูลที่วางไม่ใช่ JSON ที่ถูกต้อง');
      return;
    }
    if (!isValidBackup(parsed)) {
      setError('รูปแบบข้อมูลไม่ตรง (ต้องคัดลอกมาจากหน้า "ส่งออก" ของแอปนี้เท่านั้น)');
      return;
    }
    confirm('นำเข้าข้อมูลนี้จะแทนที่ข้อมูลปัจจุบันทั้งหมด กู้คืนไม่ได้ ยืนยันหรือไม่?', () => {
      onImport(parsed);
      onClose();
    });
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>สำรอง / กู้คืนข้อมูล</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textMid }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
            <TouchableOpacity onPress={() => setTab('export')} style={[s.tabBtn, tab === 'export' && s.tabBtnActive]}>
              <Text style={[s.tabLabel, tab === 'export' && s.tabLabelActive]}>ส่งออก</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('import')} style={[s.tabBtn, tab === 'import' && s.tabBtnActive]}>
              <Text style={[s.tabLabel, tab === 'import' && s.tabLabelActive]}>นำเข้า</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
            {tab === 'export' ? (
              <>
                <Text style={s.hint}>
                  แตะที่กล่องด้านล่าง แล้วเลือกทั้งหมด (Select All) และคัดลอก จากนั้นไปวางในแท็บ "นำเข้า" ของแอปที่ลิงก์ใหม่
                </Text>
                <TextInput
                  value={exportText}
                  editable={false}
                  multiline
                  selectTextOnFocus
                  style={s.jsonBox}
                />
              </>
            ) : (
              <>
                <Text style={s.hint}>วางข้อความที่คัดลอกจากแท็บ "ส่งออก" ของลิงก์เดิมลงในกล่องนี้</Text>
                <TextInput
                  value={pasteText}
                  onChangeText={setPasteText}
                  multiline
                  placeholder="วางข้อมูล JSON ที่นี่..."
                  placeholderTextColor={COLORS.textDim}
                  style={s.jsonBox}
                />
                {!!error && <Text style={{ fontSize: 12, color: COLORS.danger }}>{error}</Text>}
                <TouchableOpacity onPress={handleImport} disabled={!pasteText.trim()}
                  style={[s.saveBtn, { backgroundColor: pasteText.trim() ? COLORS.accent : COLORS.border }]}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>นำเข้าข้อมูล</Text>
                </TouchableOpacity>
              </>
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
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.surfaceAlt },
  tabBtnActive: { backgroundColor: COLORS.accent + '18' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMid },
  tabLabelActive: { color: COLORS.accent },
  hint: { fontSize: 12, color: COLORS.textDim, lineHeight: 17 },
  jsonBox: { minHeight: 160, maxHeight: 260, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, fontSize: 11, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, textAlignVertical: 'top' },
  saveBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 2 },
});
