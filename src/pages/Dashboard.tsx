import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import { useTasks } from '../hooks/useTasks';
import { useClients } from '../hooks/useClients';
import { usePreloader } from '../contexts/PreloaderContext';
import { useToast } from '../contexts/ToastContext';
import { Tooltip } from '../components/ui/tooltip';
import { Skeleton, SkeletonText } from '../components/ui/skeleton';
import { CreateTaskDialog } from '../components/ui/create-task-dialog';
import { GlobalSearch } from '../components/molecules/GlobalSearch';
import { useSearch } from '../contexts/SearchContext';
import { TopBar } from '../components/organisms/TopBar';

import { Input } from '../components/atoms/Input';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import {
  Users2,
  FileText,
  AlertTriangle,
  Calendar,
  Search,
  Plus,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  RotateCcw,
  MessageSquare,
  Upload,
  Brain,
  Zap,
  Target,
  Activity,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Globe,
  Building2,
  ChevronDown,
  RefreshCw,
  Star,
  Award,
  DollarSign,
  Timer,
  Bell,
  Settings,
  LogOut,
  User,
  Home,
  Briefcase,
  Lightbulb,
  Rocket,
  Shield,
  Database,
  Workflow,
  BookOpen,
  Calculator,
  FileCheck,
  CreditCard,
  Receipt,
  LineChart,
  PieChartIcon,
  BarChart,
  Layers
} from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState('2024');
  const [animatingCards, setAnimatingCards] = useState<string[]>([]);
  const { stats, recentInsights, loading, error, refreshDashboard } = useDashboard();
  const toast = useToast();
  const { isSearchOpen, closeSearch } = useSearch();
  const { setShowPreloader } = usePreloader();
  const { tasks, updateTaskStatus, getUpcomingTasks, refreshTasks } = useTasks();
  const { clients, loading: clientsLoading } = useClients();
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);

  // Get upcoming tasks from the tasks hook instead of dashboard
  const upcomingTasks = getUpcomingTasks(5);

  // Check if user just logged in
  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    if (justLoggedIn === 'true') {
      setShowPreloader(true);
      sessionStorage.removeItem('justLoggedIn');
    }
    
    // Also listen for storage events to catch changes
    const handleStorageChange = () => {
      const updatedValue = sessionStorage.getItem('justLoggedIn');
      if (updatedValue === 'true') {
        setShowPreloader(true);
        sessionStorage.removeItem('justLoggedIn');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [setShowPreloader]);

  // Simulate real-time updates - must be called before any conditional returns
  useEffect(() => {
    const cardIds = ['clients', 'documents', 'tasks', 'insights'];
    const interval = setInterval(() => {
      const randomCard = cardIds[Math.floor(Math.random() * cardIds.length)];
      setAnimatingCards([randomCard]);
      setTimeout(() => setAnimatingCards([]), 2000);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Enhanced metrics calculations
  const enhancedMetrics = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const highPriorityTasks = tasks.filter(t => t.priority === 'high').length;

    const productivityScore = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const avgTasksPerClient = stats.totalClients > 0 ? Math.round(tasks.length / stats.totalClients) : 0;

    return {
      completedTasks,
      pendingTasks,
      highPriorityTasks,
      productivityScore,
      avgTasksPerClient,
      totalDocuments: stats.totalNotices || 0,
      activeClients: stats.activeClients || 0
    };
  }, [tasks, stats]);

  // Quick stats for the welcome section
  const quickStats = useMemo(() => [
    {
      label: 'This Month',
      value: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      icon: Calendar
    },
    {
      label: 'Productivity',
      value: `${enhancedMetrics.productivityScore}%`,
      icon: Target,
      trend: enhancedMetrics.productivityScore >= 70 ? 'up' : 'neutral'
    },
    {
      label: 'Active Tasks',
      value: enhancedMetrics.pendingTasks.toString(),
      icon: Clock,
      trend: enhancedMetrics.pendingTasks > 10 ? 'warning' : 'up'
    }
  ], [enhancedMetrics]);

  // Quick action handlers
  const handleAddNewClient = () => {
    navigate('/clients');
    // Small delay to allow navigation, then trigger the add client dialog
    setTimeout(() => {
      // Dispatch a custom event that the Clients page can listen for
      window.dispatchEvent(new CustomEvent('dashboard:add-client'));
    }, 100);
  };

  const handleUploadDocuments = () => {
    navigate('/irs-notices?action=upload');
  };

  const handleCreateTask = async (taskData: {
    title: string;
    description?: string;
    task_type: 'general' | 'deadline' | 'follow_up' | 'review' | 'filing';
    priority: 'low' | 'medium' | 'high';
    due_date?: string;
    client_id?: string;
  }) => {
    const { createTask } = useTasks();
    const result = await createTask(taskData);
    if (!result.success) {
      throw new Error(result.error);
    }
    // Refresh dashboard data
    refreshDashboard();
    refreshTasks();
  };

  const handleMarkTaskComplete = async (taskId: string) => {
    const result = await updateTaskStatus(taskId, 'completed');
    if (result.success) {
      toast.success('Task Completed', 'Task has been marked as complete');
      // Refresh dashboard to update stats
      refreshDashboard();
      // Also refresh tasks to ensure we have the latest data
      refreshTasks();
    } else {
      console.error('Failed to mark task as complete:', result.error);
      toast.error('Action Failed', 'Failed to mark task as complete');
    }
  };

  const handleMarkTaskPending = async (taskId: string) => {
    const result = await updateTaskStatus(taskId, 'pending');
    if (result.success) {
      toast.success('Task Updated', 'Task has been marked as pending');
      // Refresh dashboard to update stats
      refreshDashboard();
      // Also refresh tasks to ensure we have the latest data
      refreshTasks();
    } else {
      console.error('Failed to mark task as pending:', result.error);
      toast.error('Action Failed', 'Failed to mark task as pending');
    }
  };

  const kpiData = [
    {
      id: 'clients',
      title: 'Active Clients',
      value: stats.activeClients,
      change: `+${Math.floor(Math.random() * 5) + 1} this month`,
      icon: Users2,
      trend: 'up' as const,
      tooltip: 'Clients with active engagements',
      gradient: 'bg-white',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'productivity',
      title: 'Productivity Score',
      value: `${enhancedMetrics.productivityScore}%`,
      change: enhancedMetrics.productivityScore >= 70 ? 'Excellent' : enhancedMetrics.productivityScore >= 50 ? 'Good' : 'Needs improvement',
      icon: Target,
      trend: enhancedMetrics.productivityScore >= 70 ? 'up' as const : 'neutral' as const,
      tooltip: 'Task completion rate',
      gradient: 'bg-white',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      id: 'tasks',
      title: 'Pending Tasks',
      value: enhancedMetrics.pendingTasks,
      change: `${enhancedMetrics.highPriorityTasks} high priority`,
      icon: Clock,
      trend: enhancedMetrics.pendingTasks > 10 ? 'warning' as const : 'up' as const,
      tooltip: 'Tasks requiring attention',
      gradient: 'bg-white',
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      id: 'documents',
      title: 'Documents Processed',
      value: stats.totalNotices || 0,
      change: `+${Math.floor(Math.random() * 20) + 5} this week`,
      icon: FileText,
      trend: 'up' as const,
      tooltip: 'Total documents uploaded and processed',
      gradient: 'bg-white',
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  const recentActivity = [
    {
      id: '1',
      event: 'AI detected potential deduction in uploaded receipt',
      time: '2 hours ago',
      type: 'ai',
      icon: Brain,
      color: 'text-purple-600 bg-purple-50'
    },
    {
      id: '2',
      event: 'Document request sent to 3 clients',
      time: '4 hours ago',
      type: 'action',
      icon: FileText,
      color: 'text-blue-600 bg-blue-50'
    },
    {
      id: '3',
      event: 'Q4 tax documents uploaded for Manufacturing Co',
      time: '6 hours ago',
      type: 'document',
      icon: Upload,
      color: 'text-emerald-600 bg-emerald-50'
    },
    {
      id: '4',
      event: 'Task completed: Review client tax strategy',
      time: '1 day ago',
      type: 'update',
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50'
    },
    {
      id: '5',
      event: 'New client onboarding completed: StartupXYZ',
      time: '2 days ago',
      type: 'update',
      icon: Users2,
      color: 'text-indigo-600 bg-indigo-50'
    },
  ];

  if (loading) {
    return (
      <div>
        <TopBar title="Dashboard" />
        <div className="max-w-content mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8">
          <div className="space-y-8">
            {/* Stats skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            
            <div className="grid grid-cols-12 gap-8">
              {/* Main content skeleton */}
              <div className="col-span-8 space-y-8">
                <Skeleton className="h-96" />
                <Skeleton className="h-64" />
              </div>
              
              {/* Sidebar skeleton */}
              <div className="col-span-4 space-y-6">
                <Skeleton className="h-48" />
                <Skeleton className="h-64" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <TopBar title="Dashboard" />
        <div className="max-w-content mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 font-medium">Error loading dashboard</p>
                <p className="text-red-600 mt-1">{error}</p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="mt-3 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={refreshDashboard}
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="error" size="sm">High Priority</Badge>;
      case 'medium':
        return <Badge variant="warning" size="sm">Medium Priority</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Low Priority</Badge>;
    }
  };

  // Create custom action for the TopBar to show the search and year selection UI
  const customAction = {
    label: "", // Empty label as we'll use custom rendering
    onClick: () => {
      // This is just a placeholder as we're using customRender
    },
    customRender: () => (
      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mt-2 sm:mt-0">
        <div className="flex items-center space-x-3 bg-surface-elevated rounded-xl border border-border-subtle px-4 py-2 shadow-soft">
          <Calendar className="w-4 h-4 text-text-secondary" />
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-transparent border-none text-sm font-medium text-text-primary focus:outline-none"
          >
            <option value="2024">Fiscal Year 2024</option>
            <option value="2023">Fiscal Year 2023</option>
          </select>
        </div>
      </div>
    )
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-surface-elevated to-surface">
      <TopBar
        title="Dashboard"
        customAction={customAction}
      />

      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Welcome Section */}
        <div className="mb-10">
          <div className="relative overflow-hidden" style={{ backgroundColor: '#F5FAE8' }}>
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent transform rotate-12 scale-150"></div>
            </div>

            <div className="relative p-8 sm:p-10 lg:p-12">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    <div className="p-4 bg-gradient-to-br from-primary to-primary-hover rounded-2xl shadow-xl">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-surface flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text-primary mb-3">
                      Welcome back!
                    </h1>
                    <p className="text-lg sm:text-xl text-text-secondary mb-4">
                      Your AI-powered tax management platform is ready to assist
                    </p>
                    <div className="flex items-center gap-4 text-sm text-text-tertiary">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-yellow-500" />
                        <span>Professional CPA Suite</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span>Bank-level Security</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Rocket className="w-4 h-4 text-purple-500" />
                        <span>AI-Powered Automation</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:text-right">
                  <div className="inline-flex items-center gap-3 px-6 py-3 bg-surface-elevated/80 backdrop-blur-sm rounded-2xl border border-border-subtle">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-text-tertiary">Today</p>
                      <p className="font-semibold text-text-primary">
                        {new Date().toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Bar */}
              <div className="mt-8 pt-8 border-t border-border-subtle">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {quickStats.map((stat, index) => (
                    <div key={stat.label} className="flex items-center gap-3 p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle">
                      <div className={`p-2 rounded-lg ${
                        stat.trend === 'up' ? 'bg-green-100 text-green-600' :
                        stat.trend === 'warning' ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm text-text-tertiary">{stat.label}</p>
                        <p className="font-semibold text-text-primary">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {kpiData.map((stat, index) => (
            <div key={stat.id} className="animate-slide-up group" style={{ animationDelay: `${index * 100}ms` }}>
              <div className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient} rounded-2xl border border-border-subtle shadow-soft hover:shadow-xl transition-all duration-300 p-6`}>
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent transform rotate-12 scale-150"></div>
                </div>

                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                      <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                      stat.trend === 'up' ? 'bg-green-100 text-green-700' :
                      stat.trend === 'warning' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {stat.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                      {stat.trend === 'warning' && <AlertTriangle className="w-3 h-3" />}
                      {stat.trend === 'neutral' && <BarChart3 className="w-3 h-3" />}
                      <span>{stat.change}</span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-text-secondary mb-1">{stat.title}</h3>
                    <p className="text-2xl font-bold text-text-primary group-hover:scale-105 transition-transform duration-300">
                      {stat.value}
                    </p>
                  </div>

                  {/* Mini progress bar for visual appeal */}
                  <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-1000"
                      style={{
                        width: animatingCards.includes(stat.id) ? '100%' : `${Math.min((typeof stat.value === 'number' ? stat.value : parseInt(stat.value.toString())) / 100 * 100, 100)}%`,
                        backgroundColor: stat.id === 'clients' ? '#2563eb' :
                                        stat.id === 'productivity' ? '#16a34a' :
                                        stat.id === 'tasks' ? '#ea580c' :
                                        '#4f46e5'
                      }}
                    />
                  </div>
                </div>

                {/* Hover effect overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            {/* Productivity Overview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-soft">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">Productivity Overview</h2>
                    <p className="text-sm text-text-secondary">Your performance metrics at a glance</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle">
                  <div className="text-3xl font-bold text-green-600 mb-2">{enhancedMetrics.completedTasks}</div>
                  <p className="text-sm text-text-secondary">Tasks Completed</p>
                  <div className="mt-2 h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${Math.min(enhancedMetrics.productivityScore, 100)}%` }} />
                  </div>
                </div>

                <div className="text-center p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{enhancedMetrics.pendingTasks}</div>
                  <p className="text-sm text-text-secondary">Tasks Pending</p>
                  <div className="mt-2 h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.min((enhancedMetrics.pendingTasks / Math.max(enhancedMetrics.pendingTasks + enhancedMetrics.completedTasks, 1)) * 100, 100)}%` }} />
                  </div>
                </div>

                <div className="text-center p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle">
                  <div className="text-3xl font-bold text-purple-600 mb-2">{enhancedMetrics.productivityScore}%</div>
                  <p className="text-sm text-text-secondary">Success Rate</p>
                  <div className="mt-2 h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${enhancedMetrics.productivityScore}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Tasks */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-soft animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">Recent Tasks</h2>
                    <p className="text-sm text-text-secondary">Your upcoming and recent tasks</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCreateTaskDialog(true);
                      toast.info('Create Task', 'Creating a new task');
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Task
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/tasks')}
                    className="flex items-center gap-2"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    View All
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {upcomingTasks.length > 0 ? upcomingTasks.map((task, index) => (
                  <div key={task.id} className={`group relative p-5 bg-surface rounded-xl border border-border-subtle hover:shadow-lg hover:border-border-light transition-all duration-300 ${
                    task.status === 'completed' ? 'opacity-70' : ''
                  }`}>
                    {/* Priority indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                      task.priority === 'high' ? 'bg-red-500' :
                      task.priority === 'medium' ? 'bg-orange-500' :
                      'bg-green-500'
                    }`} />

                    <div className="flex items-start justify-between">
                      <div className="flex-1 ml-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className={`font-semibold group-hover:text-text-hover transition-colors duration-200 ${
                            task.status === 'completed' ? 'line-through text-text-tertiary' : 'text-text-primary'
                          }`}>
                            <Tooltip content={task.description || 'No description provided'}>
                              {task.title}
                            </Tooltip>
                          </h3>

                          <div className="flex items-center gap-2">
                            {task.status === 'completed' && (
                              <Badge variant="success" size="sm" className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Completed
                              </Badge>
                            )}
                            {new Date().getTime() - new Date(task.created_at).getTime() < 24 * 60 * 60 * 1000 && (
                              <Badge variant="warning" size="sm" className="flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                NEW
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-text-tertiary mb-3">
                          <div className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {task.client_id ? 'Client task' : 'General task'}
                          </div>
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Due {new Date(task.due_date).toLocaleDateString()}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Timer className="w-4 h-4" />
                            Created {new Date(task.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        {task.description && (
                          <div className="bg-surface-hover rounded-lg p-3 border border-border-subtle">
                            <div className="text-text-secondary text-sm leading-relaxed line-clamp-2 overflow-hidden">
                              {task.description}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-3">
                        {getPriorityBadge(task.priority)}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                          {task.status === 'completed' ? (
                            <Button
                              size="sm"
                              title="Mark as pending"
                              variant="ghost"
                              icon={RotateCcw}
                              onClick={() => handleMarkTaskPending(task.id)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            />
                          ) : (
                            <Button
                              size="sm"
                              title="Mark as complete"
                              variant="ghost"
                              icon={CheckCircle}
                              onClick={() => handleMarkTaskComplete(task.id)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 px-6 bg-surface-hover rounded-xl border-2 border-dashed border-border-subtle">
                    <div className="p-4 bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Clock className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-text-primary mb-3">No upcoming tasks</h3>
                    <p className="text-text-secondary max-w-md mx-auto mb-6">
                      Stay organized and productive by creating tasks for your tax work and client management activities.
                    </p>
                    <Button
                      onClick={() => {
                        setShowCreateTaskDialog(true);
                        toast.info('Create Task', 'Creating a new task');
                      }}
                      className="flex items-center gap-2 mx-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Create Your First Task
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-soft animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <Activity className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">Recent Activity</h2>
                    <p className="text-sm text-text-secondary">Your latest system activities</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  View All
                </Button>
              </div>

              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={activity.id} className="group relative flex items-start space-x-4 p-4 rounded-xl hover:bg-surface-hover transition-all duration-200">
                    {/* Timeline connector */}
                    {index < recentActivity.length - 1 && (
                      <div className="absolute left-6 top-12 w-0.5 h-8 bg-border-subtle"></div>
                    )}

                    {/* Activity icon with timeline dot */}
                    <div className="relative">
                      <div className={`p-3 rounded-xl ${activity.color} shadow-soft group-hover:scale-110 transition-transform duration-200`}>
                        <activity.icon className="w-5 h-5" />
                      </div>
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full border-2 border-border-subtle"></div>
                    </div>

                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm font-medium text-text-primary group-hover:text-text-hover transition-colors duration-200">
                        <Tooltip content={`Activity type: ${activity.type}`}>
                          {activity.event}
                        </Tooltip>
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-text-tertiary">{activity.time}</p>
                        <Badge
                          variant="neutral"
                          size="sm"
                          className="text-xs capitalize"
                        >
                          {activity.type}
                        </Badge>
                      </div>
                    </div>

                    {/* Activity indicator */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                      activity.type === 'ai' ? 'bg-purple-500' :
                      activity.type === 'document' ? 'bg-emerald-500' :
                      activity.type === 'action' ? 'bg-blue-500' :
                      'bg-green-500'
                    }`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
                    {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-soft animate-fade-in">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-text-primary">Quick Actions</h3>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full justify-start bg-gradient-to-r from-primary to-primary-hover text-white hover:shadow-lg transition-all duration-200 group"
                  onClick={() => {
                    handleAddNewClient();
                    toast.info('Navigation', 'Redirecting to client creation');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="font-medium">Add New Client</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 ml-auto opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-start hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 group transition-all duration-200"
                  onClick={() => {
                    handleUploadDocuments();
                    toast.info('Navigation', 'Redirecting to document upload');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <Upload className="w-4 h-4 text-blue-600" />
                    </div>
                    <span>Upload Documents</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-start hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 group transition-all duration-200"
                  onClick={() => {
                    navigate('/ai-assistant');
                    toast.info('Navigation', 'Opening AI Assistant');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                      <Brain className="w-4 h-4 text-purple-600" />
                    </div>
                    <span>AI Assistant</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-start hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 group transition-all duration-200"
                  onClick={() => {
                    setShowCreateTaskDialog(true);
                    toast.info('Create Task', 'Creating a new task');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                      <Clock className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span>Create Task</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-soft animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="p-2 bg-purple-100 rounded-xl">
                      <Brain className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">AI Insights</h3>
                    <p className="text-xs text-text-secondary">{recentInsights.length} insights available</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  View All
                </Button>
              </div>

              <div className="space-y-4">
                {recentInsights.length > 0 ? (
                  recentInsights.map((insight, index) => (
                    <div key={insight.id} className="group relative p-4 bg-surface-elevated/80 rounded-xl border border-border-subtle hover:shadow-md hover:border-primary/30 transition-all duration-200">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg group-hover:scale-110 transition-transform duration-200">
                          <Lightbulb className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-text-primary font-medium group-hover:text-purple-700 transition-colors">
                            {insight.title}
                          </p>
                          <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                            {insight.description}
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant="secondary" size="sm" className="text-xs">
                              AI Generated
                            </Badge>
                            <span className="text-xs text-text-tertiary">•</span>
                            <span className="text-xs text-text-tertiary">Just now</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 px-4 bg-surface-elevated/50 rounded-xl border-2 border-dashed border-border-subtle">
                    <div className="p-3 bg-purple-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="text-sm text-text-secondary font-medium">No AI insights yet</p>
                    <p className="text-xs text-text-tertiary mt-2">
                      Upload documents to unlock AI-powered insights and recommendations
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate('/irs-notices?action=upload')}
                    >
                      Upload Documents
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Platform Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-soft animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">Platform Overview</h3>
                    <p className="text-xs text-text-secondary">Your practice at a glance</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  Details
                </Button>
              </div>

              <div className="space-y-5">
                <div className="p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg">
                        <Users2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-text-secondary">Total Clients</span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">{stats.totalClients}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.min((stats.totalClients / 50) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">Active client relationships</p>
                </div>

                <div className="p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg">
                        <FileText className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-sm font-medium text-text-secondary">Documents</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-600">{stats.totalNotices || 0}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(((stats.totalNotices || 0) / 200) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">Processed and uploaded</p>
                </div>

                <div className="p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm font-medium text-text-secondary">Completed Tasks</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      {tasks.filter(t => t.status === 'completed').length}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${enhancedMetrics.productivityScore}%` }} />
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">{enhancedMetrics.productivityScore}% completion rate</p>
                </div>

                <div className="p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg">
                        <Brain className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-text-secondary">AI Insights</span>
                    </div>
                    <span className="text-lg font-bold text-purple-600">{recentInsights.length}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${Math.min((recentInsights.length / 10) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">AI-generated recommendations</p>
                </div>
              </div>

              {/* System Health Indicator */}
              <div className="mt-6 pt-6 border-t border-border-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-text-secondary">System Status</span>
                  </div>
                  <Badge variant="success" size="sm" className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    All Systems Operational
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        isOpen={showCreateTaskDialog}
        onClose={() => setShowCreateTaskDialog(false)}
        onSubmit={handleCreateTask}
        clients={clients}
        loading={false}
      />
    </div>
  );
}