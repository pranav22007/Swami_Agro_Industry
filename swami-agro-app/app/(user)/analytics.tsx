import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Title, Text, Surface, IconButton, Card, useTheme } from 'react-native-paper';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useBusiness } from '../../src/context/BusinessContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { LineChart } from 'react-native-chart-kit';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { activeBusiness } = useBusiness();
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{labels: string[], datasets: {data: number[]}[]}>({
    labels: [],
    datasets: [{ data: [] }]
  });
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalOrders: 0,
    avgOrderValue: 0
  });

  useEffect(() => {
    if (!activeBusiness) return;

    const q = query(
      collection(db, 'transactions'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dailyData: { [key: string]: number } = {};
      let total = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.timestamp?.toDate() || new Date();
        const dateKey = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        
        dailyData[dateKey] = (dailyData[dateKey] || 0) + (data.total || 0);
        total += (data.total || 0);
      });

      // Get last 7 days or entries
      const sortedKeys = Object.keys(dailyData).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
      }).slice(-7);

      const labels = sortedKeys.length > 0 ? sortedKeys : ['No Data'];
      const data = sortedKeys.length > 0 ? sortedKeys.map(k => dailyData[k]) : [0];

      setChartData({
        labels,
        datasets: [{ data }]
      });

      setStats({
        totalIncome: total,
        totalOrders: snapshot.size,
        avgOrderValue: snapshot.size > 0 ? total / snapshot.size : 0
      });

      setLoading(false);
    });

    return unsubscribe;
  }, [activeBusiness]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={4}>
        <View style={styles.headerRow}>
          <IconButton icon="arrow-left" onPress={() => router.back()} iconColor={theme.colors.primary} />
          <Title style={{ color: theme.colors.primary }}>{t('revenueAnalytics') || 'Revenue Analytics'}</Title>
        </View>
      </Surface>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content>
            <Title style={{ color: theme.colors.primary, marginBottom: 20 }}>{t('incomeTrend') || 'Income Trend'}</Title>
            <LineChart
              data={chartData}
              width={width - 60}
              height={220}
              chartConfig={{
                backgroundColor: theme.colors.surface,
                backgroundGradientFrom: theme.colors.surface,
                backgroundGradientTo: theme.colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => theme.colors.primary,
                labelColor: (opacity = 1) => theme.colors.onSurfaceVariant,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: "6",
                  strokeWidth: "2",
                  stroke: theme.colors.primary
                }
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16 }}
            />
          </Card.Content>
        </Card>

        <View style={styles.statsGrid}>
          <StatBox 
            label={t('totalIncome') || 'Total Income'} 
            value={`₹${stats.totalIncome.toLocaleString('en-IN')}`} 
            icon="cash-multiple"
            theme={theme}
          />
          <StatBox 
            label={t('totalOrders') || 'Total Orders'} 
            value={stats.totalOrders.toString()} 
            icon="cart-outline"
            theme={theme}
          />
          <StatBox 
            label={t('avgOrder') || 'Avg. Order'} 
            value={`₹${Math.round(stats.avgOrderValue).toLocaleString('en-IN')}`} 
            icon="calculator-variant"
            theme={theme}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const StatBox = ({ label, value, icon, theme }: any) => (
  <Surface style={[styles.statBox, { backgroundColor: theme.colors.surface }]} elevation={1}>
    <IconButton icon={icon} iconColor={theme.colors.primary} size={24} />
    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
    <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{value}</Text>
  </Surface>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 45, paddingBottom: 10, paddingHorizontal: 10, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  content: { padding: 20 },
  chartCard: { borderRadius: 20, marginBottom: 20, padding: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statBox: { width: (width - 60) / 2, padding: 15, borderRadius: 20, marginBottom: 15, alignItems: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
});
