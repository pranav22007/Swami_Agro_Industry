import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Switch, TouchableOpacity, Alert, Image, Dimensions, ActivityIndicator } from 'react-native';
import { Title, Text, Surface, Divider, Avatar, Button, IconButton, Modal, Portal, TextInput, List, Badge, Card } from 'react-native-paper';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../src/config/firebase';
import { useRouter } from 'expo-router';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';

const { width } = Dimensions.get('window');

export default function SettingsScreen() {
  const { businesses, activeBusiness, setActiveBusiness } = useBusiness();
  const { isDarkMode, toggleTheme, theme } = useAppTheme();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  
  const [gstModalVisible, setGstModalVisible] = useState(false);
  const [gstValue, setGstValue] = useState(activeBusiness?.defaultGst?.toString() || '18');
  
  const [cdModalVisible, setCdModalVisible] = useState(false);
  const [cdValue, setCdValue] = useState(activeBusiness?.defaultCd?.toString() || '2');
  
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  // Bank Form State
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: ''
  });

  const checkUpdates = async () => {
    if (__DEV__) {
      Alert.alert('Development Mode', 'Update check is not available in development.');
      return;
    }
    
    setCheckingUpdates(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert(
          'Update Available',
          'A new minor update is available. Restart the app now to apply it?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Restart Now', onPress: () => Updates.reloadAsync() }
          ]
        );
      } else {
        Alert.alert('Up to Date', 'You are already using the latest version of the app.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Check Failed', 'Could not check for updates at this time. Please try again later.');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const exportSalesCSV = async () => {
    if (!activeBusiness?.id) return;
    setExporting(true);
    try {
      const q = query(collection(db, 'transactions'), where('businessId', '==', activeBusiness.id));
      const snapshot = await getDocs(q);
      
      let csv = 'Date,Invoice,Customer,Phone,Total,Payment Status\n';
      snapshot.forEach(doc => {
        const d = doc.data();
        const date = d.timestamp?.toDate().toLocaleDateString() || '';
        csv += `${date},${d.invoiceNumber},${d.customerName},${d.customerPhone},${d.total},${d.paymentStatus || 'paid'}\n`;
      });

      // @ts-ignore
      const fileUri = `${FileSystem.documentDirectory}sales_export_${Date.now()}.csv`;
      // @ts-ignore
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error(error);
      Alert.alert('Export Failed', 'Could not export sales data.');
    } finally {
      setExporting(false);
    }
  };

  const exportCustomersCSV = async () => {
    if (!activeBusiness?.id) return;
    setExporting(true);
    try {
      const q = query(collection(db, 'customers'), where('businessId', '==', activeBusiness.id));
      const snapshot = await getDocs(q);
      
      let csv = 'Name,Phone,Address,Total Orders\n';
      snapshot.forEach(doc => {
        const d = doc.data();
        csv += `${d.name},${d.phone},"${d.address || ''}",${d.totalOrders || 0}\n`;
      });

      // @ts-ignore
      const fileUri = `${FileSystem.documentDirectory}customers_export_${Date.now()}.csv`;
      // @ts-ignore
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error(error);
      Alert.alert('Export Failed', 'Could not export customer data.');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('logout'), 'Are you sure you want to log out?', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), onPress: () => auth.signOut(), style: 'destructive' }
    ]);
  };

  const updateBusinessConfig = async (field: string, value: any) => {
    if (!activeBusiness?.id) return;
    try {
      await updateDoc(doc(db, 'businesses', activeBusiness.id), { [field]: value });
      setGstModalVisible(false);
      setCdModalVisible(false);
    } catch (err) {
      Alert.alert(t('error'), t('updateFailed'));
    }
  };

  const addBankDetail = async () => {
    if (!activeBusiness?.id) return;
    if (!bankForm.bankName || !bankForm.accountNumber) {
      Alert.alert('Error', 'Please enter bank name and account number');
      return;
    }

    try {
      const currentBanks = activeBusiness.banks || [];
      const updatedBanks = [...currentBanks, bankForm];
      await updateDoc(doc(db, 'businesses', activeBusiness.id), { banks: updatedBanks });
      setBankForm({ bankName: '', accountNumber: '', ifscCode: '', branch: '' });
      Alert.alert('Success', 'Bank details added successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to add bank details');
    }
  };

  const deleteBankDetail = async (index: number) => {
    if (!activeBusiness?.id) return;
    try {
      const updatedBanks = activeBusiness.banks.filter((_: any, i: number) => i !== index);
      await updateDoc(doc(db, 'businesses', activeBusiness.id), { banks: updatedBanks });
    } catch (err) {
      Alert.alert('Error', 'Failed to delete bank detail');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={4}>
        <Title style={[styles.headerTitle, { color: theme.colors.primary }]}>{t('settings')}</Title>
      </Surface>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>{t('appearance')}</Text>
        </View>
        <Card style={styles.settingsCard} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <IconButton icon="theme-light-dark" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>{t('darkMode')}</Text>
              </View>
              <Switch value={isDarkMode} onValueChange={toggleTheme} thumbColor={isDarkMode ? theme.colors.primary : '#f4f3f4'} trackColor={{ false: '#767577', true: theme.colors.primaryContainer }} />
            </View>
            <Divider style={styles.itemDivider} />
            <TouchableOpacity onPress={() => router.push('/(user)/settings/language')}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="translate" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>{t('language')}</Text>
                </View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{language === 'en' ? 'English' : 'मराठी'}</Text>
              </View>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Configuration Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Business Configuration</Text>
        </View>
        <Card style={styles.settingsCard} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <TouchableOpacity onPress={() => setGstModalVisible(true)}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="percent" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>{t('gstPercentage')}</Text>
                </View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{activeBusiness?.defaultGst || 18}%</Text>
              </View>
            </TouchableOpacity>
            <Divider style={styles.itemDivider} />
            <TouchableOpacity onPress={() => setCdModalVisible(true)}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="cash-minus" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>CD Percentage</Text>
                </View>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{activeBusiness?.defaultCd || 2}%</Text>
              </View>
            </TouchableOpacity>
            <Divider style={styles.itemDivider} />
            <TouchableOpacity onPress={() => setBankModalVisible(true)}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="bank-outline" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>{t('bankDetails')}</Text>
                </View>
                <Badge 
                  style={{ backgroundColor: theme.colors.primaryContainer, color: theme.colors.primary }}
                  size={22}
                >
                  {activeBusiness?.banks?.length || 0}
                </Badge>
              </View>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Data Export Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Data & Exports</Text>
        </View>
        <Card style={styles.settingsCard} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <TouchableOpacity onPress={exportSalesCSV} disabled={exporting}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="file-export-outline" size={24} iconColor="#00796B" style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>Export Sales (CSV)</Text>
                </View>
                {exporting ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <IconButton icon="chevron-right" size={20} />}
              </View>
            </TouchableOpacity>
            <Divider style={styles.itemDivider} />
            <TouchableOpacity onPress={exportCustomersCSV} disabled={exporting}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="account-arrow-right-outline" size={24} iconColor="#00796B" style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>Export Customers (CSV)</Text>
                </View>
                {exporting ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <IconButton icon="chevron-right" size={20} />}
              </View>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Account</Text>
        </View>
        <Card style={styles.settingsCard} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(user)/business-setup', params: { edit: 'true', id: activeBusiness?.id } })}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="store-edit-outline" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>{t('manageBusiness')}</Text>
                </View>
                <IconButton icon="chevron-right" size={20} />
              </View>
            </TouchableOpacity>
            <Divider style={styles.itemDivider} />
            
            <TouchableOpacity onPress={checkUpdates} disabled={checkingUpdates}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="update" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>Check for Updates</Text>
                </View>
                {checkingUpdates ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <IconButton icon="chevron-right" size={20} />}
              </View>
            </TouchableOpacity>
            <Divider style={styles.itemDivider} />

            <TouchableOpacity onPress={handleLogout}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <IconButton icon="logout" size={24} iconColor={theme.colors.error} style={styles.settingIcon} />
                  <Text style={[styles.settingText, { color: theme.colors.error, fontWeight: 'bold' }]}>{t('logout')}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        <View style={styles.versionInfo}>
          <Text style={[styles.versionText, { color: theme.colors.onSurfaceVariant }]}>{t('version')} 2.1.0 (Premium)</Text>
          <Text style={[styles.versionText, { color: theme.colors.onSurfaceVariant }]}>{t('build')} 2026.05.22</Text>
        </View>
      </ScrollView>

      {/* Portals */}
      <Portal>
        {/* GST Modal */}
        <Modal visible={gstModalVisible} onDismiss={() => setGstModalVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Title style={styles.modalTitle}>{t('gstSettings')}</Title>
          <TextInput label={t('gstPercentage')} value={gstValue} onChangeText={setGstValue} keyboardType="numeric" mode="outlined" style={styles.modalInput} />
          <Button mode="contained" onPress={() => updateBusinessConfig('defaultGst', parseFloat(gstValue))} style={styles.modalBtn}>
            {t('save')}
          </Button>
        </Modal>
        
        {/* CD Modal */}
        <Modal visible={cdModalVisible} onDismiss={() => setCdModalVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Title style={styles.modalTitle}>Cash Discount (CD) Settings</Title>
          <TextInput label="Default CD Percentage" value={cdValue} onChangeText={setCdValue} keyboardType="numeric" mode="outlined" style={styles.modalInput} />
          <Button mode="contained" onPress={() => updateBusinessConfig('defaultCd', parseFloat(cdValue))} style={styles.modalBtn}>
            {t('save')}
          </Button>
        </Modal>

        {/* Bank Details Modal */}
        <Modal visible={bankModalVisible} onDismiss={() => setBankModalVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface, maxHeight: '85%' }]}>
          <Title style={styles.modalTitle}>{t('bankDetails')}</Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            {activeBusiness?.banks?.map((bank: any, idx: number) => (
              <Surface key={idx} style={[styles.bankItem, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                <View style={styles.bankItemText}>
                  <Text style={styles.bankNameText}>{bank.bankName}</Text>
                  <Text style={styles.bankAccountText}>{bank.accountNumber}</Text>
                  <Text style={styles.bankMetaText}>{`${bank.ifscCode} • ${bank.branch}`}</Text>
                </View>
                <IconButton 
                  icon="delete-outline" 
                  iconColor={theme.colors.error} 
                  size={22} 
                  onPress={() => deleteBankDetail(idx)} 
                  style={styles.bankDeleteIcon}
                />
              </Surface>
            ))}

            <Divider style={{ marginVertical: 15 }} />
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Add New Bank</Text>
            
            <TextInput 
              label="Bank Name" 
              value={bankForm.bankName} 
              onChangeText={v => setBankForm({ ...bankForm, bankName: v })} 
              mode="outlined" 
              style={styles.modalInput} 
            />
            <TextInput 
              label="Account Number" 
              value={bankForm.accountNumber} 
              onChangeText={v => setBankForm({ ...bankForm, accountNumber: v })} 
              mode="outlined" 
              style={styles.modalInput} 
              keyboardType="numeric"
            />
            <TextInput 
              label="IFSC Code" 
              value={bankForm.ifscCode} 
              onChangeText={v => setBankForm({ ...bankForm, ifscCode: v.toUpperCase() })} 
              mode="outlined" 
              style={styles.modalInput} 
              autoCapitalize="characters"
            />
            <TextInput 
              label="Branch" 
              value={bankForm.branch} 
              onChangeText={v => setBankForm({ ...bankForm, branch: v })} 
              mode="outlined" 
              style={styles.modalInput} 
            />
            
            <Button mode="contained" onPress={addBankDetail} style={styles.modalBtn}>
              Add Bank
            </Button>
            <Button mode="text" onPress={() => setBankModalVisible(false)}>
              Close
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
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  content: { padding: 20 },
  sectionHeader: { marginBottom: 10, marginLeft: 5 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  settingsCard: { borderRadius: 20, marginBottom: 25, overflow: 'hidden' },
  cardContent: { paddingVertical: 5 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { marginRight: 5 },
  settingText: { fontSize: 16, fontWeight: '500' },
  itemDivider: { opacity: 0.1, marginHorizontal: 15 },
  versionInfo: { alignItems: 'center', marginTop: 10, marginBottom: 40 },
  versionText: { fontSize: 12, opacity: 0.6 },
  modal: { padding: 25, margin: 20, borderRadius: 28, maxHeight: '80%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', fontSize: 20, marginBottom: 15 },
  modalInput: { marginBottom: 15, backgroundColor: 'transparent' },
  modalBtn: { marginTop: 10, borderRadius: 12, paddingVertical: 5 },
  bankItem: { padding: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bankItemText: { flex: 1 },
  bankNameText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  bankAccountText: { fontSize: 14, color: '#555', marginTop: 2 },
  bankMetaText: { fontSize: 12, color: '#888', marginTop: 2 },
  bankDeleteIcon: { margin: 0, marginRight: -5 }
});
