import { useState, useEffect, useCallback } from 'react';
import { vendorsApi, Vendor, PaymentTransaction } from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';

export interface VendorAnalytics {
  totalPaid: number;
  transactionCount: number;
  averageInvoiceSize: number;
  lastTransaction?: PaymentTransaction;
  lastTransactionDate?: string;
  outstandingBalance: number;
  pendingPayments: number;
}

export function useVendors(selectedClientId?: string) {
  const { user, loading: authLoading } = useAuthContext();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorAnalytics, setVendorAnalytics] = useState<Record<string, VendorAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendorAnalytics = useCallback(async (vendorIds: string[]) => {
    if (!user || vendorIds.length === 0) {
      return {};
    }

    try {
      // Fetch payment transactions for all vendors
      let query = supabase
        .from('payment_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('payment_date', { ascending: false });

      // Only add vendor_id filter if we have vendor IDs
      if (vendorIds.length > 0) {
        query = query.in('vendor_id', vendorIds);
      }

      // Also filter by client_id if selectedClientId is provided
      if (selectedClientId) {
        query = query.eq('client_id', selectedClientId);
      }

      const { data: transactions, error: txError } = await query;

      if (txError) {
        throw txError;
      }

      // Calculate analytics for each vendor
      const analytics: Record<string, VendorAnalytics> = {};

      vendorIds.forEach(vendorId => {
        const vendorTransactions = transactions?.filter(tx => tx.vendor_id === vendorId) || [];
        const totalPaid = vendorTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const transactionCount = vendorTransactions.length;
        const averageInvoiceSize = transactionCount > 0 ? totalPaid / transactionCount : 0;
        const lastTransaction = vendorTransactions[0];

        analytics[vendorId] = {
          totalPaid,
          transactionCount,
          averageInvoiceSize,
          lastTransaction,
          lastTransactionDate: lastTransaction?.payment_date,
          outstandingBalance: 0, // Could be calculated based on open invoices
          pendingPayments: 0 // Could be calculated based on pending transactions
        };
      });

      return analytics;
    } catch (err) {
      // Return empty analytics instead of throwing to prevent app crash
      return {};
    }
  }, [user]);

  const fetchVendors = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const vendorsData = await vendorsApi.getAll(selectedClientId);

      // Fetch analytics for all vendors
      const vendorIds = vendorsData?.map(v => v.id) || [];
      const analytics = await fetchVendorAnalytics(vendorIds);

      setVendors(vendorsData || []);
      setVendorAnalytics(analytics);
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  }, [user, selectedClientId, fetchVendorAnalytics]);

  useEffect(() => {
    // Only fetch data when authentication is complete and user exists
    if (!authLoading && user) {
      fetchVendors();
    } else if (!authLoading && !user) {
      setError('Please sign in to view vendors data');
      setLoading(false);
    }
  }, [authLoading, user?.id, selectedClientId, fetchVendors]);

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
    vendorAnalytics,
    loading,
    error,
    addVendor,
    updateVendor,
    refreshVendors
  };
}