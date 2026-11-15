// Import the core React library along with hooks for state management, lifecycle side effects, and memoized callbacks
import { useState, useEffect, useCallback, useRef } from 'react';
import useDebounce from '../../hooks/useDebounce';
import { useRefresh } from '../../hooks/useRefresh';
// Import UI icons from lucide-react used across the students management page
import {
  // GraduationCap icon representing students and academic enrollment
  GraduationCap,
  // Plus icon indicating student creation action
  Plus,
  // UploadCloud icon for triggering the bulk spreadsheet import modal
  UploadCloud,
  // Filter icon for status filter dropdown
  Filter,
  // Green checkmark circle for active student status
  CheckCircle2,
  // Red X circle for revoked account status
  XCircle,
  // Alert circle for rejected accounts
  AlertCircle,
  // Clock icon for pending review status
  Clock,
  // Eye icon for viewing student details modal
  Eye,
  // Animated circular refresh icon for reloading list data
  RefreshCw,
// User icon alias for user avatar or profile
  User as// Power switch icon for toggling active/disabled account access
  Power,
// End of icon imports from lucide-react
} from 'lucide-react';
// Import toast notification utility for displaying alerts to the user
import { toast } from 'react-toastify';
// Import the admin service client for executing API requests to student backend endpoints
import adminService from '../../services/admin.service';
// Import the bulk spreadsheet import wizard modal component
import StudentBulkImportModal from './StudentBulkImportModal';
// Import the reusable Modal component for displaying popups and dialogs
import Modal from '../../components/ui/Modal';

