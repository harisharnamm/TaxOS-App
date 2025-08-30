import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

interface FluxAnalysisRequest {
  clientId?: string;
  period?: string; // YYYY-MM format
  includeAllClients?: boolean;
  refreshCache?: boolean;
}

interface FluxAnalysisResponse {
  success: boolean;
  data: {
    summary: any;
    fluxData: any[];
    topPerformers: {
      increases: any[];
      decreases: any[];
    };
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
  };
  error?: string;
}

// Helper function to get cache key
function getCacheKey(clientId: string | undefined, period: string): string {
  return `flux_analysis:${clientId || 'all'}:${period}`;
}

// Helper function to check if cache is valid
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

// Helper function to get period boundaries
function getPeriodBoundaries(period: string) {
  const [year, month] = period.split('-').map(Number);
  const currentDate = new Date(year, month - 1, 1);
  const priorDate = new Date(year, month - 2, 1);
  const priorYearDate = new Date(year - 1, month - 1, 1);
  
  return {
    current: `${year}-${month.toString().padStart(2, '0')}`,
    prior: `${priorDate.getFullYear()}-${(priorDate.getMonth() + 1).toString().padStart(2, '0')}`,
    priorYear: `${priorYearDate.getFullYear()}-${(priorYearDate.getMonth() + 1).toString().padStart(2, '0')}`
  };
}

// Main flux analysis data aggregation
async function getFluxAnalysisData(clientId: string | undefined, period: string): Promise<any> {
  const { current, prior, priorYear } = getPeriodBoundaries(period);
  
  try {
    // Build the query based on whether we want client-specific or all clients data
    let query = supabase
      .from('flux_analysis_summary')
      .select('*')
      .eq('year', parseInt(current.split('-')[0]))
      .eq('month', parseInt(current.split('-')[1]));
    
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    
    const { data: currentData, error: currentError } = await query;
    
    if (currentError) {
      console.error('Error fetching current period data:', currentError);
      throw currentError;
    }
    
    if (!currentData || currentData.length === 0) {
      // Return empty structure if no data found
      return {
        summary: {
          totalRevenue: 0,
          totalExpenses: 0,
          netIncome: 0,
          avgMomGrowth: 0,
          avgYoyGrowth: 0
        },
        fluxData: [],
        topPerformers: { increases: [], decreases: [] },
        periodInfo: { current, prior, priorYear },
        metadata: {
          lastUpdated: new Date().toISOString(),
          cacheStatus: 'no_data',
          recordCount: 0
        }
      };
    }
    
    // Transform the data into the expected format
    const fluxData = currentData.map(record => ({
      category: getCategoryLabel(record),
      current: Math.abs(record.total_revenue || 0),
      prior: Math.abs(record.prior_month_revenue || 0),
      momDelta: Math.round((record.mom_revenue_delta || 0) * 100) / 100, // Round to 2 decimal places
      yoyDelta: Math.round((record.yoy_revenue_delta || 0) * 100) / 100, // Round to 2 decimal places
      trend: (record.mom_revenue_delta || 0) > 0 ? 'up' : 'down',
      details: {
        revenue: Math.round((record.total_revenue || 0) * 100) / 100,
        cogs: Math.round((record.cost_of_goods_sold || 0) * 100) / 100,
        grossProfit: Math.round((record.gross_profit || 0) * 100) / 100,
        expenses: Math.round((record.total_expenses || 0) * 100) / 100,
        netIncome: Math.round((record.net_income || 0) * 100) / 100
      }
    }));
    
    // Calculate summary statistics
    const summary = {
      totalRevenue: Math.round(currentData.reduce((sum, r) => sum + (r.total_revenue || 0), 0) * 100) / 100,
      totalExpenses: Math.round(currentData.reduce((sum, r) => sum + (r.total_expenses || 0), 0) * 100) / 100,
      netIncome: Math.round(currentData.reduce((sum, r) => sum + (r.net_income || 0), 0) * 100) / 100,
      avgMomGrowth: Math.round((currentData.reduce((sum, r) => sum + (r.mom_revenue_delta || 0), 0) / currentData.length) * 100) / 100,
      avgYoyGrowth: Math.round((currentData.reduce((sum, r) => sum + (r.yoy_revenue_delta || 0), 0) / currentData.length) * 100) / 100
    };
    
    // Calculate top performers
    const topPerformers = {
      increases: [...fluxData]
        .filter(d => d.momDelta > 0)
        .sort((a, b) => b.momDelta - a.momDelta)
        .slice(0, 3),
      decreases: [...fluxData]
        .filter(d => d.momDelta < 0)
        .sort((a, b) => a.momDelta - b.momDelta)
        .slice(0, 3)
    };
    
    return {
      summary,
      fluxData,
      topPerformers,
      periodInfo: { current, prior, priorYear },
      metadata: {
        lastUpdated: new Date().toISOString(),
        cacheStatus: 'live_data',
        recordCount: currentData.length
      }
    };
    
  } catch (error) {
    console.error('Error in getFluxAnalysisData:', error);
    throw error;
  }
}

