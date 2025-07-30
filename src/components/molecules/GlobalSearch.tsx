import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  X, 
  Clock, 
  Users2, 
  FileText, 
  CheckSquare, 
  AlertTriangle, 
  User,
  Loader2
} from 'lucide-react';
import { Input } from '../atoms/Input';
import { Button } from '../atoms/Button';
import { useGlobalSearch, SearchResult, SearchResultType } from '../../hooks/useGlobalSearch';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { search, results, loading, recentSearches, clearRecentSearches } = useGlobalSearch();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Handle debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery) {
      search(debouncedQuery);
    }
  }, [debouncedQuery, search]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < results.length + recentSearches.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : results.length + recentSearches.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            if (selectedIndex < results.length) {
              handleResultClick(results[selectedIndex]);
            } else {
              const recentIndex = selectedIndex - results.length;
              if (recentIndex >= 0 && recentIndex < recentSearches.length) {
                setQuery(recentSearches[recentIndex]);
                search(recentSearches[recentIndex]);
              }
            }
          } else if (query && results.length > 0) {
            handleResultClick(results[0]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, recentSearches, query, onClose, search]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const selectedElement = resultsContainerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url);
    onClose();
  };

  const getIconForType = (type: SearchResultType) => {
    switch (type) {
      case 'client':
        return <Users2 className="w-4 h-4 text-blue-600" />;
      case 'document':
        return <FileText className="w-4 h-4 text-emerald-600" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-amber-600" />;
      case 'vendor':
        return <User className="w-4 h-4 text-purple-600" />;
      case 'irs_notice':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-text-tertiary" />;
    }
  };

  const getTypeLabel = (type: SearchResultType) => {
    switch (type) {
      case 'client':
        return 'Client';
      case 'document':
        return 'Document';
      case 'task':
        return 'Task';
      case 'vendor':
        return 'Vendor';
      case 'irs_notice':
        return 'IRS Notice';
      default:
        return type;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 flex items-start justify-center pt-16 pb-20">
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="relative bg-surface-elevated rounded-2xl shadow-premium border border-border-subtle max-w-2xl w-full mx-auto"
        >
          {/* Search Input */}
          <div className="p-4 border-b border-border-subtle">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                ref={inputRef}
                placeholder="Search for clients, documents, tasks..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 pr-10 py-3 text-base"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Search Results */}
          <div 
            ref={resultsContainerRef}
            className="max-h-[60vh] overflow-y-auto"
          >
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                <p className="text-text-tertiary">Searching...</p>
              </div>
            ) : query ? (
              results.length > 0 ? (
                <div className="py-2">
                  <div className="px-4 py-2">
                    <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                      Search Results
                    </h3>
                  </div>
                  
                  <div className="space-y-1">
                    {results.map((result, index) => (
                      <div
                        key={`${result.type}-${result.id}`}
                        data-index={index}
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${
                          selectedIndex === index ? 'bg-primary/10' : 'hover:bg-surface-hover'
                        }`}
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-lg ${
                            selectedIndex === index ? 'bg-primary/20' : 'bg-surface'
                          }`}>
                            {getIconForType(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-text-primary truncate">{result.title}</h4>
                              <span className="text-xs text-text-tertiary ml-2 flex-shrink-0">
                                {getTypeLabel(result.type)}
                              </span>
                            </div>
                            {result.description && (
                              <p className="text-sm text-text-secondary line-clamp-1 mt-1">
                                {result.description}
                              </p>
                            )}
                            {result.date && (
                              <p className="text-xs text-text-tertiary mt-1">
                                {formatDate(result.date)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <FileText className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                  <p className="text-text-primary font-medium">No results found</p>
                  <p className="text-text-tertiary text-sm mt-1">Try a different search term</p>
                </div>
              )
            ) : recentSearches.length > 0 ? (
              <div className="py-2">
                <div className="px-4 py-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Recent Searches
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearRecentSearches}
                    className="text-xs text-text-tertiary hover:text-text-primary"
                  >
                    Clear
                  </Button>
                </div>
                
                <div className="space-y-1">
                  {recentSearches.map((term, index) => (
                    <div
                      key={`recent-${index}`}
                      data-index={results.length + index}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${
                        selectedIndex === results.length + index ? 'bg-primary/10' : 'hover:bg-surface-hover'
                      }`}
                      onClick={() => {
                        setQuery(term);
                        search(term);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          selectedIndex === results.length + index ? 'bg-primary/20' : 'bg-surface'
                        }`}>
                          <Clock className="w-4 h-4 text-text-tertiary" />
                        </div>
                        <span className="text-text-primary">{term}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <Search className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                <p className="text-text-primary font-medium">Search across your entire account</p>
                <p className="text-text-tertiary text-sm mt-1">Find clients, documents, tasks, and more</p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-border-subtle bg-surface">
            <div className="flex items-center justify-between text-xs text-text-tertiary">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-surface border border-border-subtle rounded">↑</kbd>
                  <kbd className="px-1.5 py-0.5 font-mono bg-surface border border-border-subtle rounded">↓</kbd>
                  <span>to navigate</span>
                </div>
                <div className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-surface border border-border-subtle rounded">Enter</kbd>
                  <span>to select</span>
                </div>
                <div className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-surface border border-border-subtle rounded">Esc</kbd>
                  <span>to close</span>
                </div>
              </div>
              <div>
                <span>Press <kbd className="px-1.5 py-0.5 font-mono bg-surface border border-border-subtle rounded">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 font-mono bg-surface border border-border-subtle rounded">K</kbd> to search</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}