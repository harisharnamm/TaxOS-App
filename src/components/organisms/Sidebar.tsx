import { useAuthContext } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { NavigationItem } from '../molecules/NavigationItem';
import { 
  LayoutDashboard, 
  Users2,
  MessageSquare as MessageSquareIcon,
  GraduationCap,
  FileText, 
  CheckSquare,
  AlertTriangle, 
  MessageSquare as ChatIcon, 
  Settings,
  Sparkles,
  X,
  Search as SearchIcon
} from 'lucide-react';


interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { profile, signOut } = useAuthContext();
  const { closeSidebar } = useSidebar();
  
  const handleSignOut = async () => {
    await signOut();
  };
  
  const displayName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}`
    : 'User';
    
  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`
    : 'U';

  // Base sidebar classes - handle mobile and desktop differently
  const sidebarClasses = `
    fixed left-0 top-0 z-40 h-screen bg-surface-elevated border-r border-border-subtle backdrop-blur-sm
    w-72 transition-transform duration-300 ease-in-out
    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
  `;

  return (
    <aside className={sidebarClasses}>
      <div className="flex flex-col h-full">
        {/* Close button - only visible on mobile */}
        {onClose && (
          <button
            onClick={() => {
              onClose();
              closeSidebar();
            }}
            aria-label="Close sidebar"
            className="lg:hidden absolute top-4 right-4 p-2 text-text-tertiary hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Logo */}
        <div className="flex items-center px-6 sm:px-8 py-6 sm:py-8">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary rounded-xl shadow-soft">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-gray-900" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-semibold text-text-primary tracking-tight">TaxOS</span>
              <p className="text-xs text-text-tertiary font-medium">by Nurahex</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 sm:px-6 space-y-1">
          <NavigationItem to="/" icon={LayoutDashboard}>
            Dashboard
          </NavigationItem>
          <NavigationItem to="/clients" icon={Users2}>
            Clients
          </NavigationItem>
          <NavigationItem to="/tasks" icon={CheckSquare}>
            Tasks
          </NavigationItem>
          <NavigationItem to="/my-zone" icon={GraduationCap}>
            My Zone
          </NavigationItem>
          <NavigationItem to="/irs-notices" icon={FileText}>
            Document Management
          </NavigationItem>
          <NavigationItem to="/client-communications" icon={MessageSquareIcon}>
            Client Communications
          </NavigationItem>
          <NavigationItem to="/deduction-chat" icon={ChatIcon}>
            Deduction Chat
          </NavigationItem>
          <NavigationItem to="/settings" icon={Settings}>
            Settings
          </NavigationItem>
        </nav>

        {/* Search Shortcut */}
        {/* Search button removed to fix error */}

        {/* User Avatar */}
        <div className="p-4 sm:p-6 border-t border-border-subtle bg-gradient-to-r from-surface to-surface-elevated">
          <div className="flex items-center space-x-3 p-3 rounded-xl bg-surface-elevated border border-border-subtle hover:shadow-soft transition-all duration-200 group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center shadow-soft">
              <span className="text-xs sm:text-sm font-semibold text-gray-900">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
              <p className="text-xs text-text-tertiary truncate">{profile?.company || 'CPA Firm'}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary transition-all duration-200 text-xs"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}