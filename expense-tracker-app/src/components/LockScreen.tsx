import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PinPad from './PinPad';
import { COLORS } from '../theme';
import { PIN_LENGTH } from '../security';

export interface LockScreenProps {
  mode: 'setup' | 'unlock';
  error: string | null;
  // setup: เรียกตอนใส่รหัส 6 หลักครบ 2 รอบตรงกันแล้ว (คอมโพเนนต์นี้จัดการ "ใส่ซ้ำเพื่อยืนยัน" เองภายใน)
  onSetupComplete: (pin: string) => void;
  // unlock: เรียกทุกครั้งที่ใส่ครบ 6 หลัก ให้ผู้เรียกตรวจสอบเอง (ถูก/ผิดสะท้อนกลับผ่าน prop error)
  onAttemptUnlock: (pin: string) => void;
  biometric?: { label: string; onPress: () => void } | null;
}

// หน้าจอล็อกเต็มจอ กันไม่ให้เห็น/แตะข้อมูลในแอปจนกว่าจะปลดล็อกสำเร็จ
// mode=setup ใช้ตอนยังไม่เคยตั้งรหัสผ่าน (ครั้งแรกที่เปิดแอปหลังเปิดใช้ฟีเจอร์นี้)
// mode=unlock ใช้ทุกครั้งหลังจากนั้น (เปิดแอปใหม่ หรือกลับมาจากพักหน้าจอ)
export default function LockScreen({ mode, error, onSetupComplete, onAttemptUnlock, biometric }: LockScreenProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [mismatchMsg, setMismatchMsg] = useState<string | null>(null);
  const [shakeSignal, setShakeSignal] = useState(0);

  // สลับโหมด (เช่น กลับมาที่ unlock หลังตั้งรหัสเสร็จ) ให้เริ่มนับใหม่เสมอ
  useEffect(() => {
    setPin('');
    setStep('enter');
    setFirstPin('');
    setMismatchMsg(null);
  }, [mode]);

  // error จากภายนอก (รหัสผิดตอน unlock) — เคลียร์ช่องแล้วสั่นให้เห็นชัด
  useEffect(() => {
    if (error) {
      setPin('');
      setShakeSignal(v => v + 1);
    }
  }, [error]);

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length !== PIN_LENGTH) return;

    if (mode === 'unlock') {
      onAttemptUnlock(next);
      return;
    }

    // mode === 'setup'
    if (step === 'enter') {
      setFirstPin(next);
      setStep('confirm');
      setPin('');
    } else if (next === firstPin) {
      onSetupComplete(next);
    } else {
      setMismatchMsg('รหัสไม่ตรงกัน ลองตั้งใหม่อีกครั้ง');
      setShakeSignal(v => v + 1);
      setStep('enter');
      setFirstPin('');
      setPin('');
    }
  };

  const title = mode === 'unlock'
    ? 'ใส่รหัสผ่านเพื่อเข้าแอป'
    : step === 'enter' ? `ตั้งรหัสผ่าน ${PIN_LENGTH} หลัก` : 'ใส่รหัสผ่านอีกครั้งเพื่อยืนยัน';

  const message = mode === 'unlock' ? error : mismatchMsg;

  return (
    <View style={[s.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={s.icon}>🔒</Text>
      <Text style={s.title}>{title}</Text>
      {mode === 'setup' && (
        <Text style={s.subtitle}>ใช้กันไม่ให้คนอื่นเปิดดูรายรับ-รายจ่ายของคุณ</Text>
      )}
      <Text style={[s.error, !message && { opacity: 0 }]}>{message ?? ' '}</Text>

      <PinPad length={PIN_LENGTH} value={pin} onKeyPress={handleKey} shakeSignal={shakeSignal} />

      {mode === 'unlock' && biometric && (
        <TouchableOpacity style={s.bioBtn} onPress={biometric.onPress}>
          <Text style={s.bioBtnText}>{biometric.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  icon: { fontSize: 34, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 12, color: COLORS.textDim, textAlign: 'center', marginTop: 6, maxWidth: 260 },
  error: { fontSize: 12, color: COLORS.danger, marginTop: 10, textAlign: 'center' },
  bioBtn: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 20 },
  bioBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },
});
