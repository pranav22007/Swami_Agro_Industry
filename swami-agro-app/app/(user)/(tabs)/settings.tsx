import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Switch, TouchableOpacity, Alert, Image, Dimensions } from 'react-native';
import { Title, Text, Surface, Divider, Avatar, Button, IconButton, Modal, Portal, TextInput, RadioButton, List, Card, Badge } from 'react-native-paper';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../../src/config/firebase';
import { useRouter } from 'expo-router';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

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
  
  const [loading, setLoading] = useState(false);

  const handleDeleteBusiness = async () => {
    if (!activeBusiness) return;

    Alert.alert(
      'Delete Business',
      `Are you sure you want to delete "${activeBusiness.businessName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            setLoading(true);
            try {
              // Delete from Firestore
              await deleteDoc(doc(db, 'businesses', activeBusiness.id));
              
              // Find another business to switch to
              const otherBusinesses = businesses.filter(b => b.id !== activeBusiness.id);
              if (otherBusinesses.length > 0) {
                setActiveBusiness(otherBusinesses[0]);
                Alert.alert(t('success'), 'Business deleted. Switched to your next business.');
                router.replace('/(user)/(tabs)'); // Redirect to dashboard
              } else {
                router.replace('/(user)/business-setup');
              }
            } catch (error) {
              console.error(error);
              Alert.alert(t('error'), 'Failed to delete business');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: ''
  });

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to exit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: async () => {
          await signOut(auth);
          router.replace('/');
        }
      }
    ]);
  };

  const handleUpdateGst = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const businessRef = doc(db, 'businesses', activeBusiness.id);
      await updateDoc(businessRef, {
        defaultGst: parseFloat(gstValue)
      });
      setGstModalVisible(false);
      Alert.alert(t('success'), t('gstUpdated'));
    } catch (error) {
      console.error(error);
      Alert.alert(t('error'), t('updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCd = async () => {
    if (!activeBusiness) return;
    setLoading(true);
    try {
      const businessRef = doc(db, 'businesses', activeBusiness.id);
      await updateDoc(businessRef, {
        defaultCd: parseFloat(cdValue)
      });
      setCdModalVisible(false);
      Alert.alert(t('success'), 'CD percentage updated successfully');
    } catch (error) {
      console.error(error);
      Alert.alert(t('error'), t('updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBank = async () => {
    if (!activeBusiness) return;
    if (!bankForm.bankName || !bankForm.accountNumber) {
      Alert.alert(t('error'), 'Bank Name and Account Number are required');
      return;
    }

    setLoading(true);
    try {
      const businessRef = doc(db, 'businesses', activeBusiness.id);
      let updatedBanks = [...(activeBusiness.banks || [])];
      
      if (editingBank !== null) {
        updatedBanks[editingBank] = bankForm;
      } else {
        updatedBanks.push(bankForm);
      }

      await updateDoc(businessRef, { banks: updatedBanks });
      setBankModalVisible(false);
      setEditingBank(null);
      setBankForm({ bankName: '', accountNumber: '', ifscCode: '', branch: '' });
    } catch (error) {
      console.error(error);
      Alert.alert(t('error'), 'Failed to update bank details');
    } finally {
      setLoading(false);
    }
  };

  const deleteBank = async (index: number) => {
    if (!activeBusiness) return;
    Alert.alert('Delete Bank', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          const businessRef = doc(db, 'businesses', activeBusiness.id);
          let updatedBanks = activeBusiness.banks.filter((_: any, i: number) => i !== index);
          await updateDoc(businessRef, { banks: updatedBanks });
        }
      }
    ]);
  };

  const openEditBank = (bank: any, index: number) => {
    setEditingBank(index);
    setBankForm(bank);
    setBankModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Title style={[styles.headerTitle, { color: theme.colors.primary }]}>{t('settings')}</Title>
      </Surface>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User/Business Profile Section */}
        <Surface style={[styles.profileCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.profileInfo}>
            {activeBusiness?.photoUrl ? (
              <Image source={{ uri: activeBusiness.photoUrl }} style={styles.profileAvatar} />
            ) : (
              <Surface style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primaryContainer }]} elevation={1}>
                <IconButton icon="store" size={30} iconColor={theme.colors.primary} />
              </Surface>
            )}
            <View style={styles.profileText}>
              <Text style={[styles.bizName, { color: theme.colors.onSurface }]}>{activeBusiness?.businessName}</Text>
              <Text style={[styles.ownerName, { color: theme.colors.onSurfaceVariant }]}>{activeBusiness?.ownerName}</Text>
            </View>
          </View>
          <Divider style={styles.profileDivider} />
          <Button 
            mode="contained" 
            onPress={() => router.push({ pathname: '/(user)/business-setup', params: { edit: 'true', id: activeBusiness?.id } })}
            style={styles.editProfileBtn}
            icon="pencil-outline"
          >
            Edit Business Profile
          </Button>
        </Surface>

        {/* App Settings Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>App Preferences</Text>
        </View>
        <Card style={styles.settingsCard} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <IconButton icon="theme-light-dark" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>{t('darkMode')}</Text>
              </View>
              <Switch value={isDarkMode} onValueChange={toggleTheme} color={theme.colors.primary} />
            </View>
            <Divider style={styles.itemDivider} />
            <View style={[styles.settingItem, { paddingBottom: 5 }]}>
              <View style={styles.settingLeft}>
                <IconButton icon="translate" size={24} iconColor={theme.colors.primary} style={styles.settingIcon} />
                <Text style={[styles.settingText, { color: theme.colors.onSurface }]}>{t('language')}</Text>
              </View>
              <View style={styles.langSelector}>
                <TouchableOpacity onPress={() => setLanguage('en')} style={[styles.langBtn, language === 'en' && { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text style={[styles.langBtnText, language === 'en' && { color: theme.colors.primary, fontWeight: 'bold' }]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setLanguage('mr')} style={[styles.langBtn, language === 'mr' && { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text style={[styles.langBtnText, language === 'mr' && { color: theme.colors.primary, fontWeight: 'bold' }]}>मराठी</Text>
                </TouchableOpacity>
              </View>
            </View>
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
                <Badge style={{ backgroundColor: theme.colors.primaryContainer, color: theme.colors.primary }}>{activeBusiness?.banks?.length || 0}</Badge>
              </View>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Bank List View */}
        {activeBusiness?.banks && activeBusiness.banks.length > 0 && (
          <Surface style={[styles.bankList, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text style={styles.listSubTitle}>Saved Bank Accounts</Text>
            {activeBusiness.banks.map((bank: any, index: number) => (
              <View key={index}>
                <View style={styles.bankItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankNameText}>{bank.bankName}</Text>
                    <Text style={styles.bankDetailText}>{bank.accountNumber} • {bank.branch}</Text>
                  </View>
                  <View style={styles.bankActions}>
                    <IconButton icon="pencil-outline" size={18} iconColor={theme.colors.primary} onPress={() => openEditBank(bank, index)} />
                    <IconButton icon="delete-outline" size={18} iconColor={theme.colors.error} onPress={() => deleteBank(index)} />
                  </View>
                </View>
                {index < activeBusiness.banks.length - 1 && <Divider />}
              </View>
            ))}
          </Surface>
        )}

        <Button 
          mode="contained" 
          onPress={handleDeleteBusiness} 
          style={styles.deleteBtn} 
          buttonColor={theme.colors.surfaceVariant}
          textColor={theme.colors.error}
          icon="delete-outline"
          loading={loading}
        >
          Delete This Business
        </Button>

        <Button 
          mode="contained" 
          onPress={handleLogout} 
          style={styles.logoutBtn} 
          buttonColor={theme.colors.error}
          icon="logout"
          contentStyle={{ paddingVertical: 5 }}
        >
          Logout Session
        </Button>
        
        <Text style={styles.versionText}>Swami Agro Industry v1.2.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals for Settings */}
      <Portal>
        {/* GST Modal */}
        <Modal visible={gstModalVisible} onDismiss={() => setGstModalVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Title style={styles.modalTitle}>{t('gstSettings')}</Title>
          <Divider style={{ marginBottom: 20 }} />
          <TextInput
            label={t('gstPercentage')}
            value={gstValue}
            onChangeText={setGstValue}
            keyboardType="numeric"
            mode="outlined"
            style={styles.modalInput}
            outlineColor="#eee"
            activeOutlineColor={theme.colors.primary}
          />
          <Button mode="contained" onPress={handleUpdateGst} loading={loading} style={styles.modalBtn}>Update</Button>
          <Button mode="text" onPress={() => setGstModalVisible(false)}>Cancel</Button>
        </Modal>

        {/* CD Modal */}
        <Modal visible={cdModalVisible} onDismiss={() => setCdModalVisible(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Title style={styles.modalTitle}>CD Settings</Title>
          <Divider style={{ marginBottom: 20 }} />
          <TextInput
            label="CD Percentage (%)"
            value={cdValue}
            onChangeText={setCdValue}
            keyboardType="numeric"
            mode="outlined"
            style={styles.modalInput}
            outlineColor="#eee"
            activeOutlineColor={theme.colors.primary}
          />
          <Button mode="contained" onPress={handleUpdateCd} loading={loading} style={styles.modalBtn}>Update CD</Button>
          <Button mode="text" onPress={() => setCdModalVisible(false)}>Cancel</Button>
        </Modal>

        {/* Bank Modal */}
        <Modal visible={bankModalVisible} onDismiss={() => { setBankModalVisible(false); setEditingBank(null); }} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Title style={styles.modalTitle}>{editingBank !== null ? 'Edit Bank Account' : 'Add Bank Account'}</Title>
          <Divider style={{ marginBottom: 20 }} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <TextInput label="Bank Name" value={bankForm.bankName} onChangeText={v => setBankForm({ ...bankForm, bankName: v })} mode="outlined" style={styles.modalInput} outlineColor="#eee" activeOutlineColor={theme.colors.primary} />
            <TextInput label="Account Number" value={bankForm.accountNumber} onChangeText={v => setBankForm({ ...bankForm, accountNumber: v })} mode="outlined" style={styles.modalInput} outlineColor="#eee" activeOutlineColor={theme.colors.primary} />
            <TextInput label="IFSC Code" value={bankForm.ifscCode} onChangeText={v => setBankForm({ ...bankForm, ifscCode: v })} mode="outlined" style={styles.modalInput} outlineColor="#eee" activeOutlineColor={theme.colors.primary} />
            <TextInput label="Branch Name" value={bankForm.branch} onChangeText={v => setBankForm({ ...bankForm, branch: v })} mode="outlined" style={styles.modalInput} outlineColor="#eee" activeOutlineColor={theme.colors.primary} />
            <Button mode="contained" onPress={handleSaveBank} loading={loading} style={styles.modalBtn}>Save Details</Button>
            <Button mode="text" onPress={() => { setBankModalVisible(false); setEditingBank(null); }}>Cancel</Button>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25, zIndex: 10 },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  content: { padding: 18 },
  profileCard: { padding: 20, borderRadius: 24, marginBottom: 25 },
  profileInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  profileAvatar: { width: 60, height: 60, borderRadius: 18 },
  profileAvatarPlaceholder: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  profileText: { marginLeft: 15, flex: 1 },
  bizName: { fontSize: 18, fontWeight: 'bold' },
  ownerName: { fontSize: 14 },
  profileDivider: { marginVertical: 12, opacity: 0.5 },
  editProfileBtn: { borderRadius: 12, elevation: 0 },
  sectionHeader: { marginBottom: 10, paddingLeft: 5 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#888' },
  settingsCard: { borderRadius: 22, marginBottom: 25, overflow: 'hidden' },
  cardContent: { paddingHorizontal: 5 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { margin: 0, marginRight: 12 },
  settingText: { fontSize: 15, fontWeight: '500' },
  itemDivider: { marginHorizontal: 15, opacity: 0.5 },
  langSelector: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 10, padding: 3 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  langBtnText: { fontSize: 12, color: '#666' },
  bankList: { borderRadius: 20, padding: 15, marginBottom: 25 },
  listSubTitle: { fontSize: 11, fontWeight: 'bold', color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  bankItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  bankNameText: { fontWeight: 'bold', fontSize: 15 },
  bankDetailText: { fontSize: 12, color: '#666', marginTop: 2 },
  bankActions: { flexDirection: 'row' },
  deleteBtn: { marginTop: 20, marginBottom: 12, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,0,0,0.1)' },
  logoutBtn: { marginTop: 10, borderRadius: 15, elevation: 2 },
  versionText: { textAlign: 'center', marginTop: 30, color: '#aaa', fontSize: 12 },
  modal: { padding: 25, margin: 20, borderRadius: 30, maxHeight: '80%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', fontSize: 20, marginBottom: 15 },
  modalInput: { marginBottom: 15, backgroundColor: 'transparent' },
  modalBtn: { marginTop: 10, borderRadius: 12, paddingVertical: 5 }
});
