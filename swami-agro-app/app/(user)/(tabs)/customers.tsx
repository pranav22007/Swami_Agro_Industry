import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { Title, Text, Surface, IconButton, Searchbar, Divider, Card, Button, Modal, Portal, TextInput, Avatar, Badge } from 'react-native-paper';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';

export default function CustomersScreen() {
  const { activeBusiness } = useBusiness();
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    Linking.openURL(`https://wa.me/${finalPhone}`);
  };

  useEffect(() => {
    if (!activeBusiness) return;

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
  }, [activeBusiness]);

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
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
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
  input: { marginBottom: 15, backgroundColor: 'transparent' }
});
