import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/organisms/TopBar'
import { Input } from '../components/atoms/Input'
import { Badge } from '../components/atoms/Badge'
import { Button } from '../components/atoms/Button'
import { useClients } from '../hooks/useClients'
import { useFluxAnalysis, useAvailablePeriods } from '../hooks/useFluxAnalysis'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Calendar,
  Users2,
  Globe,
  Building2,
  ChevronDown,
  Download,
  Filter,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  PieChart,
  LineChart,
  RefreshCw,
  AlertCircle
} from 'lucide-react'

// Utility functions for formatting
const formatCurrency = (amount: number): string => {
  if (amount === 0) return '0';
  if (Math.abs(amount) < 1) return amount.toFixed(2);
  if (Math.abs(amount) < 1000) return amount.toFixed(2);
  if (Math.abs(amount) < 1000000) return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (amount / 1000000).toFixed(2) + 'M';
};

const formatPercentage = (percentage: number): string => {
  if (percentage === 0) return '0%';
  if (Math.abs(percentage) < 0.1) return '0%';
  if (Math.abs(percentage) < 1) return percentage.toFixed(1) + '%';
  if (Math.abs(percentage) < 100) return percentage.toFixed(1) + '%';
  if (Math.abs(percentage) < 1000) return percentage.toFixed(0) + '%';
  return (percentage > 0 ? '+' : '') + percentage.toFixed(0) + '%';
};

