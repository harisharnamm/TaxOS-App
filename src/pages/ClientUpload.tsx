import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface DocumentRequest {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description?: string;
  document_types: string[];
  due_date: string;
  upload_token: string;
  clients?: {
    name: string;
    email: string;
  };
  document_request_items?: {
    id: string;
    document_name: string;
    status: 'pending' | 'uploaded';
    uploaded_document_id?: string;
    uploaded_at?: string;
  }[];
}

const ClientUpload: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [request, setRequest] = useState<DocumentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>('');

  console.log('ClientUpload component rendered');
  console.log('Raw token from URL:', token);
  
  // Decode the token if it's URL encoded
  const decodedToken = token ? decodeURIComponent(token) : '';
  console.log('Decoded token:', decodedToken);

  useEffect(() => {
    if (!decodedToken) {
      setMessage('Invalid Link: Upload token is missing');
      setLoading(false);
      return;
    }

    loadDocumentRequest();
  }, [decodedToken]);

  const loadDocumentRequest = async () => {
    try {
      console.log('Loading document request for token:', decodedToken);
      const { data, error } = await supabase
        .from('document_requests')
        .select(`
          *,
          clients(name, email),
          document_request_items(*)
        `)
        .eq('upload_token', decodedToken)
        .single();

      console.log('Database response:', { data, error });

      if (error || !data) {
        setMessage('Document request not found or link has expired');
        return;
      }

      setRequest(data);
      console.log('Request loaded:', data);
    } catch (error: any) {
      console.error('Error loading document request:', error);
      setMessage('Failed to load document request');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, itemId: string) => {
    if (!request) return;

    setUploading(true);
    setMessage('');

    try {
      console.log('Uploading file:', file.name);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `client-uploads/${request.id}/${fileName}`;
      
      console.log('Generated filename:', fileName);
      console.log('File path:', filePath);

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      console.log('File uploaded to storage:', uploadData);

      // Create document record
      const documentDataToInsert = {
        user_id: request.user_id,
        client_id: request.client_id,
        filename: fileName, // Use the generated filename
        original_filename: file.name,
        storage_path: filePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        document_type: 'other',
        processing_status: 'pending',
        uploaded_via_token: true,
        upload_token: decodedToken
      };
      
      console.log('Document data to insert:', documentDataToInsert);
      
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert(documentDataToInsert)
        .select()
        .single();

      if (documentError) {
        throw documentError;
      }

      console.log('Document record created:', documentData);

      // Update document request item
      const { error: updateError } = await supabase
        .from('document_request_items')
        .update({
          status: 'uploaded',
          uploaded_document_id: documentData.id,
          uploaded_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (updateError) {
        throw updateError;
      }

      setMessage(`${file.name} uploaded successfully!`);
      
      // Reload request data to show updated status
      await loadDocumentRequest();

    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage(`Failed to upload ${file.name}: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, itemId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document request...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Document Request Not Found</h1>
          <p className="text-gray-600">{message || 'The link may have expired or the request may have been removed.'}</p>
        </div>
      </div>
    );
  }

  const completedCount = request.document_request_items?.filter(item => item.status === 'uploaded').length || 0;
  const totalCount = request.document_request_items?.length || 0;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.includes('successfully') 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Document Upload</h1>
              <p className="mt-2 text-gray-600">
                Request: <span className="font-semibold">{request.title}</span>
              </p>
              {request.clients && (
                <p className="text-gray-600">
                  For: <span className="font-semibold">{request.clients.name}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Due Date</div>
              <div className="font-semibold text-gray-900">
                {new Date(request.due_date).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Upload Progress</span>
              <span>{completedCount} of {totalCount} documents uploaded</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Description */}
        {request.description && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-gray-600">{request.description}</p>
          </div>
        )}

        {/* Document List */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Required Documents</h2>
          
          <div className="space-y-4">
            {request.document_request_items?.map((item) => (
              <div 
                key={item.id} 
                className={`border-2 border-dashed rounded-lg p-6 ${
                  item.status === 'uploaded' 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.document_name}</h3>
                    <p className="text-sm text-gray-500">
                      {item.status === 'uploaded' ? 'Document uploaded successfully' : 'Please upload this document'}
                    </p>
                  </div>
                  
                  <div className="ml-4">
                    {item.status === 'uploaded' ? (
                      <div className="flex items-center text-green-600">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Uploaded</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                          {uploading ? 'Uploading...' : 'Choose File'}
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, item.id)}
                            disabled={uploading}
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Completion Message */}
          {progressPercentage === 100 && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-green-800 font-medium">
                  All documents have been uploaded successfully!
                </span>
              </div>
              <p className="text-green-700 text-sm mt-1">
                Thank you for submitting your documents. We will review them and get back to you soon.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>This is a secure document upload portal for TaxOS</p>
          <p>If you have any questions, please contact your tax professional</p>
        </div>
      </div>
    </div>
  );
};

export default ClientUpload;