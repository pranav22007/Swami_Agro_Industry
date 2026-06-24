import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Title, Button, Text, Surface, ActivityIndicator, List } from 'react-native-paper';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db, auth } from '../../src/config/firebase';
import { useRouter } from 'expo-router';

export default function RecoveryScreen() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const runRecovery = async () => {
    setError(null);
    setLoading(true);
    setResults([]);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError('No signed-in user found. Please sign in first.');
        setLoading(false);
        return;
      }

      const map = new Map<string, any>();

      // Primary: businesses linked by userId / userUID / ownerId / createdBy
      const uidFields = ['userId', 'userUID', 'ownerId', 'createdBy', 'ownerUID'];
      for (const field of uidFields) {
        try {
          const q = query(collection(db, 'businesses'), where(field, '==', user.uid));
          const snap = await getDocs(q);
          snap.forEach(d => map.set(d.id, { id: d.id, ...(d.data() as any) }));
        } catch (e) {
          console.error(`Business recovery query failed for ${field}`, e);
        }
      }

      // Fallback: businesses linked by businessEmail / email / ownerEmail / userEmail
      if (user.email) {
        const normalizedEmail = user.email.trim().toLowerCase();
        const emailFields = ['businessEmail', 'email', 'ownerEmail', 'userEmail', 'ownerEmailAddress'];

        for (const field of emailFields) {
          try {
            const q2 = query(collection(db, 'businesses'), where(field, '==', normalizedEmail));
            const snap2 = await getDocs(q2);
            snap2.forEach(d => map.set(d.id, { id: d.id, ...(d.data() as any) }));
          } catch (e) {
            console.error(`Business recovery email query failed for ${field}`, e);
          }
        }
      }

      const out: any[] = [];
      for (const [id, biz] of map.entries()) {
        // Use aggregation count to avoid downloading all transaction documents
        try {
          const txQ = query(collection(db, 'transactions'), where('businessId', '==', id));
          const countSnap = await getCountFromServer(txQ as any);
          const count = (countSnap.data() as any).count ?? 0;
          out.push({ id, businessName: biz.businessName || biz.ownerName || '(no name)', email: biz.businessEmail, count });
        } catch (e) {
          console.error('count failed for', id, e);
          out.push({ id, businessName: biz.businessName || '(no name)', email: biz.businessEmail, count: 'error' });
        }
      }

      setResults(out);
    } catch (e) {
      console.error(e);
      setError('Recovery failed — check console for details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Surface style={{ padding: 16, marginBottom: 12 }}>
        <Title>Data Recovery / Verification</Title>
        <Text>Run this to search for businesses linked to your account and count sales records.</Text>
        <View style={{ height: 12 }} />
        <Button mode="contained" onPress={runRecovery} loading={loading} disabled={loading}>
          Run Recovery
        </Button>
        <View style={{ height: 8 }} />
        <Button mode="outlined" onPress={() => router.push('/(user)')} disabled={loading}>
          Back to Dashboard
        </Button>
      </Surface>

      {loading && (
        <Surface style={{ padding: 12, marginBottom: 12 }}>
          <ActivityIndicator animating size={24} />
          <Text>Searching for businesses and counting transactions. This may take a while for large datasets.</Text>
        </Surface>
      )}

      {error ? (
        <Surface style={{ padding: 12, backgroundColor: '#ffebee' }}>
          <Text style={{ color: '#b00020' }}>{error}</Text>
        </Surface>
      ) : null}

      {results.map((r) => (
        <List.Item
          key={r.id}
          title={`${r.businessName}`}
          description={`Transactions: ${r.count} • Email: ${r.email || 'N/A'} • id: ${r.id}`}
          right={() => (
            <Button onPress={() => router.push({ pathname: '/(user)/business-setup', params: { edit: 'true', id: r.id } })}>
              Open
            </Button>
          )}
        />
      ))}
    </ScrollView>
  );
}
