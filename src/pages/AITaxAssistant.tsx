import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/organisms/TopBar';
import { TypingIndicator } from '../components/molecules/TypingIndicator';
import { GlobalSearch } from '../components/molecules/GlobalSearch';
import { useSearch } from '../contexts/SearchContext';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Send, Sparkles, FileText, Calculator, Trash2, RefreshCw, Paperclip, X, Users, AlertTriangle, User, ChevronDown } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useClients } from '../hooks/useClients';
import { useVendors } from '../hooks/useVendors';
import { useDocuments } from '../hooks/useDocuments';
import { useDocumentUpload } from '../hooks/useDocumentUpload';
import { formatFileSize } from '../lib/uploadUtils';
import { cn } from '../lib/utils';

type ChatMode = 'general' | 'client' | 'notice' | 'vendor';

interface ChatContext {
  mode: ChatMode;
  clientId?: string;
  noticeId?: string;
  vendorId?: string;
  documentIds?: string[];
}

export function AITaxAssistant() {
  const { clients } = useClients();
  const { vendors } = useVendors();
  const [chatContext, setChatContext] = useState<ChatContext>({ mode: 'general' });
  const { isSearchOpen, closeSearch } = useSearch();
  const { messages, loading, error, isTyping, sendMessage, clearMessages, setError } = useChat(chatContext.clientId);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const { uploadSingleDocument } = useDocumentUpload();
  
  // Get documents for selected client
  const { documents: clientDocuments } = useDocuments(chatContext.clientId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setShowModeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected documents when context changes
  useEffect(() => {
    setSelectedDocuments([]);
  }, [chatContext]);

  // Add welcome message if no messages exist
  const displayMessages = messages.length === 0 ? [
    {
      id: 'welcome',
      user_id: '',
      role: 'assistant' as const,
      content: getWelcomeMessage(),
      created_at: new Date().toISOString(),
    }
  ] : messages;

  function getWelcomeMessage(): string {
    switch (chatContext.mode) {
      case 'client':
        const clientName = clients.find(c => c.id === chatContext.clientId)?.name || 'this client';
        return `Hello! I'm your AI tax assistant, now focused on ${clientName}. I can help you with client-specific tax questions, analyze their documents, and provide tailored advice. What would you like to know about this client?`;
      case 'notice':
        return `Hello! I'm your AI tax assistant, now focused on the selected IRS notice. I can help you understand the notice requirements, suggest response strategies, and guide you through the resolution process. What would you like to know about this notice?`;
      case 'vendor':
        return `Hello! I'm your AI tax assistant, now focused on the selected vendor. I can help you with 1099 requirements, vendor compliance, and payment tracking. What would you like to know about this vendor?`;
      default:
        return `Hello! I'm your AI tax assistant. I can help you with general tax guidance, analyze documents, answer tax questions, and provide professional advice. You can switch contexts to focus on specific clients, IRS notices, or vendors. What would you like to know?`;
    }
  }

  const quickActions = [
    { 
      label: 'Analyze Document', 
      icon: FileText,
      prompt: getContextualPrompt('document')
    },
    { 
      label: 'Calculate Deduction', 
      icon: Calculator,
      prompt: getContextualPrompt('deduction')
    },
    { 
      label: 'Tax Guidance', 
      icon: Sparkles,
      prompt: getContextualPrompt('guidance')
    },
  ];

  function getContextualPrompt(type: string): string {
    const basePrompts = {
      document: 'Can you help me analyze a document for potential tax implications?',
      deduction: 'I need help calculating a deduction. Can you guide me through the process?',
      guidance: 'I have a tax question. Can you help me understand the regulations?'
    };

    switch (chatContext.mode) {
      case 'client':
        const clientName = clients.find(c => c.id === chatContext.clientId)?.name || 'this client';
        return {
          document: `Can you analyze ${clientName}'s documents for potential deductions and tax implications?`,
          deduction: `Help me calculate a deduction for ${clientName}. What information do you need?`,
          guidance: `I have a tax question specific to ${clientName}. Can you provide guidance?`
        }[type] || basePrompts[type as keyof typeof basePrompts];
      case 'notice':
        return {
          document: 'Can you analyze this IRS notice and explain what actions are required?',
          deduction: 'Help me understand the deduction issues mentioned in this IRS notice.',
          guidance: 'What are the best strategies for responding to this IRS notice?'
        }[type] || basePrompts[type as keyof typeof basePrompts];
      case 'vendor':
        return {
          document: 'Can you help me analyze vendor documentation for 1099 compliance?',
          deduction: 'Help me calculate vendor payment deductions and 1099 requirements.',
          guidance: 'What are the compliance requirements for this vendor relationship?'
        }[type] || basePrompts[type as keyof typeof basePrompts];
      default:
        return basePrompts[type as keyof typeof basePrompts];
    }
  }

  const getModeLabel = () => {
    switch (chatContext.mode) {
      case 'client':
        const clientName = clients.find(c => c.id === chatContext.clientId)?.name;
        return clientName ? `Client: ${clientName}` : 'Select Client';
      case 'notice':
        const notice = notices.find(n => n.id === chatContext.noticeId);
        return notice ? `Notice: ${notice.notice_type}` : 'Select Notice';
      case 'vendor':
        const vendor = vendors.find(v => v.id === chatContext.vendorId);
        return vendor ? `Vendor: ${vendor.name}` : 'Select Vendor';
      default:
        return 'General Tax Guidance';
    }
  };

  const getModeIcon = () => {
    switch (chatContext.mode) {
      case 'client':
        return <Users className="w-4 h-4" />;
      case 'notice':
        return <AlertTriangle className="w-4 h-4" />;
      case 'vendor':
        return <User className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const handleModeChange = (mode: ChatMode, id?: string) => {
    const newContext: ChatContext = { mode };
    
    switch (mode) {
      case 'client':
        newContext.clientId = id;
        break;
      case 'notice':
        newContext.noticeId = id;
        break;
      case 'vendor':
        newContext.vendorId = id;
        break;
    }
    
    setChatContext(newContext);
    setShowModeDropdown(false);
    
    // Clear current chat when switching contexts
    if (messages.length > 0) {
      clearMessages();
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files]);
    }
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async () => {
    if (uploadedFiles.length === 0) return [];

    const uploadedDocumentIds: string[] = [];
    setUploadingFiles([...uploadedFiles]);

    try {
      for (const file of uploadedFiles) {
        const result = await uploadSingleDocument(file, {
          clientId: chatContext.clientId,
          documentType: 'other',
          tags: ['ai-chat-upload'],
          processingOptions: {
            enableOCR: true,
            enableAI: true,
            autoClassify: true,
          },
        });

        if (result.data) {
          uploadedDocumentIds.push(result.data.id);
        }
      }

      setUploadedFiles([]);
      setUploadingFiles([]);
      return uploadedDocumentIds;
    } catch (error) {
      console.error('Error uploading files:', error);
      setUploadingFiles([]);
      throw error;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0 && selectedDocuments.length === 0) || isSending) return;

    let messageContent = input.trim();
    let contextDocuments: string[] = [...selectedDocuments];

    setIsSending(true);

    try {
      // Upload files if any
      if (uploadedFiles.length > 0) {
        const uploadedIds = await handleUploadFiles();
        contextDocuments = [...contextDocuments, ...uploadedIds];
        
        // Add file context to message
        if (messageContent) {
          messageContent += '\n\n';
        }
        messageContent += `I've uploaded ${uploadedFiles.length} document(s) for analysis. Please review and provide insights.`;
      }

      // Add context information to message
      if (chatContext.mode !== 'general') {
        let contextInfo = '';
        
        switch (chatContext.mode) {
          case 'client':
            const client = clients.find(c => c.id === chatContext.clientId);
            if (client) {
              contextInfo = `\n\nContext: This question is about client "${client.name}" (${client.entity_type}, Tax Year ${client.tax_year}).`;
            }
            break;
          case 'notice':
            const notice = notices.find(n => n.id === chatContext.noticeId);
            if (notice) {
              contextInfo = `\n\nContext: This question is about IRS Notice "${notice.notice_type}"${notice.notice_number ? ` - ${notice.notice_number}` : ''}.`;
            }
            break;
          case 'vendor':
            const vendor = vendors.find(v => v.id === chatContext.vendorId);
            if (vendor) {
              contextInfo = `\n\nContext: This question is about vendor "${vendor.name}" (Total Paid: $${vendor.total_paid.toLocaleString()}, W-9 Status: ${vendor.w9_status}).`;
            }
            break;
        }
        
        if (contextInfo) {
          messageContent += contextInfo;
        }
      }

      // Add selected documents context
      if (selectedDocuments.length > 0) {
        messageContent += `\n\nPlease also consider the ${selectedDocuments.length} selected document(s) in your analysis.`;
      }

      if (!messageContent.trim()) {
        messageContent = 'Please analyze the uploaded documents and selected context.';
      }

      setInput('');

      const result = await sendMessage(messageContent, {
        clientId: chatContext.clientId,
        contextDocuments: contextDocuments.length > 0 ? contextDocuments : undefined,
      });

      if (!result.success) {
        console.error('Failed to send message:', result.error);
        setInput(messageContent);
      }
    } catch (error) {
      console.error('Error in handleSend:', error);
      setInput(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear the chat history? This cannot be undone.')) {
      const result = await clearMessages();
      if (!result.success) {
        console.error('Failed to clear chat:', result.error);
      }
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-surface to-surface-elevated">
      <TopBar title="AI Tax Assistant" />

      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      <div className="flex-1 max-w-content mx-auto w-full flex flex-col">
        {/* Chat Header with Context Selector */}
        <div className="bg-surface-elevated border-b border-border-subtle p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-text-primary">AI Tax Assistant</h2>
                <p className="text-sm text-text-tertiary">Multi-context AI guidance for tax professionals</p>
              </div>
            </div>
            
            {/* Context Mode Selector */}
            <div className="flex items-center space-x-3">
              <div className="relative" ref={modeDropdownRef}>
                <button
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  className="flex items-center space-x-2 px-4 py-2 bg-surface rounded-xl border border-border-subtle hover:border-border-light transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {getModeIcon()}
                  <span className="text-sm font-medium text-text-primary">{getModeLabel()}</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-text-tertiary transition-transform duration-200",
                    showModeDropdown && "rotate-180"
                  )} />
                </button>

                {/* Dropdown Menu */}
                {showModeDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-surface-elevated rounded-xl border border-border-subtle shadow-premium z-50">
                    <div className="p-2">
                      {/* General Mode */}
                      <button
                        onClick={() => handleModeChange('general')}
                        className={cn(
                          "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200",
                          chatContext.mode === 'general' 
                            ? "bg-primary/10 text-primary" 
                            : "hover:bg-surface-hover text-text-primary"
                        )}
                      >
                        <Sparkles className="w-4 h-4" />
                        <div>
                          <div className="font-medium">General Tax Guidance</div>
                          <div className="text-xs text-text-tertiary">General tax questions and advice</div>
                        </div>
                      </button>

                      {/* Client Mode */}
                      <div className="mt-2">
                        <div className="px-3 py-1 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                          Client Context
                        </div>
                        {clients.slice(0, 5).map(client => (
                          <button
                            key={client.id}
                            onClick={() => handleModeChange('client', client.id)}
                            className={cn(
                              "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200",
                              chatContext.mode === 'client' && chatContext.clientId === client.id
                                ? "bg-primary/10 text-primary" 
                                : "hover:bg-surface-hover text-text-primary"
                            )}
                          >
                            <Users className="w-4 h-4" />
                            <div>
                              <div className="font-medium">{client.name}</div>
                              <div className="text-xs text-text-tertiary">{client.entity_type} • {client.tax_year}</div>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Notice Mode */}

                      {/* Vendor Mode */}
                      {vendors.length > 0 && (
                        <div className="mt-2">
                          <div className="px-3 py-1 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                            Vendors
                          </div>
                          {vendors.slice(0, 3).map(vendor => (
                            <button
                              key={vendor.id}
                              onClick={() => handleModeChange('vendor', vendor.id)}
                              className={cn(
                                "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200",
                                chatContext.mode === 'vendor' && chatContext.vendorId === vendor.id
                                  ? "bg-primary/10 text-primary" 
                                  : "hover:bg-surface-hover text-text-primary"
                              )}
                            >
                              <User className="w-4 h-4" />
                              <div>
                                <div className="font-medium">{vendor.name}</div>
                                <div className="text-xs text-text-tertiary">
                                  ${vendor.total_paid.toLocaleString()} • {vendor.w9_status}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={handleClearChat}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  title="Clear chat history"
                />
              )}
            </div>
          </div>

          {/* Document Selection for Client Mode */}
          {chatContext.mode === 'client' && chatContext.clientId && clientDocuments.length > 0 && (
            <div className="mt-4 p-4 bg-surface rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-text-primary text-sm">
                  📄 Client Documents ({selectedDocuments.length} selected)
                </h4>
                {selectedDocuments.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDocuments([])}
                    className="text-text-secondary hover:text-red-600 text-xs"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                {clientDocuments.slice(0, 12).map(doc => (
                  <label
                    key={doc.id}
                    className={cn(
                      "flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-all duration-200",
                      selectedDocuments.includes(doc.id)
                        ? "bg-primary/10 border-primary/30"
                        : "bg-surface-elevated border-border-subtle hover:border-border-light"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={() => handleDocumentToggle(doc.id)}
                      className="w-3 h-3 text-primary bg-surface border-border-subtle rounded focus:ring-primary focus:ring-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{doc.original_filename}</p>
                      <p className="text-xs text-text-tertiary">{doc.document_type}</p>
                    </div>
                  </label>
                ))}
              </div>
              
              {clientDocuments.length > 12 && (
                <p className="text-xs text-text-tertiary mt-2">
                  Showing first 12 documents. Use search to find specific documents.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-surface-elevated border-b border-border-subtle p-6">
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="secondary"
                size="sm"
                icon={action.icon}
                onClick={() => handleQuickAction(action.prompt)}
                className="text-xs"
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-red-700 text-sm">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-700"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && displayMessages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-text-tertiary">Loading chat history...</p>
              </div>
            </div>
          ) : (
            displayMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-6 py-4 rounded-2xl shadow-soft ${
                  message.role === 'user'
                    ? 'bg-primary text-gray-900'
                    : 'bg-surface-elevated border border-border-subtle text-text-primary'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                
                {/* Show context information */}
                {message.context_documents && message.context_documents.length > 0 && (
                  <div className={`mt-3 pt-3 border-t ${
                    message.role === 'user' ? 'border-gray-700' : 'border-border-subtle'
                  }`}>
                    <p className={`text-xs ${
                      message.role === 'user' ? 'text-gray-700' : 'text-text-tertiary'
                    }`}>
                      📎 {message.context_documents.length} document(s) attached
                    </p>
                  </div>
                )}
                
                {message.created_at && (
                  <p className={`text-xs mt-3 ${
                    message.role === 'user' ? 'text-gray-700' : 'text-text-tertiary'
                  }`}>
                    {formatTimestamp(message.created_at)}
                  </p>
                )}
              </div>
            </div>
            ))
          )}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-surface-elevated border border-border-subtle rounded-2xl shadow-soft">
                <TypingIndicator />
              </div>
            </div>
          )}
          
          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border-subtle bg-surface-elevated p-6">
          {/* File Upload Section - Show when files are selected */}
          {(uploadedFiles.length > 0 || uploadingFiles.length > 0) && (
            <div className="mb-4 p-4 bg-surface rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-text-primary text-sm">
                  📎 Attached Files ({uploadedFiles.length + uploadingFiles.length})
                </h4>
                {uploadedFiles.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadedFiles([])}
                    className="text-text-secondary hover:text-red-600"
                  >
                    Clear All
                  </Button>
                )}
              </div>
              
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {/* Uploaded Files */}
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg border border-border-subtle">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                        <p className="text-xs text-text-tertiary">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={X}
                      onClick={() => handleRemoveFile(index)}
                      className="text-text-secondary hover:text-red-600 flex-shrink-0 ml-2"
                    />
                  </div>
                ))}
                
                {/* Uploading Files */}
                {uploadingFiles.map((file, index) => (
                  <div key={`uploading-${index}`} className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-blue-900 truncate">{file.name}</p>
                      <p className="text-xs text-blue-700">Uploading...</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Documents Display */}
          {selectedDocuments.length > 0 && (
            <div className="mb-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-text-primary text-sm">
                  📋 Selected Documents ({selectedDocuments.length})
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDocuments([])}
                  className="text-text-secondary hover:text-red-600"
                >
                  Clear Selection
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {selectedDocuments.map(docId => {
                  const doc = clientDocuments.find(d => d.id === docId);
                  return doc ? (
                    <div key={docId} className="inline-flex items-center space-x-1 bg-primary/10 text-gray-900 px-2 py-1 rounded-md text-xs font-medium">
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[120px]">{doc.original_filename}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="flex items-center space-x-3">
            {/* File Upload Button */}
            <div className="flex-shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending || isTyping || uploadingFiles.length > 0}
                className="group relative h-12 w-12 rounded-xl bg-surface-elevated border border-border-subtle hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/20"
                title="Attach documents"
              >
                <Paperclip className="w-5 h-5 text-text-tertiary group-hover:text-primary transition-colors duration-200" />
                
                {/* Upload indicator */}
                {uploadedFiles.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-gray-900 rounded-full flex items-center justify-center text-xs font-bold">
                    {uploadedFiles.length}
                  </div>
                )}
              </button>
            </div>

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Ask about ${chatContext.mode === 'general' ? 'tax questions' : getModeLabel().toLowerCase()}...`}
                className="w-full resize-none rounded-xl border border-border-subtle px-4 py-3 bg-surface-elevated text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200 disabled:opacity-50 pr-12 min-h-[48px]"
                rows={1}
                style={{ maxHeight: '120px' }}
                disabled={isSending || isTyping || uploadingFiles.length > 0}
              />
              
              {/* Context and file indicators */}
              <div className="absolute bottom-2 right-3 flex items-center space-x-2">
                {(uploadedFiles.length > 0 || selectedDocuments.length > 0) && (
                  <div className="flex items-center space-x-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                    <Paperclip className="w-3 h-3" />
                    <span className="font-medium">{uploadedFiles.length + selectedDocuments.length}</span>
                  </div>
                )}
                {input.length > 0 && (
                  <div className="text-xs text-text-tertiary">
                    {input.length}
                  </div>
                )}
              </div>
            </div>

            {/* Send Button */}
            <div className="flex-shrink-0">
              <button
                onClick={handleSend}
                disabled={(!input.trim() && uploadedFiles.length === 0 && selectedDocuments.length === 0) || isSending || isTyping || uploadingFiles.length > 0}
                className="group relative h-12 w-12 rounded-xl bg-primary text-gray-900 hover:bg-primary-hover disabled:bg-surface-elevated disabled:text-text-tertiary disabled:cursor-not-allowed shadow-soft hover:shadow-medium transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:shadow-none"
                title="Send message"
              >
                {isSending || isTyping ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                )}
                
                {/* Send indicator */}
                {(input.trim() || uploadedFiles.length > 0 || selectedDocuments.length > 0) && !isSending && !isTyping && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center space-x-4 text-xs text-text-tertiary">
              <div className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface border border-border-subtle rounded">Enter</kbd>
                <span>to send</span>
                <span className="text-text-tertiary/60">•</span>
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface border border-border-subtle rounded">Shift+Enter</kbd>
                <span>for new line</span>
              </div>
              {(uploadedFiles.length > 0 || selectedDocuments.length > 0) && (
                <span className="flex items-center space-x-1 text-primary font-medium">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>{uploadedFiles.length + selectedDocuments.length} item(s) ready</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 text-xs text-text-tertiary">
              <Badge variant="neutral" size="sm" className="capitalize">
                {chatContext.mode === 'general' ? 'General Mode' : `${chatContext.mode} Mode`}
              </Badge>
              <span className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                  error ? 'bg-red-500' : isTyping ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}></div>
                <span>{error ? 'Connection Error' : 'AI Assistant Online'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}