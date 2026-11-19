import React, { useState, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Terminal,
  Clock,
  Cpu,
  Layers,
  Database,
  Code2,
  Eraser,
  ListChecks,
  Check,
  AlertTriangle,
  FileCode,
} from 'lucide-react';
import CodeEditor from '../common/CodeEditor';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import instructorService from '../../services/instructor.service';
import { toast } from 'react-toastify';

const SUPPORTED_LANGUAGES = [
  { id: 'python', label: 'Python 3.11', category: 'code' },
  { id: 'javascript', label: 'JavaScript (Node.js 20)', category: 'code' },
  { id: 'sqlite', label: 'SQLite 3 (In-Memory)', category: 'sql' },
];

const DEFAULT_STARTER_CODE = {
  python: `# Python 3.11 Solution / Starter Template
import sys

def main():
    lines = sys.stdin.read().split()
    if not lines:
        return
    # Write solution here
    print("Welcome")

if __name__ == "__main__":
    main()
`,
  javascript: `// JavaScript (Node.js 20) Solution / Starter Template
const fs = require('fs');

function main() {
  const input = fs.readFileSync(0, 'utf-8');
  // Write solution here
  console.log("Welcome");
}

main();
`,
  sqlite: `-- SQLite 3 Relational Query
SELECT * FROM employees;
`,
};

