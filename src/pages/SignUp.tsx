import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Building } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { usePreloader } from '../contexts/PreloaderContext';

// Import GlassInputWrapper from sign-in component
const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

export function SignUp() {
  const navigate = useNavigate();
  const { signUp } = useAuthContext();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const { setShowPreloader } = usePreloader();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Validate password strength
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setIsLoading(true);
    setShowPreloader(true);
    
    try {
      const { error } = await signUp(formData.email, formData.password, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
      });
      
      if (error) {
        console.error('❌ Sign up failed:', error.message);

        // Provide user-friendly error messages
        let userFriendlyMessage = error.message;
        if (error.message.includes('User already registered')) {
          userFriendlyMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('Password should be at least')) {
          userFriendlyMessage = 'Password must be at least 6 characters long.';
        } else if (error.message.includes('Unable to validate email address')) {
          userFriendlyMessage = 'Please enter a valid email address.';
        } else if (error.message.includes('Signup is disabled')) {
          userFriendlyMessage = 'Account registration is currently disabled. Please contact support.';
        }

        setError(userFriendlyMessage);
        setShowPreloader(false);
      } else {
        // Show email confirmation message
        setShowEmailConfirmation(true);
        
        // Redirect to sign-in after 3 seconds
        setTimeout(() => {
          navigate('/signin');
        }, 3000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setShowPreloader(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Show email confirmation state
  if (showEmailConfirmation) {
    return (
      <div className="min-h-screen bg-white">
        {/* Logo Overlay */}
        <div className="absolute top-8 left-8 z-10">
          <img
            src="/taxos-logo.png"
            alt="Taxos"
            className="h-10 w-auto"
          />
        </div>

        {/* Success Message */}
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center space-y-6">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">✓</span>
              </div>
            </div>

            {/* Message */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-gray-900">Account Created!</h1>
              <p className="text-gray-700 text-lg leading-relaxed">
                Please check your email to confirm your account.
              </p>
              <p className="text-gray-600 text-sm">
                We've sent a confirmation link to <span className="text-violet-400 font-medium">{formData.email}</span>
              </p>
            </div>

            {/* Loading indicator */}
            <div className="flex items-center justify-center space-x-3 text-gray-600">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Redirecting to sign in...</span>
            </div>

            {/* Manual redirect link */}
            <div className="pt-4">
              <Link
                to="/signin"
                className="text-violet-400 hover:text-violet-300 font-semibold transition-colors duration-200"
              >
                Go to sign in now
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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



        <div className="w-full max-w-md space-y-6 pt-16">
          {/* Header */}
          <div className="animate-element animate-delay-100 opacity-0">
            <h1 className="text-5xl font-light text-gray-900 tracking-tighter mb-8">
              Start your free trial
            </h1>
            <p className="text-muted-foreground">
              Create your Taxos account today
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="animate-element animate-delay-150 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <div className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-red-800 text-sm font-medium">Account Creation Failed</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Fields */}
            <div className="animate-element animate-delay-200 grid grid-cols-2 gap-4 opacity-0">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">First Name</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="First name"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="w-full bg-transparent text-sm p-4 pl-12 rounded-2xl focus:outline-none"
                      required
                    />
                  </div>
                </GlassInputWrapper>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Last Name</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Last name"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="w-full bg-transparent text-sm p-4 pl-12 rounded-2xl focus:outline-none"
                      required
                    />
                  </div>
                </GlassInputWrapper>
              </div>
            </div>

            {/* Email */}
            <div className="animate-element animate-delay-300 opacity-0">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Email Address</label>
              <GlassInputWrapper>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full bg-transparent text-sm p-4 pl-12 rounded-2xl focus:outline-none"
                    required
                  />
                </div>
              </GlassInputWrapper>
            </div>

            {/* Company */}
            <div className="animate-element animate-delay-400 opacity-0">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Company</label>
              <GlassInputWrapper>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Company name"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className="w-full bg-transparent text-sm p-4 pl-12 rounded-2xl focus:outline-none"
                    required
                  />
                </div>
              </GlassInputWrapper>
            </div>

            {/* Password */}
            <div className="animate-element animate-delay-500">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Password</label>
              <GlassInputWrapper>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full bg-transparent text-sm p-4 pl-12 pr-12 rounded-2xl focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" /> : <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />}
                  </button>
                </div>
              </GlassInputWrapper>
            </div>

            {/* Confirm Password */}
            <div className="animate-element animate-delay-600">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Confirm Password</label>
              <GlassInputWrapper>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className="w-full bg-transparent text-sm p-4 pl-12 pr-12 rounded-2xl focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-3 flex items-center"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" /> : <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />}
                  </button>
                </div>
              </GlassInputWrapper>
            </div>

            {/* Terms Agreement */}
            <div className="animate-element animate-delay-700 flex items-start space-x-3">
              <input
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="w-4 h-4 text-violet-400 bg-white border-gray-300 rounded focus:ring-violet-400 focus:ring-2 mt-1"
                required
              />
              <p className="text-sm text-gray-600 leading-relaxed">
                I agree to the{' '}
                <Link to="/terms" className="text-violet-400 hover:text-violet-300 transition-colors duration-200">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-violet-400 hover:text-violet-300 transition-colors duration-200">
                  Privacy Policy
                </Link>
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="animate-element animate-delay-800 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Footer */}
          <div className="animate-element animate-delay-900 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/signin"
                className="text-violet-400 hover:text-violet-300 font-semibold transition-colors duration-200"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Hero Image */}
      <div className="hidden md:block flex-1 relative overflow-hidden p-4">
        <div
          className="absolute inset-4 bg-cover bg-center bg-no-repeat rounded-3xl"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/31951633/pexels-photo-31951633.jpeg?_gl=1*106c6uc*_ga*NDg0MTc4NzYzLjE3NDg1OTk1MTM.*_ga_8JE65Q40S6*czE3NTExMTMyNTUkbzMkZzEkdDE3NTExMTM2NjEkajU5JGwwJGgw')`
          }}
        />
        {/* Blur overlay for better text readability */}
        <div className="absolute inset-4 backdrop-blur-[1px] rounded-3xl" />
        <div className="absolute inset-4 bg-gradient-to-br from-black/20 to-black/40 rounded-3xl" />

        {/* Content Overlay */}
        <div className="absolute inset-4 rounded-3xl flex flex-col justify-between p-8 xl:p-12 text-white">
          {/* Upper side - Main text */}
          <div className="flex-[3] flex items-center justify-center">
            <div className="max-w-lg">
              <h2 className="text-3xl xl:text-4xl font-bold mb-6 leading-tight text-white">
                Join thousands of CPAs who trust Taxos
              </h2>
              <p className="text-lg xl:text-xl text-white/90 leading-relaxed">
                Experience the future of tax preparation with AI-powered insights,
                automated workflows, and intelligent client management.
              </p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-[2]"></div>

          {/* Bottom side - Features */}
          <div className="flex-[3] flex items-center justify-center">
            <div className="max-w-lg space-y-6">
              {/* Features */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-gray-900 text-sm">✓</span>
                  </div>
                  <span className="text-white/90 text-base">AI-powered document analysis</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-gray-900 text-sm">✓</span>
                  </div>
                  <span className="text-white/90 text-base">Automated deduction detection</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-gray-900 text-sm">✓</span>
                  </div>
                  <span className="text-white/90 text-base">Seamless client collaboration</span>
                </div>
              </div>

              {/* Stats */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">2,500+</div>
                    <div className="text-white/70 text-sm">Active CPAs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">50K+</div>
                    <div className="text-white/70 text-sm">Documents Processed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">98%</div>
                    <div className="text-white/70 text-sm">Satisfaction Rate</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}