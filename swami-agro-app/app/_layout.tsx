import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { BusinessProvider } from '../src/context/BusinessContext';
import { ThemeProvider, useAppTheme } from '../src/context/ThemeContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { PaperProvider } from 'react-native-paper';
import * as Updates from 'expo-updates';
import { Alert, View } from 'react-native';
import OfflineNotice from '../src/components/OfflineNotice';
import AppLoader from '../src/components/AppLoader';
import DevBanner from '../src/components/DevBanner';

function RootApp() {
  const { theme } = useAppTheme();
  const { loading } = useAuth();

  if (loading) {
    return (
      <PaperProvider theme={theme}>
        <AppLoader message="Starting Swami Agro..." />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <View style={{ flex: 1 }}>
        <DevBanner />
        <OfflineNotice />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ title: 'Login' }} />
          <Stack.Screen name="(user)" options={{ title: 'Dashboard' }} />
          <Stack.Screen name="(admin)" options={{ title: 'Admin Panel' }} />
        </Stack>
      </View>
    </PaperProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    async function onFetchUpdateAsync() {
      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Update Available',
            'A new version of the app is available. Restart now to apply?',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Restart', onPress: () => Updates.reloadAsync() },
            ]
          );
        }
      } catch (error) {
        // You can also add an error handler here
        console.log(`Error fetching latest Expo update: ${error}`);
      }
    }

    if (!__DEV__) {
      onFetchUpdateAsync();
    }
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BusinessProvider>
            <RootApp />
          </BusinessProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
