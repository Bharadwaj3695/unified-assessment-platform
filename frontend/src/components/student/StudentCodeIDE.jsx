import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CodeEditor from '../common/CodeEditor';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  Play,
  RotateCcw,
  Code2,
  Database,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  HelpCircle,
  Trash2,
} from 'lucide-react';

/**
 * StudentCodeIDE
 *
 * Clean, distraction-free coding IDE for students during assessment attempts.
 * Complies with Phase 2 requirements:
 * - Left Panel: Problem statement, description, constraints, input/output format, sample examples.
 * - Right Panel: Code editor, language selector, action buttons (Run, Reset, Custom Stdin).
 * - Bottom Panel: Output, sample test results, execution errors, informational execution time.
 * - Infrastructure diagnostic metrics (CPU limit, Memory limit, GPU, PID) are excluded.
 */
const StudentCodeIDE = ({
  question,
  activeLanguage,
  onLanguageChange,
  code,
  onCodeChange,
  onResetCode,
  onRunCode,
  isExecuting,
  executionResult,
  customStdin,
  onCustomStdinChange,
  showCustomStdin,
  onToggleCustomStdin,
  onClearOutput,
}) => {
  const [activeOutputTab, setActiveOutputTab] = useState('testcases');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showDdl, setShowDdl] = useState(true);

  if (!question) return null;

  const qId = question._id;
  const isSql = question.type === 'sql';
  const codingCfg = question.codingConfig || {};

  // Supported runtimes
  const allowedLangs = (codingCfg.allowedLanguages || ['python', 'javascript']).filter((l) =>
    ['python', 'javascript'].includes(l)
  );
  const safeAllowedLangs = allowedLangs.length > 0 ? allowedLangs : ['python', 'javascript'];

  // Public sample test cases only (hidden are never exposed to students)
  const publicTestCases = (codingCfg.testCases || []).filter((tc) => !tc.isHidden);

  // Copy sample input helper
  const handleCopyInput = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  // Determine output tabs availability
  const hasSampleResults = Boolean(executionResult?.sampleResults && executionResult.sampleResults.length > 0);
  const hasStdout = Boolean(executionResult?.stdout && executionResult.stdout.trim());
  const hasStderr = Boolean(executionResult?.stderr && executionResult.stderr.trim());
  const hasSqlTable = Boolean(executionResult?.columns && executionResult.columns.length > 0);

  return (
    <div className="space-y-5">
      {/* Split IDE Grid: Left Panel (Problem Details) + Right Panel (Editor & Execution) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* LEFT PANEL: Problem Specification & Public Test Cases (col-span-5) */}
        <div className="xl:col-span-5 flex flex-col space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161F] shadow-xs space-y-4 max-h-[820px] overflow-y-auto">
            
            {/* Header: Title and Category */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/60 flex items-center gap-1">
                  {isSql ? <Database className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                  <span>{isSql ? 'Database Query' : 'Algorithm'}</span>
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {question.points} {question.points === 1 ? 'Mark' : 'Marks'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {codingCfg.problemTitle || question.questionText || 'Coding Problem'}
              </h2>
            </div>

            {/* Problem Description */}
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 whitespace-pre-wrap">
              {codingCfg.problemDescription || question.questionText}
            </div>

            {/* Input & Output Format */}
            {(codingCfg.inputFormat || codingCfg.outputFormat) && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                {codingCfg.inputFormat && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Input Format
                    </span>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                      {codingCfg.inputFormat}
                    </div>
                  </div>
                )}
                {codingCfg.outputFormat && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Output Format
                    </span>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                      {codingCfg.outputFormat}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Constraints */}
            {codingCfg.constraints && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Constraints
                </span>
                <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                  {codingCfg.constraints}
                </div>
              </div>
            )}

            {/* SQL Schema DDL (for SQL questions) */}
            {isSql && codingCfg.schemaDdl && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setShowDdl(!showDdl)}
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Database Schema & Tables (DDL)</span>
                  </span>
                  <button type="button" className="text-slate-400 hover:text-slate-600">
                    {showDdl ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
                {showDdl && (
                  <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-48 border border-slate-800">
                    {codingCfg.schemaDdl}
                  </pre>
                )}
              </div>
            )}

            {/* Public Sample Test Cases */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sample Examples ({publicTestCases.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Evaluated when clicking Run Code
                </span>
              </div>

              {publicTestCases.length > 0 ? (
                <div className="space-y-3">
                  {publicTestCases.map((tc, tcIdx) => (
                    <div
                      key={tc._id || tcIdx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          <span>Sample Example #{tcIdx + 1}</span>
                        </span>
                        {tc.explanation && (
                          <span className="text-[11px] text-slate-500 font-normal italic">
                            {tc.explanation}
                          </span>
                        )}
                      </div>

                      {isSql ? (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected Results</span>
                          {tc.expectedColumns && tc.expectedColumns.length > 0 ? (
                            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A202C]">
                              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-[11px] font-mono">
                                <thead className="bg-slate-100 dark:bg-slate-800/60">
                                  <tr>
                                    {tc.expectedColumns.map((col, cIdx) => (
                                      <th key={cIdx} className="px-2 py-1 text-left font-bold text-slate-700 dark:text-slate-300">
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {(tc.expectedRows || []).slice(0, 5).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {(Array.isArray(row) ? row : tc.expectedColumns.map((c) => row[c])).map((val, cellIdx) => (
                                        <td key={cellIdx} className="px-2 py-1 text-slate-600 dark:text-slate-300">
                                          {val === null ? <span className="text-amber-600 italic">NULL</span> : String(val)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <pre className="p-2 rounded-lg bg-white dark:bg-[#1A202C] border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto max-h-24">
                              {tc.expectedOutput || '(empty expected output)'}
                            </pre>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Input</span>
                              <button
                                type="button"
                                onClick={() => handleCopyInput(tc.input || '', tcIdx)}
                                className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                                title="Copy input to clipboard"
                              >
                                {copiedIndex === tcIdx ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <pre className="p-2 rounded-lg bg-white dark:bg-[#1A202C] border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto max-h-20 whitespace-pre">
                              {tc.input !== undefined && tc.input !== null ? tc.input : '(empty input)'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Expected Output</span>
                            <pre className="p-2 rounded-lg bg-white dark:bg-[#1A202C] border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto max-h-20 whitespace-pre">
                              {tc.expectedOutput !== undefined && tc.expectedOutput !== null ? tc.expectedOutput : '(empty output)'}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                  No public sample test cases configured for this question.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT PANEL: Code Editor & Action Controls (col-span-7) */}
        <div className="xl:col-span-7 flex flex-col space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161F] shadow-xs space-y-3">
            
            {/* Editor Top Toolbar: Language Selector & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              {/* Language Selector */}
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {isSql ? 'Dialect' : 'Language'}
                </span>
                {!isSql ? (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {safeAllowedLangs.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => onLanguageChange(lang)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          activeLanguage === lang
                            ? 'bg-white dark:bg-[#1A202C] text-orange-600 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {lang === 'python' ? 'Python 3.11' : 'JavaScript (Node.js 20)'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    SQLite 3 (In-Memory)
                  </span>
                )}
              </div>

              {/* Action Buttons: Reset, Custom Stdin, Run */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onResetCode}
                  className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reset editor to instructor template"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>

                {!isSql && (
                  <label className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(showCustomStdin)}
                      onChange={(e) => onToggleCustomStdin(e.target.checked)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span>Custom Stdin</span>
                  </label>
                )}

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Play}
                  loading={isExecuting}
                  disabled={isExecuting}
                  onClick={onRunCode}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-xs"
                >
                  {isExecuting ? 'Running...' : 'Run Code'}
                </Button>
              </div>
            </div>

            {/* Monaco / CodeMirror Editor */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
              <CodeEditor
                value={code}
                onChange={onCodeChange}
                language={activeLanguage}
                height="340px"
                minHeight="240px"
                placeholder={isSql ? '-- Enter your SQL solution query here...' : '# Write your solution code here...'}
              />
            </div>

            {/* Custom Stdin Box (when toggled) */}
            {showCustomStdin && !isSql && (
              <div className="pt-1 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Standard Input (stdin)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Passed to process standard input
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={customStdin}
                  onChange={(e) => onCustomStdinChange(e.target.value)}
                  placeholder="Enter sample input lines..."
                  className="w-full p-2.5 rounded-lg font-mono text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

          </div>

          {/* BOTTOM PANEL: Execution Results & Console Output */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161F] shadow-xs space-y-3">
            
            {/* Header: Status Tabs, Verdict, Runtime Informational metric */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveOutputTab('testcases')}
                    className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                      activeOutputTab === 'testcases'
                        ? 'bg-white dark:bg-[#1A202C] text-orange-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Test Cases
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveOutputTab('stdout')}
                    className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                      activeOutputTab === 'stdout'
                        ? 'bg-white dark:bg-[#1A202C] text-orange-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Console Output
                  </button>
                  {hasStderr && (
                    <button
                      type="button"
                      onClick={() => setActiveOutputTab('errors')}
                      className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                        activeOutputTab === 'errors'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 shadow-xs'
                          : 'text-rose-600 dark:text-rose-400 hover:text-rose-900'
                      }`}
                    >
                      Errors / Traceback
                    </button>
                  )}
                  {isSql && hasSqlTable && (
                    <button
                      type="button"
                      onClick={() => setActiveOutputTab('sql')}
                      className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                        activeOutputTab === 'sql'
                          ? 'bg-white dark:bg-[#1A202C] text-emerald-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Table View
                    </button>
                  )}
                </div>
              </div>

              {/* Informational Execution Metrics (Clean runtime only, NO CPU/Memory limits) */}
              {executionResult && (
                <div className="flex items-center gap-2.5">
                  {/* Verdict Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                      executionResult.verdict === 'ACCEPTED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                        : executionResult.verdict === 'WRONG_ANSWER'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                        : executionResult.verdict === 'TIME_LIMIT_EXCEEDED'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300'
                    }`}
                  >
                    {executionResult.verdict?.replace('_', ' ') || 'EXECUTED'}
                  </span>

                  {/* Informational Execution Time (ms) */}
                  {executionResult.executionTimeMs !== undefined && (
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{executionResult.executionTimeMs}ms</span>
                    </span>
                  )}

                  {/* Clear Output Action */}
                  {onClearOutput && (
                    <button
                      type="button"
                      onClick={onClearOutput}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Clear execution output"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Output Tab Contents */}
            <div>
              {/* State 1: Executing loader */}
              {isExecuting && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Executing code in sandboxed runtime...
                  </p>
                </div>
              )}

              {/* State 2: No execution result yet */}
              {!isExecuting && !executionResult && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-1.5 text-slate-400">
                  <Terminal className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-medium">Ready to execute.</p>
                  <p className="text-[11px]">Click &quot;Run Code&quot; to test your solution against sample test cases.</p>
                </div>
              )}

              {/* State 3: Execution Result Available */}
              {!isExecuting && executionResult && (
                <div>
                  {/* TAB 1: Test Cases */}
                  {activeOutputTab === 'testcases' && (
                    <div className="space-y-3">
                      {hasSampleResults ? (
                        <div className="space-y-2">
                          {executionResult.passedCount !== undefined && executionResult.totalCount !== undefined && (
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 pb-1">
                              <span>
                                {executionResult.passedCount} of {executionResult.totalCount} sample test cases passed
                              </span>
                              <span className="text-[11px] text-slate-400 font-normal">
                                {executionResult.passedCount === executionResult.totalCount ? 'All sample cases passed!' : 'Revise your solution to match expected output.'}
                              </span>
                            </div>
                          )}

                          <div className="space-y-2.5">
                            {executionResult.sampleResults.map((stc, stcIdx) => (
                              <div
                                key={stcIdx}
                                className={`p-3 rounded-xl border text-xs space-y-2 ${
                                  stc.passed
                                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                                    : 'border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold">
                                  <span className="flex items-center gap-1.5">
                                    {stc.passed ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                    )}
                                    <span className={stc.passed ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'}>
                                      Sample Case #{stc.sampleIndex || stcIdx + 1}
                                    </span>
                                  </span>
                                  <span className={`text-[11px] font-bold ${stc.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                    {stc.passed ? 'PASSED' : 'FAILED'}
                                  </span>
                                </div>

                                {stc.explanation && (
                                  <p className="text-[11px] text-slate-500 italic">{stc.explanation}</p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                                  {stc.expectedOutput !== undefined && (
                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Expected Output</span>
                                      <pre className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto max-h-24 whitespace-pre">
                                        {stc.expectedOutput || '(empty output)'}
                                      </pre>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Your Output</span>
                                    <pre className={`p-2 rounded bg-white dark:bg-slate-900 border overflow-x-auto max-h-24 whitespace-pre ${
                                      stc.passed ? 'border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200' : 'border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                                    }`}>
                                      {stc.actualOutput !== undefined ? stc.actualOutput : '(no output)'}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Execution finished with verdict: <strong className="font-mono">{executionResult.verdict}</strong>
                          </p>
                          {executionResult.stdout && (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Standard Output</span>
                              <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-40 whitespace-pre">
                                {executionResult.stdout}
                              </pre>
                            </div>
                          )}
                          {executionResult.stderr && (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-rose-500 block mb-1">Errors</span>
                              <pre className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900 font-mono text-xs overflow-x-auto max-h-40 whitespace-pre">
                                {executionResult.stderr}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Standard Output (stdout) */}
                  {activeOutputTab === 'stdout' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Process standard output stream (stdout)</span>
                      </div>
                      {hasStdout ? (
                        <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-60 whitespace-pre">
                          {executionResult.stdout}
                        </pre>
                      ) : (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                          (No standard output produced)
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Errors / Traceback */}
                  {activeOutputTab === 'errors' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-rose-500 font-bold uppercase">
                        <span>Compilation / Runtime Error Diagnostics</span>
                      </div>
                      <pre className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900 font-mono text-xs overflow-x-auto max-h-60 whitespace-pre">
                        {executionResult.stderr}
                      </pre>
                    </div>
                  )}

                  {/* TAB 4: SQL Table View (if SQL query) */}
                  {activeOutputTab === 'sql' && hasSqlTable && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Query Result: {executionResult.rowCount !== undefined ? executionResult.rowCount : (executionResult.rows?.length || 0)} rows</span>
                      </div>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#1A202C] max-h-60">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono">
                          <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                            <tr>
                              {executionResult.columns.map((col, idx) => (
                                <th key={idx} className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {(executionResult.rows || []).map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                {(Array.isArray(row) ? row : executionResult.columns.map((c) => row[c])).map((val, cIdx) => (
                                  <td key={cIdx} className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                                    {val === null ? <span className="text-amber-600 italic">NULL</span> : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

StudentCodeIDE.propTypes = {
  question: PropTypes.object.isRequired,
  activeLanguage: PropTypes.string.isRequired,
  onLanguageChange: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired,
  onCodeChange: PropTypes.func.isRequired,
  onResetCode: PropTypes.func.isRequired,
  onRunCode: PropTypes.func.isRequired,
  isExecuting: PropTypes.bool,
  executionResult: PropTypes.object,
  customStdin: PropTypes.string,
  onCustomStdinChange: PropTypes.func.isRequired,
  showCustomStdin: PropTypes.bool,
  onToggleCustomStdin: PropTypes.func.isRequired,
  onClearOutput: PropTypes.func,
};

export default StudentCodeIDE;
