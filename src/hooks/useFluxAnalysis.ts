import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export interface FluxAnalysisData {
  category: string;
  current: number;
  prior: number;
  momDelta: number;
  yoyDelta: number;
  trend: 'up' | 'down';
  details: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netIncome: number;
  };
}

export interface FluxAnalysisSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  avgMomGrowth: number;
  avgYoyGrowth: number;
}

export interface TopPerformers {
  increases: FluxAnalysisData[];
  decreases: FluxAnalysisData[];
}

export interface PerformanceMetrics {
  totalTransactions: number;
  incomeTransactions: number;
  expenseTransactions: number;
  averageTransactionSize: number;
  expenseRatio: number;
}

export interface FluxAnalysisResponse {
  summary: FluxAnalysisSummary;
  fluxData: FluxAnalysisData[];
  topPerformers: TopPerformers;
  periodInfo: {
    current: string;
    prior: string;
    priorYear: string;
  };
  metadata: {
    lastUpdated: string;
    cacheStatus: string;
    recordCount: number;
  };
  performanceMetrics?: PerformanceMetrics;
}

interface UseFluxAnalysisOptions {
  clientId?: string;
  period?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseFluxAnalysisReturn {
  data: FluxAnalysisResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshCache: () => Promise<void>;
  updatePeriod: (newPeriod: string) => void;
  updateClient: (newClientId: string | undefined) => void;
}

export function useFluxAnalysis({
  clientId,
  period = new Date().toISOString().slice(0, 7),
  autoRefresh = false,
  refreshInterval = 300000 // 5 minutes
}: UseFluxAnalysisOptions = {}): UseFluxAnalysisReturn {
  const [data, setData] = useState<FluxAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState(period);
  const [currentClientId, setCurrentClientId] = useState(clientId);

  // Memoized cache key for the current request
  const cacheKey = useMemo(() => 
    `flux_analysis:${currentClientId || 'all'}:${currentPeriod}`, 
    [currentClientId, currentPeriod]
  );

  // Fetch flux analysis data
  const fetchData = useCallback(async (refreshCache = false) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`🔄 Fetching flux analysis data for client: ${currentClientId || 'all'}, period: ${currentPeriod}`);

      const { data: response, error: apiError } = await supabase.functions.invoke('flux-analysis', {
        body: {
          clientId: currentClientId,
          period: currentPeriod,
          refreshCache
        }
      });

      if (apiError) {
        throw new Error(apiError.message || 'Failed to fetch flux analysis data');
      }

      if (!response.success) {
        throw new Error(response.error || 'API returned an error');
      }

      setData(response.data);
      console.log(`✅ Flux analysis data fetched successfully. Cache status: ${response.data.metadata.cacheStatus}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('❌ Error fetching flux analysis data:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentClientId, currentPeriod]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing flux analysis data...');
      fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Force cache refresh
  const refreshCache = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Update period
  const updatePeriod = useCallback((newPeriod: string) => {
    setCurrentPeriod(newPeriod);
  }, []);

  // Update client
  const updateClient = useCallback((newClientId: string | undefined) => {
    setCurrentClientId(newClientId);
  }, []);

  // Update local state when props change
  useEffect(() => {
    if (clientId !== currentClientId) {
      setCurrentClientId(clientId);
    }
  }, [clientId, currentClientId]);

  useEffect(() => {
    if (period !== currentPeriod) {
      setCurrentPeriod(period);
    }
  }, [period, currentPeriod]);

  // Real-time subscription to transaction updates (if client is selected)
  useEffect(() => {
    if (!currentClientId) return;

    const channel = supabase
      .channel(`flux_analysis_${currentClientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `client_id=eq.${currentClientId}`
        },
        (payload) => {
          console.log('🔄 Transaction change detected, refreshing flux analysis data...', payload);
          // Debounce the refresh to avoid multiple rapid updates
          setTimeout(() => fetchData(), 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClientId, fetchData]);

  // Memoized derived data for better performance
  const memoizedData = useMemo(() => {
    if (!data) return null;

    // Add computed fields
    return {
      ...data,
      computed: {
        // Calculate additional metrics
        grossProfitMargin: data.summary.totalRevenue > 0 
          ? (data.summary.totalRevenue - data.summary.totalExpenses) / data.summary.totalRevenue * 100 
          : 0,
        
        // Find best and worst performing categories
        bestPerformer: data.fluxData.reduce((best, current) => 
          current.momDelta > best.momDelta ? current : best, 
          data.fluxData[0] || { momDelta: -Infinity }
        ),
        
        worstPerformer: data.fluxData.reduce((worst, current) => 
          current.momDelta < worst.momDelta ? current : worst, 
          data.fluxData[0] || { momDelta: Infinity }
        ),
        
        // Calculate overall trend
        overallTrend: data.summary.avgMomGrowth > 0 ? 'up' : 'down',
        
        // Performance score (0-100)
        performanceScore: Math.max(0, Math.min(100, 
          50 + (data.summary.avgMomGrowth * 2) + (data.summary.avgYoyGrowth * 1.5)
        ))
      }
    };
  }, [data]);

  return {
    data: memoizedData,
    loading,
    error,
    refresh,
    refreshCache,
    updatePeriod,
    updateClient
  };
}

// Hook for getting available periods
export function useAvailablePeriods(clientId?: string) {
  const [periods, setPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('monthly_financial_summary')
          .select('year, month')
          .eq(clientId ? 'client_id' : 'client_id', clientId || '')
          .order('year', { ascending: false })
          .order('month', { ascending: false });

        if (error) throw error;

        const uniquePeriods = data
          ?.map(row => `${row.year}-${row.month.toString().padStart(2, '0')}`)
          .filter((period, index, arr) => arr.indexOf(period) === index) || [];

        setPeriods(uniquePeriods);
      } catch (err) {
        console.error('Error fetching available periods:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPeriods();
  }, [clientId]);

  return { periods, loading };
}

// Hook for getting client performance comparison
export function useClientComparison(period: string) {
  const [comparison, setComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('flux_analysis_summary')
          .select('*')
          .eq('year', parseInt(period.split('-')[0]))
          .eq('month', parseInt(period.split('-')[1]));

        if (error) throw error;

        setComparison(data || []);
      } catch (err) {
        console.error('Error fetching client comparison:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [period]);

  return { comparison, loading };
}
