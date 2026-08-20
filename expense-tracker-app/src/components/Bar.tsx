import React from 'react';
import { View } from 'react-native';

interface Props {
  pct: number;
  color: string;
  h?: number;
  bg?: string;
}

export default function Bar({ pct, color, h = 4, bg = 'rgba(0,0,0,0.07)' }: Props) {
  return (
    <View style={{ height: h, backgroundColor: bg, borderRadius: h, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.min(pct, 100)}%`, backgroundColor: color, borderRadius: h }} />
    </View>
  );
}
