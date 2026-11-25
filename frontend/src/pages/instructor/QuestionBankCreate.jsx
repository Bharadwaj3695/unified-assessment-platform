import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import questionBankService from '../../services/questionBank.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import CodeEditor from '../../components/common/CodeEditor';
import {
  ArrowLeft,
  AlertTriangle,
  Plus,
  Trash2,
  Info,
  Terminal,
  Code2,
  CheckCircle,
  Database,
  Columns,
  Table as TableIcon,
  HelpCircle,
} from 'lucide-react';

// Programming runtimes (Python & JavaScript only)
const PROGRAMMING_RUNTIMES = [
  { id: 'python', label: 'Python 3.11', badge: 'Python', defaultStarter: '# Write your solution here\nimport sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n' },
  { id: 'javascript', label: 'JavaScript (Node.js 20)', badge: 'Node.js', defaultStarter: '// Write your solution here\nconst fs = require("fs");\n\nfunction main() {\n  // Process input\n}\n\nmain();\n' },
];

// SQL database engines (Active examination restricted to SQLite 3)
const SQL_DIALECTS = [
  { id: 'sqlite', label: 'SQLite 3 (In-Memory)', description: 'Fast, isolated in-memory relational sandbox' },
];

const DEFAULT_STARTER_CODE = {
  python: '# Write your solution here\nimport sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n',
  javascript: '// Write your solution here\nconst fs = require("fs");\n\nfunction main() {\n  // Process input\n}\n\nmain();\n',
  sqlite: '-- Write your SQL query here\nSELECT * FROM students;\n',
};

const DEFAULT_SQL_DDL = `-- Define database schema and seed records\nCREATE TABLE students (\n  id INT PRIMARY KEY,\n  name VARCHAR(50),\n  major VARCHAR(50),\n  gpa DECIMAL(3,2),\n  is_active BOOLEAN\n);\n\nINSERT INTO students VALUES\n  (1, 'Alice Smith', 'Computer Science', 3.90, 1),\n  (2, 'Bob Jones', 'Electrical Engineering', 3.40, 1),\n  (3, 'Charlie Brown', 'Computer Science', 3.75, 1);\n`;