// Define the functional component for managing institutional student accounts and enrollments
const StudentsManagement = () => {
  // State storing the list of student user accounts fetched from the backend
  const [students, setStudents] = useState([]);
  // State managing pagination metadata including current page, items per page, total records, and total pages
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  // State flag indicating whether data fetching is currently in progress
  const [loading, setLoading] = useState(true);
  // State storing the search query string entered by the administrator
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  // State storing the currently selected status filter (active, pending, revoked, rejected)
  const [statusFilter, setStatusFilter] = useState('');
  const activeRequestIdRef = useRef(0);

  // Modals state management
  // State controlling the visibility of the Add Individual Student modal dialog
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // State controlling the visibility of the Bulk Spreadsheet Import modal dialog
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  // State holding the currently selected student account for detailed inspection in a modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  // State controlling the visibility of the Student Details modal dialog
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  // State controlling confirmation modal for status activation / deactivation
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusTargetStudent, setStatusTargetStudent] = useState(null);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  // Add Student Form State
  // State storing the form inputs for creating an individual student account
  const [studentForm, setStudentForm] = useState({
    // Unique institutional student identification number
    studentId: '',
    // Full legal name of the student
    name: '',
    // Student date of birth formatted as YYYY-MM-DD
    dateOfBirth: '',
    // Institutional email address
    email: '',
    // Optional initial password
    password: '',
  });
  // State indicating whether the student creation form is currently submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoized callback function to fetch student accounts with pagination, search, and status filters
  const fetchStudents = useCallback(async (isManual = false) => {
    const requestId = ++activeRequestIdRef.current;
    // Wrap API call in try-catch-finally block
    try {
      // Set loading state to true only on initial/filter load
      if (!isManual) {
        setLoading(true);
      }
      // Dispatch GET request to admin service with pagination, search, and status query parameters
      const res = await adminService.getStudents({
        // Current active page number
        page: pagination.page,
        // Page size limit
        limit: pagination.limit,
        // Search filter query string
        search: debouncedSearch,
        // Status filter value
        status: statusFilter,
      });
      if (requestId === activeRequestIdRef.current) {
        // Normalize list from array response or nested data object
        const list = Array.isArray(res?.data) ? res.data : (res?.data?.data || []);
        // Update students state with fetched list
        setStudents(list);
        // Extract pagination metadata from response
        const pag = res?.pagination || res?.data?.pagination;
        // If pagination metadata exists in response, update the pagination state
        if (pag) {
          // Update pagination state with backend values
          setPagination(pag);
        }
      }
    } catch (err) {
      if (requestId === activeRequestIdRef.current) {
        // Display error notification toast with backend message or fallback text
        toast.error(err.response?.data?.message || 'Failed to load students');
      }
      throw err;
    } finally {
      if (requestId === activeRequestIdRef.current) {
        // Reset loading flag to false once network request completes
        setLoading(false);
      }
    }
  // Memoize dependency array ensuring callback refreshes only when query parameters change
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter]);

  const { isRefreshing, refresh: handleRefresh } = useRefresh(
    () => fetchStudents(true),
    { successMessage: 'Students list refreshed!' }
  );

  // Effect hook that triggers student list fetching when fetchStudents callback updates
  useEffect(() => {
    // Execute student fetch on initial component mount and upon query filter changes
    fetchStudents(false).catch(() => {});
  }, [fetchStudents]);

  // Form submit handler for executing a search query
  const handleSearchSubmit = (e) => {
    // Prevent default browser form submission reload
    e.preventDefault();
    // Reset pagination back to page 1 for new search results
    setPagination((prev) => ({ ...prev, page: 1 }));
    // Fetch students matching the updated search query
    fetchStudents();
  };

  // Handler opening status change confirmation modal
  const handleOpenStatusModal = (student) => {
    setStatusTargetStudent(student);
    setIsStatusModalOpen(true);
  };

  // Handler confirming student account active / deactivated status transition
  const handleConfirmToggleStatus = async () => {
    if (!statusTargetStudent) return;
    const student = statusTargetStudent;
    const newActiveState = !student.isActive;
    try {
      setIsStatusSubmitting(true);
      await adminService.updateStudent(student.id || student._id, {
        isActive: newActiveState,
        status: newActiveState ? 'active' : 'inactive',
      });
      toast.success(`Student ${newActiveState ? 'activated' : 'deactivated'} successfully`);
      setIsStatusModalOpen(false);
      setStatusTargetStudent(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update student status');
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  // Handler for creating an individual student account
  const handleCreateStudent = async (e) => {
    // Prevent default browser form submission
    e.preventDefault();
    // Validate that all required fields are filled in
    if (!studentForm.studentId || !studentForm.name || !studentForm.dateOfBirth || !studentForm.email) {
      // Show warning toast for missing fields
      toast.error('Please fill in all required fields (Student ID, Name, DOB, Email)');
      // Abort submission
      return;
    }

    // Wrap API call in try-catch-finally block
    try {
      // Set submitting flag to true
      setIsSubmitting(true);
      // Create a shallow copy of the student form state
      const payload = { ...studentForm };
      // If password field is empty, remove it so backend auto-generates a secure password
      if (!payload.password) delete payload.password;
      // Dispatch API request to create the student account and master record
      await adminService.createStudent(payload);
      // Display success toast upon successful student creation
      toast.success('Student account created and registered successfully');
      // Close the Add Individual Student modal dialog
      setIsAddModalOpen(false);
      // Reset form state back to initial empty values
      setStudentForm({
        // Clear student ID
        studentId: '',
        // Clear name
        name: '',
        // Clear date of birth
        dateOfBirth: '',
        // Clear email
        email: '',
        // Clear password
        password: '',
      });
      // Refresh students list to display newly created student
      fetchStudents();
    } catch (err) {
      // Display error toast notification on failure
      toast.error(err.response?.data?.message || 'Failed to create student');
    } finally {
      // Reset submitting flag to false
      setIsSubmitting(false);
    }
  };

  // Helper function to render styled status badge based on status string and isActive flag
  const getStatusBadge = (status, isActive) => {
    // If account is inactive or revoked/inactive status, render red Inactive badge
    if (!isActive || status === 'revoked' || status === 'inactive') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300">
          <XCircle className="w-3 h-3" /> Inactive
        </span>
      );
    }
    // Switch on status string for active, pending, rejected, or default badges
    switch (status) {
      // Active status case
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        );
      // Pending review status case
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
        );
      // Rejected status case
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            <AlertCircle className="w-3 h-3" /> Rejected
          </span>
        );
      // Fallback default case for any other status
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  // Render component UI
  return (
    // Outer container div with vertical spacing between sections
    <div className="space-y-6">
      {/* Page Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Title and description container */}
        <div>
          {/* Main Page Title with GraduationCap icon */}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            {/* GraduationCap icon */}
            <GraduationCap className="w-7 h-7 text-brand-primary" />
            {/* Header text */}
            Students Management
          </h1>
          {/* Subtitle guidance text */}
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage student authentication accounts, create individual enrollments, or import bulk rosters
          </p>
        </div>

        {/* Action buttons toolbar */}
        <div className="flex items-center gap-3">
          {/* Bulk Import button opening the spreadsheet import wizard modal */}
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            {/* UploadCloud icon */}
            <UploadCloud className="w-4 h-4 text-brand-primary" />
            Bulk Import (CSV/Excel)
          </button>
          {/* Add Student button opening individual creation modal */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white transition-colors flex items-center gap-1.5 shadow-xs"
          >
            {/* Plus icon */}
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="p-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Showing {pagination.total} registered student account{pagination.total !== 1 ? 's' : ''}
        </div>

        {/* Status filter dropdown and refresh button container */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Filter icon and label wrapper */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {/* Filter icon */}
            <Filter className="w-3.5 h-3.5" />
            {/* Filter title */}
            <span>Status:</span>
          </div>
          {/* Status filter dropdown select */}
          <select
            value={statusFilter}
            onChange={(e) => {
              // Update status filter state
              setStatusFilter(e.target.value);
              // Reset pagination to first page
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            {/* Dropdown options */}
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Refresh list button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            aria-label={isRefreshing ? 'Refreshing student list' : 'Refresh list'}
            title={isRefreshing ? 'Refreshing...' : 'Refresh List'}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {/* Refresh icon with conditional spin animation */}
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Students Table Container */}
      <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-xs overflow-hidden">
        {/* Horizontal scroll container for table */}
        <div className="overflow-x-auto">
          {/* Main data table for student accounts */}
          <table className="w-full text-left text-xs border-collapse">
            {/* Table headers */}
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-surface-light-border dark:border-surface-dark-border text-slate-600 dark:text-slate-400 font-semibold">
              <tr>
                {/* Column header: Student ID */}
                <th className="py-3 px-4">Student ID</th>
                {/* Column header: Full Name */}
                <th className="py-3 px-4">Full Name</th>
                {/* Column header: Email */}
                <th className="py-3 px-4">Email</th>
                {/* Column header: Status */}
                <th className="py-3 px-4">Status</th>
                {/* Column header: Account Access */}
                <th className="py-3 px-4">Account Access</th>
                {/* Column header: Actions */}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            {/* Table body */}
            <tbody className="divide-y divide-surface-light-border dark:divide-surface-dark-border text-slate-700 dark:text-slate-300">
              {/* Conditional rendering: loading skeleton */}
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={`skel-row-${r}`} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded ml-auto" /></td>
                  </tr>
                ))
              // Conditional rendering: empty state
              ) : students.length === 0 ? (
                <tr>
                  {/* Spanning cell for empty state */}
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    {/* GraduationCap icon */}
                    <GraduationCap className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No students found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search || statusFilter ? 'Try clearing your search filters' : 'Add individual students or import a CSV/Excel roster'}
                    </p>
                  </td>
                </tr>
              // Render mapped list of student accounts
              ) : (
                students.map((student) => (
                  <tr key={student.id || student._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    {/* Student ID cell */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {student.studentId || '—'}
                    </td>
                    {/* Full Name cell */}
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {student.name}
                    </td>
                    {/* Email cell */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {student.email}
                    </td>
                    {/* Status badge cell */}
                    <td className="py-3 px-4">
                      {getStatusBadge(student.status, student.isActive)}
                    </td>
                    {/* Account Access Enabled/Disabled indicator cell */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          student.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {/* Power icon */}
                        <Power className="w-3 h-3" />
                        {/* Enabled / Disabled status label */}
                        {student.isActive ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    {/* Actions cell */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View details button */}
                        <button
                          type="button"
                          onClick={() => {
                            // Store selected student in state
                            setSelectedStudent(student);
                            // Open details modal dialog
                            setIsDetailsModalOpen(true);
                          }}
                          title="View Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Toggle active / inactive status button */}
                        <button
                          type="button"
                          onClick={() => handleOpenStatusModal(student)}
                          title={student.isActive ? 'Deactivate Account' : 'Activate Account'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            student.isActive
                              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                              : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar rendered when total pages > 1 */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-light-border dark:border-surface-dark-border text-xs text-slate-500">
            {/* Student count summary */}
            <span>
              Showing {students.length} of {pagination.total} students
            </span>
            {/* Navigation buttons container */}
            <div className="flex items-center gap-2">
              {/* Previous page button */}
              <button
                type="button"
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              {/* Page indicator */}
              <span>
                Page {pagination.page} of {pagination.pages}
              </span>
              {/* Next page button */}
              <button
                type="button"
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Individual Student Modal Dialog */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Individual Student"
        maxWidth="max-w-md"
      >
        {/* Form for creating new student account */}
        <form onSubmit={handleCreateStudent} className="space-y-4">
          {/* Student ID field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Student ID *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. STU-2025-001"
                value={studentForm.studentId}
                onChange={(e) => setStudentForm({ ...studentForm, studentId: e.target.value })}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 uppercase"
              />
            </div>
          </div>

          {/* Full Name field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={studentForm.name}
              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Date of Birth field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              value={studentForm.dateOfBirth}
              onChange={(e) => setStudentForm({ ...studentForm, dateOfBirth: e.target.value })}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Institutional Email field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Institutional Email *
            </label>
            <input
              type="email"
              placeholder="e.g. john.doe@college.edu"
              value={studentForm.email}
              onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Initial Password field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial Password (Optional)
            </label>
            <input
              type="password"
              placeholder="Leave blank to auto-generate random secure password"
              value={studentForm.password}
              onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
              minLength="6"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
            {/* Helper guidance note */}
            <p className="text-[11px] text-slate-400 mt-1">
              If left blank, a secure password is automatically generated and hashed.
            </p>
          </div>

          {/* Modal action buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Cancel button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Student...' : 'Create Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Details Modal Dialog */}
      {selectedStudent && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title="Student Account Details"
          maxWidth="max-w-md"
        >
          {/* Details container */}
          <div className="space-y-3 text-xs">
            {/* Header info box with name, email, and status */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedStudent.name}</p>
                <p className="text-slate-500 font-mono">{selectedStudent.email}</p>
              </div>
              {getStatusBadge(selectedStudent.status, selectedStudent.isActive)}
            </div>

            {/* Grid of student attributes */}
            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
              {/* Student ID attribute */}
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Student ID</span>
                <p className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">{selectedStudent.studentId || 'N/A'}</p>
              </div>
              {/* Role attribute */}
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Role</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 capitalize">{selectedStudent.role}</p>
              </div>
              {/* Date of Birth attribute */}
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Date of Birth</span>
                <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedStudent.dateOfBirth ? new Date(selectedStudent.dateOfBirth).toISOString().slice(0, 10) : 'N/A'}
                </p>
              </div>
              {/* Created At attribute */}
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Created At</span>
                <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedStudent.createdAt ? new Date(selectedStudent.createdAt).toISOString().slice(0, 10) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Modal footer close button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-primary text-white"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Import Modal Dialog */}
      <StudentBulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={fetchStudents}
      />

      {/* Account Status Confirmation Modal */}
      {statusTargetStudent && (
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => !isStatusSubmitting && setIsStatusModalOpen(false)}
          title={statusTargetStudent.isActive ? 'Deactivate Student Account' : 'Activate Student Account'}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to {statusTargetStudent.isActive ? 'deactivate' : 'activate'} account access for{' '}
              <strong className="text-slate-900 dark:text-slate-100">{statusTargetStudent.name}</strong> ({statusTargetStudent.email})?
            </p>

            <div
              className={`p-3 rounded-xl border text-xs ${
                statusTargetStudent.isActive
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <strong>Notice:</strong> The account status will transition to{' '}
              <strong>{statusTargetStudent.isActive ? 'Inactive' : 'Active'}</strong>.
              {statusTargetStudent.isActive
                ? ' The student will not be permitted to authenticate until reactivated.'
                : ' The student will be permitted to authenticate and access platform resources.'}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                disabled={isStatusSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleStatus}
                disabled={isStatusSubmitting}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white ${
                  statusTargetStudent.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusTargetStudent.isActive ? 'Deactivate Account' : 'Activate Account'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// Export StudentsManagement component as default export
export default StudentsManagement;
