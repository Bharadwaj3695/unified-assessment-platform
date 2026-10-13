import { useState, useEffect, useCallback, useRef } from 'react';
import useDebounce from '../../hooks/useDebounce';
// Import UI icons from lucide-react used across the registry table, action toolbars, and modal dialogs
import {
  // Database icon representing authoritative student master registry
  Database,
  // Plus icon indicating record creation
  Plus,
  // Search icon for the search filter input
  Search,
  // Filter icon for the status filter dropdown
  Filter,
  // Checkmark circle indicating active registry status
  CheckCircle2,
  // X circle indicating inactive or suspended status
  XCircle,
  // Eye icon for inspecting record details
  Eye,
  // Animated circular refresh icon for reloading list data
  RefreshCw,
  // User plus icon for provisioning authentication account from registry
  UserPlus,
  // Trash bin icon for deleting master records
  Trash2,
// End of icon imports from lucide-react
} from 'lucide-react';
// Import toast notification utility for displaying alerts to the user
import { toast } from 'react-toastify';
// Import the admin service client for executing API requests to student registry backend endpoints
import adminService from '../../services/admin.service';
// Import the reusable Modal component for displaying popups and dialogs
import Modal from '../../components/ui/Modal';

// Define the functional component for managing institutional Student Registry master data
const StudentRegistryPage = () => {
  // State storing the list of student registry records fetched from the backend
  const [records, setRecords] = useState([]);
  // State managing pagination metadata including current page, items per page, total records, and total pages
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  // State flag indicating whether data fetching is currently in progress
  const [loading, setLoading] = useState(true);
  // State storing the search query string entered by the administrator
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  // State storing the currently selected status filter (active, inactive, suspended, graduated)
  const [statusFilter, setStatusFilter] = useState('');
  const activeRequestIdRef = useRef(0);

  // Modals state management
  // State controlling the visibility of the Add Master Record modal dialog
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // State holding the currently selected student record for detailed inspection in a modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  // State controlling the visibility of the Record Details modal dialog
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Form State for creating a new student master record
  // State storing the form input values for creating a student registry record
  const [form, setForm] = useState({
    // Unique institutional student identification number
    studentId: '',
    // Full legal name of the student
    name: '',
    // Date of birth formatted as YYYY-MM-DD
    dateOfBirth: '',
    // Official institutional email address
    email: '',
    // Initial registry status (default active)
    status: 'active',
  });
  // State indicating whether the record creation form is currently submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoized callback function to fetch student registry records with query parameters
  const fetchRecords = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    // Wrap API request in try-catch-finally block
    try {
      // Set loading state to true while fetching records
      setLoading(true);
      // Dispatch GET request to admin service with pagination, search, and status filter
      const res = await adminService.getStudentRegistry({
        // Current active page number
        page: pagination.page,
        // Page size limit
        limit: pagination.limit,
        // Search filter keyword
        search: debouncedSearch,
        // Status filter value
        status: statusFilter,
      });
      if (requestId === activeRequestIdRef.current) {
        // Normalize list from array response or nested data object
        const list = Array.isArray(res?.data) ? res.data : (res?.data?.data || []);
        // Update records state with fetched list
        setRecords(list);
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
        toast.error(err.response?.data?.message || 'Failed to load Student Registry');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        // Reset loading flag to false once network request completes
        setLoading(false);
      }
    }
  // Memoize dependency array ensuring callback refreshes only when query parameters change
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter]);

  // Effect hook that triggers record fetching when fetchRecords callback updates
  useEffect(() => {
    // Execute record fetch on initial component mount and upon query filter changes
    fetchRecords();
  }, [fetchRecords]);

  // Form submit handler for executing a search query
  const handleSearchSubmit = (e) => {
    // Prevent default browser form submission reload
    e.preventDefault();
    // Reset pagination back to page 1 for new search results
    setPagination((prev) => ({ ...prev, page: 1 }));
    // Fetch records matching the updated search query
    fetchRecords();
  };

  // Handler for creating a new student master record
  const handleCreateRecord = async (e) => {
    // Prevent default browser form submission
    e.preventDefault();
    // Validate that all required fields are present
    if (!form.studentId || !form.name || !form.dateOfBirth || !form.email) {
      // Show warning toast for missing fields
      toast.error('Student ID, Name, DOB, and Email are required');
      // Abort submission
      return;
    }

    // Wrap API call in try-catch-finally block
    try {
      // Set submitting flag to true
      setIsSubmitting(true);
      // Dispatch API request to create the student registry entry
      await adminService.createStudentRegistryRecord(form);
      // Display success toast upon successful record creation
      toast.success('Student Registry record created successfully');
      // Close the Add Master Record modal dialog
      setIsAddModalOpen(false);
      // Reset form state back to initial values
      setForm({
        // Clear student ID
        studentId: '',
        // Clear name
        name: '',
        // Clear date of birth
        dateOfBirth: '',
        // Clear email
        email: '',
        // Reset status to active
        status: 'active',
      });
      // Refresh registry record list to display newly added entry
      fetchRecords();
    } catch (err) {
      // Display error toast notification on failure
      toast.error(err.response?.data?.message || 'Failed to create registry record');
    } finally {
      // Reset submitting flag to false
      setIsSubmitting(false);
    }
  };

  // Handler for automatically provisioning an authentication user account from a student registry record
  const handleCreateUserAccount = async (record) => {
    // Wrap API call in try-catch block
    try {
      // Call service to provision user account using registry record ID
      await adminService.createAccountForStudentRegistry(record.id || record._id);
      // Show success notification informing administrator that account was provisioned
      toast.success(`User account provisioned for ${record.studentId} (${record.email})`);
      // Refresh registry list to update UI state
      fetchRecords();
    } catch (err) {
      // Show error toast notification on failure
      toast.error(err.response?.data?.message || 'Failed to create user account from registry');
    }
  };

  // Handler for toggling student record active/inactive status
  const handleToggleStatus = async (record) => {
    // Invert the status between active and inactive
    const newStatus = record.status === 'active' ? 'inactive' : 'active';
    // Wrap API call in try-catch block
    try {
      // Update record status on backend via admin service
      await adminService.updateStudentRegistryRecord(record.id || record._id, { status: newStatus });
      // Display success toast notification
      toast.success(`Registry record set to ${newStatus}`);
      // Refresh records list
      fetchRecords();
    } catch (err) {
      // Display error toast notification on failure
      toast.error(err.response?.data?.message || 'Failed to update registry status');
    }
  };

  // Handler for deleting a record from the student master registry
  const handleDelete = async (record) => {
    // Show browser confirmation modal before proceeding with deletion
    if (!window.confirm(`Are you sure you want to delete ${record.studentId} from the master registry?`)) {
      // Abort deletion if user cancels
      return;
    }
    // Wrap delete request in try-catch block
    try {
      // Send delete request using record identifier
      await adminService.deleteStudentRegistryRecord(record.id || record._id);
      // Show success toast notification
      toast.success('Registry record deleted');
      // Refresh record list
      fetchRecords();
    } catch (err) {
      // Show error toast notification on failure
      toast.error(err.response?.data?.message || 'Failed to delete registry record');
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
          {/* Main Page Title with Database icon */}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            {/* Database icon */}
            <Database className="w-7 h-7 text-brand-primary" />
            {/* Header text */}
            Student Registry (Master Data)
          </h1>
          {/* Subtitle guidance text */}
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Authoritative institutional student records used for academic verification and account provisioning
          </p>
        </div>

        {/* Action button to open Add Master Record modal */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white transition-colors flex items-center gap-1.5 shadow-xs"
        >
          {/* Plus icon */}
          <Plus className="w-4 h-4" />
          {/* Button text label */}
          Add Master Record
        </button>
      </div>

      {/* Filter and Search Bar Section */}
      <div className="p-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search query form */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          {/* Search icon inside input */}
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          {/* Search input field */}
          <input
            type="text"
            placeholder="Search by ID, name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </form>

        {/* Status filter controls and refresh button container */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Filter icon and label wrapper */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            {/* Filter icon */}
            <Filter className="w-3.5 h-3.5" />
            {/* Filter title */}
            <span>Status:</span>
          </div>
          {/* Status filter dropdown */}
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
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="graduated">Graduated</option>
          </select>

          {/* Refresh list button */}
          <button
            type="button"
            onClick={fetchRecords}
            title="Refresh List"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {/* Refresh icon with conditional spin animation */}
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Registry Table Container */}
      <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-xs overflow-hidden">
        {/* Horizontal scroll container for table */}
        <div className="overflow-x-auto">
          {/* Main data table for student records */}
          <table className="w-full text-left text-xs border-collapse">
            {/* Table headers */}
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-surface-light-border dark:border-surface-dark-border text-slate-600 dark:text-slate-400 font-semibold">
              <tr>
                {/* Column header: Student ID */}
                <th className="py-3 px-4">Student ID</th>
                {/* Column header: Full Name */}
                <th className="py-3 px-4">Full Name</th>
                {/* Column header: Date of Birth */}
                <th className="py-3 px-4">Date of Birth</th>
                {/* Column header: Email */}
                <th className="py-3 px-4">Email</th>
                {/* Column header: Status */}
                <th className="py-3 px-4">Status</th>
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
                    <td className="py-3.5 px-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded ml-auto" /></td>
                  </tr>
                ))
              // Conditional rendering: empty state
              ) : records.length === 0 ? (
                <tr>
                  {/* Spanning cell for empty state */}
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    {/* Database icon */}
                    <Database className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No registry records found</p>
                    <p className="text-xs text-slate-400 mt-1">Add student identity master data to verify applicants</p>
                  </td>
                </tr>
              // Render mapped list of student records
              ) : (
                records.map((r) => (
                  <tr key={r.id || r._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    {/* Student ID cell */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{r.studentId}</td>
                    {/* Name cell */}
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{r.name}</td>
                    {/* Formatted Date of Birth cell */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {r.dateOfBirth ? (typeof r.dateOfBirth === 'string' ? r.dateOfBirth.slice(0, 10) : new Date(r.dateOfBirth).toISOString().slice(0, 10)) : '—'}
                    </td>
                    {/* Email cell */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">{r.email}</td>
                    {/* Status Badge cell */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    {/* Action buttons cell */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Provision user account button */}
                        <button
                          type="button"
                          onClick={() => handleCreateUserAccount(r)}
                          title="Provision User Account"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        {/* View record details button */}
                        <button
                          type="button"
                          onClick={() => {
                            // Store selected record in state
                            setSelectedRecord(r);
                            // Open details modal dialog
                            setIsDetailsModalOpen(true);
                          }}
                          title="View Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Toggle active status button */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(r)}
                          title={r.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            r.status === 'active'
                              ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                              : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          {r.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        {/* Delete record button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          title="Delete Record"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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
            {/* Record count summary */}
            <span>
              Showing {records.length} of {pagination.total} records
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

      {/* Add Record Modal Dialog */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Student Registry Record"
        maxWidth="max-w-md"
      >
        {/* Form for creating new student master record */}
        <form onSubmit={handleCreateRecord} className="space-y-4">
          {/* Student ID field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Student ID *
            </label>
            <input
              type="text"
              placeholder="e.g. STU-2025-001"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 uppercase"
            />
          </div>

          {/* Full Name field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
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
              placeholder="e.g. rahul.sharma@college.edu"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Registry Status dropdown field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Registry Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="graduated">Graduated</option>
            </select>
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
              {isSubmitting ? 'Creating Record...' : 'Create Registry Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Details Modal Dialog */}
      {selectedRecord && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title="Student Registry Master Record"
          maxWidth="max-w-md"
        >
          {/* Details container */}
          <div className="space-y-3 text-xs">
            {/* Header info box with name, email, and status */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedRecord.name}</p>
                <p className="text-slate-500 font-mono">{selectedRecord.email}</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {selectedRecord.status}
              </span>
            </div>

            {/* Grid with Student ID and Date of Birth attributes */}
            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
              {/* Student ID attribute box */}
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Student ID</span>
                <p className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">{selectedRecord.studentId}</p>
              </div>
              {/* Date of Birth attribute box */}
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Date of Birth</span>
                <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedRecord.dateOfBirth ? (typeof selectedRecord.dateOfBirth === 'string' ? selectedRecord.dateOfBirth.slice(0, 10) : new Date(selectedRecord.dateOfBirth).toISOString().slice(0, 10)) : 'N/A'}
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
    </div>
  );
};

// Export StudentRegistryPage as the default component export
export default StudentRegistryPage;
