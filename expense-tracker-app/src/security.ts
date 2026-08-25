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

// === แอปเนทีฟ (ios/android build ผ่าน EAS) — เรียก Face ID/Touch ID ของ OS ตรงๆ ผ่าน expo-local-authentication ===
// เชื่อถือได้เต็มที่ ไม่มีปัญหาเรื่องเบราว์เซอร์/origin แบบฝั่งเว็บด้านล่าง

// === เว็บ (PWA) — ใช้ WebAuthn platform authenticator ของเบราว์เซอร์แทน ===
// ลองมาแล้วหลายรอบ (non-discoverable credential, จำกัดเฉพาะ Safari, discoverable credential/passkey)
// ยังพังบ่อย เพราะขึ้นอยู่กับเบราว์เซอร์/สภาพแวดล้อมที่ควบคุมจากโค้ดฝั่งเราไม่ได้ทั้งหมด — เปิดให้ลองได้ต่อ
// เผื่อบางเครื่อง/หลัง clear ข้อมูลเบราว์เซอร์แล้วใช้ได้จริง แต่ไม่การันตีเหมือนฝั่งแอปเนทีฟ
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(length));
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

async function webAuthnRegister(): Promise<boolean> {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { id: window.location.hostname, name: 'Expense Tracker' },
        user: { id: randomBytes(16), name: 'expense-tracker-user', displayName: 'Expense Tracker' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'required',
          requireResidentKey: true, // เผื่อเบราว์เซอร์เก่าที่ยังอ่าน field นี้แทน residentKey
        },
        timeout: 60000,
      },
    });
    return !!cred;
  } catch (e) {
    console.warn('ลงทะเบียน Face ID/Touch ID (WebAuthn) ไม่สำเร็จ', e);
    return false;
  }
}

async function webAuthnAuthenticate(): Promise<boolean> {
  try {
    // ไม่ระบุ allowCredentials เจาะจง — ให้เบราว์เซอร์ค้นหาพาสคีย์ของ origin นี้ที่เก็บไว้เอง (usernameless flow)
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: window.location.hostname,
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!cred;
  } catch (e) {
    console.warn('ยืนยันตัวตนด้วย Face ID/Touch ID (WebAuthn) ไม่สำเร็จ', e);
    return false;
  }
}

// === รวมสองทางเข้าด้วยกัน — App.tsx เรียกชุดฟังก์ชันนี้ชุดเดียว ไม่ต้องรู้ว่าอยู่บนเว็บหรือแอปเนทีฟ ===

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  }
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (e) {
    console.warn('เช็คการรองรับ Face ID/Touch ID ไม่สำเร็จ', e);
    return false;
  }
}

// เปิดใช้งานครั้งแรก — ฝั่งเว็บต้อง "ลงทะเบียนพาสคีย์" ก่อนถึงจะปลดล็อกด้วยมันได้ภายหลัง
// ฝั่งแอปเนทีฟไม่ต้องลงทะเบียนแยก (OS เก็บข้อมูลไบโอเมตริกเองอยู่แล้ว) แค่ทดสอบยืนยันตัวตนให้ผ่านสักครั้งพอ
export async function enableBiometricUnlock(): Promise<boolean> {
  if (Platform.OS === 'web') return webAuthnRegister();
  return authenticateWithBiometrics();
}

// ปลดล็อกแอป — เรียกทุกครั้งที่กดปุ่ม Face ID/Touch ID ตอนแอปล็อกอยู่
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (Platform.OS === 'web') return webAuthnAuthenticate();
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
