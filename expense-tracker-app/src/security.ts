import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

// รหัสผ่านล็อกแอป — เก็บลง AsyncStorage เฉพาะค่า hash (ไม่เก็บ plaintext)
// เป็น hash แบบง่าย (ไม่ใช่ crypto มาตรฐาน) พอสำหรับล็อกหน้าจอแอปส่วนตัวในเครื่องตัวเอง
// ไม่ได้ออกแบบมาป้องกันการโจมตีที่ต้องมี backend ยืนยันตัวตนจริงจัง
export function hashPin(pin: string): string {
  let hash = 0;
  const salted = `expense-tracker-lock::${pin}`;
  for (let i = 0; i < salted.length; i++) {
    hash = (Math.imul(hash, 31) + salted.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
}

// Face ID/Touch ID ผ่าน expo-local-authentication — เรียก API ของ OS ตรงๆ ทำงานได้เฉพาะตอน build เป็นแอปเนทีฟเท่านั้น
// (ios/android) บนเว็บ (Platform.OS === 'web') API ตัวนี้ไม่รองรับ authenticateAsync เลยคืน false เสมอไปเลย
// — ก่อนหน้านี้เคยลองใช้ WebAuthn ของเบราว์เซอร์แทนสำหรับเว็บมาสามรอบ (register/verify ด้วย credential id,
// จำกัดเฉพาะ Safari, แล้วเปลี่ยนเป็น discoverable credential/passkey) แต่ยังพาผู้ใช้ไปติดหน้าจอพังซ้ำๆ ทุกรอบ
// ไม่มีเครื่องจริงให้ debug ต่อ เลยตัดสินใจเลิกใช้ WebAuthn ทั้งหมด เหลือแค่ทางนี้ (แอปเนทีฟ) กับรหัสผ่าน (PIN) เท่านั้น
export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (e) {
    console.warn('เช็คการรองรับ Face ID/Touch ID ไม่สำเร็จ', e);
    return false;
  }
}

// เรียก Face ID/Touch ID จริงของเครื่อง — ใช้ทั้งตอน "เปิดใช้งานครั้งแรก" (ทดสอบให้ผ่านก่อนค่อยเปิดฟีเจอร์)
// และตอน "ปลดล็อกแอป" (ทุกครั้งที่เปิดแอป) เหมือนกันทุกประการ ไม่ต้องมีขั้น "ลงทะเบียน credential" แยกแบบ WebAuthn
// เพราะ OS เป็นคนเก็บข้อมูลไบโอเมตริกเองอยู่แล้ว (ตั้งค่าไว้ใน Settings ของเครื่อง)
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'ปลดล็อกแอปด้วย Face ID / Touch ID',
      cancelLabel: 'ยกเลิก',
      disableDeviceFallback: false, // ล้มเหลวหลายครั้งให้ระบบเสนอ fallback เป็นรหัสผ่าน/passcode ของเครื่องแทน
    });
    return result.success;
  } catch (e) {
    console.warn('ยืนยันตัวตนด้วย Face ID/Touch ID ไม่สำเร็จ', e);
    return false;
  }
}

export const PIN_LENGTH = 6;
export const PIN_HASH_KEY = '@expense_tracker/lock_pin_hash';
// แค่ธง true/false ว่าผู้ใช้เปิดใช้ Face ID/Touch ID ไว้ไหม — ไม่มี credential/id อะไรต้องเก็บแยก
export const BIOMETRIC_ENABLED_KEY = '@expense_tracker/lock_biometric_enabled';
export const LOCK_ENABLED_KEY = '@expense_tracker/lock_enabled';
