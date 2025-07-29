import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Transaction {
  id: number;
  transaction_id: string;
  document_id?: string;
  client_id?: string;
  document_source: string;
  transaction_date?: string;
  description?: string;
  amount?: number;
  currency: string;
  transaction_type?: string;
  debit_credit?: string;
  reference_number?: string;
  counterparty?: string;
  counterparty_address?: string;
  invoice_number?: string;
  due_date?: string;
  payment_status?: string;
  payment_method?: string;
  matching_candidate: boolean;
  matched_transaction_ids?: string[];
  tags?: any;
  line_items?: any;
  raw_data?: any;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionData {
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  document?: string;
}

export function useTransactions(clientId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('unified_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createTransaction = async (transactionData: CreateTransactionData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const newTransaction = {
        user_id: user.id,
        client_id: clientId,
        transaction_id: `MANUAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        document_source: 'manual',
        transaction_date: transactionData.date,
        description: transactionData.description,
        amount: transactionData.amount,
        currency: 'USD',
        transaction_type: transactionData.category,
        debit_credit: transactionData.type === 'income' ? 'credit' : 'debit',
        payment_status: 'paid',
        tags: [transactionData.category, transactionData.type],
        line_items: [],
        raw_data: {
          manual_entry: true,
          category: transactionData.category,
          type: transactionData.type,
          document_reference: transactionData.document
        }
      };

      const { data, error: insertError } = await supabase
        .from('unified_transactions')
        .insert([newTransaction])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Refresh the transactions list
      await fetchTransactions();
      
      return { success: true, data };
    } catch (err: any) {
      console.error('Error creating transaction:', err);
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
    createTransaction
  };
} 