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
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
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

// ลงทะเบียน "พาสคีย์" (discoverable credential) ของเครื่อง ผูกกับ Face ID/Touch ID ผ่าน WebAuthn platform authenticator
// รอบก่อนใช้แบบ non-discoverable (ต้องส่ง credential id เจาะจงกลับไปหาตอนปลดล็อก) แล้วเจอปัญหาหา credential ไม่เจอซ้ำๆ
// รอบนี้เปลี่ยนมาใช้ residentKey: 'required' — เป็นพาสคีย์แบบเดียวกับที่ iOS โชว์ใน Settings > รหัสผ่าน จริงๆ
// เก็บเป็นรายการหลักในระบบของเครื่อง (ไม่ใช่ blob ที่ผูกกับ id ที่เราส่งไปเจาะจง) มีโอกาสหาเจอตอนปลดล็อกสูงกว่ามาก
// ไม่มี backend ตรวจลายเซ็นจริง — แค่เช็คว่า navigator.credentials.create()/.get() สำเร็จหรือเปล่า ให้ OS/เบราว์เซอร์
// เป็นคนยืนยันตัวตนเองทั้งหมด (เพียงพอสำหรับปลดล็อกแอปส่วนตัว ไม่ใช่ระบบยืนยันตัวตนแบบมีเซิร์ฟเวอร์ตรวจสอบ)
export async function registerBiometricCredential(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
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
    console.warn('ลงทะเบียน Face ID/Touch ID ไม่สำเร็จ', e);
    return false;
  }
}

// ปลดล็อก — ไม่ระบุ allowCredentials เจาะจง ให้เบราว์เซอร์ค้นหาพาสคีย์ของ origin นี้ที่เก็บไว้เองแทน
// (usernameless/discoverable flow — วิธีมาตรฐานสำหรับพาสคีย์ที่ลงทะเบียนแบบ residentKey: 'required' ด้านบน)
export async function verifyBiometricCredential(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
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
    console.warn('ยืนยันตัวตนด้วย Face ID/Touch ID ไม่สำเร็จ', e);
    return false;
  }
}

export const PIN_LENGTH = 6;
export const PIN_HASH_KEY = '@expense_tracker/lock_pin_hash';
// แค่ธง true/false ว่าเคยลงทะเบียนพาสคีย์ไว้ไหม — ไม่ต้องเก็บ credential id เจาะจงแบบรอบก่อนแล้ว
// (เพราะตอนปลดล็อกไม่ได้ระบุ allowCredentials เจาะจง ให้เบราว์เซอร์หาพาสคีย์ของ origin นี้เอง)
export const BIOMETRIC_ENABLED_KEY = '@expense_tracker/lock_biometric_enabled';
export const LOCK_ENABLED_KEY = '@expense_tracker/lock_enabled';
