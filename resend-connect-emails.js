// Script to resend Connect emails for existing customers to fetch historical transactions
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

async function resendConnectEmailsForExistingCustomers() {
  console.log('📧 Resending Connect emails for existing customers to fetch historical transactions...\n');

  try {
    // Get all linked customers who might need historical transactions
    const { data: customers, error: customersError } = await supabase
      .from('open_banking_customers')
      .select(`
        finicity_customer_id,
        platform_client_id,
        status,
        clients!inner(name, email)
      `)
      .eq('status', 'linked');

    if (customersError) {
      console.error('❌ Error fetching customers:', customersError);
      return;
    }

    if (!customers || customers.length === 0) {
      console.log('ℹ️ No linked customers found');
      return;
    }

    console.log(`📋 Found ${customers.length} linked customers:`);
    customers.forEach(customer => {
      console.log(`   - ${customer.clients.name} (${customer.clients.email}) - Status: ${customer.status}`);
    });

    // Check which customers have few transactions (likely missing historical data)
    console.log('\n🔍 Checking transaction counts...');
    const customersWithFewTransactions = [];

    for (const customer of customers) {
      const { data: transactionCount, error: txError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact' })
        .eq('client_id', customer.platform_client_id);

      if (txError) {
        console.error(`❌ Error checking transactions for ${customer.clients.name}:`, txError);
        continue;
      }

      const txCount = transactionCount?.length || 0;
      console.log(`   - ${customer.clients.name}: ${txCount} transactions`);

      // Consider customers with fewer than 10 transactions as needing historical data
      if (txCount < 10) {
        customersWithFewTransactions.push({
          ...customer,
          transactionCount: txCount
        });
      }
    }

    if (customersWithFewTransactions.length === 0) {
      console.log('\n✅ All customers have sufficient transaction data');
      return;
    }

    console.log(`\n🎯 Found ${customersWithFewTransactions.length} customers who likely need historical transactions:`);
    customersWithFewTransactions.forEach(customer => {
      console.log(`   - ${customer.clients.name} (${customer.transactionCount} transactions)`);
    });

    // For now, just provide instructions (since we can't directly call the Supabase function from this script)
    console.log('\n📋 To fetch historical transactions for these customers:');
    console.log('1. Go to the TaxOS web interface');
    console.log('2. Navigate to each client who has few transactions');
    console.log('3. Click the "Link Bank Account" button again');
    console.log('4. This will trigger a new Connect flow that includes historical transaction fetching');

    console.log('\n📝 Alternatively, you can manually trigger the Connect flow by calling:');
    customersWithFewTransactions.forEach(customer => {
      console.log(`   POST ${process.env.VITE_SUPABASE_URL}/functions/v1/open-banking-customer-manager`);
      console.log(`   Body: {"action": "send_bank_auth_email", "platformClientId": "${customer.platform_client_id}", "clientEmail": "${customer.clients.email}", "clientName": "${customer.clients.name}"}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error in resendConnectEmailsForExistingCustomers:', error);
  }
}

// Run the script
resendConnectEmailsForExistingCustomers();
