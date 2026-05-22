import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { Title, Text, Surface, IconButton, Searchbar, Divider, Card, Button, Modal, Portal, TextInput, Avatar, Badge } from 'react-native-paper';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useAuth } from '../../../src/context/AuthContext';
import AppLoader from '../../../src/components/AppLoader';

export default function CustomersScreen() {
  const { activeBusiness } = useBusiness();
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const { userRole } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    Linking.openURL(`https://wa.me/${finalPhone}`);
  };

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const q = query(
      collection(db, 'customers'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.lastInteraction?.seconds || 0) - (a.lastInteraction?.seconds || 0));
      setCustomers(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customers: ", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [activeBusiness?.id]);

  const fetchCustomerHistory = async (phone: string) => {
    if (!activeBusiness?.id) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('customerPhone', '==', phone),
        where('businessId', '==', activeBusiness.id)
      );
      const snapshot = await getDocs(q);
      const history: any[] = [];
      snapshot.forEach(doc => history.push({ id: doc.id, ...doc.data() }));
      history.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setCustomerHistory(history);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openDetails = (cust: any) => {
    setSelectedCustomer(cust);
    setDetailsVisible(true);
    if (cust.phone) fetchCustomerHistory(cust.phone);
  };

  const handleDeleteTransaction = async (sale: any) => {
    if (userRole !== 'admin') return;

    Alert.alert(
      t('deleteConfirmTitle') || 'Delete Transaction',
      t('deleteConfirmMsg') || 'Are you sure you want to delete this transaction?',
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('delete'), 
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              if (!activeBusiness?.id) return;
              
              const businessRef = doc(db, 'businesses', activeBusiness.id);
              const transactionRef = doc(db, 'transactions', sale.id);

              await runTransaction(db, async (transaction) => {
                // Restore stock for each item in the sale
                if (sale.items && Array.isArray(sale.items)) {
                  for (const item of sale.items) {
                    const itemRef = doc(db, `businesses/${activeBusiness.id}/items`, item.id);
                    transaction.update(itemRef, {
                      stockQuantity: increment(item.qty || 0)
                    });
                  }
                }

                // Decrement total sales in business doc
                transaction.update(businessRef, {
                  totalSales: increment(-sale.total)
                });
                
                // Delete the transaction doc
                transaction.delete(transactionRef);
              });

              // Refresh history
              if (selectedCustomer?.phone) fetchCustomerHistory(selectedCustomer.phone);
              Alert.alert(t('success'), t('saleDeleted') || "Transaction deleted.");
            } catch (error) {
              console.error(error);
              Alert.alert(t('error'), "Failed to delete transaction");
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleAddCustomer = async () => {
    if (!newCustName || !newCustPhone) {
      Alert.alert(t('error'), "Please fill all fields");
      return;
    }

    try {
      if (!activeBusiness) {
        Alert.alert(t('error'), "No active business found");
        return;
      }
      await addDoc(collection(db, 'customers'), {
        name: newCustName,
        phone: newCustPhone,
        address: newCustAddress,
        businessId: activeBusiness.id,
        mostOrdered: [],
        totalOrders: 0,
        lastInteraction: serverTimestamp(),
      });
      setModalVisible(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
    } catch (error) {
      Alert.alert(t('error'), "Failed to add customer");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <AppLoader message={t('loading') || 'Loading...'} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={4}>
        <View style={styles.headerTop}>
          <Title style={[styles.headerTitle, { color: theme.colors.primary }]}>{t('customers')}</Title>
          <Button icon="plus" mode="contained" onPress={() => setModalVisible(true)} buttonColor={theme.colors.primary}>
            {t('add')}
          </Button>
        </View>
        <Searchbar
          placeholder={t('search')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}
          iconColor={theme.colors.primary}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
      </Surface>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openDetails(item)} activeOpacity={0.7}>
            <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardLeft}>
                  <View>
                    <Avatar.Text 
                      size={48} 
                      label={item.name?.substring(0, 1).toUpperCase() || 'C'} 
                      style={{ backgroundColor: theme.colors.primaryContainer }} 
                      color={theme.colors.primary} 
                    />
                    {item.totalOrders > 0 && (
                      <Badge style={[styles.orderBadge, { backgroundColor: theme.colors.primary }]}>{item.totalOrders}</Badge>
                    )}
                  </View>
                  <View style={styles.infoContainer}>
                    <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.phone, { color: theme.colors.onSurfaceVariant }]}>{item.phone}</Text>
                    {item.address && (
                      <Text style={[styles.address, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                        {item.address}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <View style={styles.actionRow}>
                    <Surface style={[styles.miniAction, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                      <IconButton icon="phone" size={18} iconColor={theme.colors.primary} onPress={() => handleCall(item.phone)} style={{ margin: 0 }} />
                    </Surface>
                    <Surface style={[styles.miniAction, { backgroundColor: '#e8f5e9' }]} elevation={0}>
                      <IconButton icon="whatsapp" size={18} iconColor="#2E7D32" onPress={() => handleWhatsApp(item.phone)} style={{ margin: 0 }} />
                    </Surface>
                  </View>
                  <View style={styles.mostOrderedBox}>
                    <Text style={styles.orderLabel}>Top Items</Text>
                    <Text style={[styles.mostOrdered, { color: theme.colors.primary }]} numberOfLines={1}>
                      {item.mostOrdered?.length > 0 ? item.mostOrdered[0] : 'None'}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconButton icon="account-off-outline" size={60} iconColor={theme.colors.onSurfaceVariant} />
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('noCustomersFound') || 'No customers found'}</Text>
          </View>
        }
      />

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Title style={{ color: theme.colors.primary, marginBottom: 15 }}>{t('add')} {t('customers')}</Title>
          <TextInput
            label={t('name')}
            value={newCustName}
            onChangeText={setNewCustName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label={t('phone')}
            value={newCustPhone}
            onChangeText={setNewCustPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />
          <TextInput
            label={t('address')}
            value={newCustAddress}
            onChangeText={setNewCustAddress}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.input}
          />
          <Button mode="contained" onPress={handleAddCustomer} style={{ marginTop: 10 }} buttonColor={theme.colors.primary}>
            {t('save')}
          </Button>
        </Modal>

        {/* Customer Details Modal */}
        <Modal visible={detailsVisible} onDismiss={() => setDetailsVisible(false)} contentContainerStyle={[styles.detailsModal, { backgroundColor: theme.colors.surface }]}>
          {selectedCustomer && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailsHeader}>
                <Avatar.Text size={60} label={selectedCustomer.name[0].toUpperCase()} style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.primary} />
                <View style={{ marginLeft: 20 }}>
                  <Title style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{selectedCustomer.name}</Title>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>{selectedCustomer.phone}</Text>
                </View>
              </View>
              
              <Divider style={{ marginVertical: 15 }} />
              
              <View style={styles.ltvContainer}>
                <Surface style={[styles.ltvBox, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                  <Text style={[styles.ltvLabel, { color: theme.colors.primary }]}>Lifetime Value</Text>
                  <Text style={[styles.ltvValue, { color: theme.colors.primary }]}>
                    ₹{customerHistory.reduce((acc, curr) => acc + (curr.total || 0), 0).toLocaleString('en-IN')}
                  </Text>
                </Surface>
                <Surface style={[styles.ltvBox, { backgroundColor: theme.colors.secondaryContainer }]} elevation={0}>
                  <Text style={[styles.ltvLabel, { color: theme.colors.secondary }]}>Total Orders</Text>
                  <Text style={[styles.ltvValue, { color: theme.colors.secondary }]}>{customerHistory.length}</Text>
                </Surface>
              </View>

              <Title style={{ fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 10 }}>Order History</Title>
              {loadingHistory ? (
                <ActivityIndicator style={{ margin: 20 }} color={theme.colors.primary} />
              ) : (
                customerHistory.length > 0 ? customerHistory.map((order, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    onLongPress={() => handleDeleteTransaction(order)}
                    activeOpacity={0.6}
                  >
                    <Surface style={[styles.historyRow, { borderBottomColor: theme.colors.surfaceVariant }]} elevation={0}>
                      <View>
                        <Text style={{ fontWeight: 'bold' }}>#{order.invoiceNumber || 'INV'}</Text>
                        <Text style={{ fontSize: 12, color: '#888' }}>{order.timestamp?.toDate().toLocaleDateString()}</Text>
                      </View>
                      <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>₹{order.total.toLocaleString()}</Text>
                    </Surface>
                  </TouchableOpacity>
                )) : (
                  <Text style={{ textAlign: 'center', margin: 20, color: '#888' }}>No orders found</Text>
                )
              )}
              
              <Button mode="outlined" onPress={() => setDetailsVisible(false)} style={{ marginTop: 20 }} textColor={theme.colors.primary}>
                Close
              </Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 55, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  searchBar: { elevation: 0, borderRadius: 15, height: 45 },
  listContent: { padding: 15, paddingBottom: 40 },
  card: { marginBottom: 12, borderRadius: 20, overflow: 'hidden' },
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1.4 },
  infoContainer: { marginLeft: 15, flex: 1 },
  name: { fontSize: 17, fontWeight: 'bold', marginBottom: 2 },
  phone: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  address: { fontSize: 12, fontWeight: '400' },
  orderBadge: { position: 'absolute', top: -5, right: -5, borderWidth: 2, borderColor: 'white' },
  cardRight: { flex: 1, alignItems: 'flex-end' },
  actionRow: { flexDirection: 'row', marginBottom: 8 },
  miniAction: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  mostOrderedBox: { alignItems: 'flex-end' },
  orderLabel: { fontSize: 9, color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 0.5 },
  mostOrdered: { fontSize: 13, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  modal: { padding: 25, margin: 20, borderRadius: 28 },
  detailsModal: { padding: 25, margin: 15, borderRadius: 30, maxHeight: '85%' },
  detailsHeader: { flexDirection: 'row', alignItems: 'center' },
  ltvContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  ltvBox: { flex: 0.48, padding: 15, borderRadius: 20, alignItems: 'center' },
  ltvLabel: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  ltvValue: { fontSize: 18, fontWeight: 'bold' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  input: { marginBottom: 15, backgroundColor: 'transparent' }
});
