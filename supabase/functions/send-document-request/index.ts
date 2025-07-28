import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@3.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface SendDocumentRequestRequest {
  requestId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId }: SendDocumentRequestRequest = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Request ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get document request and client details
    const { data: request, error: requestError } = await supabase
      .from('document_requests')
      .select(`
        *,
        clients!inner(name, email)
      `)
      .eq('id', requestId)
      .eq('user_id', user.id)
      .single();

    if (requestError || !request) {
      return new Response(
        JSON.stringify({ error: 'Document request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate upload URL
    const appUrl = Deno.env.get('APP_URL') || 'https://taxos-rcm4uvflc-harisharnams-projects.vercel.app';
    const uploadUrl = `${appUrl}/upload/${request.upload_token}`;

    // Generate email HTML
    const dueDate = new Date(request.due_date).toLocaleDateString();
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Request</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .document-list { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .document-item { margin: 8px 0; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; color: #333;">Document Request</h1>
            </div>
            
            <p>Dear ${request.clients.name},</p>
            
            <p>We need the following documents for <strong>${request.title}</strong>:</p>
            
            <div class="document-list">
              ${request.document_types.map(doc => `<div class="document-item">• ${doc}</div>`).join('')}
            </div>
            
            ${request.description ? `<p>${request.description}</p>` : ''}
            
            <p><strong>Due Date:</strong> ${dueDate}</p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${uploadUrl}" class="button">Upload Documents</a>
            </div>
            
            <div class="footer">
              <p>If you have any questions, please don't hesitate to contact us.</p>
              <p>This is an automated message from TaxOS.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: Deno.env.get('RESEND_FROM')!,
      to: request.clients.email,
      subject: `Document Request: ${request.title}`,
      html: emailHtml,
      headers: {
        'List-Unsubscribe': `<${appUrl}/unsubscribe>`,
      },
    });

    if (emailError) {
      console.error('Resend API error:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update request status
    await supabase
      .from('document_requests')
      .update({ 
        email_sent: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    // Log email communication
    await supabase
      .from('email_communications')
      .insert({
        user_id: user.id,
        client_id: request.client_id,
        request_id: requestId,
        resend_message_id: emailResult.id,
        email_type: 'initial_request',
        recipient_email: request.clients.email,
        subject: `Document Request: ${request.title}`,
        status: 'sent'
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResult.id,
        uploadUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending document request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 