import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
  KeyboardAvoidingView, Platform, Pressable, Switch,
} from 'react-native';
import PinPad from './PinPad';
import { COLORS } from '../theme';
import { PIN_LENGTH } from '../security';

type Stage = 'verify' | 'menu' | 'change-new' | 'change-confirm';

interface Props {
  visible: boolean;
  biometricSupported: boolean;
  biometricEnabled: boolean;
  lockEnabled: boolean;
  verifyPin: (pin: string) => boolean;
  onChangePin: (newPin: string) => void;
  onToggleBiometric: (enable: boolean) => void;
  onToggleLockEnabled: (enable: boolean) => void;
  onClose: () => void;
}

// จัดการรหัสผ่านล็อกแอปหลังตั้งค่าครั้งแรกไปแล้ว — ต้องใส่รหัสผ่านปัจจุบันให้ถูกก่อนเสมอถึงจะเข้าเมนูนี้ได้
export default function LockSettingsSheet({
  visible, biometricSupported, biometricEnabled, lockEnabled,
  verifyPin, onChangePin, onToggleBiometric, onToggleLockEnabled, onClose,
}: Props) {
  const [stage, setStage] = useState<Stage>('verify');
  const [pin, setPin] = useState('');
  const [firstNewPin, setFirstNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeSignal, setShakeSignal] = useState(0);
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      setStage('verify');
      setPin('');
      setFirstNewPin('');
      setError(null);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible]);

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length !== PIN_LENGTH) return;

    if (stage === 'verify') {
      if (verifyPin(next)) {
        setError(null);
        setStage('menu');
        setPin('');
      } else {
        setError('รหัสผ่านไม่ถูกต้อง');
        setShakeSignal(v => v + 1);
        setPin('');
      }
    } else if (stage === 'change-new') {
      setFirstNewPin(next);
      setStage('change-confirm');
      setPin('');
    } else if (stage === 'change-confirm') {
      if (next === firstNewPin) {
        onChangePin(next);
        setError(null);
        setStage('menu');
        setPin('');
      } else {
        setError('รหัสไม่ตรงกัน ลองใหม่อีกครั้ง');
        setShakeSignal(v => v + 1);
        setStage('change-new');
        setFirstNewPin('');
        setPin('');
      }
    }
  };

  const pinStageTitle =
    stage === 'verify' ? 'ใส่รหัสผ่านปัจจุบัน' :
    stage === 'change-new' ? `ตั้งรหัสผ่านใหม่ ${PIN_LENGTH} หลัก` :
    'ใส่รหัสผ่านใหม่อีกครั้งเพื่อยืนยัน';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceAlt }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>ตั้งค่าการล็อกแอป</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textMid }}>✕</Text>
            </TouchableOpacity>
          </View>

          {stage === 'menu' ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 4 }}>
              <TouchableOpacity style={s.row} onPress={() => { setStage('change-new'); setError(null); }}>
                <Text style={s.rowLabel}>🔑 เปลี่ยนรหัสผ่าน</Text>
                <Text style={s.rowChevron}>›</Text>
              </TouchableOpacity>

              {biometricSupported && (
                <View style={s.row}>
                  <Text style={s.rowLabel}>👤 ปลดล็อกด้วย Face ID / Touch ID</Text>
                  <Switch value={biometricEnabled} onValueChange={onToggleBiometric}
                    trackColor={{ true: COLORS.accent }} />
                </View>
              )}

              <View style={s.row}>
                <Text style={s.rowLabel}>🔒 เปิดใช้การล็อกแอป</Text>
                <Switch value={lockEnabled} onValueChange={onToggleLockEnabled}
                  trackColor={{ true: COLORS.accent }} />
              </View>
              {!lockEnabled && (
                <Text style={s.hint}>ปิดอยู่ — เปิดแอปครั้งต่อไปจะไม่ถามรหัสผ่าน</Text>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingBottom: 32 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 4 }}>{pinStageTitle}</Text>
              <Text style={[s.error, !error && { opacity: 0 }]}>{error ?? ' '}</Text>
              <PinPad length={PIN_LENGTH} value={pin} onKeyPress={handleKey} shakeSignal={shakeSignal} />
            </View>
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderColor: COLORS.border },
  rowLabel: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  rowChevron: { fontSize: 18, color: COLORS.textDim },
  hint: { fontSize: 11, color: COLORS.textDim, marginTop: 8 },
  error: { fontSize: 12, color: COLORS.danger, marginTop: 8 },
});
