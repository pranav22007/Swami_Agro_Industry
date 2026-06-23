import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

interface Business {
  id: string;
  businessName: string;
  photoUrl?: string;
  totalSales: number;
  [key: string]: any;
}

interface BusinessContextType {
  businesses: Business[];
  activeBusiness: Business | null;
  setActiveBusiness: (business: Business) => void;
  loading: boolean;
}

const BusinessContext = createContext<BusinessContextType>({
  businesses: [],
  activeBusiness: null,
  setActiveBusiness: () => {},
  loading: true,
});

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBusinesses([]);
      setActiveBusiness(null);
      setLoading(false);
      return;
    }

    setLoading(true); // Reset loading state when user changes
    console.debug('BusinessContext: signed-in user', { uid: user.uid, email: user.email });

    const unsubscribe = onSnapshot(
      query(collection(db, 'businesses'), where('userId', '==', user.uid)),
      async (snapshot) => {
        const list: Business[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...(doc.data() as any) });
        });

        const rawEmail = user.email;
        const normalizedEmail = rawEmail?.trim().toLowerCase();

        if (list.length === 0) {
          const alternateUidFields = ['userUID', 'ownerId'];
          for (const field of alternateUidFields) {
            if (list.length > 0) break;
            try {
              const uidQuery = query(collection(db, 'businesses'), where(field, '==', user.uid));
              const uidSnapshot = await getDocs(uidQuery);
              uidSnapshot.forEach((doc) => {
                list.push({ id: doc.id, ...(doc.data() as any) });
              });
            } catch (error) {
              console.error(`Error during fallback business query for UID field ${field}:`, error);
            }
          }
        }

        if (list.length === 0 && rawEmail) {
          // Fallback: try exact match by businessEmail, email, or ownerEmail
          const emailFields = ['businessEmail', 'email', 'ownerEmail'];
          for (const field of emailFields) {
            if (list.length > 0) break;
            try {
              const fallbackQuery = query(collection(db, 'businesses'), where(field, '==', rawEmail));
              const fallbackSnapshot = await getDocs(fallbackQuery);
              fallbackSnapshot.forEach((doc) => {
                list.push({ id: doc.id, ...(doc.data() as any) });
              });
            } catch (error) {
              console.error(`Error during fallback business query for field ${field}:`, error);
            }
          }

          // If still empty, attempt a broad scan for user email or UID in any string field
          if (list.length === 0) {
            try {
              console.warn('BusinessContext: exact email fallback returned no results, scanning businesses for email or UID in any string field');
              const allSnap = await getDocs(collection(db, 'businesses'));
              allSnap.forEach((doc) => {
                const data = doc.data() as any;
                const allValues = Object.values(data);
                const matches = allValues.some((value) => {
                  if (typeof value !== 'string') return false;
                  const normalizedValue = value.trim().toLowerCase();
                  return (
                    normalizedEmail && normalizedValue === normalizedEmail
                  ) || (
                    normalizedEmail && normalizedValue.includes(normalizedEmail)
                  ) || normalizedValue === user.uid || normalizedValue.includes(user.uid);
                });
                if (matches) {
                  list.push({ id: doc.id, ...(data) });
                }
              });
            } catch (err) {
              console.error('Error scanning businesses for email/UID match:', err);
            }
          }
        }

        // If we recovered businesses but they don't have the correct userId, try to associate them automatically
        if (list.length > 0) {
          list.forEach(async (b) => {
            try {
              const existingUserId = (b.userId || b.userUID || b.ownerId) as string | undefined;
              if (!existingUserId || existingUserId !== user.uid) {
                await updateDoc(doc(db, 'businesses', b.id), { userId: user.uid });
                console.info('BusinessContext: associated business', b.id, 'to user', user.uid);
              }
            } catch (e) {
              console.error('Failed to associate business', b.id, e);
            }
          });
        }

        setBusinesses(list);
        setActiveBusiness((prevActiveBusiness) => {
          if (list.length === 0) {
            return null;
          }

          if (!prevActiveBusiness) {
            return list[0];
          }

          const matching = list.find((b) => b.id === prevActiveBusiness.id);
          return matching || list[0];
        });
        setLoading(false);
      },
      (error) => {
        console.error('Error in businesses snapshot:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return (
    <BusinessContext.Provider value={{ businesses, activeBusiness, setActiveBusiness, loading }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => useContext(BusinessContext);
