import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/atoms/Button';

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setValidSession(true);
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        // Redirect to sign in after 3 seconds
        setTimeout(() => {
          navigate('/signin');
        }, 3000);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!validSession && !error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-white">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Left Panel - Success Message */}
        <div className="flex-1 bg-gray-900 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md text-center space-y-6 sm:space-y-8">
            {/* Logo */}
            <div className="flex items-center justify-center space-x-3 mb-6 sm:mb-8">
              <div className="p-2 sm:p-3 bg-primary rounded-xl shadow-soft">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-gray-900" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">TaxOS</span>
                <p className="text-xs sm:text-sm text-gray-400 font-medium">by Nurahex</p>
              </div>
            </div>

            {/* Success Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-3 sm:space-y-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Password updated!</h1>
              <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
                Your password has been successfully updated.
              </p>
            </div>

            {/* Loading indicator */}
            <div className="flex items-center justify-center space-x-3 text-gray-400">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs sm:text-sm">Redirecting to sign in...</span>
            </div>

            {/* Manual redirect link */}
            <div className="pt-4">
              <Link
                to="/signin"
                className="text-sm text-primary hover:text-primary-hover font-semibold transition-colors duration-200"
              >
                Go to sign in now
              </Link>
            </div>
          </div>
        </div>

        {/* Right Panel - Same background */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url('https://images.pexels.com/photos/32489809/pexels-photo-32489809.jpeg?_gl=1*j7c3pm*_ga*NDg0MTc4NzYzLjE3NDg1OTk1MTM.*_ga_8JE65Q40S6*czE3NTExMTMyNTUkbzMkZzEkdDE3NTExMTMyNzgkajM3JGwwJGgw')`
            }}
          />
          {/* Blur overlay for better text readability */}
          <div className="absolute inset-0 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/40" />
          
          {/* Content Overlay */}
          <div className="relative h-full flex flex-col justify-center items-center p-8 xl:p-12 text-white">
            <div className="text-center max-w-lg">
              <h2 className="text-3xl xl:text-4xl font-bold mb-6 leading-tight">
                Welcome back to TaxOS!
              </h2>
              <p className="text-lg xl:text-xl text-white/90 leading-relaxed">
                Your account is now secure with your new password. Sign in to continue managing your tax workflow.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Form */}
      <div className="flex-1 bg-gray-900 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          {/* Logo */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6 sm:mb-8">
              <div className="p-2 sm:p-3 bg-primary rounded-xl shadow-soft">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-gray-900" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">TaxOS</span>
                <p className="text-xs sm:text-sm text-gray-400 font-medium">by Nurahex</p>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Reset your password</h1>
            <p className="text-sm sm:text-base text-gray-400">
              Enter your new password below to secure your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 sm:p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-xs sm:text-sm">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-3 sm:space-y-4">
              {/* New Password */}
              <div className="relative">
                <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 text-sm sm:text-base"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 text-sm sm:text-base"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors duration-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-2">Password requirements:</h4>
              <ul className="space-y-1 text-xs text-gray-400">
                <li className={`flex items-center space-x-2 ${password.length >= 6 ? 'text-green-400' : ''}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${password.length >= 6 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                  <span>At least 6 characters</span>
                </li>
                <li className={`flex items-center space-x-2 ${password === confirmPassword && password.length > 0 ? 'text-green-400' : ''}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${password === confirmPassword && password.length > 0 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                  <span>Passwords match</span>
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full py-3 sm:py-4 text-base sm:text-lg font-semibold"
              disabled={isLoading || !validSession}
            >
              {isLoading ? 'Updating password...' : 'Update Password'}
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center">
            <Link
              to="/signin"
              className="text-sm text-primary hover:text-primary-hover font-semibold transition-colors duration-200"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Right Panel - Background */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/32489809/pexels-photo-32489809.jpeg?_gl=1*j7c3pm*_ga*NDg0MTc4NzYzLjE3NDg1OTk1MTM.*_ga_8JE65Q40S6*czE3NTExMTMyNTUkbzMkZzEkdDE3NTExMTMyNzgkajM3JGwwJGgw')`
          }}
        />
        {/* Blur overlay for better text readability */}
        <div className="absolute inset-0 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/40" />
        
        {/* Content Overlay */}
        <div className="relative h-full flex flex-col justify-between p-8 xl:p-12 text-white">
          <div className="flex-1 flex flex-col justify-center">
            <div className="max-w-lg">
              <h2 className="text-3xl xl:text-4xl font-bold mb-6 leading-tight">
                Secure your account
              </h2>
              <p className="text-lg xl:text-xl text-white/90 leading-relaxed mb-6 xl:mb-8">
                Create a strong password to protect your tax data and client information.
              </p>
              
              {/* Security Features */}
              <div className="space-y-3 xl:space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 xl:w-6 xl:h-6 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 xl:w-4 xl:h-4 text-gray-900" />
                  </div>
                  <span className="text-white/90 text-sm xl:text-base">End-to-end encryption</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 xl:w-6 xl:h-6 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 xl:w-4 xl:h-4 text-gray-900" />
                  </div>
                  <span className="text-white/90 text-sm xl:text-base">Secure password storage</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 xl:w-6 xl:h-6 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 xl:w-4 xl:h-4 text-gray-900" />
                  </div>
                  <span className="text-white/90 text-sm xl:text-base">Account activity monitoring</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Security Badge */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 xl:p-6 border border-white/20">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary rounded-lg">
                <Lock className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <div className="text-white font-medium">Bank-level Security</div>
                <div className="text-white/70 text-sm">Your data is protected with enterprise-grade security</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}