import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, Tag, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Badge } from '../atoms/Badge';

interface ClientNote {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface EditNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (noteData: {
    title: string;
    content: string;
    category: string;
    priority: 'low' | 'medium' | 'high';
    tags: string[];
  }) => Promise<void>;
  note: ClientNote | null;
  loading?: boolean;
}

const noteCategories = [
  { id: 'general', name: 'General', description: 'General client notes and observations', icon: FileText, color: 'blue' },
  { id: 'tax_planning', name: 'Tax Planning', description: 'Tax planning strategies and recommendations', icon: CheckCircle, color: 'green' },
  { id: 'compliance', name: 'Compliance', description: 'Compliance issues and requirements', icon: AlertTriangle, color: 'red' },
  { id: 'communication', name: 'Communication', description: 'Client communication logs', icon: Info, color: 'purple' },
  { id: 'meeting', name: 'Meeting Notes', description: 'Meeting summaries and action items', icon: Calendar, color: 'amber' },
  { id: 'document', name: 'Document Notes', description: 'Document-related notes and issues', icon: FileText, color: 'indigo' }
];

const priorities = [
  { id: 'low', name: 'Low Priority', color: 'gray', description: 'General information, no urgency' },
  { id: 'medium', name: 'Medium Priority', color: 'blue', description: 'Important but not urgent' },
  { id: 'high', name: 'High Priority', color: 'red', description: 'Urgent attention required' }
];

export function EditNoteDialog({ isOpen, onClose, onSubmit, note, loading = false }: EditNoteDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    priority: 'medium' as 'low' | 'medium' | 'high',
    tagsInput: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form data when note changes
  useEffect(() => {
    if (note) {
      setFormData({
        title: note.title,
        content: note.content,
        category: note.category,
        priority: note.priority,
        tagsInput: note.tags.join(', ')
      });
    }
  }, [note]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Note title is required';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Note content is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const tags = formData.tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await onSubmit({
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        priority: formData.priority,
        tags
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const getCategoryColor = (color: string) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200 text-blue-700',
      green: 'bg-green-50 border-green-200 text-green-700',
      red: 'bg-red-50 border-red-200 text-red-700',
      purple: 'bg-purple-50 border-purple-200 text-purple-700',
      amber: 'bg-amber-50 border-amber-200 text-amber-700',
      indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      gray: 'bg-gray-50 border-gray-200 text-gray-700'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getPriorityColor = (color: string) => {
    const colors = {
      gray: 'bg-gray-50 border-gray-200 text-gray-700',
      blue: 'bg-blue-50 border-blue-200 text-blue-700',
      red: 'bg-red-50 border-red-200 text-red-700'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  if (!isOpen || !note) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-surface-elevated rounded-xl sm:rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-border-subtle">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 rounded-xl">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Edit Note</h2>
              <p className="text-text-tertiary text-sm">Update note information</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6">
            {/* Note Title */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-text-primary">Note Title *</label>
              <Input
                placeholder="Enter note title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                disabled={loading}
                error={errors.title}
              />
            </div>

            {/* Note Content */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-text-primary">Note Content *</label>
              <textarea
                placeholder="Enter your note content..."
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                disabled={loading}
                rows={6}
                className={`w-full px-4 py-3 bg-surface-elevated border border-border-subtle rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200 resize-none ${
                  errors.content ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''
                }`}
              />
              {errors.content && (
                <p className="text-sm text-red-600 font-medium" role="alert">
                  {errors.content}
                </p>
              )}
            </div>

            {/* Category Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-text-primary">Category</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {noteCategories.map(category => {
                  const Icon = category.icon;
                  const isSelected = formData.category === category.id;
                  
                  return (
                    <div
                      key={category.id}
                      onClick={() => handleInputChange('category', category.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-medium ${
                        isSelected 
                          ? `${getCategoryColor(category.color)} border-current shadow-soft` 
                          : "border-border-subtle hover:border-border-light bg-surface-elevated"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg transition-all duration-200 ${
                          isSelected 
                            ? "bg-white/50" 
                            : "bg-surface"
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{category.name}</h4>
                          <p className="text-xs mt-1 opacity-75">{category.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Priority Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-text-primary">Priority Level</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {priorities.map(priority => {
                  const isSelected = formData.priority === priority.id;
                  
                  return (
                    <div
                      key={priority.id}
                      onClick={() => handleInputChange('priority', priority.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-medium text-center ${
                        isSelected 
                          ? `${getPriorityColor(priority.color)} border-current shadow-soft` 
                          : "border-border-subtle hover:border-border-light bg-surface-elevated"
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-semibold text-sm">{priority.name}</span>
                      </div>
                      <p className="text-xs opacity-75">{priority.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-text-primary">Tags (Optional)</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <Input
                  placeholder="Enter tags separated by commas"
                  value={formData.tagsInput}
                  onChange={(e) => handleInputChange('tagsInput', e.target.value)}
                  disabled={loading}
                  className="pl-12"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 p-4 sm:p-6 border-t border-border-subtle bg-surface">
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-auto sm:min-w-[100px]"
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                disabled={loading || !formData.title.trim() || !formData.content.trim()}
                className="w-full sm:w-auto shadow-medium sm:min-w-[140px] bg-primary text-gray-900 hover:bg-primary-hover"
              >
                {loading ? 'Updating...' : '✓ Update Note'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}