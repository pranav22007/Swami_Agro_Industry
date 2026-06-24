import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
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
  error: string | null;
}

const BusinessContext = createContext<BusinessContextType>({
  businesses: [],
  activeBusiness: null,
  setActiveBusiness: () => {},
  loading: true,
  error: null,
});

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBusinesses([]);
      setActiveBusiness(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const businessCollection = collection(db, 'businesses');
    const currentUserEmail = user.email?.trim().toLowerCase() || '';
    
    const ownerEmail = "tanmaypatil664@gmail.com";
    const managerEmail = "pp9073153@gmail.com";

    console.debug('BusinessContext: Multi-role stream checking rules authorization:', { 
      uid: user.uid, 
      email: currentUserEmail,
      role: userRole
    });

    const processBusinessDocuments = (snapshotOrDocs: any, currentList: Business[]) => {
      const updatedList = [...currentList];
      snapshotOrDocs.forEach((docSnap: any) => {
        const data = docSnap.data();
        if (!updatedList.some(b => b.id === docSnap.id)) {
          updatedList.push({ id: docSnap.id, ...data } as Business);
        }
      });
      return updatedList;
    };

    const loadSharedEmailRecords = async (currentList: Business[]) => {
      let mergedList = [...currentList];
      try {
        // Query master business owner records
        const ownerQuery = query(businessCollection, where('businessEmail', '==', ownerEmail));
        const ownerSnap = await getDocs(ownerQuery);
        mergedList = processBusinessDocuments(ownerSnap, mergedList);

        // Query manager/admin specific documents if authorized
        if (currentUserEmail === managerEmail || userRole === 'admin') {
          const managerQuery = query(businessCollection, where('businessEmail', '==', managerEmail));
          const managerSnap = await getDocs(managerQuery);
          mergedList = processBusinessDocuments(managerSnap, mergedList);
        }
      } catch (err) {
        console.error('BusinessContext: Supplementary email queries failed:', err);
      }
      return mergedList;
    };

    // Open listener on active UID
    const uidQuery = query(businessCollection, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      uidQuery,
      async (snapshot) => {
        try {
          let compiledList: Business[] = [];
          compiledList = processBusinessDocuments(snapshot, compiledList);

          // Merge target business records safely backed by custom security token rules
          compiledList = await loadSharedEmailRecords(compiledList);

          setBusinesses(compiledList);
          setActiveBusiness((prevActive) => {
            if (compiledList.length === 0) return null;
            if (!prevActive) return compiledList[0];
            return compiledList.find((b) => b.id === prevActive.id) || compiledList[0];
          });
          setLoading(false);
        } catch (callbackError) {
          console.error('BusinessContext: Error processing stream update snapshots:', callbackError);
          setLoading(false);
        }
      },
      async (snapshotError) => {
        console.warn('BusinessContext: Falling back to secure token checks:', snapshotError);
        const backupList = await loadSharedEmailRecords([]);
        setBusinesses(backupList);
        setActiveBusiness(backupList.length > 0 ? backupList[0] : null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, userRole]);

  return (
    <BusinessContext.Provider value={{ businesses, activeBusiness, setActiveBusiness, loading, error }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => useContext(BusinessContext);