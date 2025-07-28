import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyWebhook } from 'https://esm.sh/svix@1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify webhook signature
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response(
        JSON.stringify({ error: 'Missing webhook headers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.text();
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')!;

    try {
      await verifyWebhook(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(payload);
    console.log('Processing webhook event:', event.type, event.data.id);

    // Update email communication status
    const { data: communication, error: fetchError } = await supabase
      .from('email_communications')
      .select('*')
      .eq('resend_message_id', event.data.id)
      .single();

    if (fetchError || !communication) {
      console.log('No communication record found for message ID:', event.data.id);
      return new Response(
        JSON.stringify({ success: true, message: 'No communication record found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let status = 'sent';
    let updateData: any = {};

    switch (event.type) {
      case 'email.delivered':
        status = 'delivered';
        break;
      case 'email.opened':
        status = 'opened';
        updateData.opened_at = new Date().toISOString();
        break;
      case 'email.clicked':
        status = 'clicked';
        updateData.clicked_at = new Date().toISOString();
        break;
      case 'email.bounced':
        status = 'bounced';
        updateData.bounced_at = new Date().toISOString();
        break;
      case 'email.complained':
        status = 'complained';
        break;
      default:
        console.log('Unhandled event type:', event.type);
        return new Response(
          JSON.stringify({ success: true, message: 'Event type not handled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { error: updateError } = await supabase
      .from('email_communications')
      .update({
        status,
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', communication.id);

    if (updateError) {
      console.error('Failed to update communication status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update communication status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully updated communication status:', communication.id, 'to', status);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 