// Helper function to get category labels
function getCategoryLabel(record: any): string {
  // This would be enhanced based on your actual categorization logic
  if (record.total_revenue > 0) return 'Revenue';
  if (record.cost_of_goods_sold > 0) return 'Cost of Goods Sold';
  if (record.total_expenses > 0) return 'Operating Expenses';
  if (record.gross_profit > 0) return 'Gross Profit';
  if (record.net_income > 0) return 'Net Income';
  return 'Other';
}

// Enhanced flux analysis with additional metrics
async function getEnhancedFluxAnalysis(clientId: string | undefined, period: string): Promise<any> {
  try {
    // Get base flux analysis data
    const baseData = await getFluxAnalysisData(clientId, period);
    
    // Get additional performance metrics
    const { data: performanceData, error: perfError } = await supabase
      .from('monthly_financial_summary')
      .select('*')
      .eq('year', parseInt(period.split('-')[0]))
      .eq('month', parseInt(period.split('-')[1]))
      .eq(clientId ? 'client_id' : 'client_id', clientId || '')
      .limit(1);
    
    if (perfError) {
      console.error('Error fetching performance data:', perfError);
    }
    
    // Add performance metrics if available
    if (performanceData && performanceData.length > 0) {
      const perf = performanceData[0];
      baseData.performanceMetrics = {
        totalTransactions: perf.total_transactions || 0,
        incomeTransactions: perf.income_transactions || 0,
        expenseTransactions: perf.expense_transactions || 0,
        averageTransactionSize: perf.total_transactions > 0 ? 
          (perf.total_revenue + perf.total_expenses) / perf.total_transactions : 0,
        expenseRatio: perf.total_revenue > 0 ? 
          (perf.total_expenses / perf.total_revenue) * 100 : 0
      };
    }
    
    return baseData;
    
  } catch (error) {
    console.error('Error in getEnhancedFluxAnalysis:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: FluxAnalysisRequest = await req.json();
    const { clientId, period = new Date().toISOString().slice(0, 7), includeAllClients = false, refreshCache = false } = body;
    
    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid period format. Use YYYY-MM format.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Check cache first (unless refresh is requested)
    const cacheKey = getCacheKey(clientId, period);
    if (!refreshCache && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (isCacheValid(cached.timestamp)) {
        console.log(`Cache hit for key: ${cacheKey}`);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...cached.data,
              metadata: {
                ...cached.data.metadata,
                cacheStatus: 'cached',
                lastUpdated: cached.data.metadata.lastUpdated
              }
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }
    
    // Fetch fresh data
    console.log(`Fetching fresh flux analysis data for client: ${clientId || 'all'}, period: ${period}`);
    const fluxData = await getEnhancedFluxAnalysis(clientId, period);
    
    // Cache the result
    cache.set(cacheKey, {
      data: fluxData,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
    
    const response: FluxAnalysisResponse = {
      success: true,
      data: fluxData
    };
    
    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error in flux analysis function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
