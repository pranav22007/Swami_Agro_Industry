import React, { useState, useEffect } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { TextInput, Button, Title, Text, Surface, HelperText, IconButton, ActivityIndicator, Checkbox, Divider, SegmentedButtons } from 'react-native-paper';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../src/config/firebase';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  
  const { user, userRole, loading: authLoading } = useAuth();
  const { theme } = useAppTheme();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    loadSavedEmail();
  }, []);

  const loadSavedEmail = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('saved_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (err) {
      console.error('Failed to load saved email', err);
    }
  };

  // Handle automatic persistent login
  useEffect(() => {
    if (!authLoading && user && userRole) {
      if (userRole === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(user)');
      }
    }
  }, [user, userRole, authLoading]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Save or remove email from storage
      if (rememberMe) {
        await AsyncStorage.setItem('saved_email', email.trim());
      } else {
        await AsyncStorage.removeItem('saved_email');
      }
    } catch (err: any) {
      console.error(err);
      let errorMessage = 'Failed to sign in. Please check your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address first to reset your password.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Success', 'Password reset email sent. Please check your inbox.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send reset email.');
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10, color: theme.colors.primary }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={[styles.headerSection, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.headerDecoration1} />
          <View style={styles.headerDecoration2} />
          
          <View style={styles.logoContainer}>
            <Surface style={styles.logoCircle} elevation={4}>
              <IconButton icon="sprout" size={60} iconColor={theme.colors.primary} />
            </Surface>
          </View>
          <Title style={styles.headerTitle}>Swami Agro Industry</Title>
          <Text style={styles.headerSubtitle}>{t('welcomeBack')}!</Text>
        </View>

        <Surface style={[styles.formCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.languageSelectorContainer}>
            <SegmentedButtons
              value={language}
              onValueChange={(value) => setLanguage(value as any)}
              buttons={[
                { value: 'en', label: 'English' },
                { value: 'mr', label: 'मराठी' },
              ]}
              style={styles.segmentedButtons}
              density="compact"
            />
          </View>

          <Title style={[styles.formTitle, { color: theme.colors.primary }]}>{t('login')}</Title>
          <Text style={[styles.formSubtitle, { color: theme.colors.onSurfaceVariant }]}>{t('signinToContinue')}</Text>

          <View style={styles.inputContainer}>
            <TextInput
              label={t('email')}
              placeholder="example@gmail.com"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              left={<TextInput.Icon icon="email-outline" />}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
            />

            <TextInput
              label={t('password')}
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              left={<TextInput.Icon icon="lock-outline" />}
              right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
            />
            
            <View style={styles.optionsRow}>
              <View style={styles.rememberMeContainer}>
                <Checkbox
                  status={rememberMe ? 'checked' : 'unchecked'}
                  onPress={() => setRememberMe(!rememberMe)}
                  color={theme.colors.primary}
                />
                <TouchableOpacity onPress={() => setRememberMe(!rememberMe)}>
                  <Text style={styles.optionText}>Remember Me</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={[styles.forgotPassword, { color: theme.colors.primary }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {error ? <HelperText type="error" visible={!!error} style={styles.errorText}>{error}</HelperText> : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
              contentStyle={styles.loginButtonContent}
              labelStyle={styles.loginButtonLabel}
            >
              {t('login')}
            </Button>
          </View>

          <View style={styles.dividerContainer}>
            <Divider style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <Divider style={styles.divider} />
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>{t('dontHaveAccount')} </Text>
            <TouchableOpacity onPress={() => Alert.alert('Contact Admin', 'Please contact the office administrator to create your account.')}>
              <Text style={[styles.contactAdmin, { color: theme.colors.primary }]}>{t('contactAdmin')}</Text>
            </TouchableOpacity>
          </View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    height: height * 0.38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    overflow: 'hidden',
  },
  headerDecoration1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerDecoration2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  logoContainer: {
    marginBottom: 15,
    zIndex: 1,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
    zIndex: 1,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    zIndex: 1,
  },
  formCard: {
    flex: 1,
    marginTop: -40,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 30,
    paddingTop: 25,
    paddingBottom: 40,
  },
  languageSelectorContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  segmentedButtons: {
    width: '70%',
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  formSubtitle: {
    fontSize: 15,
    marginBottom: 25,
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
  },
  optionText: {
    fontSize: 14,
    opacity: 0.8,
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 10,
  },
  loginButton: {
    marginTop: 15,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  loginButtonContent: {
    paddingVertical: 10,
  },
  loginButtonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 15,
    color: 'gray',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
  },
  contactAdmin: {
    fontSize: 15,
    fontWeight: 'bold',
  },
});
