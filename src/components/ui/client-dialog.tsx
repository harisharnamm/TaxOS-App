import React, { useState } from 'react';
import { User, Mail, Phone, Building, Calendar, FileText, Receipt, CreditCard, Banknote, AlertTriangle, FileCheck, CheckCircle, X, Tag } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { cn } from '../../lib/utils';

interface ClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clientData: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    category: string;
    taxYear: number;
    entityType: string;
    requiredDocuments: string[];
  }) => Promise<void>;
  loading?: boolean;
}

const documentTypes = [
  {
    id: 'w2',
    name: 'W-2 Forms',
    description: 'Wage and tax statements from employers',
    icon: FileText,
    category: 'income'
  },
  {
    id: '1099',
    name: '1099 Forms',
    description: 'Miscellaneous income statements',
    icon: Receipt,
    category: 'income'
  },
  {
    id: 'bank_statement',
    name: 'Bank Statements',
    description: 'Monthly bank account statements',
    icon: CreditCard,
    category: 'financial'
  },
  {
    id: 'receipt',
    name: 'Business Receipts',
    description: 'Receipts for business expenses',
    icon: Receipt,
    category: 'expenses'
  },
  {
    id: 'invoice',
    name: 'Invoices',
    description: 'Business invoices and billing documents',
    icon: FileCheck,
    category: 'business'
  },
  {
    id: 'irs_notice',
    name: 'IRS Notices',
    description: 'Letters and notices from the IRS',
    icon: AlertTriangle,
    category: 'compliance'
  },
  {
    id: 'w9',
    name: 'W-9 Forms',
    description: 'Vendor tax identification forms',
    icon: FileText,
    category: 'vendor'
  },
  {
    id: 'other',
    name: 'Other Documents',
    description: 'Additional tax-related documents',
    icon: FileText,
    category: 'other'
  }
];

const clientCategories = [
  { id: 'saas', name: 'SaaS', description: 'Software as a Service companies' },
  { id: 'real_estate', name: 'Real Estate', description: 'Real estate agencies and property management' },
  { id: 'non_profit', name: 'Non Profit', description: 'Non-profit organizations and charities' },
  { id: 'ecommerce', name: 'eCommerce', description: 'Online retail and e-commerce businesses' },
  { id: 'consulting', name: 'Consulting', description: 'Professional consulting services' },
  { id: 'healthcare', name: 'Healthcare', description: 'Medical practices and healthcare providers' },
  { id: 'manufacturing', name: 'Manufacturing', description: 'Manufacturing and production companies' },
  { id: 'retail', name: 'Retail', description: 'Brick and mortar retail businesses' },
  { id: 'restaurant', name: 'Restaurant', description: 'Food service and hospitality' },
  { id: 'construction', name: 'Construction', description: 'Construction and contracting services' },
  { id: 'professional_services', name: 'Professional Services', description: 'Legal, accounting, and other professional services' },
  { id: 'technology', name: 'Technology', description: 'Technology companies and IT services' },
  { id: 'other', name: 'Other', description: 'Other business types' }
];

const categories = [
  { id: 'income', name: '📊 Income Documents', color: 'emerald' },
  { id: 'financial', name: '💳 Financial Records', color: 'blue' },
  { id: 'expenses', name: '🧾 Business Expenses', color: 'amber' },
  { id: 'business', name: '📋 Business Documents', color: 'purple' },
  { id: 'compliance', name: '⚠️ Tax Compliance', color: 'red' },
  { id: 'vendor', name: '👥 Vendor Forms', color: 'indigo' },
  { id: 'other', name: '📄 Other Documents', color: 'gray' }
];

