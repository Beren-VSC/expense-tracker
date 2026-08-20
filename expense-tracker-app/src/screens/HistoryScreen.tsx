import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Bar from '../components/Bar';
import { ExpenseCategory, IncomeCategory, fmt, HISTORY, INCOME_HISTORY } from '../data';
import { COLORS, SHADOW } from '../theme';

const FIRST_DAY = 4; // Thursday (0=Sun)
const DAYS_IN_MONTH = 31;
const DAY_LABELS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

interface Props {
  cats: ExpenseCategory[];
  incomeCats: IncomeCategory[];
}

export default function HistoryScreen({ cats, incomeCats }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'expense' | 'income'>('expense');
  const [sel, setSel] = useState<number | null>(null);

  // Build calendar weeks
  const weeks: (number | null)[][] = [];
  let d = 1 - FIRST_DAY;
  for (let w = 0; w < 5; w++) {
    const wk: (number | null)[] = [];
    for (let x = 0; x < 7; x++, d++) wk.push(d >= 1 && d <= DAYS_IN_MONTH ? d : null);
    weeks.push(wk);
  }

  const spendByDay = useMemo(() => {
    const map: Record<number, number> = {};
    cats.forEach(cat => cat.items.forEach(item => {
      const m = item.date.match(/May (\d+)/);
      if (m) { const day = Number(m[1]); map[day] = (map[day] || 0) + item.amt; }
    }));
    return map;
  }, [cats]);

  const incomeByDay = useMemo(() => {
    const map: Record<number, number> = {};
    incomeCats.forEach(cat => cat.items.forEach(item => {
      const m = item.date.match(/May (\d+)/);
      if (m) { const day = Number(m[1]); map[day] = (map[day] || 0) + item.amt; }
    }));
    return map;
  }, [incomeCats]);

  const dayMap = view === 'income' ? incomeByDay : spendByDay;
  const maxVal = Object.values(dayMap).length ? Math.max(...Object.values(dayMap)) : 1;
  const dotColor = view === 'income' ? COLORS.income : COLORS.accent;

  const selItems = sel
    ? (view === 'income'
        ? incomeCats.flatMap(cat => cat.items.filter(i => i.date === `May ${sel}`).map(i => ({ ...i, catColor: cat.color })))
        : cats.flatMap(cat => cat.items.filter(i => i.date === `May ${sel}`).map(i => ({ ...i, catColor: cat.color })))
      )
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.surface, paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.border }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>ประวัติ</Text>
        <Text style={{ fontSize: 12, color: COLORS.textDim, marginTop: 1 }}>พฤษภาคม 2569</Text>
      </View>

      {/* View tabs */}
      <View style={s.tabs}>
        {(['expense', 'income'] as const).map(v => (
          <TouchableOpacity key={v} onPress={() => { setView(v); setSel(null); }}
            style={[s.tab, view === v && { borderBottomColor: v === 'income' ? COLORS.income : COLORS.accent, borderBottomWidth: 2.5 }]}>
            <Text style={[s.tabText, { color: view === v ? (v === 'income' ? COLORS.income : COLORS.accent) : COLORS.textDim, fontWeight: view === v ? '600' : '400' }]}>
              {v === 'expense' ? '💸 รายจ่าย' : '💰 รายรับ'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Calendar */}
        <View style={[s.calBox, SHADOW]}>
          {/* Day labels */}
          <View style={s.calHeader}>
            {DAY_LABELS.map(l => (
              <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: COLORS.textDim, fontWeight: '600' }}>{l}</Text>
              </View>
            ))}
          </View>
          {/* Calendar grid */}
          {weeks.map((wk, wi) => (
            <View key={wi} style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
              {wk.map((day, di) => {
                const val = day ? dayMap[day] || 0 : 0;
                const isSel = sel === day;
                const isToday = day === 27;
                const intensity = val ? Math.round((val / maxVal) * 50 + 15) : 0;
                const hexAlpha = intensity.toString(16).padStart(2, '0');
                return (
                  <TouchableOpacity
                    key={di}
                    disabled={!day}
                    onPress={() => day && setSel(isSel ? null : day)}
                    style={[s.calCell, {
                      backgroundColor: isSel ? dotColor : val ? `${dotColor}${hexAlpha}` : day ? COLORS.bg : 'transparent',
                      borderColor: isToday && !isSel ? dotColor : 'transparent',
                      borderWidth: 2,
                    }]}
                  >
                    {day ? (
                      <>
                        <Text style={{ fontSize: 12, fontWeight: (isToday || isSel) ? '700' : '400', color: isSel ? '#fff' : COLORS.text }}>{day}</Text>
                        {val > 0 && !isSel && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dotColor }} />}
                      </>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Day detail */}
        {sel && selItems.length > 0 && (
          <View style={[s.dayDetail, SHADOW]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
              {sel} พ.ค. — {view === 'income' ? '+' : ''}{fmt(dayMap[sel] || 0)}
            </Text>
            {selItems.map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderTopWidth: idx > 0 ? 1 : 0, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: (item as any).catColor }} />
                  <Text style={{ fontSize: 13, color: COLORS.text }}>{item.desc}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: view === 'income' ? (item as any).catColor : COLORS.text }}>
                  {view === 'income' ? '+' : ''}{fmt(item.amt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Previous months */}
        <Text style={s.prevLabel}>เดือนก่อนหน้า</Text>
        {view === 'expense'
          ? [...HISTORY].reverse().map((m, i) => {
              const over = m.spent > m.budget;
              return (
                <View key={i} style={[s.monthCard, SHADOW]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>{m.label} 2569</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: over ? COLORS.danger : COLORS.text }}>{fmt(m.spent)}</Text>
                  </View>
                  <Bar pct={m.spent / m.budget * 100} color={over ? COLORS.danger : COLORS.accent} bg={COLORS.surfaceAlt} />
                  <Text style={{ fontSize: 10, color: COLORS.textDim, textAlign: 'right', marginTop: 3 }}>งบ {fmt(m.budget)}</Text>
                </View>
              );
            })
          : (() => {
              const maxInc = Math.max(...INCOME_HISTORY.map(x => x.income));
              return [...INCOME_HISTORY].reverse().map((m, i) => (
                <View key={i} style={[s.monthCard, SHADOW]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>{m.label} 2569</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.income }}>+{fmt(m.income)}</Text>
                  </View>
                  <Bar pct={m.income / maxInc * 100} color={COLORS.income} bg={COLORS.surfaceAlt} />
                </View>
              ));
            })()
        }
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13 },
  calBox: { margin: 14, backgroundColor: COLORS.surface, borderRadius: 14, padding: 12 },
  calHeader: { flexDirection: 'row', marginBottom: 6 },
  calCell: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayDetail: { marginHorizontal: 14, marginTop: 10, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12 },
  prevLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMid, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  monthCard: { marginHorizontal: 14, marginBottom: 8, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12 },
});