export default function FacultyCodeIDE({
  question,
  qIndex,
  onUpdateQuestion,
  onUpdateCodingConfig,
}) {
  const codingCfg = question.codingConfig || {};
  const isSql = question.type === 'sql' || codingCfg.executionCategory === 'sql';
  const allowedLanguages = codingCfg.allowedLanguages && codingCfg.allowedLanguages.length > 0
    ? codingCfg.allowedLanguages
    : (isSql ? ['sqlite'] : ['python', 'javascript']);
  const defaultLanguage = codingCfg.defaultLanguage || allowedLanguages[0] || (isSql ? 'sqlite' : 'python');

  // Active editor state
  const [selectedLang, setSelectedLang] = useState(defaultLanguage);
  const [activeCodeTab, setActiveCodeTab] = useState(defaultLanguage);
  const [facultyCode, setFacultyCode] = useState(() => {
    if (codingCfg.starterCode && codingCfg.starterCode[defaultLanguage]) {
      return codingCfg.starterCode[defaultLanguage];
    }
    return DEFAULT_STARTER_CODE[defaultLanguage] || '';
  });

  // Stdin & Output panel state
  const [customStdin, setCustomStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [isExecutingSingle, setIsExecutingSingle] = useState(false);
  const [isExecutingAll, setIsExecutingAll] = useState(false);
  const [executingTcId, setExecutingTcId] = useState(null);
  const [singleOutput, setSingleOutput] = useState(null);
  const [suiteReport, setSuiteReport] = useState(null);
  const [tcResults, setTcResults] = useState({});

  // Active view tab in Faculty IDE (problem_config, editor, test_cases, report)
  const [ideTab, setIdeTab] = useState('editor');

  const testCases = codingCfg.testCases || [];

  // Update starter code in parent when code changes
  const handleCodeChange = (newCode) => {
    setFacultyCode(newCode);
    const existingStarter = { ...(codingCfg.starterCode || {}) };
    existingStarter[selectedLang] = newCode;
    onUpdateCodingConfig(qIndex, 'starterCode', existingStarter);
  };

  const handleLanguageChange = (newLang) => {
    setSelectedLang(newLang);
    setActiveCodeTab(newLang);
    const codeForLang = (codingCfg.starterCode && codingCfg.starterCode[newLang]) || DEFAULT_STARTER_CODE[newLang] || '';
    setFacultyCode(codeForLang);
  };

  const handleResetCode = () => {
    const defaultCode = DEFAULT_STARTER_CODE[selectedLang] || '';
    setFacultyCode(defaultCode);
    const existingStarter = { ...(codingCfg.starterCode || {}) };
    existingStarter[selectedLang] = defaultCode;
    onUpdateCodingConfig(qIndex, 'starterCode', existingStarter);
    toast.success(`Reset code to default template for ${selectedLang}`);
  };

  const handleClearOutput = () => {
    setSingleOutput(null);
    setSuiteReport(null);
    setTcResults({});
  };

  // Run single ad-hoc code execution with custom stdin
  const handleRunSingle = async () => {
    if (!facultyCode.trim()) {
      toast.error('Code cannot be empty');
      return;
    }
    setIsExecutingSingle(true);
    try {
      const res = await instructorService.testCode({
        language: selectedLang,
        code: facultyCode,
        stdin: showStdin ? customStdin : '',
        schemaDdl: codingCfg.schemaDdl || '',
        timeoutMs: codingCfg.cpuTimeLimitMs || 2000,
        memoryLimitMb: codingCfg.memoryLimitMb || 256,
      });

      const data = res.data || res;
      setSingleOutput(data);
      if (data.verdict === 'ACCEPTED') {
        toast.success(`Execution completed: ${data.verdict} (${data.executionTimeMs}ms)`);
      } else {
        toast.error(`Execution status: ${data.verdict}`);
      }
    } catch (err) {
      toast.error(err.message || 'Execution failed');
      setSingleOutput({
        verdict: 'ERROR',
        stderr: err.message,
      });
    } finally {
      setIsExecutingSingle(false);
    }
  };

  // Run individual test case
  const handleRunTestCase = async (tc, tcIdx) => {
    if (!facultyCode.trim()) {
      toast.error('Please enter code before testing');
      return;
    }
    const tcId = tc.id || tc._id || `tc-${tcIdx}`;
    setExecutingTcId(tcId);
    try {
      const res = await instructorService.testCode({
        language: selectedLang,
        code: facultyCode,
        schemaDdl: codingCfg.schemaDdl || '',
        testCase: {
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          expectedColumns: tc.expectedColumns || [],
          expectedRows: tc.expectedRows || [],
        },
        timeoutMs: codingCfg.cpuTimeLimitMs || 2000,
        memoryLimitMb: codingCfg.memoryLimitMb || 256,
      });

      const data = res.data || res;
      setTcResults((prev) => ({
        ...prev,
        [tcId]: data,
      }));

      if (data.passed) {
        toast.success(`Test Case #${tcIdx + 1} Passed!`);
      } else {
        toast.error(`Test Case #${tcIdx + 1} Failed (${data.verdict})`);
      }
    } catch (err) {
      toast.error(err.message || `Test Case #${tcIdx + 1} failed to run`);
    } finally {
      setExecutingTcId(null);
    }
  };

  // Run all test cases in suite
  const handleRunAllTests = async () => {
    if (!facultyCode.trim()) {
      toast.error('Code cannot be empty to run test cases');
      return;
    }
    if (testCases.length === 0) {
      toast.error('No test cases available to run. Please add at least one test case.');
      return;
    }

    setIsExecutingAll(true);
    try {
      const res = await instructorService.testCode({
        language: selectedLang,
        code: facultyCode,
        schemaDdl: codingCfg.schemaDdl || '',
        testCases: testCases,
        timeoutMs: codingCfg.cpuTimeLimitMs || 2000,
        memoryLimitMb: codingCfg.memoryLimitMb || 256,
      });

      const data = res.data || res;
      setSuiteReport(data);

      // Populate per-testcase quick result badges
      const resultMap = {};
      (data.testCases || []).forEach((tc) => {
        resultMap[tc.testCaseId] = tc;
      });
      setTcResults(resultMap);

      if (data.verdict === 'ACCEPTED') {
        toast.success(`All ${data.passedCount}/${data.totalCount} tests passed!`);
      } else {
        toast.warning(`${data.passedCount} of ${data.totalCount} tests passed (${data.verdict})`);
      }
      setIdeTab('report');
    } catch (err) {
      toast.error(err.message || 'Suite execution failed');
    } finally {
      setIsExecutingAll(false);
    }
  };

  // Test Case Management handlers
  const handleAddTestCase = () => {
    const updatedCases = [...testCases];
    const newIdx = updatedCases.length + 1;
    updatedCases.push({
      id: `tc-${Date.now()}-${newIdx}`,
      description: `Test Case ${newIdx}`,
      input: '',
      expectedOutput: '',
      isHidden: newIdx > 1, // First is public sample by default
      isEnabled: true,
      weight: 1,
      explanation: `Test case ${newIdx} explanation`,
    });
    onUpdateCodingConfig(qIndex, 'testCases', updatedCases);
  };

  const handleDuplicateTestCase = (tcIdx) => {
    const updatedCases = [...testCases];
    const source = updatedCases[tcIdx];
    const duplicated = {
      ...source,
      id: `tc-${Date.now()}-${updatedCases.length + 1}`,
      description: `${source.description || 'Test Case'} (Copy)`,
    };
    updatedCases.splice(tcIdx + 1, 0, duplicated);
    onUpdateCodingConfig(qIndex, 'testCases', updatedCases);
    toast.success('Test case duplicated');
  };

  const handleDeleteTestCase = (tcIdx) => {
    if (testCases.length <= 1) {
      toast.error('Question must have at least one test case.');
      return;
    }
    const updatedCases = testCases.filter((_, idx) => idx !== tcIdx);
    onUpdateCodingConfig(qIndex, 'testCases', updatedCases);
    toast.success('Test case removed');
  };

  const handleUpdateTestCase = (tcIdx, field, val) => {
    const updatedCases = [...testCases];
    updatedCases[tcIdx] = {
      ...updatedCases[tcIdx],
      [field]: val,
    };
    onUpdateCodingConfig(qIndex, 'testCases', updatedCases);
  };

  // Pre-publish validation status calculation
  const hasPrompt = Boolean(question.questionText && question.questionText.trim().length > 0);
  const enabledTestCases = testCases.filter((tc) => tc.isEnabled !== false);
  const hasAtLeastOneTestCase = enabledTestCases.length > 0;
  const allCasesHaveExpected = enabledTestCases.every((tc) =>
    Boolean(tc.expectedOutput && tc.expectedOutput.trim()) ||
    (isSql && (tc.expectedColumns?.length > 0 || tc.expectedRows?.length > 0))
  );
  const hasHiddenCase = enabledTestCases.some((tc) => Boolean(tc.isHidden));
  const hasSupportedLang = allowedLanguages.length > 0;
  const isQuestionPublishReady = hasPrompt && hasAtLeastOneTestCase && allCasesHaveExpected && hasSupportedLang;

  return (
    <div className="space-y-4 rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#12161F] p-4 sm:p-5 shadow-xs">
      {/* Faculty IDE Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EBE3D8] dark:border-[#2D3748]">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] dark:bg-[#341C16] flex items-center justify-center text-[#E05D38]">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#1F2937] dark:text-[#F9FAFB]">
              Faculty Coding IDE & Test Validator
            </h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Author, run, and validate test cases against isolated container runtimes
            </p>
          </div>
        </div>

        {/* Sub-tabs: Problem Config, Editor, Test Cases, Full Report */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setIdeTab('editor')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
              ideTab === 'editor'
                ? 'bg-white dark:bg-[#1A202C] text-[#E05D38] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Code Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setIdeTab('test_cases')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
              ideTab === 'test_cases'
                ? 'bg-white dark:bg-[#1A202C] text-[#E05D38] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Test Cases ({testCases.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setIdeTab('problem_config')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
              ideTab === 'problem_config'
                ? 'bg-white dark:bg-[#1A202C] text-[#E05D38] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Problem Specs</span>
          </button>
          {suiteReport && (
            <button
              type="button"
              onClick={() => setIdeTab('report')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                ideTab === 'report'
                  ? 'bg-white dark:bg-[#1A202C] text-emerald-600 shadow-xs'
                  : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Report ({suiteReport.passedCount}/{suiteReport.totalCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Pre-Publish Validation Warning Banner */}
      <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
        isQuestionPublishReady
          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-300'
          : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300'
      }`}>
        <div className="flex items-center space-x-2">
          {isQuestionPublishReady ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          )}
          <span>
            {isQuestionPublishReady
              ? `Ready for publishing: ${enabledTestCases.length} enabled test case(s) configured (${enabledTestCases.filter(c => c.isHidden).length} hidden).`
              : 'Draft Incomplete: Question statement and at least 1 test case with expected output are required before publishing.'}
          </span>
        </div>
        {!hasHiddenCase && hasAtLeastOneTestCase && (
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hidden sm:inline">
            Notice: No hidden test cases (recommended for anti-cheating)
          </span>
        )}
      </div>

      {/* TAB 1: CODE EDITOR */}
      {ideTab === 'editor' && (
        <div className="space-y-4">
          {/* Controls Bar: Language Selector, Run Single, Run All Tests */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                Runtime Language:
              </span>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {allowedLanguages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleLanguageChange(lang)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      selectedLang === lang
                        ? 'bg-white dark:bg-[#1A202C] text-[#E05D38] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'python' ? 'Python 3.11' : lang === 'javascript' ? 'JavaScript 20' : 'SQLite 3'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isSql && (
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showStdin}
                    onChange={(e) => setShowStdin(e.target.checked)}
                    className="rounded border-slate-300 text-[#E05D38] focus:ring-[#E05D38]"
                  />
                  <span>Custom Stdin</span>
                </label>
              )}

              <button
                type="button"
                onClick={handleResetCode}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-[#E05D38] dark:text-slate-400 flex items-center gap-1 cursor-pointer"
                title="Reset editor to starter template"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Play}
                loading={isExecutingSingle}
                disabled={isExecutingSingle || isExecutingAll}
                onClick={handleRunSingle}
                className="text-xs"
              >
                Run Code
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={ListChecks}
                loading={isExecutingAll}
                disabled={isExecutingAll || isExecutingSingle}
                onClick={handleRunAllTests}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
              >
                Run All Tests ({enabledTestCases.length})
              </Button>
            </div>
          </div>

          {/* Custom Stdin textarea */}
          {showStdin && !isSql && (
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-1">
              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Custom Standard Input (stdin):
              </label>
              <textarea
                rows={2}
                value={customStdin}
                onChange={(e) => setCustomStdin(e.target.value)}
                placeholder="Enter input values to be fed to sys.stdin / readline..."
                className="w-full p-2 rounded-lg font-mono text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A202C] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#E05D38]"
              />
            </div>
          )}

          {/* Monaco / CodeMirror Code Editor */}
          <div className="rounded-xl border border-[#EBE3D8] dark:border-[#2D3748] overflow-hidden">
            <CodeEditor
              value={facultyCode}
              onChange={handleCodeChange}
              language={selectedLang}
              height="280px"
              minHeight="200px"
              placeholder={isSql ? '-- Enter instructor reference SQL query...' : '# Enter faculty reference/starter code here...'}
            />
          </div>

          {/* Execution Output Console / Diagnostic Panel */}
          {singleOutput && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E131F] space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] uppercase ${
                    singleOutput.verdict === 'ACCEPTED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {singleOutput.verdict}
                  </span>
                  {singleOutput.executionTimeMs !== undefined && (
                    <span className="text-slate-500 font-mono">
                      Runtime: <strong>{singleOutput.executionTimeMs}ms</strong>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearOutput}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>

              {singleOutput.stdout && singleOutput.stdout.trim() && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Standard Output (stdout)</span>
                  <pre className="p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-36">
                    {singleOutput.stdout}
                  </pre>
                </div>
              )}

              {singleOutput.stderr && singleOutput.stderr.trim() && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-500 block mb-1">Errors / Stderr</span>
                  <pre className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900 font-mono text-xs overflow-x-auto max-h-36">
                    {singleOutput.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TEST CASE MANAGEMENT */}
      {ideTab === 'test_cases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#1F2937] dark:text-[#F9FAFB]">
                Test Cases Suite ({testCases.length})
              </h5>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Public sample cases are visible to students. Hidden cases are evaluated server-side.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={handleAddTestCase}
                className="text-xs"
              >
                Add Test Case
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Play}
                loading={isExecutingAll}
                disabled={isExecutingAll || testCases.length === 0}
                onClick={handleRunAllTests}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
              >
                Run All
              </Button>
            </div>
          </div>

          {/* Test Case Cards */}
          <div className="space-y-3">
            {testCases.map((tc, tcIdx) => {
              const tcId = tc.id || tc._id || `tc-${tcIdx}`;
              const tcResult = tcResults[tcId];
              const isRunningThis = executingTcId === tcId;

              return (
                <div
                  key={tcId}
                  className={`p-3.5 rounded-xl border transition-all ${
                    tc.isEnabled === false
                      ? 'opacity-60 border-slate-200 bg-slate-50 dark:bg-slate-900/30'
                      : tc.isHidden
                      ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/10'
                      : 'border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#12161F]'
                  }`}
                >
                  {/* Top Bar: Name, Enabled Toggle, Visibility, Weight, Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EBE3D8]/60 dark:border-[#2D3748]/60">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38]">
                        #{tcIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={tc.description || `Test Case ${tcIdx + 1}`}
                        onChange={(e) => handleUpdateTestCase(tcIdx, 'description', e.target.value)}
                        placeholder="Test case label (e.g. TC01 - Positive numbers)"
                        className="text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#E05D38] focus:outline-none px-1"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Result Badge if evaluated */}
                      {tcResult && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                          tcResult.passed
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {tcResult.passed ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {tcResult.passed ? 'Passed' : 'Failed'} ({tcResult.executionTimeMs}ms)
                        </span>
                      )}

                      {/* Weight input */}
                      <label className="flex items-center space-x-1 text-xs">
                        <span className="text-[#64748B] dark:text-[#94A3B8]">Weight:</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={tc.weight ?? 1}
                          onChange={(e) =>
                            handleUpdateTestCase(tcIdx, 'weight', Math.max(1, parseInt(e.target.value, 10) || 1))
                          }
                          className="w-12 px-1.5 py-0.5 text-xs text-center font-bold bg-white dark:bg-[#1A202C] border border-[#EBE3D8] dark:border-[#2D3748] rounded-md"
                        />
                        <span className="text-[#64748B] dark:text-[#94A3B8]">pts</span>
                      </label>

                      {/* Enabled / Disabled Toggle */}
                      <label className="flex items-center space-x-1.5 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={tc.isEnabled !== false}
                          onChange={(e) => handleUpdateTestCase(tcIdx, 'isEnabled', e.target.checked)}
                          className="rounded border-[#EBE3D8] text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Enabled</span>
                      </label>

                      {/* Visibility Toggle */}
                      <label className="flex items-center space-x-1.5 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(tc.isHidden)}
                          onChange={(e) => handleUpdateTestCase(tcIdx, 'isHidden', e.target.checked)}
                          className="rounded border-[#EBE3D8] text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className={`font-medium ${tc.isHidden ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-[#64748B] dark:text-[#94A3B8]'}`}>
                          {tc.isHidden ? 'Hidden (Grading)' : 'Public (Sample)'}
                        </span>
                      </label>

                      {/* Action buttons: Run, Duplicate, Delete */}
                      <button
                        type="button"
                        onClick={() => handleRunTestCase(tc, tcIdx)}
                        disabled={isRunningThis || isExecutingAll}
                        className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors cursor-pointer"
                        title="Run this test case"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateTestCase(tcIdx)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                        title="Duplicate test case"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTestCase(tcIdx)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                        title="Delete test case"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Test case content: Input and Expected Output */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                        Input (stdin / arguments)
                      </label>
                      <textarea
                        rows={2}
                        aria-label={`Test case ${tcIdx + 1} input`}
                        value={tc.input || ''}
                        onChange={(e) => handleUpdateTestCase(tcIdx, 'input', e.target.value)}
                        placeholder="e.g. 5\n1 2 3 4 5"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#FAF8F5] dark:bg-[#0E131F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                        Expected Output (stdout / expected JSON) *
                      </label>
                      <textarea
                        rows={2}
                        aria-label={`Test case ${tcIdx + 1} expected output`}
                        value={tc.expectedOutput || ''}
                        onChange={(e) => handleUpdateTestCase(tcIdx, 'expectedOutput', e.target.value)}
                        placeholder="e.g. 15"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#FAF8F5] dark:bg-[#0E131F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
                      />
                    </div>
                  </div>

                  {/* Optional explanation */}
                  <div className="pt-2">
                    <input
                      type="text"
                      value={tc.explanation || ''}
                      onChange={(e) => handleUpdateTestCase(tcIdx, 'explanation', e.target.value)}
                      placeholder="Rationale or hint (e.g. Edge case: empty input, negative numbers)"
                      className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#1A202C] border border-[#EBE3D8]/80 dark:border-[#2D3748]/80 rounded-lg text-[#64748B] dark:text-[#94A3B8] focus:outline-none focus:border-[#E05D38]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PROBLEM SPECIFICATION & CONSTRAINTS */}
      {ideTab === 'problem_config' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                Problem Title
              </label>
              <input
                type="text"
                value={codingCfg.problemTitle || ''}
                onChange={(e) => onUpdateCodingConfig(qIndex, 'problemTitle', e.target.value)}
                placeholder="e.g. Second Largest Distinct Element"
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                Problem Constraints
              </label>
              <input
                type="text"
                value={codingCfg.constraints || ''}
                onChange={(e) => onUpdateCodingConfig(qIndex, 'constraints', e.target.value)}
                placeholder="e.g. 1 <= N <= 10^5, -10^9 <= A[i] <= 10^9"
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
              Detailed Problem Description
            </label>
            <textarea
              rows={3}
              value={codingCfg.problemDescription || ''}
              onChange={(e) => onUpdateCodingConfig(qIndex, 'problemDescription', e.target.value)}
              placeholder="Comprehensive problem explanation, algorithms required, mathematical definitions..."
              className="w-full p-2.5 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                Input Format
              </label>
              <textarea
                rows={2}
                value={codingCfg.inputFormat || ''}
                onChange={(e) => onUpdateCodingConfig(qIndex, 'inputFormat', e.target.value)}
                placeholder="e.g. First line contains integer N. Second line contains N space-separated integers."
                className="w-full p-2 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                Output Format
              </label>
              <textarea
                rows={2}
                value={codingCfg.outputFormat || ''}
                onChange={(e) => onUpdateCodingConfig(qIndex, 'outputFormat', e.target.value)}
                placeholder="e.g. Print a single integer representing the second-largest distinct element."
                className="w-full p-2 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                Sample Input
              </label>
              <textarea
                rows={2}
                value={codingCfg.sampleInput || ''}
                onChange={(e) => onUpdateCodingConfig(qIndex, 'sampleInput', e.target.value)}
                placeholder="e.g. 5\n10 5 8 10 3"
                className="w-full p-2 font-mono text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                Expected Sample Output
              </label>
              <textarea
                rows={2}
                value={codingCfg.sampleOutput || ''}
                onChange={(e) => onUpdateCodingConfig(qIndex, 'sampleOutput', e.target.value)}
                placeholder="e.g. 8"
                className="w-full p-2 font-mono text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DETAILED FACULTY TEST REPORT TABLE */}
      {ideTab === 'report' && suiteReport && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <div className="flex items-center space-x-3">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                suiteReport.verdict === 'ACCEPTED'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
              }`}>
                {suiteReport.verdict}
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                {suiteReport.passedCount} Passed / {suiteReport.failedCount} Failed (Total: {suiteReport.totalCount})
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Play}
              loading={isExecutingAll}
              onClick={handleRunAllTests}
              className="text-xs"
            >
              Re-run All Tests
            </Button>
          </div>

          {/* Test Case Evaluation Results Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/70 font-semibold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Test Case</th>
                  <th className="px-3 py-2 text-left">Visibility</th>
                  <th className="px-3 py-2 text-left">Input</th>
                  <th className="px-3 py-2 text-left">Expected Output</th>
                  <th className="px-3 py-2 text-left">Actual Output</th>
                  <th className="px-3 py-2 text-center">Result</th>
                  <th className="px-3 py-2 text-right">Runtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {(suiteReport.testCases || []).map((stc, idx) => (
                  <tr
                    key={stc.testCaseId || idx}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                      stc.passed
                        ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                        : 'bg-rose-50/20 dark:bg-rose-950/10'
                    }`}
                  >
                    <td className="px-3 py-2 font-sans font-bold text-slate-800 dark:text-slate-200">
                      {stc.description || `TC${String(idx + 1).padStart(2, '0')}`}
                    </td>
                    <td className="px-3 py-2 font-sans">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        stc.isHidden
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {stc.isHidden ? 'Hidden' : 'Public'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={stc.input}>
                      {stc.input || '(empty)'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={stc.expectedOutput}>
                      {stc.expectedOutput || '(empty)'}
                    </td>
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-200 max-w-[160px] truncate font-semibold" title={stc.actualOutput}>
                      {stc.actualOutput || (stc.stderr ? `Error: ${stc.stderr}` : '(empty)')}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        stc.passed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {stc.passed ? '✓ Pass' : '✗ Fail'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {stc.executionTimeMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
