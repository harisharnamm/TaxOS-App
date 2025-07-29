import { Resend } from 'resend';

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export interface EmailTemplate {
  to: string;
  subject: string;
  html?: string;
  react?: React.ReactElement;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
  headers?: Record<string, string>;
}

export interface DocumentRequestEmailData {
  clientName: string;
  title: string;
  description?: string;
  documentTypes: string[];
  dueDate: string;
  uploadUrl: string;
}

export interface DocumentReminderEmailData {
  clientName: string;
  title: string;
  dueDate: string;
  uploadUrl: string;
  daysOverdue?: number;
}

export class EmailService {
  static async sendEmail(template: EmailTemplate) {
    try {
      const { data, error } = await resend.emails.send({
        from: import.meta.env.VITE_RESEND_FROM!,
        to: template.to,
        subject: template.subject,
        html: template.html,
        react: template.react,
        attachments: template.attachments,
        headers: template.headers,
      });

      if (error) {
        console.error('Resend API error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }

  static async sendDocumentRequestEmail(
    clientEmail: string,
    requestData: DocumentRequestEmailData
  ) {
    const html = this.generateDocumentRequestEmailHTML(requestData);
    
    return this.sendEmail({
      to: clientEmail,
      subject: `Document Request: ${requestData.title}`,
      html,
      headers: {
        'List-Unsubscribe': `<${import.meta.env.VITE_APP_URL}/unsubscribe>`,
      },
    });
  }

  static async sendReminderEmail(
    clientEmail: string,
    requestData: DocumentReminderEmailData
  ) {
    const html = this.generateReminderEmailHTML(requestData);
    
    return this.sendEmail({
      to: clientEmail,
      subject: `Reminder: ${requestData.title}`,
      html,
      headers: {
        'List-Unsubscribe': `<${import.meta.env.VITE_APP_URL}/unsubscribe>`,
      },
    });
  }

  private static generateDocumentRequestEmailHTML(data: DocumentRequestEmailData): string {
    const dueDate = new Date(data.dueDate).toLocaleDateString();
    
    return `
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
            
            <p>Dear ${data.clientName},</p>
            
            <p>We need the following documents for <strong>${data.title}</strong>:</p>
            
            <div class="document-list">
              ${data.documentTypes.map(doc => `<div class="document-item">• ${doc}</div>`).join('')}
            </div>
            
            ${data.description ? `<p>${data.description}</p>` : ''}
            
            <p><strong>Due Date:</strong> ${dueDate}</p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.uploadUrl}" class="button">Upload Documents</a>
            </div>
            
            <div class="footer">
              <p>If you have any questions, please don't hesitate to contact us.</p>
              <p>This is an automated message from TaxOS.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private static generateReminderEmailHTML(data: DocumentReminderEmailData): string {
    const dueDate = new Date(data.dueDate).toLocaleDateString();
    const overdueText = data.daysOverdue ? ` (${data.daysOverdue} days overdue)` : '';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Request Reminder</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; color: #856404;">Document Request Reminder</h1>
            </div>
            
            <p>Dear ${data.clientName},</p>
            
            <p>This is a friendly reminder that we're still waiting for documents for <strong>${data.title}</strong>${overdueText}.</p>
            
            <p><strong>Due Date:</strong> ${dueDate}</p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.uploadUrl}" class="button">Upload Documents Now</a>
            </div>
            
            <p>Please upload the requested documents as soon as possible to avoid any delays in processing.</p>
            
            <div class="footer">
              <p>If you have any questions or need assistance, please contact us immediately.</p>
              <p>This is an automated reminder from TaxOS.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
} 