export function FluxAnalysis() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { clients } = useClients()

  // Client selection state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId || null)
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [clientDropdownRef] = useState<React.RefObject<HTMLDivElement>>(React.createRef())

  // Get selected client info
  const selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null

  // Handle client selection
  const handleClientSelect = (clientId: string | null) => {
    setSelectedClientId(clientId)
    setIsClientDropdownOpen(false)
    navigate(clientId ? `/transactions/analytics/${clientId}` : '/transactions/analytics')
  }

  // Click outside handler for client dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update selectedClientId when clientId from URL changes
  useEffect(() => {
    if (clientId && clientId !== selectedClientId) {
      setSelectedClientId(clientId)
    }
  }, [clientId, selectedClientId])

  // Period state
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0,7))

  // Real data from API using the new hook
  const { 
    data: fluxAnalysisData, 
    loading, 
    error, 
    refresh, 
    refreshCache,
    updatePeriod,
    updateClient
  } = useFluxAnalysis({
    clientId: selectedClientId || undefined,
    period,
    autoRefresh: true,
    refreshInterval: 300000 // 5 minutes
  })

  // Available periods for the selected client
  const { periods: availablePeriods } = useAvailablePeriods(selectedClientId || undefined)

  // Update period when it changes
  useEffect(() => {
    updatePeriod(period)
  }, [period, updatePeriod])

  // Update client when it changes
  useEffect(() => {
    updateClient(selectedClientId || undefined)
  }, [selectedClientId, updateClient])

  // Extract data from API response
  const fluxData = fluxAnalysisData?.fluxData || []
  const summaryStats = fluxAnalysisData?.summary || {
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    avgMomGrowth: 0,
    avgYoyGrowth: 0
  }
  const topPerformers = fluxAnalysisData?.topPerformers || { increases: [], decreases: [] }
  const performanceMetrics = fluxAnalysisData?.performanceMetrics
  const metadata = fluxAnalysisData?.metadata

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title={`Flux Analysis${selectedClient ? ` - ${selectedClient.name}` : ' - All Clients'}`} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Flux Analysis</h1>
              <p className="text-text-secondary text-lg">
                Comprehensive financial movement analysis and performance insights
              </p>
              {selectedClient && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="neutral" className="text-xs">
                    Client-Specific Data
                  </Badge>
                  <span className="text-sm text-text-tertiary">
                    Showing data for {selectedClient.name}
                  </span>
                </div>
              )}
              {metadata && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={metadata.cacheStatus === 'cached' ? 'success' : 'neutral'} className="text-xs">
                    {metadata.cacheStatus === 'cached' ? 'Cached' : 'Live Data'}
                  </Badge>
                  <span className="text-sm text-text-tertiary">
                    Last updated: {new Date(metadata.lastUpdated).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex items-center gap-2 shadow-soft"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2 shadow-soft"
                onClick={refreshCache}
                disabled={loading}
              >
                <Zap className="h-4 w-4" />
                Force Refresh
              </Button>
              <Button
                variant="primary"
                className="flex items-center gap-2 shadow-soft"
              >
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>

          {/* Client Selector and Period */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                <Users2 className="w-4 h-4" />
                Filter by Client:
              </div>
              <div className="relative" ref={clientDropdownRef}>
                <button
                  onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border-subtle rounded-lg hover:bg-surface transition-colors min-w-[200px] justify-between"
                >
                  <div className="flex items-center gap-2">
                    {selectedClient ? (
                      <>
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="text-text-primary">{selectedClient.name}</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4 text-text-tertiary" />
                        <span className="text-text-secondary">All Clients</span>
                      </>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isClientDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border-subtle rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => handleClientSelect(null)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface transition-colors first:rounded-t-lg"
                    >
                      <Globe className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-secondary">All Clients</span>
                    </button>
                    {clients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleClientSelect(client.id)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface transition-colors"
                      >
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="text-text-primary">{client.name}</span>
                      </button>
                    ))}
                    {clients.length === 0 && (
                      <div className="px-4 py-3 text-text-tertiary text-sm">
                        No clients available. Add clients first to manage workpapers.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-text-secondary">Analysis Period:</div>
              <Input
                value={period.slice(0,7)}
                onChange={(e) => setPeriod(e.target.value + '-01')}
                type="month"
                className="min-w-[140px]"
              />
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <h3 className="font-medium text-red-800">Error Loading Data</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !fluxAnalysisData && (
          <div className="mb-6 p-8 bg-surface rounded-xl border border-border-subtle text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading flux analysis data...</p>
          </div>
        )}

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Revenue</p>
                <p className="text-2xl font-bold text-text-primary">
                  ${formatCurrency(summaryStats.totalRevenue)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {summaryStats.avgMomGrowth > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${
                    summaryStats.avgMomGrowth > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercentage(summaryStats.avgMomGrowth)} MoM
                  </span>
                </div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Operating Expenses</p>
                <p className="text-2xl font-bold text-text-primary">
                  ${formatCurrency(summaryStats.totalExpenses)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {(() => {
                    const operatingExpenses = fluxData.find(d => d.category === 'Operating Expenses');
                    const momDelta = operatingExpenses?.momDelta || 0;
                    return (
                      <>
                        {momDelta > 0 ? (
                          <TrendingUp className="h-3 w-3 text-orange-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-blue-500" />
                        )}
                        <span className={`text-xs font-medium ${
                          momDelta > 0 ? 'text-orange-600' : 'text-blue-600'
                        }`}>
                          {formatPercentage(momDelta)} MoM
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <Activity className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Net Income</p>
                <p className="text-2xl font-bold text-text-primary">
                  ${formatCurrency(summaryStats.netIncome)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {(() => {
                    const netIncome = fluxData.find(d => d.category === 'Net Income');
                    const momDelta = netIncome?.momDelta || 0;
                    return (
                      <>
                        {momDelta > 0 ? (
                          <TrendingUp className="h-3 w-3 text-blue-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className={`text-xs font-medium ${
                          momDelta > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(momDelta)} MoM
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Target className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Avg MoM Growth</p>
                <p className={`text-2xl font-bold ${
                  summaryStats.avgMomGrowth > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercentage(summaryStats.avgMomGrowth)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <BarChart3 className="h-3 w-3 text-purple-500" />
                  <span className="text-xs text-purple-600 font-medium">Across all categories</span>
                </div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <BarChart3 className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Avg YoY Growth</p>
                <p className={`text-2xl font-bold ${
                  summaryStats.avgYoyGrowth > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercentage(summaryStats.avgYoyGrowth)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <LineChart className="h-3 w-3 text-indigo-500" />
                  <span className="text-xs text-indigo-600 font-medium">Year over year</span>
                </div>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl">
                <LineChart className="h-6 w-6 text-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-green-500" />
                <h3 className="text-lg font-semibold text-text-primary">Top Performers</h3>
              </div>
              <Badge variant="success" className="text-xs">Month-over-Month</Badge>
            </div>
            <div className="space-y-4">
              {topPerformers.increases.map((item, index) => (
                <div key={item.category} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">{item.category}</div>
                      <div className="text-xs text-text-secondary">
                        ${formatCurrency(item.current)} current
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {formatPercentage(item.momDelta)}
                    </div>
                    <div className="text-xs text-text-secondary">
                      from ${formatCurrency(item.prior)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="h-5 w-5 text-red-500" />
                <h3 className="text-lg font-semibold text-text-primary">Areas of Concern</h3>
              </div>
              <Badge variant="warning" className="text-xs">Needs Attention</Badge>
            </div>
            <div className="space-y-4">
              {topPerformers.decreases.length > 0 ? topPerformers.decreases.map((item, index) => (
                <div key={item.category} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">{item.category}</div>
                      <div className="text-xs text-text-secondary">
                        ${formatCurrency(item.current)} current
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-600">
                      {formatPercentage(item.momDelta)}
                    </div>
                    <div className="text-xs text-text-secondary">
                      from ${formatCurrency(item.prior)}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 px-6 bg-surface-hover rounded-lg border-2 border-dashed border-border-subtle">
                  <div className="p-4 bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Target className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-text-secondary font-medium">All categories performing well!</p>
                  <p className="text-text-tertiary text-sm mt-1">
                    No significant decreases detected this period
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Flux Analysis Table */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Detailed Flux Analysis</h3>
                <p className="text-text-secondary text-sm">
                  Month-over-month and year-over-year performance comparison
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 px-6 py-4 bg-surface-hover border-b border-border-subtle text-xs font-semibold text-text-secondary uppercase tracking-wider">
              <div>Category</div>
              <div className="text-right">Current Period</div>
              <div className="text-right">Prior Period</div>
              <div className="text-right">MoM Change</div>
              <div className="text-right">MoM % Δ</div>
              <div className="text-right">YoY % Δ</div>
              <div>Trend</div>
            </div>

            <div className="divide-y divide-border-subtle">
              {fluxData.map((row) => (
                <div key={row.category} className="grid grid-cols-7 items-center px-6 py-4 hover:bg-surface-hover transition-colors">
                  <div className="font-semibold text-text-primary flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      row.trend === 'up' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {row.category}
                  </div>

                  <div className="text-right font-medium text-text-primary">
                    ${formatCurrency(row.current)}
                  </div>

                  <div className="text-right text-text-secondary">
                    ${formatCurrency(row.prior)}
                  </div>

                  <div className="text-right">
                    <span className={`font-medium ${
                      row.current - row.prior > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(row.current - row.prior)}
                    </span>
                  </div>

                  <div className="text-right">
                    <Badge
                      variant={row.momDelta > 0 ? 'success' : row.momDelta < 0 ? 'warning' : 'neutral'}
                      className="text-xs font-medium"
                    >
                      {formatPercentage(row.momDelta)}
                    </Badge>
                  </div>

                  <div className="text-right">
                    <Badge
                      variant={row.yoyDelta > 0 ? 'success' : row.yoyDelta < 0 ? 'warning' : 'neutral'}
                      className="text-xs font-medium"
                    >
                      {formatPercentage(row.yoyDelta)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            row.momDelta > 0 ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{
                            width: `${Math.min(Math.abs(row.momDelta) * 10, 100)}%`,
                            transformOrigin: 'left'
                          }}
                        />
                      </div>
                    </div>
                    <div className={`text-lg ${row.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      {row.trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Footer */}
          <div className="px-6 py-4 bg-surface-hover border-t border-border-subtle">
            <div className="flex items-center justify-between text-sm">
              <div className="text-text-secondary">
                Showing {fluxData.length} categories for {period.slice(0, 7)}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-text-secondary">
                  Overall Performance:
                  <span className={`ml-1 font-medium ${summaryStats.avgMomGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryStats.avgMomGrowth > 0 ? '+' : ''}{summaryStats.avgMomGrowth}% MoM
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


