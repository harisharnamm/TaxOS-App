// Debug script to inspect transaction data
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTransactions() {
  console.log('🔍 Debugging Transaction Data...\n');

  try {
    // 1. Check all clients
    console.log('1. Checking clients...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
    } else {
      console.log('✅ Found clients:', clients?.length || 0);
      clients?.forEach(client => {
        console.log(`   - ${client.name} (ID: ${client.id})`);
      });
    }

    // 2. Check all transactions
    console.log('\n2. Checking all transactions...');
    const { data: allTransactions, error: allTxError } = await supabase
      .from('transactions')
      .select('id, client_id, amount, raw_description, date_posted')
      .limit(10);

    if (allTxError) {
      console.error('❌ Error fetching transactions:', allTxError);
    } else {
      console.log('✅ Found transactions:', allTransactions?.length || 0);
      allTransactions?.forEach(tx => {
        console.log(`   - TX ${tx.id}: ${tx.raw_description} ($${tx.amount}) - Client: ${tx.client_id || 'No client'}`);
      });
    }

    // 3. Check transactions by client
    if (clients && clients.length > 0) {
      console.log('\n3. Checking transactions by client...');
      for (const client of clients) {
        const { data: clientTransactions, error: clientTxError } = await supabase
          .from('transactions')
          .select('id, amount, raw_description, date_posted')
          .eq('client_id', client.id);

        if (clientTxError) {
          console.error(`❌ Error fetching transactions for ${client.name}:`, clientTxError);
        } else {
          console.log(`✅ ${client.name}: ${clientTransactions?.length || 0} transactions`);
        }
      }
    }

    // 4. Check open banking accounts
    console.log('\n4. Checking open banking accounts...');
    const { data: accounts, error: accountsError } = await supabase
      .from('open_banking_accounts')
      .select('*');

    if (accountsError) {
      console.error('❌ Error fetching accounts:', accountsError);
    } else {
      console.log('✅ Found accounts:', accounts?.length || 0);
      accounts?.forEach(account => {
        console.log(`   - ${account.name} (${account.type}) - Client: ${account.client_id || 'No client'}`);
      });
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugTransactions();
