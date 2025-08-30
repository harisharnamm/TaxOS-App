import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Import GlassInputWrapper from sign-in component
const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setEmailSent(true);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Logo Overlay */}
        <div className="absolute top-8 left-8 z-10">
          <img
            src="/taxos-logo.png"
            alt="Taxos"
            className="h-10 w-auto"
          />
        </div>

        {/* Error Messages */}
        {error && (
          <div className="absolute top-8 right-8 z-10 max-w-md">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="w-full max-w-md space-y-6 pt-16">
          {emailSent ? (
            /* Success Message */
            <div className="text-center space-y-6">
                          {/* Success Icon */}
            <div className="animate-element animate-delay-100 w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Message */}
            <div className="animate-element animate-delay-200 space-y-4">
              <h1 className="text-3xl font-bold text-gray-900">Check your email</h1>
              <p className="text-gray-700 text-lg leading-relaxed">
                We've sent a password reset link to your email address.
              </p>
              <p className="text-gray-600 text-sm">
                We sent the link to <span className="text-violet-400 font-medium">{email}</span>
              </p>
            </div>

            {/* Instructions */}
            <div className="animate-element animate-delay-300 bg-white/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Next steps:</h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start space-x-3">
                  <span className="text-violet-400 font-bold bg-violet-50 rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
                  <span>Check your email inbox (and spam folder)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-violet-400 font-bold bg-violet-50 rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
                  <span>Click the reset password link</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-violet-400 font-bold bg-violet-50 rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
                  <span>Create a new secure password</span>
                </li>
              </ol>
            </div>

            {/* Back to sign in */}
            <div className="animate-element animate-delay-400 pt-4">
              <Link
                to="/signin"
                className="text-violet-400 hover:text-violet-300 font-semibold transition-colors duration-200 inline-flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to sign in</span>
              </Link>
            </div>
            </div>
          ) : (
            /* Form */
            <>
              {/* Header */}
              <div className="animate-element animate-delay-100">
                <h1 className="text-5xl font-light text-gray-900 tracking-tighter mb-8">
                  Forgot your password?
                </h1>
                <p className="text-muted-foreground">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input */}
                <div className="animate-element animate-delay-200">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Email Address</label>
                  <GlassInputWrapper>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent text-sm p-4 pl-12 rounded-2xl focus:outline-none"
                        required
                      />
                    </div>
                  </GlassInputWrapper>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="animate-element animate-delay-300 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Sending reset link...' : 'Send Reset Link'}
                </button>
              </form>

              {/* Footer */}
              <div className="animate-element animate-delay-400 text-center">
                <Link
                  to="/signin"
                  className="text-violet-400 hover:text-violet-300 font-semibold transition-colors duration-200 inline-flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to sign in</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Hero Image */}
      <div className="hidden md:block flex-1 relative overflow-hidden p-4">
        <div
          className="absolute inset-4 bg-cover bg-center bg-no-repeat rounded-3xl"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/32489809/pexels-photo-32489809.jpeg?_gl=1*j7c3pm*_ga*NDg0MTc4NzYzLjE3NDg1OTk1MTM.*_ga_8JE65Q40S6*czE3NTExMTMyNTUkbzMkZzEkdDE3NTExMTMyNzgkajM3JGwwJGgw')`
          }}
        />
        {/* Blur overlay for better text readability */}
        <div className="absolute inset-4 backdrop-blur-[1px] rounded-3xl" />
        <div className="absolute inset-4 bg-gradient-to-br from-black/20 to-black/40 rounded-3xl" />

        {/* Content Overlay */}
        <div className="absolute inset-4 rounded-3xl flex flex-col justify-between p-8 xl:p-12 text-white">
          {/* Main content section */}
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-lg">
              <h2 className="text-3xl xl:text-4xl font-bold mb-6 leading-tight text-white">
                Secure account recovery
              </h2>
              <p className="text-lg xl:text-xl text-white/90 leading-relaxed mb-8">
                Reset your password securely and get back to managing your tax workflow with confidence.
              </p>

              {/* Security Features - moved closer */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-gray-900" />
                  </div>
                  <span className="text-white/90 text-base">Encrypted email delivery</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-gray-900" />
                  </div>
                  <span className="text-white/90 text-base">Time-limited reset links</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-gray-900" />
                  </div>
                  <span className="text-white/90 text-base">Account security verification</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms Footer */}
      <div className="absolute bottom-4 left-8 z-10">
        <p className="text-xs text-gray-600 leading-relaxed">
          By using our password reset service, you agree to our{' '}
          <Link to="/terms" className="text-violet-400 hover:text-violet-300 transition-colors duration-200">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-violet-400 hover:text-violet-300 transition-colors duration-200">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}