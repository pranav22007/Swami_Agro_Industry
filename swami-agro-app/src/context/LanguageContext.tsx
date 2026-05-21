import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export type Language = 'en' | 'mr';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

export const translations: Translations = {
  en: {
    settings: 'Settings',
    appearance: 'Appearance',
    darkMode: 'Dark Mode',
    language: 'Language',
    logout: 'Logout Account',
    manageBusiness: 'Manage Business Profile',
    gstSettings: 'GST Settings',
    gstPercentage: 'Default GST Percentage',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    businessName: 'Business Name',
    salesHistory: 'Sales History',
    customers: 'Customers',
    billing: 'Billing',
    dashboard: 'Dashboard',
    search: 'Search',
    add: 'Add',
    name: 'Name',
    phone: 'Phone',
    address: 'Address',
    items: 'Items',
    total: 'Total',
    grandTotal: 'Grand Total',
    paid: 'PAID',
    generatePdf: 'Generate PDF Bill',
    close: 'Close',
    selectLanguage: 'Select Language',
    english: 'English',
    marathi: 'Marathi',
    version: 'Version',
    build: 'Build',
    success: 'Success',
    error: 'Error',
    gstUpdated: 'GST settings updated successfully',
    updateFailed: 'Failed to update GST settings',
    totalSales: 'Total Sales',
    invoiceNumber: 'Invoice Number',
    destination: 'Destination',
    vehicleNumber: 'Vehicle Number',
    dispatchLocation: 'Dispatch Location',
    bankDetails: 'Bank Details',
    bankName: 'Bank Name',
    accountNumber: 'Account Number',
    ifscCode: 'IFSC Code',
    branch: 'Branch',
    selectBank: 'Select Bank',
    manageBanks: 'Manage Bank Accounts',
    manageDestinations: 'Manage Destinations',
    manageVehicles: 'Manage Vehicles',
    addBank: 'Add Bank Account',
    addDestination: 'Add Destination',
    addVehicle: 'Add Vehicle',
    noBanks: 'No bank accounts added',
    noDestinations: 'No destinations added',
    noVehicles: 'No vehicles added',
    selectDestination: 'Select Destination',
    selectVehicle: 'Select Vehicle',
    login: 'Login',
    email: 'Email Address',
    password: 'Password',
    welcomeBack: 'Welcome Back',
    signinToContinue: 'Sign in to continue',
    dontHaveAccount: 'Don\'t have an account?',
    contactAdmin: 'Contact Admin',
    loading: 'Loading',
    revenueAnalytics: 'Revenue Analytics',
    incomeTrend: 'Income Trend',
    totalIncome: 'Total Income',
    totalOrders: 'Total Orders',
    avgOrder: 'Avg. Order',
    selectItems: 'Select Items',
    noItemsAdded: 'No items added yet',
  },
  mr: {
    settings: 'सेटिंग्ज',
    appearance: 'देखावा',
    darkMode: 'डार्क मोड',
    language: 'भाषा',
    logout: 'बाहेर पडा',
    manageBusiness: 'व्यवसाय प्रोफाइल व्यवस्थापित करा',
    gstSettings: 'GST सेटिंग्ज',
    gstPercentage: 'डीफॉल्ट GST टक्केवारी',
    save: 'जतन करा',
    cancel: 'रद्द करा',
    edit: 'संपादित करा',
    delete: 'हटवा',
    businessName: 'व्यवसायाचे नाव',
    salesHistory: 'विक्री इतिहास',
    customers: 'ग्राहक',
    billing: 'बिलिंग',
    dashboard: 'डॅशबोर्ड',
    search: 'शोधा',
    add: 'जोडा',
    name: 'नाव',
    phone: 'फोन',
    address: 'पत्ता',
    items: 'वस्तू',
    total: 'एकूण',
    grandTotal: 'भव्य एकूण',
    paid: 'भरले',
    generatePdf: 'PDF बिल तयार करा',
    close: 'बंद करा',
    selectLanguage: 'भाषा निवडा',
    english: 'इंग्रजी',
    marathi: 'मराठी',
    version: 'आवृत्ती',
    build: 'बिल्ड',
    success: 'यश',
    error: 'त्रुटी',
    gstUpdated: 'GST सेटिंग्ज यशस्वीरित्या अपडेट केल्या',
    updateFailed: 'GST सेटिंग्ज अपडेट करण्यात अपयशी',
    totalSales: 'एकूण विक्री',
    invoiceNumber: 'बील क्रमांक',
    destination: 'गंतव्य स्थान',
    vehicleNumber: 'वाहन क्रमांक',
    dispatchLocation: 'प्रेषण स्थान',
    bankDetails: 'बँक तपशील',
    bankName: 'बँकेचे नाव',
    accountNumber: 'खाते क्रमांक',
    ifscCode: 'IFSC कोड',
    branch: 'शाखा',
    selectBank: 'बँक निवडा',
    manageBanks: 'बँक खाती व्यवस्थापित करा',
    manageDestinations: 'गंतव्य स्थाने व्यवस्थापित करा',
    manageVehicles: 'वाहने व्यवस्थापित करा',
    addBank: 'बँक खाते जोडा',
    addDestination: 'गंतव्य स्थान जोडा',
    addVehicle: 'वाहन जोडा',
    noBanks: 'कोणतेही बँक खाते जोडलेले नाही',
    noDestinations: 'कोणतेही गंतव्य स्थान जोडलेले नाही',
    noVehicles: 'कोणतेही वाहन जोडलेले नाही',
    selectDestination: 'गंतव्य स्थान निवडा',
    selectVehicle: 'वाहन निवडा',
    login: 'लॉगिन करा',
    email: 'ईमेल पत्ता',
    password: 'पासवर्ड',
    welcomeBack: 'स्वागत आहे',
    signinToContinue: 'सुरू ठेवण्यासाठी साइन इन करा',
    dontHaveAccount: 'खाते नाही?',
    contactAdmin: 'अ‍ॅडमिनशी संपर्क साधा',
    loading: 'लोड होत आहे',
    revenueAnalytics: 'महसूल विश्लेषण',
    incomeTrend: 'उत्पन्न कल',
    totalIncome: 'एकूण उत्पन्न',
    totalOrders: 'एकूण ऑर्डर',
    avgOrder: 'सरासरी ऑर्डर',
    selectItems: 'वस्तू निवडा',
    noItemsAdded: 'अद्याप कोणतीही वस्तू जोडली नाही',
  },
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const loadLanguage = async () => {
      const savedLang = await safeStorage.getItem('appLanguage');
      if (savedLang === 'mr' || savedLang === 'en') {
        setLanguageState(savedLang);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await safeStorage.setItem('appLanguage', lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
