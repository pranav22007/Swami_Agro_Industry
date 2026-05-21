import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Title, Text, Surface, Card, Button, IconButton, ActivityIndicator, Modal, Portal, List, Divider } from 'react-native-paper';
import { auth } from '../../../src/config/firebase';
import { useRouter } from 'expo-router';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';

const { width } = Dimensions.get('window');

export default function UserDashboard() {
  const { businesses, activeBusiness, setActiveBusiness, loading } = useBusiness();
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const router = useRouter();
  const { theme } = useAppTheme();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && businesses.length === 0) {
      router.replace('/(user)/business-setup');
    }
  }, [loading, businesses]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const business = activeBusiness;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Enhanced Header */}
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <TouchableOpacity style={styles.headerLeft} onPress={() => setSwitcherVisible(true)} activeOpacity={0.7}>
          {business?.photoUrl ? (
            <Image source={{ uri: business.photoUrl }} style={styles.avatar} />
          ) : (
            <Surface style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primaryContainer }]} elevation={1}>
               <IconButton icon="store" size={24} iconColor={theme.colors.primary} />
            </Surface>
          )}
          <View style={styles.headerTitleContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: theme.colors.primary }]} numberOfLines={1}>
                {business?.businessName || t('businessName')}
              </Text>
              <IconButton icon="chevron-down" size={20} iconColor={theme.colors.primary} style={styles.chevronIcon} />
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>Agro Industry Dashboard</Text>
          </View>
        </TouchableOpacity>
        <IconButton icon="bell-outline" iconColor={theme.colors.onSurfaceVariant} onPress={() => {}} style={styles.bellIcon} />
      </Surface>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Dynamic Revenue Card */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(user)/analytics')}>
          <Surface style={[styles.salesCard, { backgroundColor: theme.colors.primary }]} elevation={4}>
            <View style={styles.salesCardContent}>
              <View>
                <Text style={styles.salesLabel}>{t('totalSales') || 'Total Revenue'}</Text>
                <Text style={styles.salesAmount}>₹{business?.totalSales?.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <Surface style={[styles.salesIconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]} elevation={0}>
                <IconButton icon="trending-up" iconColor="white" size={28} />
              </Surface>
            </View>
            <View style={styles.salesFooter}>
              <IconButton icon="information-outline" size={14} iconColor="rgba(255,255,255,0.6)" style={{ margin: 0 }} />
              <Text style={styles.salesFooterText}>Tap to view detailed analytics</Text>
            </View>
          </Surface>
        </TouchableOpacity>

        {/* Quick Actions Grid */}
        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Management</Title>
        </View>
        <View style={styles.actionGrid}>
          <ActionTile 
            icon="calculator" 
            label={t('billing')} 
            onPress={() => router.push('/(user)/billing')} 
            color="#e8f5e9"
            iconColor="#1b5e20"
            theme={theme}
          />
          <ActionTile 
            icon="package-variant-closed" 
            label={t('items')} 
            onPress={() => router.push('/(user)/items')} 
            color="#fff3e0"
            iconColor="#e65100"
            theme={theme}
          />
          <ActionTile 
            icon="history" 
            label={t('salesHistory')} 
            onPress={() => router.push('/(user)/(tabs)/previous-sell')} 
            color="#e3f2fd"
            iconColor="#0d47a1"
            theme={theme}
          />
          <ActionTile 
            icon="account-group" 
            label={t('customers')} 
            onPress={() => router.push('/(user)/(tabs)/customers')} 
            color="#f3e5f5"
            iconColor="#4a148c"
            theme={theme}
          />
        </View>

        {/* Business Details Section */}
        <View style={styles.infoSectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Business Profile</Title>
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/(user)/business-setup', params: { edit: 'true', id: business?.id } })}
            style={styles.editBtn}
          >
            <IconButton icon="pencil-outline" size={16} iconColor={theme.colors.primary} style={{ margin: 0 }} />
            <Text style={[styles.editLink, { color: theme.colors.primary }]}>{t('edit')}</Text>
          </TouchableOpacity>
        </View>
        
        <Surface style={[styles.infoSurface, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <InfoRow icon="email-outline" label="Official Email" value={business?.businessEmail} theme={theme} />
          <Divider style={styles.rowDivider} />
          <InfoRow icon="phone-outline" label="Contact Number" value={business?.phoneNumber} theme={theme} />
          <Divider style={styles.rowDivider} />
          <InfoRow icon="map-marker-outline" label="Dispatch Address" value={business?.address} theme={theme} />
          <Divider style={styles.rowDivider} />
          <View style={styles.doubleInfoRow}>
            <View style={{ flex: 1 }}>
              <InfoRow icon="card-account-details-outline" label="PAN" value={business?.panNumber} theme={theme} />
            </View>
            <View style={styles.verticalDivider} />
            <View style={{ flex: 1 }}>
              <InfoRow icon="file-document-outline" label="GSTIN" value={business?.gstId} theme={theme} />
            </View>
          </View>
        </Surface>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Business Switcher Modal */}
      <Portal>
        <Modal visible={switcherVisible} onDismiss={() => setSwitcherVisible(false)} contentContainerStyle={[styles.switcherModal, { backgroundColor: theme.colors.surface }]}>
          <Title style={[styles.modalTitle, { color: theme.colors.primary }]}>Switch Business</Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            {businesses.map((b) => (
              <TouchableOpacity 
                key={b.id} 
                onPress={() => { setActiveBusiness(b); setSwitcherVisible(false); }}
                activeOpacity={0.7}
              >
                <Surface style={[styles.switchItem, { backgroundColor: b.id === activeBusiness?.id ? theme.colors.primaryContainer : theme.colors.surfaceVariant }]} elevation={b.id === activeBusiness?.id ? 1 : 0}>
                  <View style={styles.switchContent}>
                    {b.photoUrl ? (
                      <Image source={{ uri: b.photoUrl }} style={styles.switchAvatar} />
                    ) : (
                      <Surface style={[styles.switchAvatarPlaceholder, { backgroundColor: theme.colors.surface }]} elevation={1}>
                        <IconButton icon="store" size={20} iconColor={theme.colors.primary} />
                      </Surface>
                    )}
                    <View style={styles.switchTextContainer}>
                      <Text style={[styles.switchBizName, { color: theme.colors.onSurface }]} numberOfLines={1}>{b.businessName}</Text>
                      <Text style={[styles.switchOwnerName, { color: theme.colors.onSurfaceVariant }]}>{b.ownerName}</Text>
                    </View>
                    {b.id === activeBusiness?.id && <IconButton icon="check-circle" iconColor={theme.colors.primary} size={22} />}
                  </View>
                </Surface>
              </TouchableOpacity>
            ))}
            <Button 
              icon="plus" 
              mode="contained" 
              onPress={() => {
                setSwitcherVisible(false);
                router.push('/(user)/business-setup');
              }}
              style={styles.addBusinessBtn}
              contentStyle={styles.addBtnContent}
            >
              Add New Business
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const ActionTile = ({ icon, label, onPress, color, iconColor, theme }: any) => (
  <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
    <Surface style={[styles.actionSurface, { backgroundColor: color }]} elevation={1}>
      <IconButton icon={icon} iconColor={iconColor} size={30} style={styles.actionIcon} />
      <Text style={[styles.actionText, { color: '#333' }]} numberOfLines={1}>{label}</Text>
    </Surface>
  </TouchableOpacity>
);

const InfoRow = ({ icon, label, value, theme }: { icon: string, label: string, value: string, theme: any }) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIconWrapper, { backgroundColor: theme.colors.primaryContainer }]}>
      <IconButton icon={icon} size={20} style={{ margin: 0 }} iconColor={theme.colors.primary} />
    </View>
    <View style={styles.infoTextContainer}>
      <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.onSurface }]} numberOfLines={1}>{value || 'Not provided'}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 55,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 15,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    maxWidth: '85%',
  },
  chevronIcon: { margin: 0, marginLeft: -5 },
  headerSubtitle: { fontSize: 12, marginTop: -8 },
  bellIcon: { backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  salesCard: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 25,
  },
  salesCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  salesLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  salesAmount: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 2,
  },
  salesIconContainer: { borderRadius: 12 },
  salesFooter: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  salesFooterText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  sectionHeader: { marginBottom: 15, paddingHorizontal: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  actionCard: {
    width: (width - 55) / 2,
    marginBottom: 15,
  },
  actionSurface: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { margin: 0, marginBottom: 5 },
  actionText: { fontWeight: 'bold', fontSize: 14 },
  infoSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 5,
  },
  editBtn: { flexDirection: 'row', alignItems: 'center' },
  editLink: { fontWeight: 'bold', fontSize: 14, marginLeft: 2 },
  infoSurface: {
    borderRadius: 22,
    padding: 15,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoTextContainer: { flex: 1 },
  infoLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 1,
  },
  infoValue: { fontSize: 14, fontWeight: '600' },
  rowDivider: { backgroundColor: '#f0f0f0' },
  doubleInfoRow: { flexDirection: 'row', alignItems: 'center' },
  verticalDivider: { width: 1, height: 40, backgroundColor: '#f0f0f0', marginHorizontal: 5 },
  switcherModal: {
    padding: 24,
    margin: 20,
    borderRadius: 28,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  switchItem: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
  },
  switchContent: { flexDirection: 'row', alignItems: 'center' },
  switchAvatar: { width: 42, height: 42, borderRadius: 10 },
  switchAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchTextContainer: { flex: 1, marginLeft: 12 },
  switchBizName: { fontSize: 15, fontWeight: 'bold' },
  switchOwnerName: { fontSize: 12 },
  addBusinessBtn: { marginTop: 15, borderRadius: 14 },
  addBtnContent: { paddingVertical: 6 }
});
