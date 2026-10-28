import { useState, useEffect, useCallback, useRef } from 'react';
import useDebounce from '../../hooks/useDebounce';
import { useRefresh } from '../../hooks/useRefresh';
// Import UI icons from lucide-react used across the table, action buttons, and status badges
import {
  // Icon representing a book or official master registry catalog
  BookOpen,
  // Icon for adding a new master record
  Plus,
  // Icon for refreshing data or indicating a loading spinner
  RefreshCw,
  // Icon for presenting alert and error messages
  AlertCircle,
// End of icon imports from lucide-react
} from 'lucide-react';
// Import toast notification utility for displaying alerts to the user
import { toast } from 'react-toastify';
// Import the admin service client for making API requests to backend administrative endpoints
import adminService from '../../services/admin.service';
// Import the reusable Modal component for displaying popups and dialogs
import Modal from '../../components/ui/Modal';

// Define the functional component for managing institutional Faculty Registry master data
const FacultyRegistryPage = () => {
  // State storing the list of faculty registry records fetched from the backend
  const [records, setRecords] = useState([]);
  // State managing pagination metadata including current page, items per page, total count, and total pages
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  // State flag indicating whether data fetching is currently in progress
  const [loading, setLoading] = useState(true);
  // State storing error message if data fetching fails
  const [error, setError] = useState(null);
  // State storing the search text entered by the user
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  // State storing the currently selected status filter (active, inactive, or all)
  const [statusFilter, setStatusFilter] = useState('');
  const activeRequestIdRef = useRef(0);

  // Modals state management
  // State controlling the visibility of the Add Faculty Record modal dialog
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // State holding the currently selected faculty record for detailed viewing
  const [selectedRecord, setSelectedRecord] = useState(null);
  // State controlling the visibility of the Record Details modal dialog
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Form State for creating a new faculty registry record
  // State holding the input values for the faculty record creation form
  const [form, setForm] = useState({
    // Unique institutional faculty identification number or code
    facultyId: '',
    // Full legal name of the faculty member
    name: '',
    // Official institutional email address
    email: '',
    // Default active status for the new record
    status: 'active',
  });
  // State indicating whether the record creation form is currently submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoized callback function to fetch faculty registry records with pagination, search, and status filters
  const fetchRecords = useCallback(async (isManual = false) => {
    const requestId = ++activeRequestIdRef.current;
    // Wrap API call in try-catch-finally block to handle errors and loading state
    try {
      // Set loading state to true only on initial/filter load
      if (!isManual) {
        setLoading(true);
      }
      setError(null);
      // Send GET request to backend via admin service with query parameters
      const res = await adminService.getFacultyRegistry({
        // Current active page number
        page: pagination.page,
        // Number of records per page
        limit: pagination.limit,
        // Active search filter keyword
        search: debouncedSearch,
        // Active status filter value
        status: statusFilter,
      });
      if (requestId === activeRequestIdRef.current) {
        // Normalize response list from array or nested data property
        const list = Array.isArray(res?.data) ? res.data : (res?.data?.data || []);
        // Update records state with the fetched list
        setRecords(list);
        // Extract pagination metadata from response
        const rawPag = res?.pagination || res?.data?.pagination;
        // If pagination metadata exists in response, update the pagination state
        if (rawPag) {
          setPagination({
            page: rawPag.currentPage || rawPag.page || 1,
            limit: rawPag.perPage || rawPag.limit || 10,
            total: rawPag.totalCount !== undefined ? rawPag.totalCount : (rawPag.total !== undefined ? rawPag.total : 0),
            pages: rawPag.totalPages || rawPag.pages || 1,
          });
        }
      }
    } catch (err) {
      if (requestId === activeRequestIdRef.current) {
        // Display error notification toast with message from backend or fallback text
        const errMsg = err.response?.data?.message || 'Failed to load Faculty Registry';
        setError(errMsg);
        toast.error(errMsg);
      }
      throw err;
    } finally {
      if (requestId === activeRequestIdRef.current) {
        // Set loading state to false once request completes
        setLoading(false);
      }
    }
  // Memoize dependency array ensuring fetchRecords recreates only when query params change
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter]);

  const { isRefreshing, refresh: handleRefresh } = useRefresh(
    () => fetchRecords(true),
    { successMessage: 'Faculty registry refreshed!' }
  );

  // Effect hook that triggers record fetching when fetchRecords callback updates
  useEffect(() => {
    // Invoke fetchRecords to load records on mount and upon filter changes
    fetchRecords(false).catch(() => {});
  }, [fetchRecords]);

  // Form submit handler for executing a search query
  const handleSearchSubmit = (e) => {
    // Prevent the default browser form submission reload
    e.preventDefault();
    // Reset pagination to first page when initiating a new search
    setPagination((prev) => ({ ...prev, page: 1 }));
    // Fetch records matching the updated search query
    fetchRecords();
  };

  // Handler for creating a new faculty master registry record
  const handleCreateRecord = async (e) => {
    // Prevent default form submission behavior
    e.preventDefault();
    // Validate that required fields (facultyId, name, email) are not blank
    if (!form.facultyId || !form.name || !form.email) {
      // Notify user of missing required fields
      toast.error('Faculty ID, Name, and Email are required');
      // Abort submission
      return;
    }

    // Attempt creation with backend API
    try {
      // Set submitting flag to true to disable form buttons
      setIsSubmitting(true);
      // Dispatch API request to create the faculty registry entry
      await adminService.createFacultyRegistryRecord(form);
      // Display success toast notification upon successful creation
      toast.success('Faculty Registry record created successfully');
      // Close the modal dialog
      setIsAddModalOpen(false);
      // Reset form fields back to default empty state
      setForm({
        // Reset faculty ID
        facultyId: '',
        // Reset name
        name: '',
        // Reset email
        email: '',
        // Reset status to active
        status: 'active',
      });
      // Refresh registry record list to include newly created entry
      fetchRecords();
    } catch (err) {
      // Display error toast notification if creation fails
      toast.error(err.response?.data?.message || 'Failed to create faculty registry record');
    } finally {
      // Reset submitting flag to false
      setIsSubmitting(false);
    }
  };

  // Handler for toggling faculty record active/inactive status
  const handleToggleStatus = async (record) => {
    // Calculate inverted status value based on current record status
    const newStatus = record.status === 'active' ? 'inactive' : 'active';
    // Wrap status update API call in try-catch block
    try {
      // Update record status on backend via admin service
      await adminService.updateFacultyRegistryRecord(record.id || record._id, { status: newStatus });
      // Show success notification confirming new status
      toast.success(`Faculty record status set to ${newStatus}`);
      // Refresh list to display updated status badge
      fetchRecords();
    } catch (err) {
      // Show error toast notification if status update fails
      toast.error(err.response?.data?.message || 'Failed to update registry status');
    }
  };

  // Handler for deleting a record from the master registry
  const handleDelete = async (record) => {
    // Display browser confirmation dialog to prevent accidental deletion
    if (!window.confirm(`Are you sure you want to delete ${record.facultyId} from the master registry?`)) {
      // Return early if the user cancels confirmation
      return;
    }
    // Proceed with deletion API call
    try {
      // Call delete endpoint using record ID
      await adminService.deleteFacultyRegistryRecord(record.id || record._id);
      // Show success toast notification
      toast.success('Faculty record deleted');
      // Refresh records list
      fetchRecords();
    } catch (err) {
      // Show error toast notification on failure
      toast.error(err.response?.data?.message || 'Failed to delete faculty record');
    }
  };

  // Render component UI
  return (
    // Outer container div with vertical spacing between sections
    <div className="space-y-6">
      {/* Page Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Header Title and Description column */}
        <div>
          {/* Main Page Title with BookOpen icon */}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            {/* Lucide BookOpen icon representing faculty master data */}
            <BookOpen className="w-7 h-7 text-brand-primary" />
            {/* Header text heading */}
            Faculty Registry
          </h1>
          {/* Subtitle description providing context about institutional master data */}
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Authoritative institutional faculty records for staff identity verification and account provisioning
          </p>
        </div>

        {/* Action button to open Add Faculty Record modal */}
        <button
          /* Specify standard button type to avoid unwanted form submissions */
          type="button"
          /* Open the add faculty record modal dialog on click */
          onClick={() => setIsAddModalOpen(true)}
          /* Button styling classes for background, text color, padding, and hover states */
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white transition-colors flex items-center gap-1.5 shadow-xs"
        >
          {/* Plus icon indicating addition action */}
          <Plus className="w-4 h-4" />
          {/* Button label text */}
          Add Faculty Record
        </button>
      </div>

      {/* Filter Section */}
      <div className="p-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Showing {pagination.total} institutional faculty record{pagination.total !== 1 ? 's' : ''}
        </div>

        {/* Controls container for filter dropdown and refresh button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status filter dropdown select */}
          <select
            /* Bound to statusFilter state */
            value={statusFilter}
            /* Change handler updating statusFilter and resetting page to 1 */
            onChange={(e) => {
              /* Update status filter state */
              setStatusFilter(e.target.value);
              /* Reset pagination page to 1 */
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            /* Accessible label for screen readers */
            aria-label="Filter by status"
            /* Dropdown styling classes */
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            {/* Option for displaying all records regardless of status */}
            <option value="">All Status</option>
            {/* Option to filter by active records */}
            <option value="active">Active</option>
            {/* Option to filter by inactive records */}
            <option value="inactive">Inactive</option>
          </select>

          {/* Refresh button to re-fetch the records list */}
          <button
            /* Button element type */
            type="button"
            /* Click handler calling handleRefresh */
            onClick={handleRefresh}
            /* Disabled during active refresh */
            disabled={isRefreshing}
            /* Accessibility attributes */
            aria-busy={isRefreshing}
            aria-label={isRefreshing ? 'Refreshing faculty registry' : 'Refresh list'}
            /* Tooltip text on hover */
            title={isRefreshing ? 'Refreshing...' : 'Refresh List'}
            /* Button styling classes */
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {/* Refresh icon with conditional spin animation when refreshing */}
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Registry Table Container */}
      <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-xs overflow-hidden">
        {/* Horizontal scroll container for responsive table display */}
        <div className="overflow-x-auto">
          {/* Main data table for faculty records */}
          <table className="w-full text-left text-xs border-collapse">
            {/* Table header row */}
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-surface-light-border dark:border-surface-dark-border text-slate-600 dark:text-slate-400 font-semibold">
              {/* Header columns */}
              <tr>
                {/* Column for Faculty ID */}
                <th className="py-3 px-4">Faculty ID</th>
                {/* Column for Full Name */}
                <th className="py-3 px-4">Full Name</th>
                {/* Column for Institutional Email */}
                <th className="py-3 px-4">Email</th>
                {/* Column for Status */}
                <th className="py-3 px-4">Status</th>
                {/* Column for Action Buttons */}
                <th className="py-3 px-4 text-right min-w-[220px]">Actions</th>
              </tr>
            </thead>
            {/* Table body */}
            <tbody className="divide-y divide-surface-light-border dark:divide-surface-dark-border text-slate-700 dark:text-slate-300">
              {/* Conditional render: Show skeleton rows when loading is true */}
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={`skel-row-${r}`} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                        <div className="h-6 w-18 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                        <div className="h-6 w-14 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              /* Conditional render: Show error state message if data fetching fails */
              ) : error ? (
                /* Table row for error state */
                <tr>
                  {/* Spanning cell across all 5 columns */}
                  <td colSpan="5" className="py-12 text-center text-rose-500">
                    <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-400 dark:text-rose-500" />
                    <p className="font-semibold text-rose-600 dark:text-rose-400">{error}</p>
                    <p className="text-xs text-slate-400 mt-1">An error occurred while loading faculty records</p>
                    <button
                      type="button"
                      onClick={fetchRecords}
                      className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-300 transition-colors inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry
                    </button>
                  </td>
                </tr>
              /* Conditional render: Show empty state message if no records returned */
              ) : records.length === 0 ? (
                /* Table row for empty state */
                <tr>
                  {/* Spanning cell across all 5 columns */}
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    {/* Empty state illustration icon */}
                    <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    {/* Primary empty state text */}
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No faculty records found</p>
                    {/* Subtext prompt to add records */}
                    <p className="text-xs text-slate-400 mt-1">Add faculty staff master data to get started</p>
                  </td>
                </tr>
              /* Render mapped list of records */
              ) : (
                /* Map over each record in the records array */
                records.map((r) => (
                  /* Data row with unique key from record identifier */
                  <tr key={r.id || r._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    {/* Faculty ID cell with monospace bold styling */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{r.facultyId}</td>
                    {/* Faculty Name cell */}
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{r.name}</td>
                    {/* Email cell with monospace styling */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">{r.email}</td>
                    {/* Status Badge cell */}
                    <td className="py-3 px-4">
                      {/* Badge span with conditional color styling based on active/inactive status */}
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {/* Display status text */}
                        {r.status}
                      </span>
                    </td>
                    {/* Actions cell containing interactive action buttons */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Named View button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecord(r);
                            setIsDetailsModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:text-brand-primary dark:hover:text-brand-primary transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        >
                          View
                        </button>

                        {/* Toggle active/inactive status button */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(r)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 ${
                            r.status === 'active'
                              ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 focus:ring-amber-500/20'
                              : 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 focus:ring-emerald-500/20'
                          }`}
                        >
                          {r.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>

                        {/* Delete record button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-800/60 bg-red-50/60 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls Section rendered only if total pages > 1 */}
        {pagination.pages > 1 && (
          /* Pagination bar container */
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-light-border dark:border-surface-dark-border text-xs text-slate-500">
            {/* Record count summary text */}
            <span>
              Showing {records.length} of {pagination.total} records
            </span>
            {/* Page navigation controls wrapper */}
            <div className="flex items-center gap-2">
              {/* Previous page button */}
              <button
                /* Set button type */
                type="button"
                /* Decrease current page number by 1, clamped to minimum 1 */
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                /* Disable button if already on first page */
                disabled={pagination.page <= 1}
                /* Button styling classes */
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              {/* Current page indicator */}
              <span>
                Page {pagination.page} of {pagination.pages}
              </span>
              {/* Next page button */}
              <button
                /* Set button type */
                type="button"
                /* Increase current page number by 1, clamped to max pages */
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                /* Disable button if already on the last page */
                disabled={pagination.page >= pagination.pages}
                /* Button styling classes */
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
        /* Modal visibility controlled by isAddModalOpen state */
        isOpen={isAddModalOpen}
        /* Close handler resetting modal open state */
        onClose={() => setIsAddModalOpen(false)}
        /* Modal title header */
        title="Add Faculty Registry Record"
        /* Max width constraint */
        maxWidth="max-w-md"
      >
        {/* Form for entering new faculty master registry data */}
        <form onSubmit={handleCreateRecord} className="space-y-4">
          {/* Faculty ID Input Field Group */}
          <div>
            {/* Input label for Faculty ID */}
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Faculty ID *
            </label>
            {/* Text input for Faculty ID */}
            <input
              /* Input type text */
              type="text"
              /* Placeholder example */
              placeholder="e.g. FAC-2025-01"
              /* Controlled value from form state */
              value={form.facultyId}
              /* Update form state on change */
              onChange={(e) => setForm({ ...form, facultyId: e.target.value })}
              /* Mark field as required */
              required
              /* Input styling classes with uppercase transformation */
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 uppercase"
            />
          </div>

          {/* Full Name Input Field Group */}
          <div>
            {/* Input label for Full Name */}
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            {/* Text input for Full Name */}
            <input
              /* Input type text */
              type="text"
              /* Placeholder example */
              placeholder="e.g. Prof. Alan Turing"
              /* Controlled value from form state */
              value={form.name}
              /* Update form state on change */
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              /* Mark field as required */
              required
              /* Input styling classes */
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Institutional Email Input Field Group */}
          <div>
            {/* Input label for Institutional Email */}
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Institutional Email *
            </label>
            {/* Email input field */}
            <input
              /* Input type email */
              type="email"
              /* Placeholder example */
              placeholder="e.g. alan.turing@college.edu"
              /* Controlled value from form state */
              value={form.email}
              /* Update form state on change */
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              /* Mark field as required */
              required
              /* Input styling classes */
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Registry Status Dropdown Field Group */}
          <div>
            {/* Input label for Registry Status */}
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Registry Status
            </label>
            {/* Select dropdown for record status */}
            <select
              /* Controlled value from form state */
              value={form.status}
              /* Update form state on selection change */
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              /* Dropdown styling classes */
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            >
              {/* Option for active status */}
              <option value="active">Active</option>
              {/* Option for inactive status */}
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Modal Action Buttons Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Cancel button */}
            <button
              /* Standard button type */
              type="button"
              /* Close modal on click */
              onClick={() => setIsAddModalOpen(false)}
              /* Button styling classes */
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            {/* Submit button to create record */}
            <button
              /* Form submit button type */
              type="submit"
              /* Disable button during form submission */
              disabled={isSubmitting}
              /* Button styling classes */
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              {/* Conditional button label during submission */}
              {isSubmitting ? 'Creating Record...' : 'Create Registry Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Details Modal Dialog */}
      {selectedRecord && (
        /* Modal component displaying detailed information of selected record */
        <Modal
          /* Modal visibility controlled by isDetailsModalOpen state */
          isOpen={isDetailsModalOpen}
          /* Close handler resetting details modal open state */
          onClose={() => setIsDetailsModalOpen(false)}
          /* Modal title header */
          title="Faculty Registry Master Record"
          /* Max width constraint */
          maxWidth="max-w-md"
        >
          {/* Container for record detail fields */}
          <div className="space-y-3 text-xs">
            {/* Header card displaying Name, Email, and Status badge */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {/* Name and email text wrapper */}
              <div>
                {/* Faculty full name */}
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedRecord.name}</p>
                {/* Faculty institutional email */}
                <p className="text-slate-500 font-mono">{selectedRecord.email}</p>
              </div>
              {/* Status badge pill */}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {selectedRecord.status}
              </span>
            </div>

            {/* Grid displaying Faculty ID and Status attributes */}
            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
              {/* Faculty ID attribute box */}
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                {/* Field label */}
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Faculty ID</span>
                {/* Field value in bold monospace font */}
                <p className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">{selectedRecord.facultyId}</p>
              </div>
              {/* Status attribute box */}
              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
                {/* Field label */}
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Status</span>
                {/* Field value formatted capitalized */}
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 capitalize">{selectedRecord.status}</p>
              </div>
            </div>

            {/* Footer with Close button */}
            <div className="pt-2 flex justify-end">
              {/* Close button */}
              <button
                /* Button element type */
                type="button"
                /* Close details modal on click */
                onClick={() => setIsDetailsModalOpen(false)}
                /* Button styling classes */
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

// Export FacultyRegistryPage component as the default export of this module
export default FacultyRegistryPage;
