import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BookkeepingTransaction {
  id: string;
  tx_id_ext: string;
  user_id: string;
  client_id?: string;
  account_id?: string;
  date_posted: string;
  amount: number;
  raw_description?: string;
  normalized_merchant?: string;
  status: 'for_review' | 'categorized' | 'posted' | 'flagged' | 'waiting_on_client';
  category_suggested?: string;
  category_final?: string;
  payee_suggested?: string;
  payee_final?: string;
  confidence?: number;
  flags?: string[];
  // Data Enrichment fields
  enrichment_source?: string;
  category_group?: string;
  category_confidence?: number;
  merchant_entity_id?: string;
  merchant_website?: string;
  merchant_logo?: string;
  merchant_confidence?: number;
  merchant_city?: string;
  merchant_state?: string;
  merchant_coordinates?: string;
  enrichment_timestamp?: string;
  created_at: string;
  updated_at: string;
}

export interface BookkeepingTransactionWithAccount extends BookkeepingTransaction {
  account_name?: string;
  account_type?: string;
}

export function useBookkeepingTransactions(clientId?: string) {
  const [transactions, setTransactions] = useState<BookkeepingTransactionWithAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('transactions')
        .select(`
          *,
          open_banking_accounts(
            name,
            type
          )
        `)
        .order('date_posted', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Transform the data to include account information
      const transformedData = data?.map(tx => ({
        ...tx,
        account_name: tx.open_banking_accounts?.name,
        account_type: tx.open_banking_accounts?.type
      })) || [];

      setTransactions(transformedData);
    } catch (err: any) {
      console.error('Error fetching bookkeeping transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateTransaction = async (transactionId: string, updates: Partial<BookkeepingTransaction>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', transactionId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Refresh the transactions list
      await fetchTransactions();
      
      return { success: true, data };
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      return { success: false, error: err.message };
    }
  };

  const bulkUpdateTransactions = async (transactionIds: string[], updates: Partial<BookkeepingTransaction>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('transactions')
        .update(updates)
        .in('id', transactionIds)
        .select();

      if (updateError) {
        throw updateError;
      }

      // Refresh the transactions list
      await fetchTransactions();
      
      return { success: true, data };
    } catch (err: any) {
      console.error('Error bulk updating transactions:', err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [clientId]);

  const refreshTransactions = () => {
    fetchTransactions();
  };

  return {
    transactions,
    loading,
    error,
    refreshTransactions,
    updateTransaction,
    bulkUpdateTransactions
  };
}
