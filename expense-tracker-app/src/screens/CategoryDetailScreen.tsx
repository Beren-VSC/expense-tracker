import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Bar from '../components/Bar';
import { ExpenseCategory, ExpenseItem, fmt } from '../data';
import { COLORS } from '../theme';

interface Props {
  cat: ExpenseCategory;
  onBack: () => void;
  onItemPress: (item: ExpenseItem) => void;
}

export default function CategoryDetailScreen({ cat, onBack, onItemPress }: Props) {
  const insets = useSafeAreaInsets();
  const pct = cat.spent / cat.budget * 100;
  const over = cat.spent > cat.budget;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Hero header */}
      <View style={{ backgroundColor: cat.color, paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 18 }}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }}>
          <Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)', lineHeight: 28 }}>‹</Text>
          <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>กลับ</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={s.iconBox}>
            <Text style={{ fontSize: 26 }}>{cat.icon}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{cat.name}</Text>
            <Text style={{ fontSize: 30, fontWeight: '700', color: '#fff', lineHeight: 34 }}>{fmt(cat.spent)}</Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>งบ {fmt(cat.budget)}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: over ? 'rgba(255,180,180,0.95)' : 'rgba(255,255,255,0.65)' }}>
              {over ? '⚠ เกินงบ' : `เหลือ ${fmt(cat.budget - cat.spent)}`}
            </Text>
          </View>
          <Bar pct={pct} color="rgba(255,255,255,0.85)" h={6} bg="rgba(255,255,255,0.2)" />
        </View>
      </View>

      {/* Items list */}
      <ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
          <Text style={s.countLabel}>ทั้งหมด {cat.count} รายการ</Text>
        </View>
        {cat.items.map(item => (
          <TouchableOpacity key={item.id} style={s.itemRow} onPress={() => onItemPress(item)}>
            <View style={[s.receiptIcon, {
              backgroundColor: item.receipt ? cat.color + '18' : COLORS.surfaceAlt,
              borderColor: item.receipt ? cat.color + '40' : COLORS.border,
            }]}>
              <Text style={{ fontSize: 18 }}>{item.receipt ? '🧾' : '—'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.text }}>{item.desc}</Text>
              <Text style={{ fontSize: 11, color: COLORS.textDim, marginTop: 1 }}>{item.date}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>{fmt(item.amt)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  iconBox: { width: 52, height: 52, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  countLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderColor: COLORS.border },
  receiptIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
