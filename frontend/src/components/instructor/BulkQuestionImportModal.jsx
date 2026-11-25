import { useState } from 'react';
import { UploadCloud, X, Check, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import uapQuestionBankService from '../../services/uapQuestionBank.service';

export default function BulkQuestionImportModal({ isOpen, onClose, subjects = [], onImportCommitted }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?._id || '');
  const [uploading, setUploading] = useState(false);
  const [stagedJob, setStagedJob] = useState(null);
  const [committing, setCommitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file (CSV, XLSX, or JSON).');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedSubject) {
        formData.append('subjectId', selectedSubject);
      }

      const res = await uapQuestionBankService.uploadImportFile(formData);
      setStagedJob(res.data);
      toast.success('File uploaded and parsed successfully. Review staged questions below.');
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!stagedJob) return;
    try {
      setCommitting(true);
      const res = await uapQuestionBankService.commitImportJob(stagedJob._id || stagedJob.id, {
        subjectId: selectedSubject,
      });
      toast.success(res.message || 'Questions committed into Mock Bank drafts.');
      if (onImportCommitted) onImportCommitted();
      onClose();
    } catch (err) {
      toast.error('Commit failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-primary text-white shadow-warm-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Question Import</h2>
              <p className="text-xs text-slate-500">
                Upload CSV, XLSX, or JSON spreadsheets. Verify staging records before committing to drafts.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {!stagedJob ? (
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Target Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:border-brand-primary transition cursor-pointer">
                <input
                  type="file"
                  id="bulk-file-input"
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="bulk-file-input" className="cursor-pointer space-y-2 flex flex-col items-center">
                  <div className="p-3 rounded-full bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-peach">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {selectedFile ? selectedFile.name : 'Click to select CSV, XLSX, or JSON file'}
                    </p>
                    <p className="text-xs text-slate-400">Max file size: 15MB</p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-1.5"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  {uploading ? 'Processing & Validating...' : 'Parse & Preview'}
                </button>
              </div>
            </form>
          ) : (
            /* Staged Preview */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Parsed {stagedJob.totalDetected || stagedJob.extractedQuestions?.length} Questions
                  </h4>
                  <p className="text-xs text-slate-500">
                    Source: {stagedJob.sourceFilename || stagedJob.sourceType}
                  </p>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    Ready to Import: {stagedJob.extractedQuestions?.filter((q) => q.reviewStatus !== 'REJECTED').length}
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {stagedJob.extractedQuestions?.map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs flex items-center justify-between"
                  >
                    <div className="flex-1 mr-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {item.questionText}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Type: {item.type} | Difficulty: {item.difficulty || 'MEDIUM'}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600">Valid</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStagedJob(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Upload Different File
                </button>
                <button
                  type="button"
                  disabled={committing}
                  onClick={handleCommit}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1.5"
                >
                  {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {committing ? 'Committing...' : 'Commit to Question Bank'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
