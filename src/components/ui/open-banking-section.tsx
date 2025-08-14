import React, { useState, useEffect } from 'react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { 
  Link2, 
  Banknote, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Send,
  Eye
} from 'lucide-react';

interface OpenBankingSectionProps {
  clientId: string;
  clientEmail: string;
  clientName: string;
}

interface OpenBankingStatus {
  status: 'not_linked' | 'pending' | 'linked';
  finicityCustomerId?: string;
  linkedAt?: string;
  accountCount?: number;
  accounts?: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    balance: number;
  }>;
}

export function OpenBankingSection({ clientId, clientEmail, clientName }: OpenBankingSectionProps) {
  const [status, setStatus] = useState<OpenBankingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const toast = useToast();

  // Get authentication token
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Fetch current Open Banking status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('https://aveuyyywoxizfipbeodi.supabase.co/functions/v1/open-banking-customer-manager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'get_customer_status',
          platformClientId: clientId,
          clientEmail,
          clientName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching Open Banking status:', error);
      toast.error('Failed to fetch status', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Send bank authentication email
  const sendBankAuthEmail = async () => {
    try {
      setSendingEmail(true);
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('https://aveuyyywoxizfipbeodi.supabase.co/functions/v1/open-banking-customer-manager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'send_bank_auth_email',
          platformClientId: clientId,
          clientEmail,
          clientName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      toast.success('Email Sent', 'Bank authentication email has been sent to your client');
      
      // Refresh status to show updated state
      await fetchStatus();
    } catch (error) {
      console.error('Error sending bank auth email:', error);
      toast.error('Failed to send email', (error as Error).message);
    } finally {
      setSendingEmail(false);
    }
  };

  // Check account status directly from Finicity
  const checkAccountStatus = async () => {
    if (!status?.finicityCustomerId) {
      toast.error('No Finicity customer ID found');
      return;
    }

    try {
      setLoading(true);
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Call our accounts function to check directly from Finicity
      const response = await fetch('https://aveuyyywoxizfipbeodi.supabase.co/functions/v1/open-banking-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          finicityCustomerId: status.finicityCustomerId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Update the status with real-time data from Finicity
        setStatus({
          ...status,
          status: data.status,
          accountCount: data.accountCount,
          accounts: data.accounts,
          linkedAt: data.hasAccounts ? new Date().toISOString() : status.linkedAt,
        });
        
        if (data.hasAccounts) {
          toast.success('Accounts Found!', `Client has linked ${data.accountCount} bank account${data.accountCount !== 1 ? 's' : ''}`);
        } else {
          toast.info('No accounts yet', 'Client has not completed bank account linking yet');
        }
      } else {
        toast.error('Failed to check accounts', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error checking account status:', error);
      toast.error('Failed to check accounts', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Load status on component mount
  useEffect(() => {
    fetchStatus();
  }, [clientId]);

  const getStatusIcon = () => {
    switch (status?.status) {
      case 'linked':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'not_linked':
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (status?.status) {
      case 'linked':
        return <Badge variant="success" size="sm">Linked</Badge>;
      case 'pending':
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case 'not_linked':
        return <Badge variant="neutral" size="sm">Not Linked</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Unknown</Badge>;
    }
  };

  const getStatusDescription = () => {
    switch (status?.status) {
      case 'linked':
        return `Client has linked ${status.accountCount} bank account${status.accountCount !== 1 ? 's' : ''}`;
      case 'pending':
        return 'Client has been sent a bank authentication email. Waiting for them to complete the process.';
      case 'not_linked':
        return 'Client has not yet been invited to link their bank accounts.';
      default:
        return 'Unable to determine Open Banking status.';
    }
  };

  return (
    <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
            <Banknote className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">Open Banking</h3>
            <p className="text-sm text-text-tertiary">Bank account access and data</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStatus}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Display */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-3">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-text-primary">Status:</span>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-text-secondary mt-1">
              {getStatusDescription()}
            </p>
          </div>
        </div>

        {/* Additional Status Info */}
        {status?.linkedAt && (
          <div className="text-sm text-text-tertiary">
            <span>Linked since: {new Date(status.linkedAt).toLocaleDateString()}</span>
          </div>
        )}
        
        {/* Last Email Sent Info */}
        {status?.status === 'pending' && (
          <div className="text-sm text-text-tertiary">
            <span>Email sent to client. Check back for updates.</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {status?.status === 'not_linked' && (
          <div className="space-y-3">
            <Button
              className="w-full bg-primary text-gray-900 hover:bg-primary-hover"
              icon={Send}
              onClick={sendBankAuthEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? 'Sending...' : 'Request Bank Access'}
            </Button>
            <p className="text-xs text-text-tertiary text-center">
              Send a secure email to {clientEmail} to request bank account access.
            </p>
          </div>
        )}

        {status?.status === 'pending' && (
          <div className="space-y-3">
            <Button
              variant="secondary"
              className="w-full"
              icon={RefreshCw}
              onClick={checkAccountStatus}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Check Account Status
            </Button>
            
            <Button
              variant="secondary"
              className="w-full"
              icon={Send}
              onClick={sendBankAuthEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? 'Sending...' : 'Resend Email'}
            </Button>
            
            <p className="text-xs text-text-tertiary text-center">
              The email was sent to {clientEmail}. You can resend it if needed.
            </p>
          </div>
        )}

        {status?.status === 'linked' && (
          <div className="space-y-3">
            <Button
              variant="secondary"
              className="w-full"
              icon={Eye}
              onClick={fetchStatus}
            >
              View Accounts
            </Button>
            
            <Button
              variant="ghost"
              className="w-full"
              icon={Send}
              onClick={sendBankAuthEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? 'Sending...' : 'Request Additional Access'}
            </Button>
            {status.accounts && status.accounts.length > 0 && (
              <div className="mt-4 p-3 bg-surface rounded-xl">
                <h4 className="font-medium text-text-primary mb-2">Linked Accounts</h4>
                <div className="space-y-2">
                  {status.accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-text-primary">{account.name}</span>
                        <span className="text-text-tertiary ml-2">({account.type})</span>
                      </div>
                      <span className="font-medium text-text-primary">
                        ${account.balance?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-xs text-text-tertiary text-center mt-3">
              Client has {status.accountCount} linked account{status.accountCount !== 1 ? 's' : ''}. 
              You can request access to additional accounts if needed.
            </p>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 rounded-xl">
        <p className="text-xs text-blue-700">
          <strong>How it works:</strong> Send a secure email to your client. They'll receive a link to 
          connect their bank accounts through our secure partner, Finicity. Once connected, you'll have 
          access to their financial data for tax preparation. You can resend the email anytime if needed.
        </p>
      </div>
    </div>
  );
}
