import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

interface Segment {
  spent: number;
  color: string;
  _isIncome?: boolean;
}

interface Props {
  cats: Segment[];
  size?: number;
}

export default function Donut({ cats, size = 80 }: Props) {
  const total = cats.reduce((s, c) => s + c.spent, 0);
  const r = 30, cx = 40, cy = 40, sw = 11;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const fmt1k = (n: number) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;
  const isIncome = cats[0]?._isIncome;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={sw} />
        {cats.map((c, i) => {
          const dash = total > 0 ? (c.spent / total) * circ : 0;
          const el = (
            <Circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={c.color}
              strokeWidth={sw - 1}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              rotation={-90}
              origin={`${cx}, ${cy}`}
              strokeLinecap="round"
            />
          );
          offset += dash;
          return el;
        })}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size,
        alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.45)', fontWeight: '500' }}>
          {isIncome ? 'รายรับ' : 'รายจ่าย'}
        </Text>
        <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>
          {isIncome ? `+${fmt1k(total)}` : fmt1k(total)}
        </Text>
      </View>
    </View>
  );
}
