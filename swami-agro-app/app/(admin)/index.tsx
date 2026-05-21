import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, Image } from 'react-native';
import { Title, Text, Surface, IconButton, ActivityIndicator, List, Avatar } from 'react-native-paper';
import { collection, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../src/config/firebase';
import { useRouter } from 'expo-router';

export default function AdminDashboard() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchAllBusinesses = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'businesses'));
        const list: any[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setBusinesses(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllBusinesses();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#d32f2f" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.header} elevation={2}>
        <View>
          <Title style={styles.headerTitle}>Admin Panel</Title>
          <Text style={styles.headerSubtitle}>User Activity Overview</Text>
        </View>
        <IconButton icon="logout" onPress={handleLogout} />
      </Surface>

      <FlatList
        data={businesses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <List.Item
            title={item.businessName}
            description={`Sales: ₹${item.totalSales} | Email: ${item.businessEmail}`}
            left={props => 
              item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.listAvatar} />
              ) : (
                <Avatar.Icon {...props} icon="store" />
              )
            }
            style={styles.listItem}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text>No business activity found yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#757575',
  },
  listContent: {
    padding: 10,
  },
  listItem: {
    backgroundColor: 'white',
    marginBottom: 8,
    borderRadius: 8,
  },
  listAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 10,
    marginVertical: 5,
  },
  empty: {
    alignItems: 'center',
    marginTop: 50,
  }
});
