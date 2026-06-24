import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Title, Text, Surface, IconButton, Card, useTheme, Divider } from 'react-native-paper';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useBusiness } from '../../src/context/BusinessContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { LineChart } from 'react-native-chart-kit';
import { useRouter } from 'expo-router';
import AppLoader from '../../src/components/AppLoader';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { activeBusiness, loading: businessLoading } = useBusiness();
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ labels: string[], datasets: { data: number[] }[] }>({
    labels: [],
    datasets: [{ data: [] }]
  });
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    totalExpenses: 0,
    netProfit: 0,
    topProducts: [] as any[]
  });

  useEffect(() => {
    // If the core business context is still fetching profiles, wait for it
    if (businessLoading) return;

    // If business profiles loaded but none are assigned active, stop the loader safely
    if (!activeBusiness?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const qTransactions = query(collection(db, 'transactions'), where('businessId', '==', activeBusiness.id));
    const qExpenses = query(collection(db, 'expenses'), where('businessId', '==', activeBusiness.id));

    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      const dailyData: { [key: string]: number } = {};
      let total = 0;
      let productMap: any = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.timestamp?.toDate() || new Date();
        const dateKey = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

        dailyData[dateKey] = (dailyData[dateKey] || 0) + (data.total || 0);
        total += (data.total || 0);

        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            if (productMap[item.name]) {
              productMap[item.name].qty += item.qty;
              productMap[item.name].revenue += (item.price * item.qty * (1 + (item.gst || 0) / 100));
            } else {
              productMap[item.name] = {
                name: item.name,
                qty: item.qty,
                revenue: (item.price * item.qty * (1 + (item.gst || 0) / 100))
              };
            }
          });
        }
      });

      const sortedKeys = Object.keys(dailyData).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
      }).slice(-7);

      const labels = sortedKeys.length > 0 ? sortedKeys : ['No Data'];
      const data = sortedKeys.length > 0 ? sortedKeys.map(k => dailyData[k]) : [0];

      setChartData({
        labels,
        datasets: [{ data }]
      });

      const topProds = Object.values(productMap)
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5);

      setStats(prev => ({
        ...prev,
        totalIncome: total,
        totalOrders: snapshot.size,
        avgOrderValue: snapshot.size > 0 ? total / snapshot.size : 0,
        topProducts: topProds,
        netProfit: total - prev.totalExpenses
      }));

      // Stop the loader once transactions match
      setLoading(false);
    }, (error) => {
      console.error("Analytics transactions pipeline error:", error);
      setLoading(false);
    });

    const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
      let totalExp = 0;
      snapshot.forEach(doc => {
        totalExp += doc.data().amount || 0;
      });
      setStats(prev => ({
        ...prev,
        totalExpenses: totalExp,
        netProfit: prev.totalIncome - totalExp
      }));

      // Stop the loader once expenses update
      setLoading(false);
    }, (error) => {
      console.error("Analytics expenses pipeline error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeExpenses();
    };
  }, [activeBusiness?.id, businessLoading]);

  // Handle various component shell loading blocks cleanly
  if (businessLoading || loading) {
    return <AppLoader message={t('loading') || 'Loading...'} />;
  }

  // Handle case where no business setup is loaded
  if (!activeBusiness) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Title style={{ color: theme.colors.primary, marginBottom: 10 }}>No Business Selected</Title>
        <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }}>
          Please complete your business setup parameters to view analytics reporting tools.
        </Text>
        <TouchableOpacity onPress={() => router.push('/(user)/business-setup')}>
          <Surface style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.primary }}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Go to Setup</Text>
          </Surface>
        </TouchableOpacity>
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

            {/* Added defensive handling for Chart component to completely prevent calculation crashes */}
            {chartData && chartData.datasets[0]?.data?.length > 0 && chartData.datasets[0].data[0] !== 0 ? (
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
            ) : (
              <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
                <IconButton icon="chart-line-variant" size={48} iconColor={theme.colors.onSurfaceVariant} />
                <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('noDataAvailable') || 'No transaction data available yet'}</Text>
              </View>
            )}
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

        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Financial Summary</Title>
        </View>
        <Surface style={[styles.summarySurface, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Income</Text>
            <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>+ ₹{stats.totalIncome.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.error }]}>- ₹{stats.totalExpenses.toLocaleString('en-IN')}</Text>
          </View>
          <Divider style={{ marginVertical: 10 }} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { fontWeight: 'bold' }]}>Net Profit</Text>
            <Text style={[styles.summaryValue, { fontWeight: 'bold', color: theme.colors.primary, fontSize: 20 }]}>₹{stats.netProfit.toLocaleString('en-IN')}</Text>
          </View>
        </Surface>

        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Top Selling Products</Title>
        </View>
        <Surface style={[styles.topProductsSurface, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {stats.topProducts.length > 0 ? stats.topProducts.map((prod, index) => (
            <View key={index}>
              <View style={styles.productRow}>
                <View style={[styles.rankBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text style={[styles.rankText, { color: theme.colors.primary }]}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.productName}>{prod.name}</Text>
                  <Text style={styles.productMeta}>{prod.qty} units sold</Text>
                </View>
                <Text style={styles.productRevenue}>₹{Math.round(prod.revenue).toLocaleString('en-IN')}</Text>
              </View>
              {index < stats.topProducts.length - 1 && <Divider style={{ marginVertical: 8, opacity: 0.3 }} />}
            </View>
          )) : (
            <Text style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, padding: 20 }}>No product data available</Text>
          )}
        </Surface>
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
  sectionHeader: { marginTop: 10, marginBottom: 15, paddingHorizontal: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  summarySurface: { padding: 20, borderRadius: 24, marginBottom: 25 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 16, fontWeight: '600' },
  topProductsSurface: { padding: 15, borderRadius: 24, marginBottom: 40 },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rankBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontWeight: 'bold', fontSize: 14 },
  productName: { fontSize: 15, fontWeight: 'bold' },
  productMeta: { fontSize: 12, color: '#888' },
  productRevenue: { fontSize: 15, fontWeight: 'bold' },
});