import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Alert, ScrollView } from 'react-native';
import { TextInput, Button, FAB, IconButton, Modal, Portal, Surface, Title, Text, ActivityIndicator, Divider, Badge, Card } from 'react-native-paper';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useRouter } from 'expo-router';

export default function ItemsScreen() {
  const { activeBusiness } = useBusiness();
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const initialForm = { 
    name: '', 
    price: '', 
    gst: '18', 
    stockQuantity: '0', 
    lowStockThreshold: '5' 
  };
  
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const q = query(collection(db, `businesses/${activeBusiness.id}/items`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemList: any[] = [];
      snapshot.forEach((doc) => itemList.push({ id: doc.id, ...doc.data() }));
      setItems(itemList);
      setLoading(false);
    });

    return unsubscribe;
  }, [activeBusiness?.id]);

  const handleSave = async () => {
    if (!form.name || !form.price) {
      Alert.alert(t('error'), 'Please fill all fields');
      return;
    }

    if (!activeBusiness?.id) {
      Alert.alert(t('error'), 'No active business');
      return;
    }

    try {
      const itemData = {
        ...form,
        price: parseFloat(form.price),
        gst: parseFloat(form.gst),
        stockQuantity: parseFloat(form.stockQuantity || '0'),
        lowStockThreshold: parseFloat(form.lowStockThreshold || '5')
      };

      if (editingItem) {
        await updateDoc(doc(db, `businesses/${activeBusiness.id}/items`, editingItem.id), itemData);
      } else {
        await addDoc(collection(db, `businesses/${activeBusiness.id}/items`), itemData);
      }
      setModalVisible(false);
      setForm(initialForm);
      setEditingItem(null);
    } catch (error) {
      console.error('Offline sync queued:', error);
      setModalVisible(false);
      setForm(initialForm);
      setEditingItem(null);
    }
  };

  const deleteItem = (id: string) => {
    if (!activeBusiness?.id) return;
    Alert.alert(t('delete'), 'Are you sure?', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), onPress: async () => await deleteDoc(doc(db, `businesses/${activeBusiness.id}/items`, id)) }
    ]);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setForm({ 
      name: item.name, 
      price: item.price.toString(), 
      gst: item.gst.toString(),
      stockQuantity: (item.stockQuantity || 0).toString(),
      lowStockThreshold: (item.lowStockThreshold || 5).toString()
    });
    setModalVisible(true);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={4}>
        <View style={styles.headerRow}>
          <IconButton icon="arrow-left" onPress={() => router.back()} iconColor={theme.colors.primary} />
          <Title style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{t('items')}</Title>
        </View>
      </Surface>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={[styles.itemCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Card.Content style={styles.itemContent}>
              <View style={styles.itemLeft}>
                <Surface style={[styles.itemIcon, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                  <IconButton icon="package-variant" size={24} iconColor={theme.colors.primary} style={{ margin: 0 }} />
                </Surface>
                <View style={styles.itemTextContainer}>
                  <Text style={[styles.itemName, { color: theme.colors.onSurface }]} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.itemPrice, { color: theme.colors.primary }]}>₹{item.price.toLocaleString('en-IN')}</Text>
                    <Badge style={[styles.gstBadge, { backgroundColor: theme.colors.secondaryContainer, color: theme.colors.secondary }]}>{`${item.gst}% GST`}</Badge>
                  </View>
                  <View style={styles.stockRow}>
                    <Text style={[styles.stockText, { color: (item.stockQuantity || 0) <= (item.lowStockThreshold || 5) ? theme.colors.error : theme.colors.onSurfaceVariant }]}>
                      Stock: {item.stockQuantity || 0} units
                    </Text>
                    {(item.stockQuantity || 0) <= (item.lowStockThreshold || 5) && (
                      <Badge style={styles.lowStockBadge}>LOW STOCK</Badge>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.itemActions}>
                <Surface style={styles.actionCircle} elevation={0}>
                  <IconButton icon="pencil" size={18} iconColor={theme.colors.primary} onPress={() => openEdit(item)} style={{ margin: 0 }} />
                </Surface>
                <Surface style={[styles.actionCircle, { marginLeft: 8 }]} elevation={0}>
                  <IconButton icon="delete" size={18} iconColor={theme.colors.error} onPress={() => deleteItem(item.id)} style={{ margin: 0 }} />
                </Surface>
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <IconButton icon="package-variant-closed" size={80} iconColor={theme.colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 16 }}>No items found. Add your first product!</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="white"
        onPress={() => { setEditingItem(null); setForm(initialForm); setModalVisible(true); }}
        label="Add Item"
      />

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Title style={[styles.modalTitle, { color: theme.colors.primary }]}>{editingItem ? 'Edit Product' : 'Add New Product'}</Title>
          <Divider style={styles.modalDivider} />
          
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Product Name</Text>
              <TextInput
                placeholder="e.g. Organic Fertilizer"
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                mode="outlined"
                style={styles.input}
                outlineColor="#e0e0e0"
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Price (₹)</Text>
                <TextInput
                  placeholder="0.00"
                  value={form.price}
                  onChangeText={(v) => setForm({ ...form, price: v })}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  outlineColor="#e0e0e0"
                  activeOutlineColor={theme.colors.primary}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>GST (%)</Text>
                <TextInput
                  placeholder="18"
                  value={form.gst}
                  onChangeText={(v) => setForm({ ...form, gst: v })}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  outlineColor="#e0e0e0"
                  activeOutlineColor={theme.colors.primary}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Stock Quantity</Text>
                <TextInput
                  placeholder="0"
                  value={form.stockQuantity}
                  onChangeText={(v) => setForm({ ...form, stockQuantity: v })}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  outlineColor="#e0e0e0"
                  activeOutlineColor={theme.colors.primary}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Low Stock Alert At</Text>
                <TextInput
                  placeholder="5"
                  value={form.lowStockThreshold}
                  onChangeText={(v) => setForm({ ...form, lowStockThreshold: v })}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  outlineColor="#e0e0e0"
                  activeOutlineColor={theme.colors.primary}
                />
              </View>
            </View>

            <Button mode="contained" onPress={handleSave} style={styles.saveBtn} contentStyle={styles.saveBtnContent}>
              {editingItem ? 'Update Product' : 'Add Product'}
            </Button>
            <Button mode="text" onPress={() => setModalVisible(false)} textColor={theme.colors.onSurfaceVariant}>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 10,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    zIndex: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  listContainer: { padding: 15, paddingBottom: 100 },
  itemCard: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemTextContainer: { flex: 1 },
  itemName: { fontSize: 17, fontWeight: 'bold', marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  itemPrice: { fontSize: 16, fontWeight: '800', marginRight: 10 },
  gstBadge: { borderRadius: 6, fontWeight: 'bold', paddingHorizontal: 6 },
  stockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  stockText: { fontSize: 12, fontWeight: '600' },
  lowStockBadge: { marginLeft: 8, height: 20, fontSize: 10, textAlignVertical: 'center', backgroundColor: '#FFEBEE', color: '#D32F2F', fontWeight: 'bold' },
  itemActions: { flexDirection: 'row', alignItems: 'center' },
  actionCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', margin: 20, right: 0, bottom: 20, borderRadius: 20, elevation: 4 },
  modal: { padding: 25, margin: 20, borderRadius: 30, maxHeight: '85%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', fontSize: 22, marginBottom: 10 },
  modalDivider: { marginBottom: 20, opacity: 0.5 },
  formGroup: { marginBottom: 18 },
  formRow: { flexDirection: 'row' },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#888', marginBottom: 6, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: 'transparent' },
  saveBtn: { marginTop: 15, borderRadius: 15, marginBottom: 5, elevation: 2 },
  saveBtnContent: { paddingVertical: 8 },
  empty: { alignItems: 'center', marginTop: 100, padding: 40 }
});