const QuestionBankCreate = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [activeCodeTab, setActiveCodeTab] = useState('python');
  const [sqlViewMode, setSqlViewMode] = useState({}); // { [tcIndex]: 'visual' | 'json' }

  const [formData, setFormData] = useState({
    questionText: '',
    type: 'mcq',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' },
    ],
    correctAnswer: 'a',
    explanation: '',
    points: 5,
    difficulty: 'MEDIUM',
    bloomLevel: 'UNDERSTAND',
    category: 'Computer Science',
    tagsInput: '',
    fileUploadConfig: {
      allowedFileTypes: ['pdf', 'doc', 'docx'],
      maxFileSizeMb: 10,
      allowGoogleDocs: true,
      isRequired: true,
    },
    codingConfig: {
      executionCategory: 'code',
      allowedLanguages: ['python', 'javascript'],
      defaultLanguage: 'python',
      sqlDialect: 'sqlite',
      starterCode: { ...DEFAULT_STARTER_CODE },
      schemaDdl: '',
      cpuTimeLimitMs: 2000,
      memoryLimitMb: 256,
      testCases: [
        {
          id: 'tc-1',
          input: '',
          expectedOutput: '',
          expectedColumns: [],
          expectedRows: [],
          isHidden: false,
          weight: 1,
          explanation: 'Sample test case 1',
        },
      ],
    },
  });

  // Load question data when editing
  useEffect(() => {
    if (isEditing) {
      const fetchQuestion = async () => {
        try {
          setIsLoading(true);
          const res = await questionBankService.getQuestionById(id);
          const q = res.data?.question || res.data;
          if (q) {
            let questionType = q.type || 'mcq';
            const codingCfg = q.codingConfig || {};
            const isSql =
              questionType === 'sql' ||
              codingCfg.executionCategory === 'sql' ||
              (codingCfg.allowedLanguages &&
                codingCfg.allowedLanguages.length > 0 &&
                codingCfg.allowedLanguages.every((l) => ['sqlite'].includes(l)));

            if (isSql) {
              questionType = 'sql';
            }

            const sqlDialect =
              codingCfg.sqlDialect ||
              (codingCfg.allowedLanguages &&
                codingCfg.allowedLanguages.find((l) => ['sqlite'].includes(l))) ||
              'sqlite';

            // Filter allowed programming languages so SQL dialects are NEVER mixed in
            const progAllowed = Array.isArray(codingCfg.allowedLanguages)
              ? codingCfg.allowedLanguages.filter((l) => ['python', 'javascript'].includes(l))
              : ['python', 'javascript'];
            const safeProgAllowed = progAllowed.length > 0 ? progAllowed : ['python', 'javascript'];
            const safeProgDefault = ['python', 'javascript'].includes(codingCfg.defaultLanguage)
              ? codingCfg.defaultLanguage
              : safeProgAllowed[0];

            setFormData({
              questionText: q.questionText || '',
              type: questionType,
              options:
                Array.isArray(q.options) && q.options.length > 0
                  ? q.options
                  : [
                      { id: 'a', text: '' },
                      { id: 'b', text: '' },
                    ],
              correctAnswer: q.correctAnswer || (q.options?.[0]?.id || 'a'),
              explanation: q.explanation || '',
              points: q.points || 5,
              difficulty: q.difficulty || 'MEDIUM',
              bloomLevel: q.bloomLevel || 'UNDERSTAND',
              category: q.category || 'General',
              tagsInput: Array.isArray(q.tags) ? q.tags.join(', ') : '',
              fileUploadConfig: q.fileUploadConfig || {
                allowedFileTypes: ['pdf', 'doc', 'docx'],
                maxFileSizeMb: 10,
                allowGoogleDocs: true,
                isRequired: true,
              },
              codingConfig: {
                executionCategory: isSql ? 'sql' : 'code',
                allowedLanguages: isSql ? [sqlDialect] : safeProgAllowed,
                defaultLanguage: isSql ? sqlDialect : safeProgDefault,
                sqlDialect,
                starterCode: codingCfg.starterCode
                  ? { ...DEFAULT_STARTER_CODE, ...codingCfg.starterCode }
                  : { ...DEFAULT_STARTER_CODE },
                schemaDdl: codingCfg.schemaDdl || (isSql ? DEFAULT_SQL_DDL : ''),
                cpuTimeLimitMs: codingCfg.cpuTimeLimitMs || 2000,
                memoryLimitMb: codingCfg.memoryLimitMb || 256,
                testCases:
                  Array.isArray(codingCfg.testCases) && codingCfg.testCases.length > 0
                    ? codingCfg.testCases.map((tc, idx) => {
                        let expectedColumns = Array.isArray(tc.expectedColumns) ? tc.expectedColumns : [];
                        let expectedRows = Array.isArray(tc.expectedRows) ? tc.expectedRows : [];
                        let expectedOutput = tc.expectedOutput || '';
                        if (isSql && !expectedColumns.length && !expectedRows.length && expectedOutput) {
                          try {
                            const parsed = JSON.parse(expectedOutput);
                            if (parsed && typeof parsed === 'object') {
                              if (Array.isArray(parsed.columns)) expectedColumns = parsed.columns;
                              if (Array.isArray(parsed.rows)) expectedRows = parsed.rows;
                              else if (Array.isArray(parsed) && parsed.length > 0) {
                                expectedColumns = Object.keys(parsed[0]);
                                expectedRows = parsed;
                              }
                            }
                          } catch {
                            // Raw text
                          }
                        } else if (isSql && !expectedOutput && (expectedColumns.length > 0 || expectedRows.length > 0)) {
                          expectedOutput = JSON.stringify({ columns: expectedColumns, rows: expectedRows }, null, 2);
                        }
                        return {
                          id: tc.id || tc._id || `tc-${idx + 1}`,
                          input: tc.input || '',
                          expectedOutput,
                          expectedColumns,
                          expectedRows,
                          isHidden: Boolean(tc.isHidden),
                          weight: tc.weight || 1,
                          explanation: tc.explanation || '',
                        };
                      })
                    : [
                        {
                          id: 'tc-1',
                          input: '',
                          expectedOutput: isSql
                            ? JSON.stringify([{ id: 1, name: 'Alice Smith' }], null, 2)
                            : '',
                          expectedColumns: isSql ? ['id', 'name'] : [],
                          expectedRows: isSql ? [[1, 'Alice Smith']] : [],
                          isHidden: false,
                          weight: 1,
                          explanation: isSql
                            ? 'Verify query result matches expected columns and rows'
                            : 'Sample test case 1',
                        },
                      ],
              },
            });

            if (!isSql) {
              setActiveCodeTab(safeProgDefault);
            }
          }
        } catch (err) {
          toast.error(err.message || 'Failed to load question for editing.');
          navigate('/instructor/question-bank');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestion();
    }
  }, [id, isEditing, navigate]);

  // Debounced duplicate detection
  useEffect(() => {
    if (isEditing || !formData.questionText || formData.questionText.trim().length < 8) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await questionBankService.checkDuplicate(formData.questionText);
        if (res.isDuplicate && res.duplicateQuestion) {
          setDuplicateWarning(res.duplicateQuestion);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // ignore check errors
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.questionText, isEditing]);

  const handleTypeChange = (newType) => {
    setFormData((prev) => {
      const currentConfig = prev.codingConfig || {};
      let updatedConfig = { ...currentConfig };

      if (newType === 'code') {
        const allowed = (currentConfig.allowedLanguages || []).filter((l) =>
          ['python', 'javascript'].includes(l)
        );
        const safeAllowed = allowed.length > 0 ? allowed : ['python', 'javascript'];
        const safeDefault = ['python', 'javascript'].includes(currentConfig.defaultLanguage)
          ? currentConfig.defaultLanguage
          : safeAllowed[0];

        updatedConfig = {
          ...currentConfig,
          executionCategory: 'code',
          allowedLanguages: safeAllowed,
          defaultLanguage: safeDefault,
        };
        setActiveCodeTab(safeDefault);
      } else if (newType === 'sql') {
        const dialect = currentConfig.sqlDialect || 'sqlite';
        updatedConfig = {
          ...currentConfig,
          executionCategory: 'sql',
          sqlDialect: dialect,
          allowedLanguages: [dialect],
          defaultLanguage: dialect,
          schemaDdl: currentConfig.schemaDdl || DEFAULT_SQL_DDL,
        };
      }

      return {
        ...prev,
        type: newType,
        codingConfig: updatedConfig,
      };
    });
  };

  const handleSqlDialectChange = (dialect) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      return {
        ...prev,
        codingConfig: {
          ...current,
          sqlDialect: dialect,
          allowedLanguages: [dialect],
          defaultLanguage: dialect,
        },
      };
    });
  };

  const toggleAllowedProgrammingLanguage = (langId) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const currentLangs = (current.allowedLanguages || ['python', 'javascript']).filter((l) =>
        ['python', 'javascript'].includes(l)
      );
      const idx = currentLangs.indexOf(langId);
      let nextLangs = [...currentLangs];

      if (idx >= 0) {
        if (nextLangs.length === 1) {
          toast.warning('At least one programming runtime (Python or JavaScript) must remain enabled.');
          return prev;
        }
        nextLangs.splice(idx, 1);
      } else {
        nextLangs.push(langId);
      }

      const defaultLang = nextLangs.includes(current.defaultLanguage)
        ? current.defaultLanguage
        : nextLangs[0];

      if (activeCodeTab === langId && !nextLangs.includes(langId)) {
        setActiveCodeTab(defaultLang);
      }

      return {
        ...prev,
        codingConfig: {
          ...current,
          allowedLanguages: nextLangs,
          defaultLanguage: defaultLang,
        },
      };
    });
  };

  const handleOptionChange = (idx, val) => {
    setFormData((prev) => {
      const updated = [...prev.options];
      updated[idx] = { ...updated[idx], text: val };
      return { ...prev, options: updated };
    });
  };

  const handleAddOption = () => {
    setFormData((prev) => {
      const nextLetter = String.fromCharCode(97 + prev.options.length);
      return {
        ...prev,
        options: [...prev.options, { id: nextLetter, text: '' }],
      };
    });
  };

  const handleRemoveOption = (idx) => {
    setFormData((prev) => {
      if (prev.options.length <= 2) {
        toast.warn('MCQ must have at least 2 options.');
        return prev;
      }
      const updated = prev.options.filter((_, i) => i !== idx);
      const activeCorrect = updated.some((opt) => opt.id === prev.correctAnswer)
        ? prev.correctAnswer
        : updated[0]?.id || 'a';
      return { ...prev, options: updated, correctAnswer: activeCorrect };
    });
  };

  const updateCodingConfig = (field, val) => {
    setFormData((prev) => ({
      ...prev,
      codingConfig: {
        ...(prev.codingConfig || {}),
        [field]: val,
      },
    }));
  };

  const updateStarterCode = (lang, code) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const starterCode = { ...(current.starterCode || {}) };
      starterCode[lang] = code;
      return {
        ...prev,
        codingConfig: {
          ...current,
          starterCode,
        },
      };
    });
  };

  const addTestCase = () => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const testCases = [...(current.testCases || [])];
      const isSql = prev.type === 'sql';
      testCases.push({
        id: `tc-${Date.now()}-${testCases.length + 1}`,
        input: '',
        expectedOutput: isSql ? JSON.stringify([{ id: testCases.length + 1, name: 'Sample Result' }], null, 2) : '',
        expectedColumns: isSql ? ['id', 'name'] : [],
        expectedRows: isSql ? [[testCases.length + 1, 'Sample Result']] : [],
        isHidden: testCases.length >= 1,
        weight: 1,
        explanation: `${isSql ? 'SQL Result' : 'Test'} Case ${testCases.length + 1}`,
      });
      return {
        ...prev,
        codingConfig: {
          ...current,
          testCases,
        },
      };
    });
  };

  const removeTestCase = (tcIndex) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const testCases = [...(current.testCases || [])];
      if (testCases.length <= 1) {
        toast.warning('Questions must have at least one test case.');
        return prev;
      }
      testCases.splice(tcIndex, 1);
      return {
        ...prev,
        codingConfig: {
          ...current,
          testCases,
        },
      };
    });
  };

  const updateTestCase = (tcIndex, field, val) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const testCases = [...(current.testCases || [])];
      testCases[tcIndex] = {
        ...testCases[tcIndex],
        [field]: val,
      };
      return {
        ...prev,
        codingConfig: {
          ...current,
          testCases,
        },
      };
    });
  };

  // Structured SQL expected-result handlers
  const updateSqlColumns = (tcIndex, colStr) => {
    const cols = colStr.split(',').map((c) => c.trim()).filter(Boolean);
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const testCases = [...(current.testCases || [])];
      const tc = { ...testCases[tcIndex], expectedColumns: cols };

      // Synchronize expectedOutput JSON
      tc.expectedOutput = JSON.stringify({ columns: cols, rows: tc.expectedRows || [] }, null, 2);
      testCases[tcIndex] = tc;
      return {
        ...prev,
        codingConfig: {
          ...current,
          testCases,
        },
      };
    });
  };

  const addSqlRow = (tcIndex) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const testCases = [...(current.testCases || [])];
      const tc = { ...testCases[tcIndex] };
      const cols = tc.expectedColumns || [];
      const newRow = cols.length > 0 ? cols.map(() => '') : [''];
      const rows = [...(tc.expectedRows || []), newRow];
      tc.expectedRows = rows;
      tc.expectedOutput = JSON.stringify({ columns: cols, rows }, null, 2);
      testCases[tcIndex] = tc;
      return {
        ...prev,
        codingConfig: {
          ...current,
          testCases,
        },
      };
    });
  };

  const updateSqlCell = (tcIndex, rowIndex, colIndex, val) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const testCases = [...(current.testCases || [])];
      const tc = { ...testCases[tcIndex] };
      const rows = (tc.expectedRows || []).map((r, rIdx) => {
        if (rIdx !== rowIndex) return r;
        const updatedRow = Array.isArray(r) ? [...r] : [];
        let parsedVal = val;
        if (!isNaN(val) && val.trim() !== '') {
          parsedVal = Number(val);
        }
        updatedRow[colIndex] = parsedVal;
        return updatedRow;
      });
      tc.expectedRows = rows;
      tc.expectedOutput = JSON.stringify({ columns: tc.expectedColumns || [], rows }, null, 2);
      testCases[tcIndex] = tc;
      return {
        ...prev,
        codingConfig: {
          ...current,
          testCases,
        },
      };
    });
  };

  const removeSqlRow = (tcIndex, rowIndex) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const testCases = [...(current.testCases || [])];
      const tc = { ...testCases[tcIndex] };
      const rows = (tc.expectedRows || []).filter((_, idx) => idx !== rowIndex);
      tc.expectedRows = rows;
      tc.expectedOutput = JSON.stringify({ columns: tc.expectedColumns || [], rows }, null, 2);
      testCases[tcIndex] = tc;
      return {
        ...prev,
        codingConfig: {
          ...current,
          testCases,
        },
      };
    });
  };

  const updateSqlRawJson = (tcIndex, jsonStr) => {
    setFormData((prev) => {
      const current = prev.codingConfig || {};
      const testCases = [...(current.testCases || [])];
      const tc = { ...testCases[tcIndex], expectedOutput: jsonStr };

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.columns)) tc.expectedColumns = parsed.columns;
          if (Array.isArray(parsed.rows)) tc.expectedRows = parsed.rows;
          else if (Array.isArray(parsed)) {
            if (parsed.length > 0) {
              tc.expectedColumns = Object.keys(parsed[0]);
              tc.expectedRows = parsed;
            } else {
              tc.expectedColumns = [];
              tc.expectedRows = [];
            }
          }
        }
      } catch {
        // Keep raw string
      }

      testCases[tcIndex] = tc;
      return {
        ...prev,
        codingConfig: {
          ...current,
          testCases,
        },
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.questionText.trim()) {
      toast.error('Question prompt is required.');
      return;
    }

    // MCQ Validation
    if (formData.type === 'mcq') {
      const emptyOpts = formData.options.filter((o) => !o.text.trim());
      if (emptyOpts.length > 0) {
        toast.error('All MCQ options must have text.');
        return;
      }
      if (!formData.correctAnswer) {
        toast.error('Please select the correct answer for the MCQ.');
        return;
      }
    }

    // Coding Question Validation (Separate from SQL)
    if (formData.type === 'code') {
      const allowed = (formData.codingConfig?.allowedLanguages || []).filter((l) =>
        ['python', 'javascript'].includes(l)
      );
      if (allowed.length === 0) {
        toast.error('At least one programming runtime (Python or JavaScript) must be enabled.');
        return;
      }
      if (!['python', 'javascript'].includes(formData.codingConfig?.defaultLanguage)) {
        toast.error('Default language must be Python or JavaScript.');
        return;
      }
      const testCases = formData.codingConfig?.testCases || [];
      if (testCases.length === 0) {
        toast.error('Coding questions must have at least one test case.');
        return;
      }
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        if (!tc.expectedOutput || !tc.expectedOutput.trim()) {
          toast.error(`Test Case #${i + 1} must specify expected stdout.`);
          return;
        }
      }
    }

    // SQL Question Validation (Separate from Coding)
    if (formData.type === 'sql') {
      const dialect = (formData.codingConfig?.sqlDialect || 'sqlite').toLowerCase();
      if (dialect !== 'sqlite') {
        toast.error('SQL examination supports SQLite 3 only.');
        return;
      }
      const schemaDdl = (formData.codingConfig?.schemaDdl || '').trim();
      if (!schemaDdl) {
        toast.error('SQL questions require Schema DDL (table definitions and seed records).');
        return;
      }
      const testCases = formData.codingConfig?.testCases || [];
      if (testCases.length === 0) {
        toast.error('SQL questions must have at least one test case.');
        return;
      }
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const hasStructured =
          (tc.expectedColumns && tc.expectedColumns.length > 0) ||
          (tc.expectedRows && tc.expectedRows.length > 0);
        const hasOutput = tc.expectedOutput && tc.expectedOutput.trim().length > 0;
        if (!hasStructured && !hasOutput) {
          toast.error(`SQL Test Case #${i + 1} must specify expected columns and rows.`);
          return;
        }
      }
    }

    try {
      setIsSaving(true);
      const tags = formData.tagsInput
        ? formData.tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      let codingConfigPayload = undefined;

      if (formData.type === 'code') {
        const allowed = (formData.codingConfig?.allowedLanguages || ['python']).filter((l) =>
          ['python', 'javascript'].includes(l)
        );
        const defaultLang = allowed.includes(formData.codingConfig?.defaultLanguage)
          ? formData.codingConfig.defaultLanguage
          : allowed[0] || 'python';

        codingConfigPayload = {
          executionCategory: 'code',
          allowedLanguages: allowed,
          defaultLanguage: defaultLang,
          starterCode: formData.codingConfig?.starterCode || {},
          schemaDdl: '',
          cpuTimeLimitMs: Number(formData.codingConfig?.cpuTimeLimitMs) || 2000,
          memoryLimitMb: Number(formData.codingConfig?.memoryLimitMb) || 256,
          testCases: (formData.codingConfig?.testCases || []).map((tc) => ({
            input: tc.input || '',
            expectedOutput: tc.expectedOutput?.trim() || '',
            isHidden: Boolean(tc.isHidden),
            weight: Number(tc.weight) >= 1 ? Number(tc.weight) : 1,
            explanation: tc.explanation || '',
          })),
        };
      } else if (formData.type === 'sql') {
        const dialect = formData.codingConfig?.sqlDialect || 'sqlite';
        codingConfigPayload = {
          executionCategory: 'sql',
          sqlDialect: dialect,
          allowedLanguages: [dialect],
          defaultLanguage: dialect,
          starterCode: formData.codingConfig?.starterCode || {},
          schemaDdl: formData.codingConfig?.schemaDdl || '',
          cpuTimeLimitMs: Number(formData.codingConfig?.cpuTimeLimitMs) || 2000,
          memoryLimitMb: Number(formData.codingConfig?.memoryLimitMb) || 256,
          testCases: (formData.codingConfig?.testCases || []).map((tc) => {
            let output = tc.expectedOutput || '';
            if (!output && (tc.expectedColumns?.length > 0 || tc.expectedRows?.length > 0)) {
              output = JSON.stringify(
                {
                  columns: tc.expectedColumns || [],
                  rows: tc.expectedRows || [],
                },
                null,
                2
              );
            }
            return {
              input: '',
              expectedOutput: output,
              expectedColumns: tc.expectedColumns || [],
              expectedRows: tc.expectedRows || [],
              isHidden: Boolean(tc.isHidden),
              weight: Number(tc.weight) >= 1 ? Number(tc.weight) : 1,
              explanation: tc.explanation || '',
            };
          }),
        };
      }

      const payload = {
        questionText: formData.questionText.trim(),
        type: formData.type,
        options: formData.type === 'mcq' ? formData.options : [],
        correctAnswer:
          formData.type === 'mcq'
            ? formData.correctAnswer
            : formData.correctAnswer?.trim() || null,
        explanation: formData.explanation.trim() || null,
        points: parseInt(formData.points, 10) || 5,
        difficulty: formData.difficulty,
        bloomLevel: formData.bloomLevel,
        category: formData.category.trim() || 'General',
        tags,
        fileUploadConfig: formData.type === 'file_upload' ? formData.fileUploadConfig : undefined,
        codingConfig: codingConfigPayload,
      };

      if (isEditing) {
        await questionBankService.updateQuestion(id, payload);
        toast.success('Question updated successfully in Question Bank.');
      } else {
        await questionBankService.createQuestion(payload);
        toast.success('Question added to Question Bank.');
      }

      navigate('/instructor/question-bank');
    } catch (err) {
      toast.error(err.message || 'Failed to save question.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            to="/instructor/question-bank"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditing ? 'Edit Question Bank Item' : 'Create Question Bank Item'}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Updates will preserve historical assessments and submissions.'
                : 'Questions added here are instantly available across all assessments.'}
            </p>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-2.5 text-xs text-indigo-900">
          <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Automatic Versioning Guard:</span> If this question is already utilized in existing assessments, saving changes will automatically create a new version (e.g. Version 2). Historical assessments and student attempt grades remain permanently anchored to their original versions.
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-5">
          {/* Question Text Prompt */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Question Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formData.questionText}
              onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
              placeholder="e.g. What is the tightest upper bound time complexity of inserting into a Red-Black Tree?"
              className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />

            {/* Duplicate Detection Alert */}
            {duplicateWarning && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Possible Duplicate Detected:</span> A very similar question already exists in your Question Bank:
                  <div className="italic text-slate-700 mt-1">
                    "{duplicateWarning.questionText}" ({duplicateWarning.category})
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Classification & Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Question Type</label>
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="mcq">MCQ (Multiple Choice)</option>
                <option value="code">Programming Problem (Python / JS)</option>
                <option value="sql">SQL Query Problem (Database)</option>
                <option value="short_answer">Short Answer</option>
                <option value="long_answer">Long Answer</option>
                <option value="file_upload">File Upload (Document)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bloom Taxonomy</label>
              <select
                value={formData.bloomLevel}
                onChange={(e) => setFormData({ ...formData, bloomLevel: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="REMEMBER">REMEMBER</option>
                <option value="UNDERSTAND">UNDERSTAND</option>
                <option value="APPLY">APPLY</option>
                <option value="ANALYZE">ANALYZE</option>
                <option value="EVALUATE">EVALUATE</option>
                <option value="CREATE">CREATE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Points Value</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category / Subject Area</label>
              <input
                type="text"
                placeholder="e.g. Algorithms, System Design"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tags (Comma Separated)</label>
              <input
                type="text"
                placeholder="e.g. tree, sorting, sql, join"
                value={formData.tagsInput}
                onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* ============================================================== */}
          {/* CATEGORY 1: PROGRAMMING PROBLEM (PYTHON / JAVASCRIPT ONLY)    */}
          {/* ============================================================== */}
          {formData.type === 'code' && (
            <div className="pt-3 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <Terminal className="w-4 h-4 text-primary-600" />
                  <span>Programming Language Runtimes (Python & JavaScript Only)</span>
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  Selectable runtimes: Python 3.11, JavaScript (Node.js 20)
                </div>
              </div>

              {/* Allowed Programming Languages */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Permitted Runtimes <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {PROGRAMMING_RUNTIMES.map((rt) => {
                    const isAllowed = (formData.codingConfig?.allowedLanguages || []).includes(rt.id);
                    const isDefault = formData.codingConfig?.defaultLanguage === rt.id;
                    return (
                      <div
                        key={rt.id}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                          isAllowed
                            ? 'border-primary-500/50 bg-primary-50/20 shadow-sm'
                            : 'border-slate-200 opacity-60 bg-slate-50'
                        }`}
                      >
                        <label className="flex items-center space-x-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isAllowed}
                            onChange={() => toggleAllowedProgrammingLanguage(rt.id)}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span>{rt.label}</span>
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">
                                {rt.badge}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Language Runtime
                            </div>
                          </div>
                        </label>

                        {isAllowed && (
                          <button
                            type="button"
                            onClick={() => updateCodingConfig('defaultLanguage', rt.id)}
                            title={isDefault ? 'Default language' : 'Click to make default language'}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              isDefault
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                            }`}
                          >
                            {isDefault ? 'Default' : 'Set Default'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Execution Ceilings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CPU Time Limit (ms)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="500"
                      max="10000"
                      step="500"
                      value={formData.codingConfig?.cpuTimeLimitMs ?? 2000}
                      onChange={(e) =>
                        updateCodingConfig(
                          'cpuTimeLimitMs',
                          Math.max(500, Math.min(10000, parseInt(e.target.value, 10) || 2000))
                        )
                      }
                      className="w-32 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-primary-500"
                    />
                    <span className="text-xs text-slate-500">ms (500 - 10,000ms)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Memory Ceiling (MB)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="64"
                      max="512"
                      step="64"
                      value={formData.codingConfig?.memoryLimitMb ?? 256}
                      onChange={(e) =>
                        updateCodingConfig(
                          'memoryLimitMb',
                          Math.max(64, Math.min(512, parseInt(e.target.value, 10) || 256))
                        )
                      }
                      className="w-32 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-primary-500"
                    />
                    <span className="text-xs text-slate-500">MB (64 - 512MB)</span>
                  </div>
                </div>
              </div>

              {/* Starter Code Editor with Tabs */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Code2 className="w-3.5 h-3.5 text-primary-600" />
                    <span>Starter Code Template</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Template loaded into student editor
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(formData.codingConfig?.allowedLanguages || ['python']).map((langId) => {
                    const rtMeta = PROGRAMMING_RUNTIMES.find((r) => r.id === langId) || { label: langId };
                    const activeTab = activeCodeTab || formData.codingConfig?.defaultLanguage || 'python';
                    const isActive = activeTab === langId;
                    return (
                      <button
                        key={langId}
                        type="button"
                        onClick={() => setActiveCodeTab(langId)}
                        className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                          isActive
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {rtMeta.label}
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const activeTab =
                    activeCodeTab && (formData.codingConfig?.allowedLanguages || []).includes(activeCodeTab)
                      ? activeCodeTab
                      : formData.codingConfig?.defaultLanguage || 'python';

                  const codeVal =
                    formData.codingConfig?.starterCode &&
                    formData.codingConfig.starterCode[activeTab] !== undefined
                      ? formData.codingConfig.starterCode[activeTab]
                      : DEFAULT_STARTER_CODE[activeTab] || '';

                  return (
                    <CodeEditor
                      value={codeVal}
                      onChange={(val) => updateStarterCode(activeTab, val)}
                      language={activeTab}
                      height="180px"
                      placeholder={`Enter starter template for ${activeTab}...`}
                    />
                  );
                })()}
              </div>

              {/* Test Cases Suite for Code */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-primary-600" />
                      <span>Automated Test Cases Suite <span className="text-red-500">*</span></span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Hidden cases are evaluated securely on final submit and never shown to candidates.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={addTestCase}
                    className="text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Test Case
                  </Button>
                </div>

                <div className="space-y-3">
                  {(formData.codingConfig?.testCases || []).map((tc, tcIndex) => (
                    <div
                      key={tc.id || tcIndex}
                      className={`p-3.5 rounded-xl border transition-all ${
                        tc.isHidden
                          ? 'border-indigo-200 bg-indigo-50/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary-100 text-primary-700">
                            Case #{tcIndex + 1}
                          </span>
                          <label className="flex items-center space-x-1.5 text-xs text-slate-700">
                            <span className="text-slate-500">Weight:</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={tc.weight ?? 1}
                              onChange={(e) =>
                                updateTestCase(tcIndex, 'weight', Math.max(1, parseInt(e.target.value, 10) || 1))
                              }
                              className="w-14 px-2 py-0.5 text-xs bg-white border border-slate-300 rounded text-center font-bold"
                            />
                            <span className="text-slate-500">pts</span>
                          </label>
                        </div>

                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-1.5 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(tc.isHidden)}
                              onChange={(e) => updateTestCase(tcIndex, 'isHidden', e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span
                              className={`font-medium ${
                                tc.isHidden ? 'text-indigo-600 font-semibold' : 'text-slate-500'
                              }`}
                            >
                              {tc.isHidden ? 'Hidden Case (Grading Only)' : 'Visible (Public Sample)'}
                            </span>
                          </label>

                          {(formData.codingConfig?.testCases || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTestCase(tcIndex)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              title="Remove Test Case"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Standard Input (stdin)
                          </label>
                          <textarea
                            rows={2}
                            value={tc.input || ''}
                            onChange={(e) => updateTestCase(tcIndex, 'input', e.target.value)}
                            placeholder="Leave empty if program requires no stdin..."
                            className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-primary-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Expected Output (stdout) <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            rows={2}
                            value={tc.expectedOutput || ''}
                            onChange={(e) => updateTestCase(tcIndex, 'expectedOutput', e.target.value)}
                            placeholder="Expected console output..."
                            className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-primary-500"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <input
                          type="text"
                          value={tc.explanation || ''}
                          onChange={(e) => updateTestCase(tcIndex, 'explanation', e.target.value)}
                          placeholder="Optional explanation note for this test case (e.g. Edge case: empty input list)"
                          className="w-full px-3 py-1 text-xs bg-white border border-slate-200 rounded text-slate-600 focus:outline-none focus:border-primary-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CATEGORY 2: SQL EXECUTION (SELECTABLE DIALECT & STRUCTURED RES) */}
          {/* ============================================================== */}
          {formData.type === 'sql' && (
            <div className="pt-3 border-t border-slate-200 space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>SQL Execution Category & Relational Sandbox</span>
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  Target SQL Engine: SQLite 3 (In-Memory Sandbox)
                </div>
              </div>

              {/* Selectable SQL Dialect */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Target SQL Engine / Dialect <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {SQL_DIALECTS.map((dialect) => {
                    const isSelected = (formData.codingConfig?.sqlDialect || 'sqlite') === dialect.id;
                    return (
                      <button
                        key={dialect.id}
                        type="button"
                        onClick={() => handleSqlDialectChange(dialect.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900">{dialect.label}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded">
                              Active Dialect
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{dialect.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schema DDL */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>SQL Schema DDL (Table Creations & Seed Data) <span className="text-red-500">*</span></span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Executed inside isolated sandbox before running candidate query
                  </span>
                </div>
                <CodeEditor
                  value={formData.codingConfig?.schemaDdl || ''}
                  onChange={(val) => updateCodingConfig('schemaDdl', val)}
                  language={formData.codingConfig?.sqlDialect || 'sqlite'}
                  height="160px"
                  placeholder="-- CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(50));\n-- INSERT INTO students VALUES (1, 'Alice');"
                />
              </div>

              {/* Starter Query Template */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Code2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Starter Query Template</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Initial query prompt presented to candidate
                  </span>
                </div>
                {(() => {
                  const dialect = formData.codingConfig?.sqlDialect || 'sqlite';
                  const codeVal =
                    formData.codingConfig?.starterCode &&
                    formData.codingConfig.starterCode[dialect] !== undefined
                      ? formData.codingConfig.starterCode[dialect]
                      : DEFAULT_STARTER_CODE[dialect] || '';
                  return (
                    <CodeEditor
                      value={codeVal}
                      onChange={(val) => updateStarterCode(dialect, val)}
                      language={dialect}
                      height="120px"
                      placeholder={`-- Starter ${dialect} query template`}
                    />
                  );
                })()}
              </div>

              {/* SQL Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Query Timeout Ceiling (ms)
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    step="500"
                    value={formData.codingConfig?.cpuTimeLimitMs ?? 2000}
                    onChange={(e) =>
                      updateCodingConfig(
                        'cpuTimeLimitMs',
                        Math.max(500, Math.min(10000, parseInt(e.target.value, 10) || 2000))
                      )
                    }
                    className="w-32 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Memory Ceiling (MB)
                  </label>
                  <input
                    type="number"
                    min="64"
                    max="512"
                    step="64"
                    value={formData.codingConfig?.memoryLimitMb ?? 256}
                    onChange={(e) =>
                      updateCodingConfig(
                        'memoryLimitMb',
                        Math.max(64, Math.min(512, parseInt(e.target.value, 10) || 256))
                      )
                    }
                    className="w-32 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Structured SQL Expected-Result Test Cases */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Structured SQL Test Cases & Expected Results <span className="text-red-500">*</span></span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Evaluates columns, types, and tabular row results returned by candidate SQL query.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={addTestCase}
                    className="text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add SQL Case
                  </Button>
                </div>

                <div className="space-y-4">
                  {(formData.codingConfig?.testCases || []).map((tc, tcIndex) => {
                    const viewMode = sqlViewMode[tcIndex] || 'visual';
                    const columns = tc.expectedColumns || [];
                    const rows = tc.expectedRows || [];

                    return (
                      <div
                        key={tc.id || tcIndex}
                        className={`p-4 rounded-xl border transition-all ${
                          tc.isHidden ? 'border-indigo-200 bg-indigo-50/20' : 'border-slate-200 bg-white'
                        }`}
                      >
                        {/* Header bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                              SQL Case #{tcIndex + 1}
                            </span>
                            <label className="flex items-center space-x-1.5 text-xs text-slate-700">
                              <span className="text-slate-500">Weight:</span>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={tc.weight ?? 1}
                                onChange={(e) =>
                                  updateTestCase(tcIndex, 'weight', Math.max(1, parseInt(e.target.value, 10) || 1))
                                }
                                className="w-14 px-2 py-0.5 text-xs bg-white border border-slate-300 rounded text-center font-bold"
                              />
                              <span className="text-slate-500">pts</span>
                            </label>
                          </div>

                          <div className="flex items-center space-x-3">
                            {/* Mode Toggle: Visual vs JSON */}
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
                              <button
                                type="button"
                                onClick={() =>
                                  setSqlViewMode((prev) => ({ ...prev, [tcIndex]: 'visual' }))
                                }
                                className={`px-2 py-0.5 rounded font-medium ${
                                  viewMode === 'visual' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
                                }`}
                              >
                                Visual Builder
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSqlViewMode((prev) => ({ ...prev, [tcIndex]: 'json' }))
                                }
                                className={`px-2 py-0.5 rounded font-medium ${
                                  viewMode === 'json' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
                                }`}
                              >
                                JSON View
                              </button>
                            </div>

                            <label className="flex items-center space-x-1.5 text-xs cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={Boolean(tc.isHidden)}
                                onChange={(e) => updateTestCase(tcIndex, 'isHidden', e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span
                                className={`font-medium ${
                                  tc.isHidden ? 'text-indigo-600 font-semibold' : 'text-slate-500'
                                }`}
                              >
                                {tc.isHidden ? 'Hidden (Grading Only)' : 'Visible (Public Sample)'}
                              </span>
                            </label>

                            {(formData.codingConfig?.testCases || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTestCase(tcIndex)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                title="Remove SQL Case"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Visual Builder Mode */}
                        {viewMode === 'visual' ? (
                          <div className="space-y-3 pt-3">
                            {/* Expected Columns */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                  <Columns className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Expected Columns (Comma Separated)</span>
                                </label>
                                <span className="text-[10px] text-slate-400">
                                  Case-insensitive column header verification
                                </span>
                              </div>
                              <input
                                type="text"
                                placeholder="e.g. id, name, gpa"
                                value={columns.join(', ')}
                                onChange={(e) => updateSqlColumns(tcIndex, e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                              />

                              {columns.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  {columns.map((col, cIdx) => (
                                    <span
                                      key={cIdx}
                                      className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono rounded font-semibold"
                                    >
                                      {col}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Expected Rows Table */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700">
                                  Expected Tabular Rows ({rows.length} row{rows.length === 1 ? '' : 's'})
                                </label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addSqlRow(tcIndex)}
                                  className="text-[11px] py-0.5 px-2 h-auto"
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Add Row
                                </Button>
                              </div>

                              {columns.length === 0 ? (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                  Enter expected column names above to configure tabular row values.
                                </div>
                              ) : rows.length === 0 ? (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                                  No expected rows configured. Click "Add Row" to define expected query result.
                                </div>
                              ) : (
                                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                                  <table className="min-w-full text-xs divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="px-2 py-1.5 text-left text-[10px] font-bold text-slate-500 uppercase w-8">
                                          #
                                        </th>
                                        {columns.map((col, colIdx) => (
                                          <th
                                            key={colIdx}
                                            className="px-2 py-1.5 text-left text-[10px] font-bold text-slate-700 font-mono"
                                          >
                                            {col}
                                          </th>
                                        ))}
                                        <th className="px-2 py-1.5 text-right w-10"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {rows.map((row, rowIdx) => {
                                        const rowVals = Array.isArray(row)
                                          ? row
                                          : columns.map((c) => (row && typeof row === 'object' ? row[c] : ''));
                                        return (
                                          <tr key={rowIdx} className="hover:bg-slate-50/50">
                                            <td className="px-2 py-1 text-slate-400 font-mono text-[10px]">
                                              {rowIdx + 1}
                                            </td>
                                            {columns.map((col, colIdx) => (
                                              <td key={colIdx} className="px-2 py-1">
                                                <input
                                                  type="text"
                                                  value={rowVals[colIdx] ?? ''}
                                                  onChange={(e) =>
                                                    updateSqlCell(tcIndex, rowIdx, colIdx, e.target.value)
                                                  }
                                                  placeholder={`value...`}
                                                  className="w-full px-2 py-1 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                                                />
                                              </td>
                                            ))}
                                            <td className="px-2 py-1 text-right">
                                              <button
                                                type="button"
                                                onClick={() => removeSqlRow(tcIndex, rowIdx)}
                                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                                                title="Delete Row"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* JSON View Mode */
                          <div className="space-y-1.5 pt-3">
                            <label className="block text-xs font-semibold text-slate-700">
                              Expected SQL Output (Structured JSON Table)
                            </label>
                            <textarea
                              rows={5}
                              value={tc.expectedOutput || ''}
                              onChange={(e) => updateSqlRawJson(tcIndex, e.target.value)}
                              placeholder={`{\n  "columns": ["id", "name"],\n  "rows": [\n    [1, "Alice Smith"]\n  ]\n}`}
                              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                            />
                            <p className="text-[10px] text-slate-500">
                              Supports structured object <code className="text-emerald-700 font-mono">{'{ columns, rows }'}</code> or an array of row objects <code className="text-emerald-700 font-mono">{'[ { id: 1, name: "Alice" } ]'}</code>.
                            </p>
                          </div>
                        )}

                        <div className="pt-2">
                          <input
                            type="text"
                            value={tc.explanation || ''}
                            onChange={(e) => updateTestCase(tcIndex, 'explanation', e.target.value)}
                            placeholder="Optional explanation note for this SQL test case (e.g. Verifies GPA filtering and sorting)"
                            className="w-full px-3 py-1 text-xs bg-white border border-slate-200 rounded text-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CATEGORY 3: MULTIPLE CHOICE (MCQ)                              */}
          {/* ============================================================== */}
          {formData.type === 'mcq' && (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Multiple Choice Options & Correct Answer
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  className="flex items-center gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Option
                </Button>
              </div>

              <div className="space-y-2">
                {formData.options.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={formData.correctAnswer === opt.id}
                      onChange={() => setFormData({ ...formData, correctAnswer: opt.id })}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      title="Select as correct answer"
                    />
                    <span className="text-xs font-bold text-slate-500 uppercase w-5 text-center">
                      {opt.id}.
                    </span>
                    <input
                      type="text"
                      placeholder={`Option ${opt.id.toUpperCase()} text...`}
                      value={opt.text}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className="flex-1 p-2 border border-slate-300 rounded-md text-sm"
                      required
                    />
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        title="Remove option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CATEGORY 4: FILE UPLOAD CONFIGURATION                           */}
          {/* ============================================================== */}
          {formData.type === 'file_upload' && (
            <div className="pt-2 border-t border-slate-200 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <span>File Upload Submission Parameters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Allowed Extensions (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={(formData.fileUploadConfig?.allowedFileTypes || ['pdf', 'doc', 'docx']).join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fileUploadConfig: {
                          ...(formData.fileUploadConfig || {}),
                          allowedFileTypes: e.target.value.split(',').map((s) => s.trim().replace(/^\./, '')).filter(Boolean),
                        },
                      })
                    }
                    placeholder="pdf, doc, docx"
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max File Size Ceiling (MB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.fileUploadConfig?.maxFileSizeMb ?? 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fileUploadConfig: {
                          ...(formData.fileUploadConfig || {}),
                          maxFileSizeMb: Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 10)),
                        },
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CATEGORY 5: SHORT & LONG ANSWER RUBRIC KEY                     */}
          {/* ============================================================== */}
          {['short_answer', 'long_answer'].includes(formData.type) && (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sample Correct Answer / Rubric Criterion
                </label>
                <textarea
                  rows={2}
                  placeholder="Expected answer key or evaluation criteria for grading..."
                  value={formData.correctAnswer}
                  onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
          )}

          {/* Explanation / Pedagogical Feedback */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Explanation & Feedback (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Provide context on why this answer is correct or helpful learning feedback..."
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/instructor/question-bank')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update Question' : 'Save to Question Bank'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default QuestionBankCreate;
