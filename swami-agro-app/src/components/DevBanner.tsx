import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

export default function DevBanner() {
  let source = 'Unknown';
  try {
    const ownership = (Constants as any).appOwnership || (Constants as any).appOwnership;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      source = 'Development (Expo)';
    } else if (ownership === 'expo') {
      source = 'Expo Client';
    } else if (ownership === 'standalone') {
      source = 'Standalone build';
    } else if (ownership === 'guest') {
      source = 'Expo Dev Client';
    } else {
      source = ownership || 'Unknown';
    }
  } catch (e) {
    // ignore
  }

  return (
    <View style={styles.banner} pointerEvents="none">
      <Text style={styles.text}>{source}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 36,
    left: 12,
    right: 12,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  text: {
    color: '#fff',
    fontSize: 12,
  },
});
