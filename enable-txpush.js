// Script to enable TxPush for all existing customers
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

// TxPush enable function (similar to the webhook function)
async function enableTxPushForCustomer(customerId, partnerSecret, appKey, webhookUrl) {
  try {
    const baseUrl = process.env.OPEN_BANKING_BASE_URL?.replace(/\/$/, "") || "https://api.finicity.com";
    const partnerId = process.env.OPEN_BANKING_PARTNER_ID;

    if (!partnerId || !appKey || !webhookUrl || !partnerSecret) {
      console.error('Missing required environment variables for TxPush');
      return false;
    }

    // Get partner token
    const tokenResponse = await fetch(`${baseUrl}/aggregation/v2/partners/authentication`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Finicity-App-Key': appKey,
        'Accept': 'application/json',
        'User-Agent': 'TaxOS/1.0 (+preview.trytaxos.com)',
      },
      body: JSON.stringify({
        partnerId: partnerId,
        partnerSecret: partnerSecret
      })
    });

    if (!tokenResponse.ok) {
      console.error(`Failed to get partner token for customer ${customerId}`);
      return false;
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.token;

    // Enable TxPush for the customer
    const txPushUrl = `${baseUrl}/aggregation/v2/customers/${customerId}/txpush`;

    const txPushResponse = await fetch(txPushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Finicity-App-Key': appKey,
        'Finicity-App-Token': token,
        'Accept': 'application/json',
        'User-Agent': 'TaxOS/1.0 (+preview.trytaxos.com)',
      },
      body: JSON.stringify({
        callbackUrl: webhookUrl,
        enabled: true
      })
    });

    if (txPushResponse.ok) {
      const txPushData = await txPushResponse.json();
      console.log(`✅ TxPush enabled successfully for customer ${customerId}:`, txPushData);
      return true;
    } else {
      const errorText = await txPushResponse.text();
      console.error(`❌ Failed to enable TxPush for customer ${customerId}:`, txPushResponse.status, errorText);
      return false;
    }

  } catch (error) {
    console.error(`Error enabling TxPush for customer ${customerId}:`, error);
    return false;
  }
}

async function enableTxPushForAllCustomers() {
  console.log('🚀 Enabling TxPush for all existing customers...\n');

  try {
    // Get all customers with linked status
    const { data: customers, error: customersError } = await supabase
      .from('open_banking_customers')
      .select('finicity_customer_id, platform_client_id, status')
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
      console.log(`   - ${customer.finicity_customer_id} (${customer.status})`);
    });

    // Enable TxPush for each customer
    const results = [];
    for (const customer of customers) {
      console.log(`\n🔄 Enabling TxPush for customer ${customer.finicity_customer_id}...`);

      const success = await enableTxPushForCustomer(
        customer.finicity_customer_id,
        process.env.OPEN_BANKING_PARTNER_SECRET,
        process.env.OPEN_BANKING_APP_KEY,
        process.env.OPEN_BANKING_WEBHOOK_URL
      );

      results.push({
        customerId: customer.finicity_customer_id,
        success: success
      });
    }

    // Summary
    console.log('\n📊 TxPush Enablement Summary:');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Successfully enabled: ${successful}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed customers:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.customerId}`);
      });
    }

  } catch (error) {
    console.error('❌ Error in enableTxPushForAllCustomers:', error);
  }
}

// Run the script
enableTxPushForAllCustomers();
