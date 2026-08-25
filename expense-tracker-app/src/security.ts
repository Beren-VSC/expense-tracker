import { Platform } from 'react-native';

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

// Face ID/Touch ID จริงๆ ทำได้แค่บนแอปเนทีฟ (expo-local-authentication) — แอปนี้ deploy เป็นเว็บ (PWA)
// เลยใช้ WebAuthn platform authenticator ของเบราว์เซอร์แทน (รองรับเฉพาะเว็บ + ต้องเป็น HTTPS)
export function isWebAuthnSupported(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(length));
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

function toBase64(bytes: ArrayBuffer): string {
  let binary = '';
  new Uint8Array(bytes).forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ลงทะเบียนตัวยืนยันตัวตนของเครื่อง (Face ID/Touch ID/Windows Hello ฯลฯ) ผ่าน WebAuthn platform authenticator
// ไม่มี backend ตรวจลายเซ็นจริง — เก็บแค่ credential id ไว้เช็คว่า "เคยลงทะเบียนไว้แล้ว" แล้วให้ OS/เบราว์เซอร์
// เป็นคนยืนยันตัวตนเองทั้งหมด (เพียงพอสำหรับปลดล็อกแอปส่วนตัว ไม่ใช่ระบบยืนยันตัวตนแบบมีเซิร์ฟเวอร์ตรวจสอบ)
export async function registerBiometricCredential(): Promise<string | null> {
  if (!isWebAuthnSupported()) return null;
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'Expense Tracker' },
        user: { id: randomBytes(16), name: 'expense-tracker-user', displayName: 'Expense Tracker' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;
    if (!cred) return null;
    return toBase64(cred.rawId);
  } catch (e) {
    console.warn('ลงทะเบียน Face ID/Touch ID ไม่สำเร็จ', e);
    return null;
  }
}

export async function verifyBiometricCredential(credentialIdB64: string): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ id: fromBase64(credentialIdB64), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!cred;
  } catch (e) {
    console.warn('ยืนยันตัวตนด้วย Face ID/Touch ID ไม่สำเร็จ', e);
    return false;
  }
}

export const PIN_LENGTH = 6;
export const PIN_HASH_KEY = '@expense_tracker/lock_pin_hash';
export const BIOMETRIC_CRED_KEY = '@expense_tracker/lock_biometric_cred';
export const LOCK_ENABLED_KEY = '@expense_tracker/lock_enabled';
