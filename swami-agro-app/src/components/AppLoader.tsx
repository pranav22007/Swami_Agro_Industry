import React from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';

interface AppLoaderProps {
  message?: string;
}

export default function AppLoader({ message = 'Loading...' }: AppLoaderProps) {
  const { theme } = useAppTheme();
  const spinValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.loaderBox}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <ActivityIndicator size={60} color={theme.colors.primary} />
        </Animated.View>
        <Text style={[styles.text, { color: theme.colors.primary }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderBox: {
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
