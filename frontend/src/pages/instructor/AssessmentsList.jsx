import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import assessmentService from '../../services/assessment.service';
import InstructorSearchBar from '../../components/instructor/InstructorSearchBar';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import {
  BookOpen,
  PlusCircle,
  Clock,
  Award,
  Globe,
  Lock,
  Edit,
  Trash2,
  Eye,
  Send,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Users,
  Search,
  BarChart2,
} from 'lucide-react';

const AssessmentsList = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Modals
  const [previewModal, setPreviewModal] = useState({ isOpen: false, assessment: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, assessment: null, isDeleting: false });
  const [publishModal, setPublishModal] = useState({ isOpen: false, assessment: null, isPublishing: false });

  const loadAssessments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await assessmentService.getAssessments({ limit: 100 });
      const list = res.data || res.assessments || [];
      setAssessments(list);
    } catch (err) {
      setError(err.message || 'Failed to retrieve assessments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  // Filter assessments
  const filteredAssessments = assessments.filter((asmt) => {
    if (statusFilter !== 'all' && asmt.status !== statusFilter) return false;
    if (accessFilter !== 'all' && asmt.accessType !== accessFilter) return false;
    if (dateFilter !== 'all') {
      const createdAt = asmt.createdAt ? new Date(asmt.createdAt).getTime() : 0;
      const now = Date.now();
      if (dateFilter === 'recent' && now - createdAt > 48 * 60 * 60 * 1000) return false;
      if (dateFilter === 'last_week' && now - createdAt > 7 * 24 * 60 * 60 * 1000) return false;
      if (dateFilter === 'last_month' && now - createdAt > 30 * 24 * 60 * 60 * 1000) return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = asmt.title?.toLowerCase().includes(term);
      const matchCategory = asmt.category?.toLowerCase().includes(term);
      const matchDesc = asmt.description?.toLowerCase().includes(term);
      if (!matchTitle && !matchCategory && !matchDesc) return false;
    }
    return true;
  });

  const handleDelete = async () => {
    if (!deleteModal.assessment) return;
    try {
      setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
      await assessmentService.deleteAssessment(deleteModal.assessment._id || deleteModal.assessment.id);
      toast.success('Assessment and questions deleted successfully.');
      setDeleteModal({ isOpen: false, assessment: null, isDeleting: false });
      loadAssessments();
    } catch (err) {
      toast.error(err.message || 'Failed to delete assessment.');
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const handlePublish = async () => {
    if (!publishModal.assessment) return;
    try {
      setPublishModal((prev) => ({ ...prev, isPublishing: true }));
      const asmtId = publishModal.assessment._id || publishModal.assessment.id;
      await assessmentService.updateAssessment(asmtId, { status: 'published' });
      toast.success(`"${publishModal.assessment.title}" is now published live!`);
      setPublishModal({ isOpen: false, assessment: null, isPublishing: false });
      loadAssessments();
    } catch (err) {
      toast.error(err.message || 'Failed to publish assessment.');
      setPublishModal((prev) => ({ ...prev, isPublishing: false }));
    }
  };

  const openPreview = async (asmt) => {
    try {
      const detailed = await assessmentService.getAssessmentById(asmt._id || asmt.id);
      setPreviewModal({ isOpen: true, assessment: detailed });
    } catch (err) {
      setPreviewModal({ isOpen: true, assessment: asmt });
    }
  };

  return (
    <div className="space-y-6">
      {/* Prominent Workspace Search Bar (Requirement 6) */}
      <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-4 sm:p-5 shadow-sm">
        <InstructorSearchBar
          placeholder="Search course assessments, questions, students, or submissions..."
          onSelectAssessment={(asmt) => navigate(`/instructor/edit/${asmt._id || asmt.id}`)}
        />
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Badge variant="sage" size="sm" dot>
              My Assessments
            </Badge>
            <span className="text-xs text-slate-400">· Question Banks & Examinations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Course Assessments
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Author, configure, publish, and monitor your academic examinations and quizzes.
          </p>
        </div>

        <Link to="/instructor/create">
          <Button variant="primary" size="md" icon={PlusCircle}>
            Create Assessment
          </Button>
        </Link>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-warm-xs">
        {/* Status Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Statuses' },
            { id: 'published', label: 'Published' },
            { id: 'draft', label: 'Drafts' },
            { id: 'archived', label: 'Archived' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#E05D38] text-white shadow-warm-xs'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Access Type, Date Filter & Search Controls */}
        <div className="flex items-center space-x-2">
          <select
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all"
          >
            <option value="all">All Access Types</option>
            <option value="public">Public Only</option>
            <option value="restricted">Restricted Only</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all"
          >
            <option value="all">All Dates</option>
            <option value="recent">Recent (48 hrs)</option>
            <option value="last_week">Last Week</option>
            <option value="last_month">Last Month</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter list..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] placeholder-[#64748B]/60 focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Table / List */}
      <Card>
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <Spinner size="md" />
            <p className="mt-3 text-xs text-slate-500">Loading your assessments...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 text-sm">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
            {error}
          </div>
        ) : filteredAssessments.length === 0 ? (
          <EmptyState
            title="No assessments found"
            description={
              searchTerm || statusFilter !== 'all' || accessFilter !== 'all' || dateFilter !== 'all'
                ? 'No assessments match the selected search or filter criteria.'
                : 'You have not authored any assessments yet.'
            }
            actionLabel={
              searchTerm || statusFilter !== 'all' || accessFilter !== 'all' || dateFilter !== 'all'
                ? 'Clear Filters'
                : 'Create First Assessment'
            }
            onAction={
              searchTerm || statusFilter !== 'all' || accessFilter !== 'all' || dateFilter !== 'all'
                ? () => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setAccessFilter('all');
                    setDateFilter('all');
                  }
                : () => navigate('/instructor/create')
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Assessment</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Access</TableHeader>
                <TableHeader>Duration</TableHeader>
                <TableHeader>Weight</TableHeader>
                <TableHeader>Last Modified</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAssessments.map((asmt) => {
                const asmtId = asmt._id || asmt.id;
                const isDraft = asmt.status === 'draft';
                const isPublished = asmt.status === 'published';
                const isRestricted = asmt.accessType === 'restricted';
                const qCount = asmt.questions?.length || 0;

                return (
                  <TableRow key={asmtId}>
                    {/* Title & Category */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="font-semibold text-[#1F2937] dark:text-[#F9FAFB] block hover:text-[#E05D38] cursor-pointer transition-colors" onClick={() => openPreview(asmt)}>
                          {asmt.title}
                        </span>
                        <div className="flex items-center space-x-2 text-xs text-[#64748B]">
                          <span className="font-medium text-[#64748B] dark:text-[#94A3B8]">{asmt.category || 'General'}</span>
                          <span>·</span>
                          <span>{qCount} Questions</span>
                          <span>·</span>
                          <span>Pass: {asmt.passingScore || 60}%</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <Badge
                        variant={isPublished ? 'sage' : isDraft ? 'peach' : 'neutral'}
                        size="sm"
                        dot
                      >
                        {asmt.status}
                      </Badge>
                    </TableCell>

                    {/* Access Type Badge */}
                    <TableCell>
                      <div className="flex items-center space-x-1.5">
                        {isRestricted ? (
                          <Badge variant="terracotta" size="sm">
                            <Lock className="w-3 h-3 mr-1" />
                            Restricted ({asmt.assignedStudents?.length || 0})
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            <Globe className="w-3 h-3 mr-1" />
                            Public
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Duration */}
                    <TableCell className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      <div className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-[#E05D38]" />
                        {asmt.durationMinutes} mins
                      </div>
                    </TableCell>

                    {/* Points Weight */}
                    <TableCell className="text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB]">
                      {asmt.totalPoints || 100} pts
                    </TableCell>

                    {/* Last Modified Date */}
                    <TableCell className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {new Date(asmt.updatedAt || asmt.createdAt).toLocaleDateString()}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Analytics */}
                        <Link to={`/instructor/analytics/${asmtId}`}>
                          <button
                            type="button"
                            className="p-1.5 text-[#3B82F6] hover:text-[#2563EB] rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                            title="Assessment Analytics"
                          >
                            <BarChart2 className="w-4 h-4" />
                          </button>
                        </Link>

                        {/* Preview */}
                        <button
                          type="button"
                          onClick={() => openPreview(asmt)}
                          className="p-1.5 text-[#64748B] hover:text-[#1F2937] dark:hover:text-[#F9FAFB] rounded-xl hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] transition-colors cursor-pointer"
                          title="Preview Assessment"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <Link to={`/instructor/edit/${asmtId}`}>
                          <button
                            type="button"
                            className="p-1.5 text-[#E05D38] hover:text-[#C84E2D] rounded-xl hover:bg-[#FDECE2] dark:hover:bg-[#341C16] transition-colors cursor-pointer"
                            title="Edit Assessment"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </Link>

                        {/* Quick Publish if draft */}
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => setPublishModal({ isOpen: true, assessment: asmt, isPublishing: false })}
                            className="p-1.5 text-[#3D8A78] hover:text-[#2D6A5B] rounded-xl hover:bg-[#EAF4F1] dark:hover:bg-[#132A24] transition-colors cursor-pointer"
                            title="Publish Live"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeleteModal({ isOpen: true, assessment: asmt, isDeleting: false })}
                          className="p-1.5 text-red-500 hover:text-red-700 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                          title="Delete Assessment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Delete Confirmation Modal (Requirement 5) */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, assessment: null, isDeleting: false })}
        title="Delete Assessment"
      >
        <div className="space-y-4">
          <div className="flex items-start space-x-3 text-red-600">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to permanently delete <strong>"{deleteModal.assessment?.title}"</strong>?
              This will remove all associated questions and student draft attempts.
            </p>
          </div>
          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModal({ isOpen: false, assessment: null, isDeleting: false })}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={deleteModal.isDeleting}
              onClick={handleDelete}
            >
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Publish Confirmation Modal */}
      <Modal
        isOpen={publishModal.isOpen}
        onClose={() => setPublishModal({ isOpen: false, assessment: null, isPublishing: false })}
        title="Publish Assessment"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you ready to publish <strong>"{publishModal.assessment?.title}"</strong>?
            Students with access will immediately be able to see and attempt this examination.
          </p>
          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPublishModal({ isOpen: false, assessment: null, isPublishing: false })}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={publishModal.isPublishing}
              onClick={handlePublish}
            >
              Confirm & Publish
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Assessment Modal */}
      <Modal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, assessment: null })}
        title={previewModal.assessment?.title || 'Assessment Preview'}
      >
        {previewModal.assessment && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={previewModal.assessment.status === 'published' ? 'success' : 'warning'}>
                {previewModal.assessment.status}
              </Badge>
              <Badge variant={previewModal.assessment.accessType === 'restricted' ? 'sage' : 'neutral'}>
                {previewModal.assessment.accessType || 'public'}
              </Badge>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 dark:text-slate-300">
                {previewModal.assessment.durationMinutes} mins
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 dark:text-slate-300">
                {previewModal.assessment.totalPoints} total points
              </span>
            </div>

            {previewModal.assessment.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 p-3 bg-slate-50 dark:bg-surface-dark-muted rounded-xl">
                {previewModal.assessment.description}
              </p>
            )}

            {previewModal.assessment.accessType === 'restricted' && (
              <div className="p-3 bg-brand-sage-light/20 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-brand-sage-dark dark:text-brand-sage-light flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1" />
                  Assigned Students ({previewModal.assessment.assignedStudents?.length || 0})
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {previewModal.assessment.assignedStudents?.map((s) => (
                    <span key={s._id || s.id || s} className="px-2 py-0.5 rounded bg-white dark:bg-surface-dark text-[11px] border border-surface-light-border dark:border-surface-dark-border">
                      {s.name || s.email || s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Questions ({previewModal.assessment.questions?.length || 0})
              </h5>
              <div className="space-y-3">
                {previewModal.assessment.questions?.map((q, idx) => (
                  <div key={q._id || q.id || idx} className="p-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-semibold">
                      <span>#{idx + 1} ({q.points || 5} pts)</span>
                      <Badge variant="secondary" size="sm">{q.type}</Badge>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200">{q.questionText}</p>
                    {q.type === 'mcq' && q.options && (
                      <div className="space-y-1 pl-2 pt-1">
                        {q.options.map((opt) => (
                          <div
                            key={opt.id}
                            className={`px-2 py-1 rounded text-[11px] ${
                              q.correctAnswer === opt.id
                                ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {opt.id === q.correctAnswer ? '✓ ' : '• '} {opt.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AssessmentsList;
