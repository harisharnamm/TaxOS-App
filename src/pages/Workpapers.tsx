import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/atoms/Button'
import { Badge } from '../components/atoms/Badge'
import { Input } from '../components/atoms/Input'
import { TopBar } from '../components/organisms/TopBar'
import {
  Calendar,
  CheckSquare,
  FileText,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Calculator,
  BarChart3,
  Target,
  Zap,
  Building2,
  Globe,
  Users2,
  ArrowUpRight,
  ArrowDownRight,
  Upload
} from 'lucide-react'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { useAuth } from '../hooks/useAuth'
import { useClients } from '../hooks/useClients'
import { useAccruals, AccrualCandidate } from '../hooks/useAccruals'
import { usePrepaids } from '../hooks/usePrepaids'
import { useEvidence } from '../hooks/useEvidence'
import { Modal } from '../components/molecules/Modal'

export function Workpapers() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { clients } = useClients()
  const { loading, error, listCandidates, detectCandidates, approveAccruals, reverseByCandidate } = useAccruals()
  const prepaids = usePrepaids()
  const evidence = useEvidence()

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
    navigate(clientId ? `/workpapers/${clientId}` : '/workpapers')
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

  // Workpapers state
  const [schedules, setSchedules] = useState<any[]>([])
  const [postingEntryId, setPostingEntryId] = useState<string | null>(null)
  const [evidenceFor, setEvidenceFor] = useState<{ type: 'accrual'|'prepaid', id: string } | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [attached, setAttached] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<'accruals' | 'prepaids'>('accruals')
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0,7) + '-01')
  const [candidates, setCandidates] = useState<AccrualCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [showReverse, setShowReverse] = useState(false)
  const [candidateToReverse, setCandidateToReverse] = useState<string | null>(null)

  const periodEnd = useMemo(() => {
    const d = new Date(period)
    return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10)
  }, [period])

  useEffect(() => {
    if (!selectedClientId) {
      // Seed demo candidates when no client is selected
      const demo: AccrualCandidate[] = [
        { id: 'demo-1', client_id: 'demo', period, suggested_amount: 4500, confidence: 0.9, reason: 'recurring_vendor', expense_account: 'Office supplies', status: 'proposed', created_at: new Date().toISOString() },
        { id: 'demo-2', client_id: 'demo', period, suggested_amount: 500, confidence: 0.8, reason: 'contract_schedule', expense_account: 'Software subscriptions', status: 'proposed', created_at: new Date().toISOString() },
        { id: 'demo-3', client_id: 'demo', period, suggested_amount: 123, confidence: 0.75, reason: 'spike_detected', expense_account: 'Utilities', status: 'proposed', created_at: new Date().toISOString() },
      ]
      setCandidates(demo)
      return
    }
    listCandidates(selectedClientId, period).then(setCandidates)
  }, [selectedClientId, period, listCandidates])

  // Load prepaid schedules when client changes
  useEffect(() => {
    if (selectedClientId) {
      prepaids.listSchedules(selectedClientId).then(setSchedules)
    } else {
      setSchedules([])
    }
  }, [selectedClientId, prepaids])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const runDetect = async () => {
    if (!selectedClientId) {
      // Enhance demo by adding a new row
      setCandidates(prev => ([
        ...prev,
        { id: `demo-${prev.length+1}`, client_id: 'demo', period, suggested_amount: 275, confidence: 0.7, reason: 'recurring_vendor', expense_account: 'Office expenses', status: 'proposed', created_at: new Date().toISOString() }
      ]))
      return
    }
    await detectCandidates(selectedClientId, period)
    const data = await listCandidates(selectedClientId, period)
    setCandidates(data)
  }

  const runApprove = async () => {
    if (!user) return
    if (!selectedClientId) {
      // Demo mode: mark selected as accrued locally
      setCandidates(prev => prev.map(c => selected.has(c.id) ? { ...c, status: 'accrued' } : c))
      setSelected(new Set())
      return
    }
    await approveAccruals(Array.from(selected), periodEnd, user.id)
    const data = await listCandidates(selectedClientId, period)
    setCandidates(data)
    setSelected(new Set())
  }

  // Statistics calculations
  const stats = useMemo(() => {
    const totalCandidates = candidates.length
    const proposedCandidates = candidates.filter(c => c.status === 'proposed').length
    const accruedCandidates = candidates.filter(c => c.status === 'accrued').length
    const totalAccrualAmount = candidates
      .filter(c => selected.has(c.id))
      .reduce((sum, c) => sum + (c.suggested_amount || 0), 0)

    const avgConfidence = candidates.length > 0
      ? candidates.reduce((sum, c) => sum + (c.confidence || 0), 0) / candidates.length
      : 0

    return {
      totalCandidates,
      proposedCandidates,
      accruedCandidates,
      totalAccrualAmount,
      avgConfidence: Math.round(avgConfidence * 100)
    }
  }, [candidates, selected])

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title={`Workpapers${selectedClient ? ` - ${selectedClient.name}` : ' - All Clients'}`} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Workpapers</h1>
              <p className="text-text-secondary text-lg">
                Intelligent accruals and prepaid expense management
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={runDetect}
                variant="secondary"
                className="flex items-center gap-2 shadow-soft"
              >
                <Zap className="h-4 w-4" />
                Detect Accruals
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowConfirm(true)}
                disabled={selected.size === 0}
                className="flex items-center gap-2 shadow-soft"
              >
                <CheckSquare className="h-4 w-4" />
                Accrue Selected ({selected.size})
              </Button>
            </div>
          </div>

          {/* Client Selector */}
          <div className="mb-8">
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
                <div className="text-sm font-medium text-text-secondary">Period:</div>
                <Input
                  value={period.slice(0,7)}
                  onChange={(e) => setPeriod(e.target.value + '-01')}
                  type="month"
                  className="min-w-[140px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Candidates</p>
                <p className="text-2xl font-bold text-text-primary">{stats.totalCandidates}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Calculator className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Proposed</p>
                <p className="text-2xl font-bold text-text-primary">{stats.proposedCandidates}</p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <Clock className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Accrued</p>
                <p className="text-2xl font-bold text-text-primary">{stats.accruedCandidates}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl p-6 border border-border-subtle shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Avg Confidence</p>
                <p className="text-2xl font-bold text-text-primary">{stats.avgConfidence}%</p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <Target className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle shadow-soft overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-border-subtle">
            <button
              onClick={() => setActiveTab('accruals')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 w-full ${activeTab==='accruals' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <Calculator className="h-4 w-4" />
                Accruals
              </div>
            </button>
            <button
              onClick={() => setActiveTab('prepaids')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 w-full ${activeTab==='prepaids' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <DollarSign className="h-4 w-4" />
                Prepaid Expenses
                <Badge variant="neutral" className="ml-2 text-xs">Coming Soon</Badge>
              </div>
            </button>
          </div>

          {activeTab === 'accruals' && (
            <div className="p-6 space-y-6">
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={runDetect}
                    className="flex items-center gap-2 shadow-soft"
                  >
                    <Zap className="h-4 w-4" />
                    Detect Accruals
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowConfirm(true)}
                    disabled={selected.size === 0}
                    className="flex items-center gap-2 shadow-soft"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Accrue Selected ({selected.size})
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-text-secondary">Period End:</div>
                  <Input
                    value={period.slice(0,7)}
                    onChange={(e) => setPeriod(e.target.value + '-01')}
                    type="month"
                    className="min-w-[140px]"
                  />
                </div>
              </div>

              {/* Accruals Table */}
              <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
                <div className="grid grid-cols-6 px-6 py-4 bg-surface-hover border-b border-border-subtle">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Reason</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Account</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Amount</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Confidence</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Actions</div>
                </div>

                <div className="divide-y divide-border-subtle">
                  {candidates.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="p-4 bg-surface-hover rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Calculator className="h-8 w-8 text-text-tertiary" />
                      </div>
                      <h3 className="text-lg font-medium text-text-primary mb-2">No Accrual Candidates</h3>
                      <p className="text-text-secondary max-w-md mx-auto mb-6">
                        {selectedClient
                          ? `No accrual opportunities detected for ${selectedClient.name} in the selected period.`
                          : 'No accrual opportunities detected. Select a client and click "Detect Accruals" to find opportunities.'
                        }
                      </p>
                      <Button
                        onClick={runDetect}
                        className="flex items-center gap-2 mx-auto"
                      >
                        <Zap className="h-4 w-4" />
                        Detect Accruals
                      </Button>
                    </div>
                  ) : (
                    candidates.map(c => (
                      <div key={c.id} className="grid grid-cols-6 items-center px-6 py-4 hover:bg-surface-hover transition-colors">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggle(c.id)}
                            className="w-4 h-4 text-primary border-border-subtle rounded focus:ring-primary"
                          />
                          <div>
                            <div className="font-medium text-text-primary">
                              {c.reason || 'Recurring Vendor'}
                            </div>
                            <div className="text-xs text-text-tertiary">
                              Detected {new Date(c.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="text-text-secondary">
                          {c.expense_account || 'Office Supplies'}
                        </div>

                        <div className="font-semibold text-text-primary">
                          ${Number(c.suggested_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              (c.confidence || 0) >= 0.8 ? 'bg-green-500' :
                              (c.confidence || 0) >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-sm font-medium">
                              {Math.round((c.confidence || 0) * 100)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant={c.status === 'accrued' ? 'success' : c.status === 'proposed' ? 'warning' : 'neutral'}
                            className="text-xs"
                          >
                            {c.status.toUpperCase()}
                          </Badge>
                          {'je_id' in c && (c as any).je_id && (
                            <Badge variant="secondary" className="text-xs">JE</Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              setEvidenceFor({ type: 'accrual', id: c.id })
                              if (selectedClientId) {
                                const s = await evidence.suggest(selectedClientId!, 'accrual', c.id)
                                setSuggestions(s)
                                const a = await evidence.get('accrual', c.id)
                                setAttached(a)
                              } else {
                                // Demo suggestions when no client selected
                                setSuggestions([
                                  { document_id: 'demo-doc-1', filename: 'invoice-apple-2025-05.pdf', confidence: 0.82 },
                                  { document_id: 'demo-doc-2', filename: 'contract-renewal.pdf', confidence: 0.76 }
                                ])
                                setAttached([])
                              }
                            }}
                            className="flex items-center gap-1"
                          >
                            <Paperclip className="h-3 w-3" />
                            Evidence
                          </Button>
                          {c.status === 'accrued' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setCandidateToReverse(c.id); setShowReverse(true) }}
                              className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                              Reverse
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Enhanced Evidence Modal */}
              <Modal
                isOpen={!!evidenceFor}
                onClose={() => { setEvidenceFor(null); setSuggestions([]); setAttached([]) }}
                title={
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5 text-primary" />
                    Evidence Management
                    <Badge variant="neutral" className="ml-auto">
                      {evidenceFor?.type === 'accrual' ? 'Accrual' : 'Prepaid'}
                    </Badge>
                  </div>
                }
                maxWidth="2xl"
              >
                <div className="space-y-6">
                  {/* Attached Documents Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <h5 className="text-lg font-semibold text-text-primary">Attached Documents</h5>
                      <Badge variant="secondary" className="ml-auto">{attached.length}</Badge>
                    </div>

                    {attached.length === 0 ? (
                      <div className="text-center py-8 px-6 bg-surface-hover rounded-lg border-2 border-dashed border-border-subtle">
                        <FileText className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
                        <p className="text-text-secondary font-medium">No documents attached yet</p>
                        <p className="text-text-tertiary text-sm mt-1">
                          Documents attached here will be linked to this {evidenceFor?.type} for audit purposes
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {attached.map((a, index) => (
                          <div key={a.document_id || index} className="flex items-center justify-between p-4 bg-surface-hover rounded-lg border border-border-subtle hover:shadow-soft transition-all">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <FileText className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <div className="font-medium text-text-primary">
                                  {a.filename || a.document_id || `Document ${index + 1}`}
                                </div>
                                <div className="text-xs text-text-tertiary">
                                  Attached to this {evidenceFor?.type}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="success" className="text-xs">
                                {a.confidence ? Math.round(a.confidence * 100) : 100}% confidence
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  // Detach functionality could be added here
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Suggested Documents Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="h-4 w-4 text-blue-500" />
                      <h5 className="text-lg font-semibold text-text-primary">Suggested Documents</h5>
                      <Badge variant="secondary" className="ml-auto">{suggestions.length}</Badge>
                    </div>

                    {suggestions.length === 0 ? (
                      <div className="text-center py-8 px-6 bg-surface-hover rounded-lg border-2 border-dashed border-border-subtle">
                        <Search className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
                        <p className="text-text-secondary font-medium">No suggestions available</p>
                        <p className="text-text-tertiary text-sm mt-1">
                          AI will suggest relevant documents based on the {evidenceFor?.type} details
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {suggestions.map((s, index) => (
                          <div key={s.document_id || index} className="flex items-center justify-between p-4 bg-surface-hover rounded-lg border border-border-subtle hover:shadow-soft transition-all">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <FileText className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium text-text-primary">
                                  {s.filename || s.document_id || `Suggested Document ${index + 1}`}
                                </div>
                                <div className="text-xs text-text-tertiary">
                                  AI-suggested match for this {evidenceFor?.type}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  (s.confidence || 0) >= 0.8 ? 'bg-green-500' :
                                  (s.confidence || 0) >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                                }`} />
                                <Badge variant="neutral" className="text-xs">
                                  {Math.round((s.confidence || 0) * 100)}% match
                                </Badge>
                              </div>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={async () => {
                                  if (!evidenceFor) return
                                  await evidence.attach(evidenceFor.type, evidenceFor.id, s.document_id, s.confidence)
                                  const a = await evidence.get(evidenceFor.type, evidenceFor.id)
                                  setAttached(a)
                                  // Remove from suggestions after attaching
                                  setSuggestions(prev => prev.filter(sugg => sugg.document_id !== s.document_id))
                                }}
                                className="flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Attach
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upload Section */}
                  <div className="border-t border-border-subtle pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ArrowUpRight className="h-4 w-4 text-purple-500" />
                      <h5 className="text-lg font-semibold text-text-primary">Upload New Document</h5>
                    </div>
                    <div className="text-center py-6 px-6 bg-surface-hover rounded-lg border-2 border-dashed border-border-subtle hover:border-primary/50 transition-colors cursor-pointer">
                      <Upload className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
                      <p className="text-text-secondary font-medium">Drop files here or click to browse</p>
                      <p className="text-text-tertiary text-sm mt-1">
                        Supports PDF, DOC, XLS files up to 10MB
                      </p>
                      <Button variant="secondary" className="mt-3">
                        Browse Files
                      </Button>
                    </div>
                  </div>
                </div>
              </Modal>
              <ConfirmDialog
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={() => { setShowConfirm(false); runApprove() }}
                title="Confirm Accrual"
                message={`Post accrual JEs dated ${periodEnd} for ${selected.size} item(s)?`}
                confirmText="Post Accruals"
              />
              <ConfirmDialog
                isOpen={showReverse}
                onClose={() => setShowReverse(false)}
                onConfirm={async () => {
                  if (!candidateToReverse || !user) { setShowReverse(false); return }
                  await reverseByCandidate(candidateToReverse, periodEnd, user.id)
                  if (clientId) {
                    const data = await listCandidates(clientId, period)
                    setCandidates(data)
                  } else {
                    setCandidates(prev => prev.map(p => p.id === candidateToReverse ? { ...p, status: 'reversed' } : p))
                  }
                  setCandidateToReverse(null)
                  setShowReverse(false)
                }}
                title="Reverse Accrual"
                message="Create reversing JE for selected item? (UI wiring to specific entry can follow)"
                confirmText="Reverse"
                confirmVariant="secondary"
              />
            </div>
          )}

          {activeTab === 'prepaids' && (
            <div className="p-6 space-y-6">
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await prepaids.createSchedule({
                        client_id: selectedClientId,
                        start_date: period,
                        end_date: periodEnd,
                        total_amount: 1200,
                        user_id: user?.id
                      })
                      if (selectedClientId) {
                        const data = await prepaids.listSchedules(selectedClientId)
                        setSchedules(data)
                      }
                    }}
                    className="flex items-center gap-2 shadow-soft"
                  >
                    <Plus className="h-4 w-4" />
                    New Schedule
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-text-secondary">Period:</div>
                  <Input
                    value={period.slice(0,7)}
                    onChange={(e) => setPeriod(e.target.value + '-01')}
                    type="month"
                    className="min-w-[140px]"
                  />
                </div>
              </div>

              {/* Prepaid Schedules Table */}
              <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
                <div className="grid grid-cols-6 px-6 py-4 bg-surface-hover border-b border-border-subtle">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Asset Account</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Expense Account</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Total</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Remaining</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Period</div>
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Actions</div>
                </div>

                <div className="divide-y divide-border-subtle">
                  {schedules.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="p-4 bg-surface-hover rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <DollarSign className="h-8 w-8 text-text-tertiary" />
                      </div>
                      <h3 className="text-lg font-medium text-text-primary mb-2">No Prepaid Schedules</h3>
                      <p className="text-text-secondary max-w-md mx-auto mb-6">
                        {selectedClient
                          ? `No prepaid expense schedules found for ${selectedClient.name}. Create your first schedule to manage prepaid expenses.`
                          : 'No prepaid expense schedules found. Select a client and create your first prepaid schedule.'
                        }
                      </p>
                      <Button
                        onClick={async () => {
                          await prepaids.createSchedule({
                            client_id: selectedClientId,
                            start_date: period,
                            end_date: periodEnd,
                            total_amount: 1200,
                            user_id: user?.id
                          })
                          if (selectedClientId) {
                            const data = await prepaids.listSchedules(selectedClientId)
                            setSchedules(data)
                          }
                        }}
                        className="flex items-center gap-2 mx-auto"
                      >
                        <Plus className="h-4 w-4" />
                        Create First Schedule
                      </Button>
                    </div>
                  ) : (
                    schedules.map((s) => (
                      <div key={s.id} className="px-6 py-4">
                        <div className="grid grid-cols-6 items-center">
                          <div className="font-medium text-text-primary">
                            {s.asset_account || 'Prepaid Expenses'}
                          </div>
                          <div className="text-text-secondary">
                            {s.expense_account || 'Monthly Expenses'}
                          </div>
                          <div className="font-semibold text-text-primary">
                            ${Number(s.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="font-medium text-green-600">
                            ${Number(s.remaining_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-sm text-text-secondary">
                            {s.start_date && s.end_date ? (
                              <div>
                                <div>{new Date(s.start_date).toLocaleDateString()}</div>
                                <div className="text-xs">to {new Date(s.end_date).toLocaleDateString()}</div>
                              </div>
                            ) : (
                              <span className="text-text-tertiary">No dates set</span>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                setEvidenceFor({ type: 'prepaid', id: s.id })
                                if (selectedClientId) {
                                  const sugg = await evidence.suggest(selectedClientId!, 'prepaid', s.id)
                                  setSuggestions(sugg)
                                } else {
                                  setSuggestions([
                                    { document_id: 'demo-doc-3', filename: 'insurance-policy.pdf', confidence: 0.79 }
                                  ])
                                }
                              }}
                              className="flex items-center gap-1"
                            >
                              <Paperclip className="h-3 w-3" />
                              Evidence
                            </Button>
                            <Button variant="ghost" size="sm" className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Edit
                            </Button>
                          </div>
                        </div>

                        {/* Amortization Entries */}
                        {s.prepaid_entries && s.prepaid_entries.length > 0 && (
                          <div className="mt-4 rounded-lg border border-border-subtle bg-surface-hover">
                            <div className="grid grid-cols-5 px-4 py-3 bg-surface border-b border-border-subtle">
                              <div className="text-xs font-semibold text-text-secondary uppercase">Period</div>
                              <div className="text-xs font-semibold text-text-secondary uppercase">Amount</div>
                              <div className="text-xs font-semibold text-text-secondary uppercase">Status</div>
                              <div className="text-xs font-semibold text-text-secondary uppercase">JE</div>
                              <div className="text-xs font-semibold text-text-secondary uppercase text-right">Action</div>
                            </div>
                            <div className="divide-y divide-border-subtle">
                              {s.prepaid_entries.map((e: any) => (
                                <div key={e.id} className="grid grid-cols-5 items-center px-4 py-3">
                                  <div className="text-text-primary font-medium">
                                    {e.period_date ? new Date(e.period_date).toLocaleDateString() : 'TBD'}
                                  </div>
                                  <div className="font-medium text-text-primary">
                                    ${Number(e.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </div>
                                  <div>
                                    <Badge
                                      variant={e.status === 'posted' ? 'success' : e.status === 'pending' ? 'warning' : 'neutral'}
                                      className="text-xs"
                                    >
                                      {e.status.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <div className="text-text-secondary">
                                    {e.je_id ? (
                                      <Badge variant="secondary" className="text-xs">JE-{e.je_id}</Badge>
                                    ) : (
                                      <span className="text-text-tertiary">-</span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    {e.status !== 'posted' && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={async () => {
                                          if (!user) return
                                          setPostingEntryId(e.id)
                                          await prepaids.postEntry(e.id, user.id)
                                          const data = await prepaids.listSchedules(selectedClientId!)
                                          setSchedules(data)
                                          setPostingEntryId(null)
                                        }}
                                        className="flex items-center gap-1"
                                      >
                                        {postingEntryId === e.id ? (
                                          <>
                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                            Posting...
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle className="h-3 w-3" />
                                            Post
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


