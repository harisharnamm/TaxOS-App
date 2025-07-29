import { useState, useEffect, useCallback } from 'react';
import { vendorsApi, Vendor } from '../lib/database';
import { useAuthContext } from '../contexts/AuthContext';

export function useVendors() {
  const { user, loading: authLoading } = useAuthContext();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Vendors: Starting data fetch...');
      console.log('🔄 Vendors: User authenticated:', user?.email);
      
      const vendorsData = await vendorsApi.getAll();
      
      console.log('✅ Vendors: Found', vendorsData?.length, 'vendors');
      setVendors(vendorsData || []);
    } catch (err) {
      console.error('❌ Vendors: Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Only fetch data when authentication is complete and user exists
    if (!authLoading && user) {
      console.log('🔄 Vendors: Auth complete, starting data fetch');
      fetchVendors();
    } else if (!authLoading && !user) {
      console.log('❌ Vendors: No authenticated user');
      setError('Please sign in to view vendors data');
      setLoading(false);
    } else {
      console.log('⏳ Vendors: Waiting for authentication...');
    }
  }, [authLoading, user?.id, fetchVendors]);

  const addVendor = async (vendorData: Omit<Vendor, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const newVendor = await vendorsApi.create(vendorData);
      setVendors(prev => [newVendor, ...prev]);
      return newVendor;
    } catch (err) {
      console.error('Error adding vendor:', err);
      throw err;
    }
  };

  const updateVendor = async (id: string, updates: Partial<Vendor>) => {
    try {
      const updatedVendor = await vendorsApi.update(id, updates);
      setVendors(prev => prev.map(vendor => 
        vendor.id === id ? updatedVendor : vendor
      ));
      return updatedVendor;
    } catch (err) {
      console.error('Error updating vendor:', err);
      throw err;
    }
  };

  const refreshVendors = () => {
    fetchVendors();
  };

  return {
    vendors,
    loading,
    error,
    addVendor,
    updateVendor,
    refreshVendors
  };
}