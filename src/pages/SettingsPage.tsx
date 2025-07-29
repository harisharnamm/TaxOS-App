import React, { useState, ReactElement } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { TopBar } from '../components/organisms/TopBar';
import { GlobalSearch } from '../components/molecules/GlobalSearch';
import { useSearch } from '../contexts/SearchContext';
import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { supabase } from '../lib/supabase';
import { 
  User,
  Mail,
  Bell,
  Save,
  Globe,
  CheckCircle, 
  Smartphone, 
  Lock, 
  Zap,
  Clock,
  Shield
} from 'lucide-react';

export function Settings(): ReactElement {
  const { profile, updateProfile } = useAuthContext();
  const [activeSection, setActiveSection] = useState('profile');
  const { isSearchOpen, closeSearch } = useSearch();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    company: profile?.company || '',
    phone: profile?.phone || '',
  });

  // Update profileData when profile changes
  React.useEffect(() => {
    if (profile) {
      setProfileData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        company: profile.company || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  // Load sessions when component mounts
  React.useEffect(() => {
    loadSessions();
  }, []);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateMessage(null);
    
    try {
      const { error } = await updateProfile(profileData);
      
      if (error) {
        setUpdateMessage('Error updating profile');
      } else {
        setUpdateMessage('Profile updated successfully');
      }
    } catch (err) {
      setUpdateMessage('An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordMessage(null);
    
    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage('New passwords do not match');
      setIsChangingPassword(false);
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage('New password must be at least 6 characters long');
      setIsChangingPassword(false);
      return;
    }
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) {
        setPasswordMessage('Error updating password: ' + error.message);
      } else {
        setPasswordMessage('Password updated successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (err) {
      setPasswordMessage('An unexpected error occurred');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      // For now, we'll use mock data since the admin API might not be available
      // In a production app, you would implement proper session management
      const mockSessions = [
        {
          id: 'current',
          user_agent: 'Chrome on Windows',
          ip: '192.168.1.1',
          created_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          is_current: true
        },
        {
          id: 'mobile',
          user_agent: 'iPhone',
          ip: '192.168.1.2',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          last_active_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          is_current: false
        }
      ];
      
      setSessions(mockSessions);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    try {
      // For demo purposes, we'll simulate revoking a session
      // In a real implementation, you would call supabase.auth.admin.deleteSession(sessionId)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Remove the session from the list
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // Show success message
      setUpdateMessage('Session revoked successfully');
    } catch (err) {
      console.error('Error revoking session:', err);
      setUpdateMessage('Error revoking session');
    } finally {
      setRevokingSession(null);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) !== 1 ? 's' : ''} ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) !== 1 ? 's' : ''} ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInSeconds / 2592000)} month${Math.floor(diffInSeconds / 2592000) !== 1 ? 's' : ''} ago`;
  };

  const sections = [
    {
      id: 'profile',
      title: 'Profile Settings',
      icon: User,
      description: 'Manage your personal information',
      content: (
        <div className="space-y-8">
          {updateMessage && (
            <div className={`p-4 rounded-xl animate-fade-in ${
              updateMessage.includes('successfully') 
                ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200' 
                : 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{updateMessage}</span>
              </div>
            </div>
          )}
          
          <div className="bg-gradient-to-br from-surface-elevated to-surface p-6 rounded-2xl border border-border-subtle shadow-soft mb-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center shadow-soft">
                <span className="text-xl font-bold text-gray-900">
                  {profile?.first_name?.[0] || ''}{profile?.last_name?.[0] || ''}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {profile?.first_name || ''} {profile?.last_name || ''}
                </h3>
                <p className="text-text-tertiary">{profile?.company || 'CPA Firm'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface rounded-xl p-4 border border-border-subtle">
                <div className="flex items-center space-x-2 text-text-tertiary mb-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">Email</span>
                </div>
                <p className="text-text-primary font-medium">user@example.com</p>
              </div>
              
              <div className="bg-surface rounded-xl p-4 border border-border-subtle">
                <div className="flex items-center space-x-2 text-text-tertiary mb-1">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">Account Status</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-xs font-medium">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </span>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-primary">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <Input 
                      value={profileData.first_name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-primary">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <Input 
                      value={profileData.last_name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-primary">Phone Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <Input 
                    type="tel" 
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-primary">Company</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <Input 
                    value={profileData.company}
                    onChange={(e) => setProfileData(prev => ({ ...prev, company: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="pt-4">
                <Button 
                  type="submit" 
                  icon={Save} 
                  disabled={isUpdating}
                  className="bg-primary text-gray-900 hover:bg-primary-hover shadow-medium"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ),
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      description: 'Configure your notification preferences',
      content: (
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-surface-elevated to-surface p-6 rounded-2xl border border-border-subtle shadow-soft">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Notification Preferences</h3>
                <p className="text-text-tertiary text-sm">Choose how you want to be notified</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
                <div className="p-5 border-b border-border-subtle">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-text-primary">Email Notifications</h4>
                      <p className="text-sm text-text-tertiary mt-1">Receive email updates about important events</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
                
                <div className="p-5 border-b border-border-subtle bg-surface-elevated">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-amber-50 rounded-lg">
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-text-primary">Deadline Reminders</h5>
                        <p className="text-xs text-text-tertiary mt-1">Get reminded about upcoming tax deadlines</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
                
                <div className="p-5 border-b border-border-subtle">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Zap className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-text-primary">AI Insights</h5>
                        <p className="text-xs text-text-tertiary mt-1">Receive notifications when AI detects important patterns</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <User className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-text-primary">Client Updates</h5>
                        <p className="text-xs text-text-tertiary mt-1">Get notified when clients upload documents</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="bg-surface rounded-xl border border-border-subtle p-5">
                <h4 className="font-semibold text-text-primary mb-3">Notification Channels</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-primary">Email</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-primary">Mobile Push</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
              
              <Button icon={Save} className="bg-primary text-gray-900 hover:bg-primary-hover shadow-medium">
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'security',
      title: 'Security',
      icon: Lock,
      description: 'Manage your account security',
      content: (
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-surface-elevated to-surface p-6 rounded-2xl border border-border-subtle shadow-soft">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Lock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Account Security</h3>
                <p className="text-text-tertiary text-sm">Manage your password and security settings</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {passwordMessage && (
                <div className={`p-4 rounded-xl animate-fade-in ${
                  passwordMessage.includes('successfully') 
                    ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200' 
                    : 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{passwordMessage}</span>
                  </div>
                </div>
              )}

              <div className="bg-surface rounded-xl border border-border-subtle p-5">
                <h4 className="font-semibold text-text-primary mb-4">Change Password</h4>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-text-primary">Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <Input 
                        type="password"
                        placeholder="Enter your current password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-text-primary">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <Input 
                        type="password"
                        placeholder="Enter new password (min 6 characters)"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-text-primary">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <Input 
                        type="password"
                        placeholder="Confirm new password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit"
                    disabled={isChangingPassword}
                    className="bg-primary text-gray-900 hover:bg-primary-hover shadow-medium"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </div>
              
              <div className="bg-surface rounded-xl border border-border-subtle p-5">
                <h4 className="font-semibold text-text-primary mb-4">Two-Factor Authentication</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary">Enhance your account security with 2FA</p>
                    <p className="text-sm text-text-tertiary mt-1">Protect your account with an additional layer of security</p>
                    <div className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium mt-2">
                      <Clock className="w-3 h-3 mr-1" />
                      Coming Soon
                    </div>
                  </div>
                  <Button variant="secondary" disabled>Enable 2FA</Button>
                </div>
              </div>
              
              <div className="bg-surface rounded-xl border border-border-subtle p-5">
                <h4 className="font-semibold text-text-primary mb-4">Login Sessions</h4>
                <div className="space-y-3">
                  {sessionsLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg border border-border-subtle animate-pulse">
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-1/3 mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                          <div className="w-16 h-6 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-8">
                      <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No active sessions found</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg border border-border-subtle">
                        <div>
                          <p className="text-text-primary font-medium">
                            {session.is_current ? 'Current Session' : session.user_agent}
                          </p>
                          <p className="text-xs text-text-tertiary mt-1">
                            {session.user_agent} • IP: {session.ip}
                          </p>
                          {!session.is_current && (
                            <p className="text-xs text-text-tertiary">
                              Last active: {getTimeAgo(session.last_active_at)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {session.is_current ? (
                            <div className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-xs font-medium">
                              Active Now
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => revokeSession(session.id)}
                              disabled={revokingSession === session.id}
                            >
                              {revokingSession === session.id ? 'Revoking...' : 'Revoke'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title="Settings" />

      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      <div className="max-w-content mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Settings Navigation */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-surface-elevated to-surface rounded-2xl border border-border-subtle p-6 shadow-soft sticky top-8">
              <h3 className="font-semibold text-text-primary mb-6">Settings</h3>
              <nav className="space-y-3">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                      activeSection === section.id
                        ? 'bg-gradient-to-r from-primary to-primary-hover text-gray-900 shadow-soft'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent hover:border-border-subtle'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      activeSection === section.id
                        ? 'bg-white/20'
                        : 'bg-surface'
                    }`}>
                      <section.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block">{section.title}</span>
                      {section.description && (
                        <span className="text-xs opacity-80 truncate block">{section.description}</span>
                      )}
                    </div>
                  </button>
                ))}
              </nav>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-6 shadow-soft hidden lg:block sticky top-[calc(8rem+1.5rem)] z-10">
              <div className="flex items-center space-x-3 mb-4 relative">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Zap className="w-4 h-4 text-blue-700" />
                </div>
                <h4 className="font-semibold text-blue-800">Need Help?</h4>
              </div>
              <p className="text-sm text-blue-700 mb-4">
                Our support team is available to help you with any questions about your account settings.
              </p>
              <Button variant="secondary" className="w-full border-blue-300 bg-blue-100/50 hover:bg-blue-200/50 text-blue-700 relative">
                Contact Support
              </Button>
            </div>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            <div className="bg-gradient-to-br from-surface-elevated to-surface rounded-2xl border border-border-subtle shadow-soft overflow-hidden">
              <div className="p-6 border-b border-border-subtle bg-surface-elevated">
                <h2 className="text-xl font-bold text-text-primary">
                  {sections.find(s => s.id === activeSection)?.title}
                </h2>
                <p className="text-text-tertiary">
                  {sections.find(s => s.id === activeSection)?.description}
                </p>
              </div>
              <div className="p-6">
                <div className="animate-fade-in">
                  {sections.find(s => s.id === activeSection)?.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add default export for compatibility
export default Settings;