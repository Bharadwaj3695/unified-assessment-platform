// Import the core React library along with hooks for local component state and DOM reference access
import { useState, useRef } from 'react';
// Import UI icons from lucide-react used across the bulk import wizard steps
import {
  // Cloud upload icon for the file dropzone area
  UploadCloud,
  // Spreadsheet icon representing CSV or Excel workbook files
  FileSpreadsheet,
  // Checkmark circle indicating valid rows or successful completion
  CheckCircle2,
  // Triangle warning icon indicating duplicate records detected
  AlertTriangle,
  // Circle X icon indicating invalid or errored rows
  XCircle,
  // Download icon for templates and error reports
  Download,
  // Right arrow icon for next step transitions and primary actions
  ArrowRight,
  // Left arrow icon for returning to preceding wizard step
  ArrowLeft,
  // Close X icon for dismiss buttons
  X,
  // Animated circular loader icon during network processing
  Loader2,
// End of icon imports from lucide-react
} from 'lucide-react';
// Import toast notification utility for displaying alerts to the user
import { toast } from 'react-toastify';
// Import admin service client for executing bulk preview and confirmation API endpoints
import adminService from '../../services/admin.service';

// Define the functional component for bulk importing students from spreadsheets
const StudentBulkImportModal = ({ isOpen, onClose, onSuccess }) => {
  // State tracking the current wizard step (1: Upload, 2: Preview, 3: Processing, 4: Result)
  const [step, setStep] = useState(1);
  // State holding the spreadsheet file selected by the user
  const [selectedFile, setSelectedFile] = useState(null);
  // State indicating whether file parsing and validation is currently in flight
  const [isUploading, setIsUploading] = useState(false);
  // State indicating whether the database import transaction is currently running
  const [isImporting, setIsImporting] = useState(false);
  // State holding the parsed spreadsheet rows and validation summary returned from the server
  const [previewData, setPreviewData] = useState(null);
  // State storing the final result statistics after database persistence
  const [importResult, setImportResult] = useState(null);
  // React ref pointing directly to the hidden file input DOM element
  const fileInputRef = useRef(null);

  // If the modal is not open, return null to avoid rendering any DOM nodes
  if (!isOpen) return null;

  // Helper function to reset all modal states back to their initial values
  const resetState = () => {
    // Reset wizard step back to initial upload step
    setStep(1);
    // Clear selected file reference
    setSelectedFile(null);
    // Reset uploading status flag
    setIsUploading(false);
    // Reset importing status flag
    setIsImporting(false);
    // Clear parsed preview data
    setPreviewData(null);
    // Clear import execution results
    setImportResult(null);
    // If the file input DOM ref exists, clear its value so the same file can be re-selected
    if (fileInputRef.current) {
      // Clear file input value in DOM
      fileInputRef.current.value = '';
    }
  };

  // Handler for closing the modal window cleanly
  const handleClose = () => {
    // Reset all internal form and step states
    resetState();
    // Invoke parent-supplied close callback
    onClose();
  };

  // Handler for file selection changes from the file input element
  const handleFileChange = (e) => {
    // Extract the first file selected by the user from event target
    const file = e.target.files?.[0];
    // If a file was selected by the user
    if (file) {
      // Extract lowercase file extension from the file name
      const ext = file.name.split('.').pop().toLowerCase();
      // Validate that file extension matches supported spreadsheet formats
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        // Display toast error notification if an unsupported file type is provided
        toast.error('Only CSV and Excel files (.csv, .xlsx, .xls) are supported');
        // Abort file selection handler
        return;
      }
      // Store the valid selected file in state
      setSelectedFile(file);
    }
  };

  // Handler to generate and download a sample CSV template for the user
  const handleDownloadTemplate = () => {
    // Define standard CSV template text content with header columns and sample rows
    const templateContent = `Student ID,Name,Date of Birth,Email
STU101,Rahul Sharma,2002-05-14,rahul.sharma@college.edu
STU102,Priya Patel,2001-11-20,priya.patel@college.edu
STU103,Amit Verma,2003-02-08,amit.verma@college.edu
`;
    // Create a new Blob object containing the CSV text with utf-8 encoding
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    // Generate a temporary browser object URL for the Blob
    const url = URL.createObjectURL(blob);
    // Create a temporary anchor element in memory to trigger file download
    const link = document.createElement('a');
    // Set the anchor href attribute to the Blob URL
    link.href = url;
    // Set download file name for the downloaded template
    link.setAttribute('download', 'uap_student_import_template.csv');
    // Append the link element to the document body
    document.body.appendChild(link);
    // Programmatically click the anchor to start browser file download
    link.click();
    // Remove the temporary anchor element from the document body
    document.body.removeChild(link);
  };

  // Handler to upload the selected spreadsheet file and request validation preview from server
  const handleUploadAndPreview = async () => {
    // Ensure that a file has been selected before proceeding
    if (!selectedFile) {
      // Display error notification if no file is present
      toast.error('Please select a spreadsheet file first');
      // Abort preview request
      return;
    }

    // Wrap network request in try-catch-finally
    try {
      // Set uploading loading state to true
      setIsUploading(true);
      // Construct a new FormData container for multipart upload
      const formData = new FormData();
      // Append the selected file to FormData under the key 'file'
      formData.append('file', selectedFile);

      // Dispatch request to preview endpoint via admin service
      const res = await adminService.previewStudentBulkImport(formData);
      // Normalize response data structure
      const data = res?.data || res;
      // If validation summary exists in response data
      if (data?.summary) {
        // Store parsed rows and validation statistics in state
        setPreviewData(data);
        // Advance wizard to Step 2 (Preview & Validate)
        setStep(2);
      } else {
        // Display toast error if summary is missing from response
        toast.error('Could not generate spreadsheet preview');
      }
    } catch (err) {
      // Extract error message string from response or error object
      const msg = err.response?.data?.message || err.message || 'Failed to process spreadsheet';
      // Display toast error notification
      toast.error(msg);
    } finally {
      // Reset uploading loading state to false
      setIsUploading(false);
    }
  };

  // Handler to export an error and duplicate report as a downloadable CSV
  const handleDownloadErrorReport = () => {
    // Guard clause ensuring parsed rows exist
    if (!previewData?.rows) return;
    // Filter out rows that failed validation (duplicates or invalid entries)
    const errorRows = previewData.rows.filter((r) => r.status !== 'VALID');
    // If no error or duplicate rows were found
    if (errorRows.length === 0) {
      // Inform the user that the file is completely clean
      toast.info('No errors or duplicates found in this file');
      // Abort report generation
      return;
    }

    // Define header row for error report CSV
    const headers = 'Row,Student ID,Name,Date of Birth,Email,Status,Reason\n';
    // Format error rows into CSV text lines
    const csvContent =
      // Prepend CSV header
      headers +
      // Map each row into a comma-separated string
      errorRows
        .map(
          // Construct formatted line with escaped quotes around string fields
          (r) =>
            `${r.rowNumber},"${r.studentId}","${r.name}","${r.dateOfBirth}","${r.email}","${r.status}","${r.reason || ''}"`
        )
        // Join lines with newline character
        .join('\n');

    // Create a Blob object containing the error CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    // Generate object URL for the Blob
    const url = URL.createObjectURL(blob);
    // Create temporary anchor DOM element
    const link = document.createElement('a');
    // Assign Blob URL to link href
    link.href = url;
    // Specify download file name
    link.setAttribute('download', 'student_import_errors.csv');
    // Append anchor to document body
    document.body.appendChild(link);
    // Trigger download click
    link.click();
    // Clean up temporary DOM anchor
    document.body.removeChild(link);
  };

  // Handler to confirm import and persist valid student rows into the database
  const handleConfirmImport = async () => {
    // Guard clause ensuring parsed preview data exists
    if (!previewData?.rows) return;
    // Extract only rows that passed validation with status VALID
    const validRows = previewData.rows.filter((r) => r.status === 'VALID');
    // Check if there are any valid rows available for import
    if (validRows.length === 0) {
      // Display error notification if no valid rows exist
      toast.error('No valid rows found to import');
      // Abort import confirmation
      return;
    }

    // Wrap API call in try-catch-finally block
    try {
      // Advance to step 3 (Processing Loader)
      setStep(3);
      // Set importing flag to true
      setIsImporting(true);
      // Dispatch API request to persist valid rows into master registry and user store
      const res = await adminService.confirmStudentBulkImport(validRows);
      // Store import execution statistics in state
      setImportResult(res?.data || res);
      // Advance to step 4 (Completed Result)
      setStep(4);
      // Display success toast with count of imported records
      toast.success(`Successfully imported ${res?.data?.createdCount || validRows.length} students`);
      // If parent provided an onSuccess callback, execute it to refresh underlying lists
      if (onSuccess) onSuccess();
    } catch (err) {
      // Extract error message string
      const msg = err.response?.data?.message || err.message || 'Import failed';
      // Display toast error notification
      toast.error(msg);
      // Return back to Step 2 so user can review the preview data
      setStep(2);
    } finally {
      // Reset importing flag to false
      setIsImporting(false);
    }
  };

  // Render modal component JSX
  return (
    // Outer modal dialog container with accessible ARIA role and fixed positioning
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Background backdrop with semi-transparent dark tint and blur */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box wrapper */}
      <div className="relative z-10 w-full max-w-4xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-slate-900/40 flex-shrink-0">
          {/* Header title text container */}
          <div className="min-w-0 pr-2">
            {/* Modal Heading with FileSpreadsheet icon */}
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate">
              {/* Spreadsheet icon */}
              <FileSpreadsheet className="w-5 h-5 text-brand-primary flex-shrink-0" />
              {/* Header title */}
              Bulk Student Import
            </h3>
            {/* Subtitle guidance text */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Upload institutional rosters via CSV or Excel with automated deduplication & verification
            </p>
          </div>
          {/* Modal close icon button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {/* X icon */}
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-step Progress Indicator Bar */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-surface-light-border dark:border-surface-dark-border bg-slate-50/30 dark:bg-slate-900/20 flex-shrink-0 overflow-x-auto no-scrollbar">
          {/* Flex container centering the step badges */}
          <div className="flex items-center justify-between min-w-[280px] max-w-lg mx-auto text-xs font-semibold text-slate-600 dark:text-slate-400">
            {/* Step 1 Indicator */}
            <span className={`flex items-center gap-1.5 ${step >= 1 ? 'text-brand-primary font-bold' : ''}`}>
              {/* Step number badge */}
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-brand-primary text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>1</span>
              {/* Step label text */}
              Upload File
            </span>
            {/* Connector line between step 1 and 2 */}
            <span className="text-slate-300 dark:text-slate-700">───</span>
            {/* Step 2 Indicator */}
            <span className={`flex items-center gap-1.5 ${step >= 2 ? 'text-brand-primary font-bold' : ''}`}>
              {/* Step number badge */}
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-brand-primary text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>2</span>
              {/* Step label text */}
              Preview &amp; Validate
            </span>
            {/* Connector line between step 2 and 3 */}
            <span className="text-slate-300 dark:text-slate-700">───</span>
            {/* Step 3 (Complete) Indicator */}
            <span className={`flex items-center gap-1.5 ${step === 4 ? 'text-brand-primary font-bold' : ''}`}>
              {/* Step number badge */}
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 4 ? 'bg-brand-primary text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>3</span>
              {/* Step label text */}
              Complete
            </span>
          </div>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: Upload View */}
          {step === 1 && (
            /* Container with vertical spacing */
            <div className="space-y-6">
              {/* Dashed drag-and-drop / upload card */}
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 hover:border-brand-primary transition-colors bg-slate-50/40 dark:bg-slate-900/20 text-center">
                {/* Cloud upload icon */}
                <UploadCloud className="w-12 h-12 text-brand-primary mb-3 stroke-[1.5]" />
                {/* Title prompt */}
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Select CSV or Excel Spreadsheet
                </h4>
                {/* Format and column guidelines text */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Required columns: <span className="font-semibold text-slate-700 dark:text-slate-300">Student ID, Name, Date of Birth, Email</span>. Max file size: 10MB.
                </p>

                {/* Hidden HTML file input element */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  id="student-bulk-input"
                />

                {/* File picker and template download buttons container */}
                <div className="mt-5 flex items-center gap-3">
                  {/* Label functioning as button that triggers hidden file input */}
                  <label
                    htmlFor="student-bulk-input"
                    className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white transition-colors shadow-xs"
                  >
                    Browse Files
                  </label>
                  {/* Button to download the template CSV */}
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
                  >
                    {/* Download icon */}
                    <Download className="w-3.5 h-3.5" />
                    Download CSV Template
                  </button>
                </div>

                {/* Selected File Details Banner */}
                {selectedFile && (
                  <div className="mt-4 px-3.5 py-2 rounded-xl bg-brand-primary-light/40 dark:bg-[#341C16] border border-brand-primary/20 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    {/* File spreadsheet icon */}
                    <FileSpreadsheet className="w-4 h-4 text-brand-primary" />
                    {/* Display file name */}
                    <span className="font-semibold">{selectedFile.name}</span>
                    {/* Display formatted file size in KB */}
                    <span className="text-slate-500 text-[11px]">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              {/* Step 1 Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                {/* Cancel button */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                {/* Upload and validate button */}
                <button
                  type="button"
                  onClick={handleUploadAndPreview}
                  disabled={!selectedFile || isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white flex items-center gap-2 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {/* Conditional rendering for loading spinner or button label */}
                  {isUploading ? (
                    <>
                      {/* Spinning loader */}
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Validating Spreadsheet...
                    </>
                  ) : (
                    <>
                      Next: Validate &amp; Preview
                      {/* Next arrow icon */}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Validation Table View */}
          {step === 2 && previewData && (
            <div className="space-y-4">
              {/* Validation Summary Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {/* Total Rows Card */}
                <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <p className="text-[11px] font-medium text-slate-500">Total Rows</p>
                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{previewData.summary.totalRows}</p>
                </div>
                {/* Valid Rows Card */}
                <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                  </p>
                  <p className="text-base sm:text-lg font-bold text-emerald-800 dark:text-emerald-200">{previewData.summary.validCount}</p>
                </div>
                {/* Duplicate Rows Card */}
                <div className="p-3 sm:p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Duplicate
                  </p>
                  <p className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-200">{previewData.summary.duplicateCount}</p>
                </div>
                {/* Invalid Rows Card */}
                <div className="p-3 sm:p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
                  <p className="text-[11px] font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Invalid
                  </p>
                  <p className="text-base sm:text-lg font-bold text-red-800 dark:text-red-200">{previewData.summary.invalidCount}</p>
                </div>
              </div>

              {/* Action Toolbar above preview table */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs pt-1">
                {/* Explanatory text */}
                <span className="text-slate-500">
                  Review verified rows below before confirming database persistence.
                </span>
                {/* Download error report button if any duplicates or invalid records exist */}
                {(previewData.summary.duplicateCount > 0 || previewData.summary.invalidCount > 0) && (
                  <button
                    type="button"
                    onClick={handleDownloadErrorReport}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 font-semibold self-start sm:self-auto"
                  >
                    {/* Download icon */}
                    <Download className="w-3.5 h-3.5" />
                    Download Error &amp; Duplicate Report
                  </button>
                )}
              </div>

              {/* Preview Table Container with scrollable height */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-64 overflow-y-auto">
                <table className="min-w-[640px] w-full text-left text-xs border-collapse">
                  {/* Sticky table header */}
                  <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 text-slate-700 dark:text-slate-300 font-semibold z-10">
                    <tr>
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Student ID</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">DOB</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Validation Details</th>
                    </tr>
                  </thead>
                  {/* Table body with mapped row items */}
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {/* Map through preview rows */}
                    {previewData.rows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={
                          row.status === 'VALID'
                            ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                            : row.status === 'DUPLICATE'
                            ? 'bg-amber-50/40 dark:bg-amber-950/10'
                            : 'bg-red-50/40 dark:bg-red-950/10'
                        }
                      >
                        {/* Row number cell */}
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{row.rowNumber}</td>
                        {/* Student ID cell */}
                        <td className="py-2 px-3 font-semibold font-mono text-[11px]">{row.studentId}</td>
                        {/* Name cell */}
                        <td className="py-2 px-3 font-medium">{row.name}</td>
                        {/* Date of Birth cell */}
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{row.dateOfBirth}</td>
                        {/* Email cell */}
                        <td className="py-2 px-3">{row.email}</td>
                        {/* Status Badge cell */}
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.status === 'VALID'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : row.status === 'DUPLICATE'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        {/* Validation Details cell */}
                        <td className="py-2 px-3 text-[11px] text-slate-500 max-w-xs truncate">
                          {row.reason || 'Ready for import'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Step 2 Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                {/* Back button returning to Step 1 */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
                >
                  {/* Left arrow icon */}
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                {/* Right button container */}
                <div className="flex items-center gap-2">
                  {/* Cancel button */}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  {/* Confirm and Import button */}
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={previewData.summary.validCount === 0 || isImporting}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white flex items-center gap-2 disabled:opacity-50 transition-colors shadow-xs"
                  >
                    Import {previewData.summary.validCount} Valid Records
                    {/* Right arrow icon */}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Processing Loader View */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              {/* Spinning animated loader icon */}
              <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
              <div>
                {/* Processing title */}
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Importing Valid Student Records...
                </h4>
                {/* Processing explanation message */}
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Writing to master Student Registry, provisioning User authentication accounts, and queuing welcome notifications.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Completed Result View */}
          {step === 4 && importResult && (
            <div className="space-y-6 text-center py-4">
              {/* Success checkmark badge circle */}
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              {/* Success heading and description */}
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Bulk Student Import Completed!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Master registry records and student user accounts have been successfully created.
                </p>
              </div>

              {/* Statistics Grid */}
              <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
                {/* Created count card */}
                <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Created</p>
                  <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">{importResult.createdCount}</p>
                </div>
                {/* Skipped count card */}
                <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-center">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Skipped</p>
                  <p className="text-xl font-bold text-amber-800 dark:text-amber-200">{importResult.skippedCount}</p>
                </div>
                {/* Failed count card */}
                <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 text-center">
                  <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">Failed</p>
                  <p className="text-xl font-bold text-red-800 dark:text-red-200">{importResult.failedCount}</p>
                </div>
              </div>

              {/* Completion action button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2 rounded-xl text-xs font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white transition-colors shadow-xs"
                >
                  Done &amp; View Student Roster
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Export StudentBulkImportModal as default component export
export default StudentBulkImportModal;
