import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import CategoryDetailScreen from './src/screens/CategoryDetailScreen';
import AddItemSheet, { EditTarget } from './src/components/AddItemSheet';

import { INIT_CATS, INIT_INCOME_CATS, ExpenseCategory, IncomeCategory } from './src/data';
import { COLORS } from './src/theme';

type Screen = 'home' | 'history';

export default function App() {
  const [cats, setCats] = useState<ExpenseCategory[]>(INIT_CATS);
  const [incomeCats, setIncomeCats] = useState<IncomeCategory[]>(INIT_INCOME_CATS);
  const [screen, setScreen] = useState<Screen>('home');
  const [catId, setCatId] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const totalSpent  = useMemo(() => cats.reduce((s, c) => s + c.spent, 0), [cats]);
  const totalIncome = useMemo(() => incomeCats.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.amt, 0), 0), [incomeCats]);

  const addItem = ({ catId: cId, item }: { catId: string; item: any }) => {
    setCats(cs => cs.map(c => c.id === cId ? { ...c, items: [item, ...c.items], spent: c.spent + item.amt, count: c.count + 1 } : c));
  };
  const addIncome = ({ catId: cId, item }: { catId: string; item: any }) => {
    setIncomeCats(cs => cs.map(c => c.id === cId ? { ...c, items: [item, ...c.items] } : c));
  };

  const editItem = ({ oldCatId, itemId, newCatId, updated }: { oldCatId: string; itemId: number; newCatId: string; updated: any }) => {
    setCats(cs => {
      let removedItem: any = null;
      const removed = cs.map(c => {
        if (c.id !== oldCatId) return c;
        const item = c.items.find(i => i.id === itemId);
        if (!item) return c;
        removedItem = item;
        return { ...c, items: c.items.filter(i => i.id !== itemId), spent: c.spent - item.amt, count: c.count - 1 };
      });
      if (!removedItem) return cs;
      const newItem = { ...removedItem, ...updated };
      return removed.map(c => c.id === newCatId ? { ...c, items: [newItem, ...c.items], spent: c.spent + newItem.amt, count: c.count + 1 } : c);
    });
  };
  const deleteItem = (cId: string, itemId: number) => {
    setCats(cs => cs.map(c => {
      if (c.id !== cId) return c;
      const item = c.items.find(i => i.id === itemId);
      if (!item) return c;
      return { ...c, items: c.items.filter(i => i.id !== itemId), spent: c.spent - item.amt, count: c.count - 1 };
    }));
  };

  const editIncome = ({ oldCatId, itemId, newCatId, updated }: { oldCatId: string; itemId: number; newCatId: string; updated: any }) => {
    setIncomeCats(cs => {
      let removedItem: any = null;
      const removed = cs.map(c => {
        if (c.id !== oldCatId) return c;
        const item = c.items.find(i => i.id === itemId);
        if (!item) return c;
        removedItem = item;
        return { ...c, items: c.items.filter(i => i.id !== itemId) };
      });
      if (!removedItem) return cs;
      const newItem = { ...removedItem, ...updated };
      return removed.map(c => c.id === newCatId ? { ...c, items: [newItem, ...c.items] } : c);
    });
  };
  const deleteIncome = (cId: string, itemId: number) => {
    setIncomeCats(cs => cs.map(c => c.id === cId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c));
  };

  const openEdit = (target: EditTarget) => {
    setEditTarget(target);
    setShowSheet(true);
  };
  const closeSheet = () => {
    setShowSheet(false);
    setEditTarget(null);
  };

  const activeCat = catId ? cats.find(c => c.id === catId) ?? null : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
          {/* Screen content */}
          {activeCat ? (
            <CategoryDetailScreen
              cat={activeCat}
              onBack={() => setCatId(null)}
              onItemPress={item => openEdit({ type: 'expense', catId: activeCat.id, item })}
            />
          ) : screen === 'history' ? (
            <HistoryScreen cats={cats} incomeCats={incomeCats} />
          ) : (
            <HomeScreen
              cats={cats}
              incomeCats={incomeCats}
              totalSpent={totalSpent}
              totalIncome={totalIncome}
              onCat={id => setCatId(id)}
              onAdd={() => setShowSheet(true)}
              onItemPress={(type, cId, item) => openEdit({ type, catId: cId, item })}
            />
          )}

          {/* Bottom tab bar (hidden when in category detail) */}
          {!activeCat && (
            <View style={s.tabBar}>
              {([
                { id: 'home' as Screen,    label: 'หน้าหลัก', icon: '🏠' },
                { id: 'history' as Screen, label: 'ประวัติ',   icon: '📅' },
              ]).map(tab => (
                <TouchableOpacity key={tab.id} onPress={() => setScreen(tab.id)} style={s.tabItem}>
                  <Text style={{ fontSize: 20 }}>{tab.icon}</Text>
                  <Text style={[s.tabLabel, { color: screen === tab.id ? COLORS.accent : COLORS.textDim, fontWeight: screen === tab.id ? '600' : '400' }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <AddItemSheet
          visible={showSheet}
          cats={cats}
          incomeCats={incomeCats}
          editTarget={editTarget}
          onAdd={addItem}
          onAddIncome={addIncome}
          onEdit={editItem}
          onEditIncome={editIncome}
          onDelete={deleteItem}
          onDeleteIncome={deleteIncome}
          onClose={closeSheet}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
  },
});
