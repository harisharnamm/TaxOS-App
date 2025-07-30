import { useState, useEffect } from 'react';
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
import { StatCard } from '../components/atoms/StatCard';
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
  Sparkles
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
    console.log('Dashboard checking justLoggedIn:', justLoggedIn);
    if (justLoggedIn === 'true') {
      setShowPreloader(true);
      sessionStorage.removeItem('justLoggedIn');
    }
    
    // Also listen for storage events to catch changes
    const handleStorageChange = () => {
      const updatedValue = sessionStorage.getItem('justLoggedIn');
      console.log('Storage event detected, justLoggedIn:', updatedValue);
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
    console.log('🔄 Marking task as complete:', taskId);
    const result = await updateTaskStatus(taskId, 'completed');
    if (result.success) {
      toast.success('Task Completed', 'Task has been marked as complete');
      console.log('✅ Task marked as complete successfully');
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
    console.log('🔄 Marking task as pending:', taskId);
    const result = await updateTaskStatus(taskId, 'pending');
    if (result.success) {
      toast.success('Task Updated', 'Task has been marked as pending');
      console.log('✅ Task marked as pending successfully');
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
      change: '+2 this month',
      icon: Users2,
      trend: 'up' as const,
      tooltip: 'Clients with active engagements',
    },
    {
      id: 'documents',
      title: 'Documents Processed',
      value: stats.totalNotices || 0,
      change: '+15 this week',
      icon: FileText,
      trend: 'up' as const,
      tooltip: 'Total documents uploaded and processed',
    },
    {
      id: 'tasks',
      title: 'Active Tasks',
      value: stats.totalTasks - (stats.upcomingDeadlines || 0),
      change: `${stats.upcomingDeadlines || 0} due soon`,
      icon: CheckCircle,
      trend: stats.upcomingDeadlines > 5 ? 'warning' as const : 'up' as const,
      tooltip: 'Tasks in progress and pending',
    },
    {
      id: 'insights',
      title: 'AI Insights',
      value: recentInsights.length,
      change: 'New opportunities',
      icon: Brain,
      trend: 'up' as const,
      tooltip: 'AI-generated insights and recommendations',
    },
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
    <div>
      <TopBar 
        title="Dashboard" 
        customAction={customAction} 
      />

      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      <div className="max-w-content mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-6 sm:p-8 mb-8 shadow-soft">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary rounded-xl shadow-soft">
                <Sparkles className="w-8 h-8 text-gray-900" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">
                  Welcome to TaxOS
                </h1>
                <p className="text-text-secondary text-base sm:text-lg">
                  Your AI-powered tax management platform
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-2">
              <div className="text-right">
                <p className="text-sm text-text-tertiary">Today</p>
                <p className="font-semibold text-text-primary">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpiData.map((stat, index) => (
            <div key={stat.id} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <StatCard 
                title={stat.title}
                value={stat.value}
                change={stat.change}
                icon={stat.icon}
                trend={stat.trend}
                isAnimating={animatingCards.includes(stat.id)}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            {/* Recent Tasks */}
            <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-soft animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-text-primary">Recent Tasks</h2>
                </div>
                <div className="flex items-center space-x-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setShowCreateTaskDialog(true);
                      toast.info('Create Task', 'Creating a new task');
                    }}
                  >
                    Create Task
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate('/tasks')}
                  >
                    View All
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {upcomingTasks.length > 0 ? upcomingTasks.map((task) => (
                  <div key={task.id} className={`group p-4 bg-surface rounded-xl border border-border-subtle hover:shadow-medium hover:border-border-light transition-all duration-200 ${
                    task.status === 'completed' ? 'opacity-60' : ''
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className={`font-semibold group-hover:text-text-hover transition-colors duration-200 ${
                            task.status === 'completed' ? 'line-through text-text-tertiary' : 'text-text-primary'
                          }`}>
                            <Tooltip content={task.description || 'No description provided'}>
                            {task.title}
                            </Tooltip>
                          </h3>
                          {task.status === 'completed' && (
                            <Badge variant="success" size="sm">Completed</Badge>
                          )}
                          {/* Show "NEW" badge for tasks created in the last 24 hours */}
                          {new Date().getTime() - new Date(task.created_at).getTime() < 24 * 60 * 60 * 1000 && (
                            <Badge variant="warning" size="sm">NEW</Badge>
                          )}
                        </div>
                        <p className="text-sm text-text-tertiary mt-1">
                          {task.client_id ? 'Client task' : 'General task'} • 
                          {task.due_date ? ` Due ${new Date(task.due_date).toLocaleDateString()}` : ' No due date'} •
                          {' Created ' + new Date(task.created_at).toLocaleDateString()}
                        </p>
                        {task.description && (
                          <div className="bg-surface rounded-lg p-2 mt-2 border border-border-subtle">
                            <div className="text-text-secondary text-xs leading-relaxed line-clamp-2 overflow-hidden">
                              {task.description}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {getPriorityBadge(task.priority)}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
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
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-text-primary mb-2">No upcoming tasks</h3>
                    <p className="text-text-tertiary">Create tasks or upload documents to get started</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-soft animate-fade-in">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-text-primary">Recent Activity</h2>
              </div>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-4 p-3 rounded-xl hover:bg-surface transition-colors duration-200">
                    <div className={`p-2 rounded-lg ${activity.color}`}>
                      <activity.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        <Tooltip content={`Activity type: ${activity.type}`}>{activity.event}</Tooltip>
                      </p>
                      <p className="text-xs text-text-tertiary mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Quick Actions */}
            <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft animate-fade-in">
              <h3 className="font-semibold text-text-primary mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button 
                  className="w-full justify-start bg-primary text-gray-900 hover:bg-primary-hover shadow-medium" 
                  icon={Plus}
                  onClick={() => {
                    handleAddNewClient();
                    toast.info('Navigation', 'Redirecting to client creation');
                  }}
                >
                  Add New Client
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full justify-start hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200" 
                  icon={Upload}
                  onClick={() => {
                    handleUploadDocuments();
                    toast.info('Navigation', 'Redirecting to document upload');
                  }}
                >
                  Upload Documents
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full justify-start hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200" 
                  icon={MessageSquare}
                  onClick={() => {
                    navigate('/deduction-chat');
                    toast.info('Navigation', 'Opening AI Tax Assistant');
                  }}
                >
                  Ask AI Assistant
                </Button>
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20 p-6 shadow-soft animate-fade-in">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <h3 className="font-semibold text-text-primary">AI Insights</h3>
              </div>
              <div className="space-y-3">
                {recentInsights.length > 0 ? (
                  recentInsights.map((insight) => (
                    <div key={insight.id} className="p-3 bg-surface-elevated/80 rounded-xl border border-border-subtle">
                      <div className="flex items-start space-x-2">
                        <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-text-primary font-medium">{insight.title}</p>
                          <p className="text-xs text-text-tertiary mt-1">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-surface-elevated/80 rounded-xl border border-border-subtle">
                    <div className="flex items-start space-x-2">
                      <Brain className="w-4 h-4 text-text-tertiary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-text-secondary">No recent AI insights</p>
                        <p className="text-xs text-text-tertiary mt-1">Upload documents to generate insights</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Platform Stats */}
            <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 shadow-soft animate-fade-in">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-text-primary">Platform Overview</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users2 className="w-4 h-4 text-text-tertiary" />
                    <span className="text-sm text-text-secondary">Total Clients</span>
                  </div>
                  <span className="font-semibold text-text-primary">{stats.totalClients}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-text-tertiary" />
                    <span className="text-sm text-text-secondary">Documents</span>
                  </div>
                  <span className="font-semibold text-text-primary">{stats.totalNotices || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-text-tertiary" />
                    <span className="text-sm text-text-secondary">Completed Tasks</span>
                  </div>
                  <span className="font-semibold text-text-primary">
                    {tasks.filter(t => t.status === 'completed').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-4 h-4 text-text-tertiary" />
                    <span className="text-sm text-text-secondary">AI Insights</span>
                  </div>
                  <span className="font-semibold text-text-primary">{recentInsights.length}</span>
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