export function ClientDialog({ isOpen, onClose, onSubmit, loading = false }: ClientDialogProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    taxYear: new Date().getFullYear(),
    entityType: 'individual'
  });
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Client name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.taxYear < 2020 || formData.taxYear > new Date().getFullYear() + 1) {
      newErrors.taxYear = 'Please enter a valid tax year';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a client category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleSubmit = async () => {
    try {
      await onSubmit({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        category: formData.category,
        taxYear: formData.taxYear,
        entityType: formData.entityType,
        requiredDocuments: selectedDocuments
      });
      
      // Reset form on success
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        category: '',
        taxYear: new Date().getFullYear(),
        entityType: 'individual'
      });
      setSelectedDocuments([]);
      setErrors({});
      setStep(1);
      onClose();
    } catch (error) {
      console.error('Failed to create client:', error);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      category: '',
      taxYear: new Date().getFullYear(),
      entityType: 'individual'
    });
    setSelectedDocuments([]);
    setErrors({});
    setStep(1);
    onClose();
  };

  const getCategoryDocuments = (category: string) => {
    return documentTypes.filter(doc => doc.category === category);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-surface-elevated rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full h-full sm:h-auto sm:max-h-[95vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-border-subtle">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Add New Client</h2>
              <p className="text-text-tertiary text-sm">
                {step === 1 ? 'Enter client information and details' : 'Select required documents for this client'}
              </p>
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

        {/* Progress indicator */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 bg-surface border-b border-border-subtle">
          <div className="flex items-center space-x-4">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200",
              step >= 1 ? "bg-primary text-gray-900" : "bg-surface-elevated text-text-tertiary border border-border-subtle"
            )}>
              1
            </div>
            <div className={cn(
              "flex-1 h-2 rounded-full transition-all duration-300",
              step >= 2 ? "bg-primary" : "bg-surface-elevated border border-border-subtle"
            )} />
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200",
              step >= 2 ? "bg-primary text-gray-900" : "bg-surface-elevated text-text-tertiary border border-border-subtle"
            )}>
              2
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs font-medium text-text-secondary">Details</span>
            <span className="text-xs font-medium text-text-secondary">Documents</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Client Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-primary">Client Name *</label>
                <div className="relative">
                  <Input
                    placeholder="Enter client name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={loading}
                    className="pl-12"
                  />
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                </div>
                {errors.name && (
                  <p className="text-sm text-red-600 font-medium">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-primary">Email Address *</label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={loading}
                    className="pl-12"
                  />
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 font-medium">{errors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-primary">Phone Number</label>
                <div className="relative">
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={loading}
                    className="pl-12"
                  />
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-primary">Address</label>
                <div className="relative">
                  <textarea
                    placeholder="Enter client address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    disabled={loading}
                    rows={3}
                    className="w-full px-4 py-3 pl-12 bg-surface-elevated border border-border-subtle rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200 resize-none"
                  />
                  <Building className="absolute left-4 top-3 w-4 h-4 text-text-tertiary" />
                </div>
              </div>

              {/* Tax Year and Entity Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-primary">Tax Year *</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="2020"
                      max={new Date().getFullYear() + 1}
                      value={formData.taxYear}
                      onChange={(e) => handleInputChange('taxYear', parseInt(e.target.value))}
                      disabled={loading}
                      className="pl-12"
                    />
                    <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  </div>
                  {errors.taxYear && (
                    <p className="text-sm text-red-600 font-medium">{errors.taxYear}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-primary">Entity Type</label>
                  <select
                    value={formData.entityType}
                    onChange={(e) => handleInputChange('entityType', e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-surface-elevated border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200"
                  >
                    <option value="individual">Individual</option>
                    <option value="llc">LLC</option>
                    <option value="corporation">Corporation</option>
                    <option value="s_corp">S Corporation</option>
                    <option value="partnership">Partnership</option>
                  </select>
                </div>
              </div>

              {/* Client Category */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-text-primary">Business Category *</label>
                <p className="text-xs text-text-tertiary mb-3">
                  Select the category that best describes your client's business type
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clientCategories.map(category => {
                    const isSelected = formData.category === category.id;
                    
                    return (
                      <div
                        key={category.id}
                        onClick={() => handleInputChange('category', category.id)}
                        className={cn(
                          "cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-medium",
                          isSelected 
                            ? "border-primary bg-primary/5 shadow-soft" 
                            : "border-border-subtle hover:border-border-light bg-surface-elevated"
                        )}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={cn(
                            "p-2 rounded-lg transition-all duration-200",
                            isSelected 
                              ? "bg-primary text-gray-900" 
                              : "bg-surface group-hover:bg-surface-hover"
                          )}>
                            <Tag className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-semibold text-sm text-text-primary">{category.name}</h5>
                            <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{category.description}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {errors.category && (
                  <p className="text-sm text-red-600 font-medium">{errors.category}</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-4 sm:p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Required Documents</h3>
                  <p className="text-sm text-text-tertiary mb-6">
                    Select the types of documents you'll need from this client for their tax preparation.
                  </p>
                </div>

                <div className="space-y-8">
                  {categories.map(category => {
                    const categoryDocs = getCategoryDocuments(category.id);
                    if (categoryDocs.length === 0) return null;

                    return (
                      <div key={category.id} className="space-y-4">
                        <h4 className="font-semibold text-text-primary text-sm uppercase tracking-wide">
                          {category.name}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {categoryDocs.map(doc => {
                            const Icon = doc.icon;
                            const isSelected = selectedDocuments.includes(doc.id);
                            
                            return (
                              <div
                                key={doc.id}
                                onClick={() => handleDocumentToggle(doc.id)}
                                className={cn(
                                  "relative cursor-pointer rounded-xl border p-4 hover:shadow-medium transition-all duration-200 group",
                                  isSelected 
                                    ? "border-primary bg-primary/5 shadow-soft" 
                                    : "border-border-subtle hover:border-border-light bg-surface-elevated"
                                )}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className={cn(
                                    "p-2 rounded-lg transition-all duration-200",
                                    isSelected 
                                      ? "bg-primary text-gray-900" 
                                      : "bg-surface group-hover:bg-surface-hover"
                                  )}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-semibold text-sm text-text-primary">{doc.name}</h5>
                                    <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{doc.description}</p>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedDocuments.length > 0 && (
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                    <h4 className="font-semibold text-sm text-text-primary mb-3">
                      Selected Documents ({selectedDocuments.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedDocuments.map(docId => {
                        const doc = documentTypes.find(d => d.id === docId);
                        return doc ? (
                          <span
                            key={docId}
                            className="inline-flex items-center px-3 py-1 rounded-lg bg-primary text-gray-900 text-xs font-semibold"
                          >
                            {doc.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-t border-border-subtle bg-surface">
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-auto sm:min-w-[100px]"
              >
                Cancel
              </Button>
              
              
              {step === 2 && (
                <Button
                  variant="secondary"
                  onClick={handleBack}
                  disabled={loading}
                  className="w-full sm:w-auto sm:min-w-[100px]"
                >
                  ← Back
                </Button>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
              {step === 1 && (
                <Button
                  onClick={handleNext}
                  disabled={loading}
                  className="w-full sm:w-auto shadow-medium sm:min-w-[180px] bg-primary text-gray-900 hover:bg-primary-hover"
                >
                  Next: Select Documents →
                </Button>
              )}
              
              {step === 2 && (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full sm:w-auto shadow-medium sm:min-w-[140px] bg-primary text-gray-900 hover:bg-primary-hover"
                >
                  {loading ? 'Creating...' : '✓ Create Client'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}