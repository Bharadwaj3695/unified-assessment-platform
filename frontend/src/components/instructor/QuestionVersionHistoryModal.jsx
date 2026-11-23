import { useState, useEffect } from 'react';
import { History, X, Clock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import uapQuestionBankService from '../../services/uapQuestionBank.service';

export default function QuestionVersionHistoryModal({ isOpen, onClose, questionId }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    if (questionId && isOpen) {
      async function loadVersions() {
        try {
          setLoading(true);
          const res = await uapQuestionBankService.getQuestionVersions(questionId);
          const vers = res.data || [];
          setVersions(vers);
          if (vers.length > 0) setSelectedVersion(vers[0]);
        } catch (_err) {
          setVersions([]);
        } finally {
          setLoading(false);
        }
      }
      loadVersions();
    }
  }, [questionId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-primary text-white shadow-warm-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Immutable Question Version History</h2>
              <p className="text-xs text-slate-500">
                Tests and attempts lock to specific version snapshots. Historical usages remain uncorrupted.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[75vh] overflow-y-auto">
          {/* Versions list */}
          <div className="space-y-2 border-r border-slate-200 dark:border-slate-800 pr-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Revisions</h3>
            {loading ? (
              <p className="text-xs text-slate-400">Loading version logs...</p>
            ) : versions.length === 0 ? (
              <p className="text-xs text-slate-400">No previous version history found.</p>
            ) : (
              versions.map((v) => (
                <div
                  key={v._id || v.versionNumber}
                  onClick={() => setSelectedVersion(v)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                    selectedVersion?.versionNumber === v.versionNumber
                      ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-peach font-semibold'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">Version {v.versionNumber}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-500 truncate">{v.changeSummary || 'Revision snapshot'}</p>
                </div>
              ))
            )}
          </div>

          {/* Selected Version Snapshot details */}
          <div className="md:col-span-2 space-y-4">
            {selectedVersion ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-brand-primary dark:text-brand-peach">
                      Version {selectedVersion.versionNumber} Snapshot
                    </span>
                    <p className="text-slate-500 mt-0.5">{selectedVersion.changeSummary}</p>
                  </div>
                  <div className="text-right text-slate-400">
                    <span className="block font-medium">
                      Author: {selectedVersion.changedBy?.fullName || 'Faculty'}
                    </span>
                    <span>{new Date(selectedVersion.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                    Question Statement at this Version
                  </h4>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedVersion.questionSnapshot?.statement || selectedVersion.questionSnapshot?.questionText}
                  </p>

                  {selectedVersion.questionSnapshot?.options?.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-xs font-semibold text-slate-500">Choice Options:</span>
                      {selectedVersion.questionSnapshot.options.map((opt, i) => (
                        <div
                          key={opt.id || i}
                          className={`p-2 rounded text-xs border ${
                            opt.isCorrect
                              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-medium'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {opt.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedVersion.questionSnapshot?.explanation && (
                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Explanation: </span>
                      {selectedVersion.questionSnapshot.explanation}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select a version revision from the left to inspect snapshot.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
