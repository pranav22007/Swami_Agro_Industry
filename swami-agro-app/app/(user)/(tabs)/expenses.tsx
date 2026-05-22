import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Title, Text, Surface, IconButton, Searchbar, Divider, Card, Button, Modal, Portal, TextInput, FAB, ActivityIndicator } from 'react-native-paper';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import AppLoader from '../../../src/components/AppLoader';

export default function ExpensesScreen() {
  const { activeBusiness } = useBusiness();
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  
  const [form, setForm] = useState({
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const q = query(
      collection(db, 'expenses'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      setExpenses(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching expenses: ", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [activeBusiness?.id]);

  const handleSave = async () => {
    if (!form.category || !form.amount) {
      Alert.alert(t('error'), "Please fill category and amount");
      return;
    }

    try {
      if (!activeBusiness?.id) return;

      const expenseData = {
        ...form,
        amount: parseFloat(form.amount),
        businessId: activeBusiness.id,
        updatedAt: serverTimestamp()
      };

      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), expenseData);
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...expenseData,
          createdAt: serverTimestamp()
        });
      }
      
      setModalVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert(t('error'), "Failed to save expense");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Expense", "Are you sure you want to delete this expense record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, 'expenses', id));
      }}
    ]);
  };

  const resetForm = () => {
    setForm({
      category: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setEditingExpense(null);
  };

  const openEdit = (expense: any) => {
    setEditingExpense(expense);
    setForm({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description || '',
      date: expense.date || new Date().toISOString().split('T')[0]
    });
    setModalVisible(true);
  };

  const filteredExpenses = expenses.filter(e => 
    e.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  if (loading) {
    return <AppLoader message="Loading expenses..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={4}>
        <View style={styles.headerTop}>
          <Title style={[styles.headerTitle, { color: theme.colors.primary }]}>Business Expenses</Title>
          <Button icon="plus" mode="contained" onPress={() => { resetForm(); setModalVisible(true); }} buttonColor={theme.colors.primary}>
            {t('add')}
          </Button>
        </View>
        <Searchbar
          placeholder="Search expenses..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}
          iconColor={theme.colors.primary}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
      </Surface>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Surface style={[styles.summaryBox, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.error }]}>Total Expenses</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.error }]}>₹{totalExpenses.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.error }]}>Records</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.error }]}>{filteredExpenses.length}</Text>
            </View>
          </Surface>
        }
        renderItem={({ item }) => (
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardLeft}>
                <Surface style={[styles.iconBox, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
                  <IconButton icon="cash-minus" size={24} iconColor={theme.colors.error} style={{ margin: 0 }} />
                </Surface>
                <View style={styles.infoContainer}>
                  <Text style={[styles.category, { color: theme.colors.onSurface }]} numberOfLines={1}>{item.category}</Text>
                  <Text style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>{item.date}</Text>
                  {item.description ? (
                    <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.amount, { color: theme.colors.error }]}>₹{item.amount.toLocaleString('en-IN')}</Text>
                <View style={styles.actionRow}>
                  <IconButton icon="pencil-outline" size={18} iconColor={theme.colors.primary} onPress={() => openEdit(item)} />
                  <IconButton icon="delete-outline" size={18} iconColor={theme.colors.error} onPress={() => handleDelete(item.id)} />
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconButton icon="cash-off" size={60} iconColor={theme.colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
            <Text style={{ color: theme.colors.onSurfaceVariant }}>No expenses found.</Text>
          </View>
        }
      />

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Title style={{ color: theme.colors.primary, marginBottom: 15 }}>{editingExpense ? 'Edit' : 'Add'} Expense</Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TextInput
              label="Category (e.g. Salary, Rent, Stock)"
              value={form.category}
              onChangeText={(v) => setForm({ ...form, category: v })}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Amount (₹)"
              value={form.amount}
              onChangeText={(v) => setForm({ ...form, amount: v })}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              label="Date (YYYY-MM-DD)"
              value={form.date}
              onChangeText={(v) => setForm({ ...form, date: v })}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Description (Optional)"
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.input}
            />
            <Button mode="contained" onPress={handleSave} style={{ marginTop: 10 }} buttonColor={theme.colors.primary}>
              {t('save')}
            </Button>
            <Button mode="text" onPress={() => setModalVisible(false)} style={{ marginTop: 5 }}>
              Cancel
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 55, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  searchBar: { elevation: 0, borderRadius: 15, height: 45 },
  summaryBox: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    padding: 18,
    borderRadius: 24,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: 'bold' },
  summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(0,0,0,0.05)' },
  listContent: { paddingBottom: 40 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 20, overflow: 'hidden' },
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1.5 },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  infoContainer: { flex: 1 },
  category: { fontSize: 17, fontWeight: 'bold', marginBottom: 2 },
  date: { fontSize: 12, fontWeight: '500' },
  description: { fontSize: 12, marginTop: 2 },
  cardRight: { flex: 1, alignItems: 'flex-end' },
  amount: { fontSize: 18, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  modal: { padding: 25, margin: 20, borderRadius: 28, maxHeight: '80%' },
  input: { marginBottom: 15, backgroundColor: 'transparent' }
});
