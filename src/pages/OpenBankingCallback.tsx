import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/organisms/TopBar';
import { Button } from '../components/atoms/Button';
import { CheckCircle2, AlertCircle, Clock, ArrowLeft } from 'lucide-react';

export function OpenBankingCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const reason = searchParams.get('reason');
    const code = searchParams.get('code');
    const reportData = searchParams.get('reportData');

    console.log('Open Banking Callback:', { reason, code, reportData });

    // Determine status based on callback parameters
    if (reason === 'complete' && code === '200') {
      setStatus('success');
      setMessage('Bank account linking completed successfully! Your CPA will now have access to your financial data for tax preparation.');
    } else if (reason === 'cancel') {
      setStatus('error');
      setMessage('Bank account linking was cancelled. You can try again later if needed.');
    } else if (reason === 'error') {
      setStatus('error');
      setMessage('There was an error during the bank account linking process. Please try again or contact your CPA for assistance.');
    } else {
      setStatus('pending');
      setMessage('Processing your bank account linking request...');
    }

    // Auto-redirect after 5 seconds for success
    if (reason === 'complete' && code === '200') {
      const timer = setTimeout(() => {
        navigate('/clients');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, navigate]);

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-16 h-16 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-16 h-16 text-red-600" />;
      case 'pending':
        return <Clock className="w-16 h-16 text-yellow-600" />;
      default:
        return <Clock className="w-16 h-16 text-blue-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title="Open Banking Callback" />
      
      <div className="max-w-2xl mx-auto px-8 py-16">
        <div className="text-center">
          {/* Status Icon */}
          <div className="mb-8">
            {getStatusIcon()}
          </div>

          {/* Status Title */}
          <h1 className={`text-3xl font-bold mb-4 ${getStatusColor()}`}>
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Error'}
            {status === 'pending' && 'Processing...'}
            {status === 'loading' && 'Loading...'}
          </h1>

          {/* Status Message */}
          <p className="text-lg text-text-secondary mb-8 leading-relaxed">
            {message}
          </p>

          {/* Additional Info for Success */}
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-green-800 mb-2">What happens next?</h3>
              <ul className="text-green-700 text-left space-y-2">
                <li>• Your CPA will be notified that your bank accounts are linked</li>
                <li>• Financial data will be securely retrieved for tax preparation</li>
                <li>• You can manage your connected accounts through your bank's website</li>
                <li>• Your data is protected by bank-level security standards</li>
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            <Button
              className="bg-primary text-gray-900 hover:bg-primary-hover"
              icon={ArrowLeft}
              onClick={() => navigate('/clients')}
            >
              Back to Clients
            </Button>
            
            {status === 'error' && (
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            )}
          </div>

          {/* Auto-redirect notice */}
          {status === 'success' && (
            <p className="text-sm text-text-tertiary mt-6">
              You'll be automatically redirected to the clients page in a few seconds...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
