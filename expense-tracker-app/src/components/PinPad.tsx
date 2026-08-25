import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

interface Props {
  length: number;
  value: string;
  onKeyPress: (key: string) => void;
  shakeSignal: number; // เพิ่มค่าทุกครั้งที่อยากสั่นแสดงว่าใส่ผิด (เปลี่ยนค่า = trigger animation ใหม่)
}

// แป้นตัวเลขใส่รหัสผ่าน — ใช้ร่วมกันทั้ง LockScreen (ปลดล็อก/ตั้งรหัสครั้งแรก) และ LockSettingsSheet (จัดการภายหลัง)
export default function PinPad({ length, value, onKeyPress, shakeSignal }: Props) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shakeSignal === 0) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeSignal]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={[s.dotsRow, { transform: [{ translateX: shake }] }]}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[s.dot, i < value.length && s.dotFilled]} />
        ))}
      </Animated.View>

      <View style={s.keypad}>
        {KEYS.map((k, i) => (
          k === '' ? <View key={i} style={s.key} /> : (
            <TouchableOpacity key={i} style={s.key} onPress={() => onKeyPress(k)} hitSlop={4}>
              <Text style={s.keyText}>{k}</Text>
            </TouchableOpacity>
          )
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dotsRow: { flexDirection: 'row', gap: 12, marginVertical: 22 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.border },
  dotFilled: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 258, justifyContent: 'center' },
  key: { width: 78, height: 62, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 24, fontWeight: '500', color: COLORS.text },
});
