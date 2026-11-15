import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { sql, PostgreSQL, MySQL, SQLite } from '@codemirror/lang-sql';

/**
 * Reusable CodeMirror Editor Component for UAP
 * Strictly supports only: Python, JavaScript, and SQL (SQLite, PostgreSQL, MySQL)
 */
const CodeEditor = ({
  value = '',
  onChange,
  language = 'python',
  height = '220px',
  readOnly = false,
  placeholder = '',
  className = '',
  minHeight = '140px',
}) => {
  // Select grammar extensions strictly according to approved language scope
  const extensions = useMemo(() => {
    switch (language) {
      case 'python':
        return [python()];
      case 'javascript':
        return [javascript({ jsx: false })];
      case 'sqlite':
        return [sql({ dialect: SQLite })];
      case 'postgresql':
        return [sql({ dialect: PostgreSQL })];
      case 'mysql':
        return [sql({ dialect: MySQL })];
      default:
        return [python()];
    }
  }, [language]);

  // Determine if dark theme is currently active in the document root
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className={`overflow-hidden rounded-xl border border-[#EBE3D8] dark:border-[#2D3748] shadow-sm bg-white dark:bg-[#0E131F] ${className}`}>
      <CodeMirror
        value={value || ''}
        height={height}
        minHeight={minHeight}
        theme={isDark ? 'dark' : 'light'}
        extensions={extensions}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
        className="font-mono text-xs sm:text-sm"
      />
    </div>
  );
};

export default CodeEditor;
