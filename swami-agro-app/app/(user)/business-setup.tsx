import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { TextInput, Button, Title, Text, Surface, Divider, IconButton, Card } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../src/config/firebase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';

export default function BusinessSetup() {
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEdit = params.edit === 'true';
  const businessId = params.id as string;

  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    businessEmail: '',
    phoneNumber: '',
    address: '',
    gstId: '',
    panNumber: '',
  });

  const [logo, setLogo] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [signatureChanged, setSignatureChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (isEdit && businessId) {
      fetchBusiness();
    }
  }, [isEdit, businessId]);

  const fetchBusiness = async () => {
    setFetching(true);
    try {
      const docSnap = await getDoc(doc(db, 'businesses', businessId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setForm({
          businessName: data.businessName || '',
          ownerName: data.ownerName || '',
          businessEmail: data.businessEmail || '',
          phoneNumber: data.phoneNumber || '',
          address: data.address || '',
          gstId: data.gstId || '',
          panNumber: data.panNumber || '',
        });
        setLogo(data.photoUrl || null);
        setSignature(data.signatureUrl || null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setFetching(false);
    }
  };

  // Convert image file to Base64 string
  const convertToBase64 = async (uri: string) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error("Base64 Conversion Error:", error);
      return null;
    }
  };

  const pickImage = async (type: 'logo' | 'signature') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'logo' ? [4, 3] : [3, 1],
      quality: 0.5, // String ची साईझ नियंत्रणात ठेवण्यासाठी गुणवत्ता थोडी कमी केली आहे
    });

    if (!result.canceled) {
      if (type === 'logo') {
        setLogo(result.assets[0].uri);
        setLogoChanged(true);
      }
      else {
        setSignature(result.assets[0].uri);
        setSignatureChanged(true);
      }
    }
  };

  const handleSave = async () => {
    if (!form.businessName || !form.ownerName) {
      Alert.alert(t('error'), 'Please fill at least business name and owner name');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      let photoUrl = logo;
      let signatureUrl = signature;
      let imageErrors = [];

      // Firebase Storage ऐवजी थेट Base64 स्ट्रिंगमध्ये रूपांतर करून व्हेरिएबलमध्ये सेव्ह केले
      if (logoChanged && logo && !logo.startsWith('data:')) {
        try {
          const convertedLogo = await convertToBase64(logo);
          if (convertedLogo) {
            photoUrl = convertedLogo;
          } else {
            imageErrors.push('Logo');
          }
        } catch (error) {
          console.error('Logo conversion failed:', error);
          imageErrors.push('Logo');
        }
      }
      
      if (signatureChanged && signature && !signature.startsWith('data:')) {
        try {
          const convertedSig = await convertToBase64(signature);
          if (convertedSig) {
            signatureUrl = convertedSig;
          } else {
            imageErrors.push('Signature');
          }
        } catch (error) {
          console.error('Signature conversion failed:', error);
          imageErrors.push('Signature');
        }
      }

      const businessData = {
        ...form,
        userId: user.uid,
        photoUrl: photoUrl,
        signatureUrl: signatureUrl,
        updatedAt: new Date().toISOString(),
      };

      if (isEdit) {
        await updateDoc(doc(db, 'businesses', businessId), businessData);
        Alert.alert(t('success'), 'Business profile updated successfully!');
      } else {
        await addDoc(collection(db, 'businesses'), {
          ...businessData,
          totalSales: 0,
          createdAt: new Date().toISOString(),
        });
        Alert.alert(t('success'), 'Business profile created successfully!');
      }

      if (imageErrors.length > 0) {
        Alert.alert('Warning', `Profile saved successfully. Note: ${imageErrors.join(', ')} image(s) could not be processed. You can try uploading again.`);
      }

      router.replace('/(user)');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert(t('error'), 'Failed to save business profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.headerRow}>
          <IconButton icon="arrow-left" onPress={() => router.back()} iconColor={theme.colors.primary} />
          <Title style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{isEdit ? 'Update Profile' : 'Setup Business'}</Title>
        </View>
      </Surface>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard} elevation={1}>
          <Card.Content>
            <SectionTitle title="Branding" />
            <View style={styles.uploadRow}>
              <View style={styles.uploadCol}>
                <Text style={styles.uploadLabel}>Rectangular Logo</Text>
                <TouchableOpacity onPress={() => pickImage('logo')} style={[styles.logoBox, { borderColor: theme.colors.outline }]}>
                  {logo ? (
                    <Image source={{ uri: logo }} style={styles.previewLogo} />
                  ) : (
                    <View style={styles.placeholder}>
                      <IconButton icon="image-plus" size={28} iconColor={theme.colors.primary} />
                      <Text style={styles.placeholderText}>Logo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.uploadCol}>
                <Text style={styles.uploadLabel}>Official Signature</Text>
                <TouchableOpacity onPress={() => pickImage('signature')} style={[styles.sigBox, { borderColor: theme.colors.outline }]}>
                  {signature ? (
                    <Image source={{ uri: signature }} style={styles.previewSig} />
                  ) : (
                    <View style={styles.placeholder}>
                      <IconButton icon="draw" size={28} iconColor={theme.colors.primary} />
                      <Text style={styles.placeholderText}>Signature</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <Divider style={styles.divider} />
            <SectionTitle title="Basic Information" />
            <TextInput
              label="Business Name"
              value={form.businessName}
              onChangeText={v => setForm({ ...form, businessName: v })}
              mode="outlined"
              style={styles.input}
              outlineColor="#eee"
              activeOutlineColor={theme.colors.primary}
            />
            <TextInput
              label="Owner / Proprietor Name"
              value={form.ownerName}
              onChangeText={v => setForm({ ...form, ownerName: v })}
              mode="outlined"
              style={styles.input}
              outlineColor="#eee"
              activeOutlineColor={theme.colors.primary}
            />

            <Divider style={styles.divider} />
            <SectionTitle title="Contact & Address" />
            <TextInput
              label="Business Email"
              value={form.businessEmail}
              onChangeText={v => setForm({ ...form, businessEmail: v })}
              mode="outlined"
              keyboardType="email-address"
              style={styles.input}
              outlineColor="#eee"
              activeOutlineColor={theme.colors.primary}
            />
            <TextInput
              label="Contact Number"
              value={form.phoneNumber}
              onChangeText={v => setForm({ ...form, phoneNumber: v })}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor="#eee"
              activeOutlineColor={theme.colors.primary}
            />
            <TextInput
              label="Full Office Address"
              value={form.address}
              onChangeText={v => setForm({ ...form, address: v })}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={[styles.input, { height: 100 }]}
              outlineColor="#eee"
              activeOutlineColor={theme.colors.primary}
            />

            <Divider style={styles.divider} />
            <SectionTitle title="Tax Configuration" />
            <View style={styles.formRow}>
              <TextInput
                label="GSTIN Number"
                value={form.gstId}
                onChangeText={v => setForm({ ...form, gstId: v })}
                mode="outlined"
                style={[styles.input, { flex: 1, marginRight: 6 }]}
                outlineColor="#eee"
                activeOutlineColor={theme.colors.primary}
              />
              <TextInput
                label="PAN Number"
                value={form.panNumber}
                onChangeText={v => setForm({ ...form, panNumber: v })}
                mode="outlined"
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                outlineColor="#eee"
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            <Button
              mode="contained"
              onPress={handleSave}
              loading={loading}
              disabled={loading}
              style={styles.saveBtn}
              contentStyle={styles.saveBtnContent}
            >
              {isEdit ? 'Save Profile Changes' : 'Complete Setup'}
            </Button>
            <View style={{ height: 30 }} />
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const SectionTitle = ({ title }: { title: string }) => (
  <Text style={styles.sectionSubTitle}>{title}</Text>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 50, paddingBottom: 12, paddingHorizontal: 10, borderBottomLeftRadius: 25, borderBottomRightRadius: 25, zIndex: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  content: { padding: 16 },
  formCard: { borderRadius: 24, paddingVertical: 10 },
  sectionSubTitle: { fontSize: 11, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15, marginTop: 5, marginLeft: 2 },
  uploadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  uploadCol: { width: '48%' },
  uploadLabel: { fontSize: 12, color: '#666', marginBottom: 8, textAlign: 'center' },
  logoBox: { height: 110, borderRadius: 18, borderStyle: 'dashed', borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#fafafa' },
  sigBox: { height: 110, borderRadius: 18, borderStyle: 'dashed', borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#fafafa' },
  previewLogo: { width: '100%', height: '100%', resizeMode: 'contain' },
  previewSig: { width: '100%', height: '100%', resizeMode: 'contain' },
  placeholder: { alignItems: 'center' },
  placeholderText: { fontSize: 12, color: '#999', marginTop: -8, fontWeight: 'bold' },
  divider: { marginVertical: 22, opacity: 0.5 },
  input: { marginBottom: 15, backgroundColor: 'transparent' },
  formRow: { flexDirection: 'row' },
  saveBtn: { marginTop: 25, borderRadius: 16, elevation: 2 },
  saveBtnContent: { paddingVertical: 8 }
});