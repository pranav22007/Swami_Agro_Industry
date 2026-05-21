import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
    const q = query(collection(db, 'businesses'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Business[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...(doc.data() as any) });
      });
      setBusinesses(list);
      
      // Set active business if not set or if current active is not in new list
      if (list.length > 0) {
        if (!activeBusiness || !list.find(b => b.id === activeBusiness.id)) {
          setActiveBusiness(list[0]);
        } else {
          // Update active business data
          const updated = list.find(b => b.id === activeBusiness.id);
          if (updated) setActiveBusiness(updated);
        }
      } else {
        setActiveBusiness(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return (
    <BusinessContext.Provider value={{ businesses, activeBusiness, setActiveBusiness, loading }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => useContext(BusinessContext);
