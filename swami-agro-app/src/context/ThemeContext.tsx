import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

// Fallback storage in case native module is null
const safeStorage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('AsyncStorage not available, using memory fallback');
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('AsyncStorage not available, item not saved');
    }
  }
};

// Create a custom agro-green light theme
export const customLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1b5e20', // Deep Forest Green
    onPrimary: '#ffffff',
    primaryContainer: '#e8f5e9', // Very Light Mint
    onPrimaryContainer: '#002106',
    secondary: '#388e3c', // Mid Green
    onSecondary: '#ffffff',
    secondaryContainer: '#c8e6c9',
    onSecondaryContainer: '#002105',
    tertiary: '#55624c', // Olive Green
    onTertiary: '#ffffff',
    tertiaryContainer: '#d9e7cb',
    onTertiaryContainer: '#131f0e',
    background: '#f8faf8', // Very subtle off-white green
    surface: '#ffffff',
    surfaceVariant: '#f1f4f1',
    onSurfaceVariant: '#424940',
    outline: '#72796f',
    error: '#ba1a1a',
  },
};

// Create a custom agro-green dark theme
export const customDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#81c784',
    onPrimary: '#003910',
    primaryContainer: '#00531c',
    onPrimaryContainer: '#e8f5e9',
    secondary: '#96d391',
    onSecondary: '#003a0b',
    secondaryContainer: '#11521a',
    onSecondaryContainer: '#b2efab',
    tertiary: '#bdcbb0',
    onTertiary: '#273421',
    tertiaryContainer: '#3e4a36',
    onTertiaryContainer: '#d9e7cb',
    background: '#0a0d0a', // Solid deep dark green-black
    surface: '#121612', // Slightly lighter for cards
    surfaceVariant: '#1e251e', // Even lighter for secondary surfaces
    onSurface: '#ffffff', // Pure white for primary text
    onSurfaceVariant: '#e1e3e1', // Off-white for secondary text
    outline: '#8b9388',
    error: '#ffb4ab',
  },
};

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  theme: typeof customLightTheme;
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  theme: customLightTheme,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load saved theme preference
    const loadTheme = async () => {
      try {
        const savedTheme = await safeStorage.getItem('appTheme');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        }
      } catch (error) {
        console.log('Error loading theme:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try {
      await safeStorage.setItem('appTheme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const theme = isDarkMode ? customDarkTheme : customLightTheme;

  if (!isLoaded) return null;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
