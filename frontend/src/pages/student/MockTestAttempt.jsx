import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  Send,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
  Paperclip,
  Database,
  Code2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import uapQuestionBankService from '../../services/uapQuestionBank.service';

export default function MockTestAttempt() {
  const { id: testId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState(null);
  const [testData, setTestData] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Student answers state: { [qId]: { selectedOption, selectedOptions, textAnswer, code, fileAnswer } }
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600);

  // File upload state per question: { [qId]: { isUploading, progress, error, success } }
  const [uploadingStates, setUploadingStates] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function start() {
      try {
        setLoading(true);
        const res = await uapQuestionBankService.startMockTestAttempt(testId);
        setAttemptId(res.data.attemptId);
        setTestData(res.data.mockTest);
        setTimeLeftSeconds((res.data.mockTest.durationMinutes || 60) * 60);
      } catch (err) {
        toast.error('Failed to load test session: ' + (err.response?.data?.message || err.message));
        navigate('/student/mock-tests');
      } finally {
        setLoading(false);
      }
    }
    start();
  }, [testId, navigate]);

  // Timer countdown
  useEffect(() => {
    if (loading || !testData) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitAttempt();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, testData]);

  if (loading || !testData) {
    return <div className="p-12 text-center text-sm text-slate-400">Initializing secure mock test environment...</div>;
  }

  const questions = testData.questions || [];
  const activeQuestion = questions[currentIdx];
  const qSnapshot = activeQuestion?.questionSnapshot || {};
  const currentQId = activeQuestion?.questionId;

  const currentAnswer = answers[currentQId] || {};
  const uploadState = uploadingStates[currentQId] || {};

  const handleSelectOption = (optId) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQId]: {
        ...prev[currentQId],
        selectedOption: optId,
      },
    }));
  };

  const handleSelectMultiOption = (optId) => {
    const prevList = currentAnswer.selectedOptions || [];
    const updated = prevList.includes(optId) ? prevList.filter((x) => x !== optId) : [...prevList, optId];
    setAnswers((prev) => ({
      ...prev,
      [currentQId]: {
        ...prev[currentQId],
        selectedOptions: updated,
      },
    }));
  };

  const handleTextChange = (val) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQId]: {
        ...prev[currentQId],
        textAnswer: val,
      },
    }));
  };

  const handleCodeChange = (val) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQId]: {
        ...prev[currentQId],
        code: val,
      },
    }));
  };

  const handleFileUpload = async (file) => {
    if (!file || !attemptId || !currentQId) return;

    const fileConfig = qSnapshot.fileUploadConfig || {};
    const maxMb = fileConfig.maxFileSizeMb || 10;
    const allowed = (fileConfig.allowedFileTypes || ['pdf', 'doc', 'docx']).map((e) =>
      e.toLowerCase().replace(/^\./, '')
    );

    // 1. Client-side Size Validation
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${maxMb}MB.`);
      return;
    }

    // 2. Client-side Extension & Executable Validation
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const dangerousExts = /^(exe|sh|bat|cmd|php|js|mjs|py|pl|cgi|jar|war|dll|so|vbs|ps1|html|htm)$/i;
    if (dangerousExts.test(ext)) {
      toast.error('Executable and script files are strictly forbidden.');
      return;
    }

    if (!allowed.includes(ext)) {
      toast.error(`Invalid format .${ext}. Permitted formats: ${allowed.join(', ').toUpperCase()}`);
      return;
    }

    try {
      setUploadingStates((prev) => ({
        ...prev,
        [currentQId]: { isUploading: true, progress: 15, error: null, success: false },
      }));

      const res = await uapQuestionBankService.uploadMockTestFile(
        attemptId,
        currentQId,
        file,
        (progressEvt) => {
          if (progressEvt.total) {
            const pct = Math.round((progressEvt.loaded / progressEvt.total) * 100);
            setUploadingStates((prev) => ({
              ...prev,
              [currentQId]: { isUploading: true, progress: Math.min(95, pct), error: null, success: false },
            }));
          }
        }
      );

      setAnswers((prev) => ({
        ...prev,
        [currentQId]: {
          ...prev[currentQId],
          fileAnswer: res.data.fileAnswer,
        },
      }));

      setUploadingStates((prev) => ({
        ...prev,
        [currentQId]: { isUploading: false, progress: 100, error: null, success: true },
      }));

      toast.success('Document uploaded and attached successfully!');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'File upload failed';
      setUploadingStates((prev) => ({
        ...prev,
        [currentQId]: { isUploading: false, progress: 0, error: errMsg, success: false },
      }));
      toast.error(`Upload error: ${errMsg}`);
    }
  };

  const handleSubmitAttempt = async () => {
    try {
      setSubmitting(true);
      const responsesPayload = questions.map((rq) => {
        const a = answers[rq.questionId] || {};
        return {
          questionId: rq.questionId,
          versionNumber: rq.versionNumber,
          selectedOption: a.selectedOption || null,
          selectedOptions: a.selectedOptions || [],
          textAnswer: a.textAnswer || null,
          code: a.code || null,
          fileAnswer: a.fileAnswer || null,
        };
      });

      await uapQuestionBankService.submitMockTestAttempt(testId, attemptId, {
        responses: responsesPayload,
      });

      toast.success('Exam submitted and scored successfully!');
      navigate(`/student/mock-test-analytics/${attemptId}`);
    } catch (err) {
      toast.error('Submission failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const rawQType = (qSnapshot.questionType || qSnapshot.type || 'SINGLE_MCQ').toUpperCase();
  const fileUploadCfg = qSnapshot.fileUploadConfig || {};
  const allowedExts = fileUploadCfg.allowedFileTypes || ['pdf', 'doc', 'docx'];
  const maxMb = fileUploadCfg.maxFileSizeMb || 10;
  const acceptStr = allowedExts.map((e) => `.${e.replace(/^\./, '')}`).join(',');

  return (
    <div className="space-y-6 pb-16">
      {/* Top Test Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{testData.title}</h2>
          <span className="text-xs text-slate-400">
            Question {currentIdx + 1} of {questions.length} | {activeQuestion?.marks} Marks
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-mono text-sm font-bold">
            <Clock className="w-4 h-4 text-amber-600" />
            {formatTime(timeLeftSeconds)}
          </div>

          <button
            onClick={handleSubmitAttempt}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Finish & Submit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Question Display */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-brand-primary dark:text-brand-peach tracking-wider">
                {rawQType}
              </span>
              <span className="text-xs text-slate-400">
                {activeQuestion?.negativeMarks ? `-${activeQuestion.negativeMarks} Negative Marks` : 'No Negative Marking'}
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
              {qSnapshot.statement || qSnapshot.questionText}
            </h3>

            {/* 1. SINGLE_MCQ */}
            {rawQType === 'SINGLE_MCQ' && qSnapshot.options && (
              <div className="space-y-3">
                {qSnapshot.options.map((opt, i) => (
                  <div
                    key={opt.id || i}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                      currentAnswer.selectedOption === opt.id
                        ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-peach font-medium'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        currentAnswer.selectedOption === opt.id
                          ? 'border-brand-primary bg-brand-primary text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {currentAnswer.selectedOption === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm">{opt.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 2. TRUE_FALSE */}
            {rawQType === 'TRUE_FALSE' && (
              <div className="grid grid-cols-2 gap-4">
                {(qSnapshot.options && qSnapshot.options.length > 0
                  ? qSnapshot.options
                  : [
                      { id: 'true', text: 'True' },
                      { id: 'false', text: 'False' },
                    ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt.id)}
                    className={`p-5 rounded-xl border text-center font-bold text-base transition ${
                      currentAnswer.selectedOption === opt.id
                        ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-peach ring-2 ring-brand-primary/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            )}

            {/* 3. MULTI_SELECT */}
            {rawQType === 'MULTI_SELECT' && qSnapshot.options && (
              <div className="space-y-3">
                <span className="text-xs text-slate-400 italic">Select all applicable options</span>
                {qSnapshot.options.map((opt, i) => {
                  const isChecked = (currentAnswer.selectedOptions || []).includes(opt.id);
                  return (
                    <div
                      key={opt.id || i}
                      onClick={() => handleSelectMultiOption(opt.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                        isChecked
                          ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-peach font-medium'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
                      />
                      <span className="text-sm">{opt.text}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. FILL_BLANK */}
            {rawQType === 'FILL_BLANK' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Your Answer:</label>
                <input
                  type="text"
                  value={currentAnswer.textAnswer || ''}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Type the exact word or phrase here..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>
            )}

            {/* 5. SHORT_ANSWER */}
            {rawQType === 'SHORT_ANSWER' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Short Answer:</label>
                <input
                  type="text"
                  value={currentAnswer.textAnswer || ''}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Type your brief answer here..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>
            )}

            {/* 6. DESCRIPTIVE */}
            {rawQType === 'DESCRIPTIVE' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-500">Detailed Solution / Essay:</label>
                    <span className="text-xs text-slate-400">
                      {(currentAnswer.textAnswer || '').trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={currentAnswer.textAnswer || ''}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="Provide your comprehensive explanation, proofs, and working steps..."
                    className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-primary outline-none leading-relaxed"
                  />
                </div>

                {/* Rubric Criteria Preview */}
                {qSnapshot.evaluationConfig?.rubric?.length > 0 && (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Evaluation Rubric Criteria:
                    </span>
                    <div className="space-y-1.5">
                      {qSnapshot.evaluationConfig.rubric.map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span>{r.criteria || r.criterion}</span>
                          <span className="font-semibold text-brand-primary dark:text-brand-peach">{r.maxMarks} Marks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. FILE_UPLOAD */}
            {rawQType === 'FILE_UPLOAD' && (
              <div className="space-y-4">
                {/* Configuration Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Formats: {allowedExts.map((e) => e.toUpperCase()).join(', ')}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Max File Size: {maxMb} MB
                  </span>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) handleFileUpload(dropped);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    isDragging
                      ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-brand-primary hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept={acceptStr}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />

                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-brand-primary/10 dark:bg-brand-primary/20 flex items-center justify-center text-brand-primary dark:text-brand-peach">
                      {uploadState.isUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <UploadCloud className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {uploadState.isUploading
                          ? `Uploading Document (${uploadState.progress}%)...`
                          : 'Click to upload or drag & drop document'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Supported: {allowedExts.join(', ').toUpperCase()} up to {maxMb}MB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upload Progress Bar */}
                {uploadState.isUploading && (
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadState.progress}%` }}
                    />
                  </div>
                )}

                {/* Successfully Attached File Card */}
                {currentAnswer.fileAnswer && (
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {currentAnswer.fileAnswer.originalFilename}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {(currentAnswer.fileAnswer.size / 1024).toFixed(1)} KB • Attached & Linked to Question
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-brand-primary hover:text-brand-primary-hover px-3 py-1.5 rounded-lg border border-brand-primary/30 dark:border-brand-primary/30 hover:bg-brand-primary/10 dark:hover:bg-brand-primary/20"
                    >
                      Replace File
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 8. CODING */}
            {rawQType === 'CODING' && (
              <div className="space-y-4">
                <textarea
                  rows={8}
                  value={currentAnswer.code || ''}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Write your code solution here..."
                  className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-slate-100 font-mono text-sm leading-relaxed"
                />
                {qSnapshot.evaluationConfig?.testCases?.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-500">Public Test Cases:</span>
                    {qSnapshot.evaluationConfig.testCases.map((tc, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">
                        <p>Input: {tc.input}</p>
                        <p>Expected: {tc.expectedOutput}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 9. SQL */}
            {rawQType === 'SQL' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-brand-primary dark:text-brand-peach" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Dialect: SQLite (Standard SQL query)
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={currentAnswer.code || currentAnswer.textAnswer || ''}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="SELECT * FROM students WHERE ...;"
                  className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-slate-100 font-mono text-sm leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous Question
            </button>

            <button
              onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIdx === questions.length - 1}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs disabled:opacity-40 flex items-center gap-1.5 transition"
            >
              Next Question
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Palette */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Question Palette</h4>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((rq, idx) => {
                const ans = answers[rq.questionId];
                const isAnswered =
                  ans?.selectedOption ||
                  (ans?.selectedOptions && ans.selectedOptions.length > 0) ||
                  (ans?.textAnswer && ans.textAnswer.trim().length > 0) ||
                  (ans?.code && ans.code.trim().length > 0) ||
                  ans?.fileAnswer;
                const isCurrent = idx === currentIdx;

                return (
                  <button
                    key={rq.questionId}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-9 rounded-lg text-xs font-bold border transition ${
                      isCurrent
                        ? 'border-brand-primary ring-2 ring-brand-primary/30 font-black'
                        : isAnswered
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-slate-300 dark:border-slate-700 inline-block" /> Unanswered
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
