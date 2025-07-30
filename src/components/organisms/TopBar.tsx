import React from 'react';
import { Breadcrumb } from '../molecules/Breadcrumb';
import { Button } from '../atoms/Button';
import { Menu, Search, X, Users2, FileText, CheckSquare, AlertTriangle, User, Command } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useSearch } from '../../contexts/SearchContext';
import type { LucideIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch, SearchResult } from '../../hooks/useGlobalSearch';

interface TopBarProps {
  title: string;
  breadcrumbItems?: Array<{ label: string; href?: string }>;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  customAction?: {
    label: string;
    onClick: () => void;
    customRender: () => React.ReactNode;
  };
}

export function TopBar({ title, breadcrumbItems, action, customAction }: TopBarProps) {
  const { openSidebar } = useSidebar();
  const { openSearch } = useSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { search } = useGlobalSearch();
  const navigate = useNavigate();
  
  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showResults) return;
      
      switch (e.key) {
        case 'Escape':
          setShowResults(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => prev < results.length - 1 ? prev + 1 : 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : results.length - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            handleResultClick(results[selectedIndex]);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showResults, results, selectedIndex]);
  
  // Perform search when query changes
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      const searchResults = await search(searchQuery);
      setResults(searchResults);
      setLoading(false);
    };
    
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, search]);
  
  const handleResultClick = (result: SearchResult) => {
    navigate(result.url);
    setShowResults(false);
    setSearchQuery('');
  };
  
  const getIconForType = (type: string) => {
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
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };
  
  return (
    <div className="bg-surface-elevated/80 backdrop-blur-sm border-b border-border-subtle sticky top-0 z-30">
      <div className="max-w-content mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3">
            {/* Hamburger menu - only visible on mobile */}
            <button 
              onClick={openSidebar}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="space-y-1 sm:space-y-2">
              {breadcrumbItems && <Breadcrumb items={breadcrumbItems} />}
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-primary tracking-tight truncate">{title}</h1>
            </div>
          </div>
          
          {action && (
            <div className="flex items-center space-x-2 mt-2 sm:mt-0">
              <Button
                variant="secondary"
                size="sm"
                icon={Search}
                onClick={openSearch}
                className="hidden sm:flex items-center"
              >
                <span className="mr-1">Search</span>
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface border border-border-subtle rounded hidden sm:inline-block">⌘K</kbd>
              </Button>
              <Button
                onClick={action.onClick}
                icon={action.icon}
                className="shadow-medium text-sm sm:text-base py-1.5 sm:py-2 w-full sm:w-auto"
              >
                {action.label}
              </Button>
            </div>
          )}
          {customAction && (
            <div className="flex items-center space-x-2 mt-2 sm:mt-0">
              <Button
                variant="secondary"
                size="sm"
                icon={Search}
                onClick={openSearch}
                className="hidden sm:flex items-center"
              >
                <span className="mr-1">Search</span>
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface border border-border-subtle rounded hidden sm:inline-block">⌘K</kbd>
              </Button>
              {customAction.customRender()}
            </div>
          )}
          
          {/* Quick search button - only show when no custom action */}
          {!customAction && !action && (
            <div className="relative mt-2 sm:mt-0">
              <Button
                variant="secondary"
                size="sm"
                icon={Search}
                onClick={openSearch}
                className="w-full sm:w-auto justify-start text-text-tertiary"
              >
                <span className="mr-1">Search</span>
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface border border-border-subtle rounded hidden sm:inline-block">⌘K</kbd>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}