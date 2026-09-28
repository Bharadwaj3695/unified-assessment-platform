import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import questionImportService from '../../services/questionImport.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import {
  UploadCloud,
  FileText,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Database,
  HelpCircle,
} from 'lucide-react';

const QuestionImportUpload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'google-forms'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Google Forms state
  const [formsUrl, setFormsUrl] = useState('');
  const [formsToken, setFormsToken] = useState('');
  const [isImportingForms, setIsImportingForms] = useState(false);

  // Jobs state
  const [jobs, setJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  const loadJobs = useCallback(async () => {
    try {
      setIsLoadingJobs(true);
      const res = await questionImportService.getJobs();
      const list = res.data || res.jobs || [];
      setJobs(list);
    } catch {
      // ignore
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    // Poll active jobs every 5 seconds if any job is processing
    const interval = setInterval(() => {
      loadJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.docx', '.doc'].includes(ext)) {
      toast.error('Only PDF, DOC, or DOCX document formats are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File exceeds maximum size of 10MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a document to upload.');
      return;
    }

    try {
      setIsUploading(true);
      const res = await questionImportService.importFile(selectedFile);
      toast.success(res.message || 'File uploaded! Processing questions...');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadJobs();
      if (res.jobId) {
        // Navigate directly to review page after brief processing pause
        setTimeout(() => {
          navigate(`/instructor/question-import/review/${res.jobId}`);
        }, 1200);
      }
    } catch (err) {
      toast.error(err.message || 'Document upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImportForms = async (e) => {
    e.preventDefault();
    if (!formsUrl.trim()) {
      toast.error('Please enter a valid Google Form URL or ID.');
      return;
    }

    try {
      setIsImportingForms(true);
      const res = await questionImportService.importGoogleForms({
        formsUrlOrId: formsUrl.trim(),
        accessToken: formsToken.trim() || undefined,
      });
      toast.success(res.message || 'Google Forms import initiated!');
      setFormsUrl('');
      setFormsToken('');
      loadJobs();
      if (res.jobId) {
        setTimeout(() => {
          navigate(`/instructor/question-import/review/${res.jobId}`);
        }, 1200);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to import Google Form.');
    } finally {
      setIsImportingForms(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REVIEW_REQUIRED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Review Required</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Completed</span>;
      case 'PROCESSING':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200 animate-pulse">Processing...</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">Failed</span>;
      case 'QUEUED':
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Queued</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UploadCloud className="w-7 h-7 text-primary-600" />
            Intelligent Question Import Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Extract questions from existing academic PDFs, Word documents, or Google Forms with AI classification and mandatory faculty review.
          </p>
        </div>
        <div>
          <Link
            to="/instructor/question-bank"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            <Database className="w-4 h-4" />
            View Question Bank
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button
          onClick={() => setActiveTab('file')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'file'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Document Upload (PDF / DOCX)
        </button>
        <button
          onClick={() => setActiveTab('google-forms')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'google-forms'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          Google Forms Import
        </button>
      </div>

      {/* Tab 1: File Upload */}
      {activeTab === 'file' && (
        <Card className="p-8">
          <form onSubmit={handleUploadFile} className="space-y-6">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-primary-500 bg-primary-50/40'
                  : 'border-slate-300 hover:border-primary-400 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileSelect}
                className="hidden"
              />
              <UploadCloud className="w-12 h-12 text-primary-600 mx-auto mb-3" />
              {selectedFile ? (
                <div>
                  <p className="font-semibold text-slate-800 text-base">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for processing
                  </p>
                  <span className="inline-block mt-3 text-xs text-primary-600 font-medium underline">
                    Click to choose a different file
                  </span>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-slate-800 text-base">
                    Click to browse or drag & drop document here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supported formats: PDF, DOCX, DOC (up to 10MB)
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Our parser automatically identifies question headers, numbered options, answer keys, and points.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <span>Questions remain in pending review status until you explicitly approve them.</span>
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedFile || isUploading}
                className="flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Spinner size="sm" />
                    <span>Extracting Questions...</span>
                  </>
                ) : (
                  <>
                    <span>Extract & Review Questions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 2: Google Forms Import */}
      {activeTab === 'google-forms' && (
        <Card className="p-8">
          <form onSubmit={handleImportForms} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Google Form URL or Form ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formsUrl}
                onChange={(e) => setFormsUrl(e.target.value)}
                placeholder="https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform"
                className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Paste the full share link or edit link of your Google Form.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                OAuth Access Token (Optional)
              </label>
              <input
                type="text"
                value={formsToken}
                onChange={(e) => setFormsToken(e.target.value)}
                placeholder="Bearer token (leave blank if platform Google OAuth is configured or form is public)"
                className="w-full p-2.5 border border-slate-300 rounded-md text-sm font-mono text-xs"
              />
              <p className="text-xs text-slate-400 mt-1">
                Optional: If your institution requires restricted-domain Google Workspace authentication.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Maps Radio / Checkbox to MCQ, Short / Paragraph text to Short / Long Answer.</span>
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={!formsUrl.trim() || isImportingForms}
                className="flex items-center gap-2"
              >
                {isImportingForms ? (
                  <>
                    <Spinner size="sm" />
                    <span>Connecting & Parsing Form...</span>
                  </>
                ) : (
                  <>
                    <span>Import from Google Forms</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Recent Import Jobs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500" />
            Recent Import Jobs
          </h2>
          <button
            onClick={loadJobs}
            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {isLoadingJobs && jobs.length === 0 ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : jobs.length === 0 ? (
          <Card className="p-8 text-center text-slate-500 text-sm">
            No question import jobs yet. Upload a document or import a Google Form above to get started.
          </Card>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Detected</th>
                  <th className="p-3.5">Review Progress</th>
                  <th className="p-3.5">Created</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {jobs.map((job) => (
                  <tr key={job._id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">
                        {job.sourceFilename || job.sourceType}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Type: {job.sourceType}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="p-3.5 font-medium text-slate-800">
                      {job.totalDetected || 0} questions
                    </td>
                    <td className="p-3.5">
                      <div className="text-slate-700 font-medium">
                        <span className="text-emerald-700">{job.totalAccepted || 0} accepted</span> •{' '}
                        <span className="text-red-700">{job.totalRejected || 0} rejected</span>
                      </div>
                      <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className="bg-primary-600 h-1.5 rounded-full transition-all"
                          style={{
                            width: `${
                              job.totalDetected > 0
                                ? Math.min(100, Math.round(((job.totalAccepted + job.totalRejected) / job.totalDetected) * 100))
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right">
                      {job.status === 'REVIEW_REQUIRED' || job.status === 'COMPLETED' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/instructor/question-import/review/${job._id}`)}
                          className="text-primary-600 border-primary-200 hover:bg-primary-50 text-xs"
                        >
                          Review Questions
                        </Button>
                      ) : job.status === 'FAILED' ? (
                        <span className="text-xs text-red-600 font-medium">
                          {job.errors?.[0] || 'Extraction failed'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Processing...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionImportUpload;
