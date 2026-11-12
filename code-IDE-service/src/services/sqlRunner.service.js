const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../utils/logger');

// Forbidden SQL statements/functions that could compromise host, filesystem, or grant privileges
const FORBIDDEN_SQL_PATTERNS = [
  /\bATTACH\s+DATABASE\b/i,
  /\bDETACH\s+DATABASE\b/i,
  /\bLOAD_FILE\b/i,
  /\bINTO\s+OUTFILE\b/i,
  /\bINTO\s+DUMPFILE\b/i,
  /\bpg_read_file\b/i,
  /\bpg_write_file\b/i,
  /\bpg_execute_server_program\b/i,
  /\bCOPY\s+.*\bPROGRAM\b/i,
  /\bALTER\s+SYSTEM\b/i,
  /\bSHUTDOWN\b/i,
  /\bGRANT\s+.*\bTO\b/i,
  /\bREVOKE\s+.*\bFROM\b/i,
  /\bCREATE\s+USER\b/i,
  /\bDROP\s+USER\b/i,
];

class SqlRunnerService {
  /**
   * Validate that student query does not contain prohibited administrative or filesystem operations
   */
  validateQuerySecurity(query) {
    for (const pattern of FORBIDDEN_SQL_PATTERNS) {
      if (pattern.test(query)) {
        return {
          allowed: false,
          error: `Prohibited SQL statement detected: statement violates sandbox security policy.`,
        };
      }
    }
    return { allowed: true };
  }

  /**
   * Normalize tabular SQL result rows for deterministic comparison
   */
  normalizeSqlRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      if (typeof row !== 'object' || row === null) return row;
      const cleanRow = {};
      for (const [key, val] of Object.entries(row)) {
        cleanRow[key.toLowerCase()] = typeof val === 'bigint' ? Number(val) : val;
      }
      return cleanRow;
    });
  }

  /**
   * Determine if a string is a clean, safe numeric representation without leading zeros
   * (e.g. "95", "95.0", "-12.5" vs "0123" which is a string identifier / code).
   */
  isSafeNumericString(val) {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed === '') return false;
    return /^-?(0|[1-9]\d*)(\.\d+)?$/.test(trimmed);
  }

  /**
   * Safely compare two cell values following strict SQL semantics:
   * - Explicit NULL: null === null, null !== "", null !== 0
   * - Safe Numeric Normalization: numbers & clean numeric strings within 1e-6 tolerance
   * - Arbitrary strings (like leading-zero postal codes "0123"): preserved as strings
   */
  areCellsEqual(actVal, expVal) {
    const isActNull = actVal === null || actVal === undefined;
    const isExpNull = expVal === null || expVal === undefined;

    if (isActNull && isExpNull) return true;
    if (isActNull !== isExpNull) return false;

    // Convert BigInt to Number
    const a = typeof actVal === 'bigint' ? Number(actVal) : actVal;
    const b = typeof expVal === 'bigint' ? Number(expVal) : expVal;

    if (a === b) return true;

    const isANum = typeof a === 'number';
    const isBNum = typeof b === 'number';
    const isAStr = typeof a === 'string';
    const isBStr = typeof b === 'string';

    if (isANum && isBNum) {
      if (Number.isNaN(a) && Number.isNaN(b)) return true;
      return Math.abs(a - b) < 1e-6;
    }

    if (isANum && isBStr && this.isSafeNumericString(b)) {
      return Math.abs(a - Number(b)) < 1e-6;
    }

    if (isAStr && isBNum && this.isSafeNumericString(a)) {
      return Math.abs(Number(a) - b) < 1e-6;
    }

    if (isAStr && isBStr) {
      if (this.isSafeNumericString(a) && this.isSafeNumericString(b)) {
        return Math.abs(Number(a) - Number(b)) < 1e-6;
      }
      return a === b;
    }

    if (typeof a === 'boolean' || typeof b === 'boolean') {
      return Boolean(a) === Boolean(b);
    }

    return false;
  }

  /**
   * Extract cell value from a row whether represented as object or array
   */
  getCellValue(row, colKey, colIndex) {
    if (row === null || row === undefined) return null;
    if (Array.isArray(row)) {
      return row[colIndex];
    }
    if (typeof row === 'object') {
      if (colKey !== undefined && colKey !== null) {
        if (colKey in row) return row[colKey];
        const lowerKey = String(colKey).toLowerCase().trim();
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase().trim() === lowerKey) return v;
        }
      }
      return undefined;
    }
    return row;
  }

  /**
   * Compare two rows across specified columns
   */
  areRowsEqual(rowA, rowB, cols = []) {
    if (cols && cols.length > 0) {
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const valA = this.getCellValue(rowA, col, c);
        const valB = this.getCellValue(rowB, col, c);
        if (!this.areCellsEqual(valA, valB)) {
          return false;
        }
      }
      return true;
    }

    if (Array.isArray(rowA) && Array.isArray(rowB)) {
      if (rowA.length !== rowB.length) return false;
      for (let i = 0; i < rowA.length; i++) {
        if (!this.areCellsEqual(rowA[i], rowB[i])) return false;
      }
      return true;
    }

    if (typeof rowA === 'object' && typeof rowB === 'object' && rowA !== null && rowB !== null) {
      const keysA = Object.keys(rowA).map((k) => k.toLowerCase().trim());
      const keysB = Object.keys(rowB).map((k) => k.toLowerCase().trim());
      const allKeys = Array.from(new Set([...keysA, ...keysB]));
      for (const k of allKeys) {
        const valA = this.getCellValue(rowA, k);
        const valB = this.getCellValue(rowB, k);
        if (!this.areCellsEqual(valA, valB)) return false;
      }
      return true;
    }

    return this.areCellsEqual(rowA, rowB);
  }

  /**
   * Match rows as a multiset (bag equality), strictly preserving duplicates and multiplicity
   */
  matchesMultiset(actualRows, expectedRows, cols = []) {
    if (actualRows.length !== expectedRows.length) return false;
    const matched = new Array(expectedRows.length).fill(false);
    for (let i = 0; i < actualRows.length; i++) {
      let found = false;
      for (let j = 0; j < expectedRows.length; j++) {
        if (!matched[j] && this.areRowsEqual(actualRows[i], expectedRows[j], cols)) {
          matched[j] = true;
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  /**
   * Compare actual SQL query results against expected results.
   * Supports:
   * 1. Structured SQL comparison with columns and rows:
   *    { columns: ['id', 'name'], rows: [[1, 'Alice'], [2, 'Bob']] }
   *    or { columns: ['id', 'name'], rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] }
   * 2. Array of row objects:
   *    [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
   * 3. Serialized JSON string of any of the above.
   */
  compareSqlExpected(actualRows, actualColumns = [], expectedOutput) {
    if (expectedOutput === null || expectedOutput === undefined) {
      return { verdict: 'ACCEPTED', reason: '' };
    }

    let parsedExpected = expectedOutput;
    if (typeof expectedOutput === 'string') {
      const trimmed = expectedOutput.trim();
      if (trimmed === '') {
        return { verdict: 'ACCEPTED', reason: '' };
      }
      try {
        parsedExpected = JSON.parse(trimmed);
      } catch {
        // If string does not parse as JSON, check raw text equivalence
        if (trimmed === JSON.stringify(actualRows, null, 2).trim()) {
          return { verdict: 'ACCEPTED', reason: '' };
        }
        return {
          verdict: 'WRONG_ANSWER',
          reason: 'Malformed expected output JSON format',
        };
      }
    }

    let expColumns = null;
    let expRows = [];
    let isOrdered = false;
    let ignoreColumnOrder = false;

    if (
      parsedExpected &&
      typeof parsedExpected === 'object' &&
      !Array.isArray(parsedExpected)
    ) {
      if ('columns' in parsedExpected || 'rows' in parsedExpected) {
        expColumns = Array.isArray(parsedExpected.columns)
          ? parsedExpected.columns.map((c) => String(c).toLowerCase().trim())
          : null;
        expRows = Array.isArray(parsedExpected.rows) ? parsedExpected.rows : [];
        isOrdered = Boolean(parsedExpected.ordered);
        ignoreColumnOrder = Boolean(parsedExpected.ignoreColumnOrder);
      } else {
        expRows = [parsedExpected];
      }
    } else if (Array.isArray(parsedExpected)) {
      expRows = parsedExpected;
    } else {
      return {
        verdict: 'WRONG_ANSWER',
        reason: 'Malformed expected output JSON format',
      };
    }

    const actColumns = (actualColumns || []).map((c) => String(c).toLowerCase().trim());
    const actRows = Array.isArray(actualRows) ? actualRows : [];

    // 1. Column verification
    if (expColumns !== null && expColumns.length > 0) {
      if (actColumns.length > 0) {
        const actColSet = new Set(actColumns);
        const missingCols = expColumns.filter((c) => !actColSet.has(c));

        if (missingCols.length > 0 || expColumns.length !== actColumns.length) {
          return {
            verdict: 'WRONG_ANSWER',
            reason: `Column mismatch: expected [${expColumns.join(', ')}], received [${actColumns.join(', ')}]`,
          };
        }

        if (!ignoreColumnOrder) {
          const orderMismatch = expColumns.some((col, i) => col !== actColumns[i]);
          if (orderMismatch) {
            return {
              verdict: 'WRONG_ANSWER',
              reason: `Column order mismatch: expected [${expColumns.join(', ')}], received [${actColumns.join(', ')}]`,
            };
          }
        }
      } else if (actRows.length === 0 && expRows.length === 0) {
        return { verdict: 'ACCEPTED', reason: '' };
      }
    }

    // Determine canonical column order for row values
    const cols =
      expColumns && expColumns.length > 0
        ? expColumns
        : actColumns.length > 0
        ? actColumns
        : expRows.length > 0 && typeof expRows[0] === 'object' && !Array.isArray(expRows[0])
        ? Object.keys(expRows[0]).map((c) => c.toLowerCase().trim())
        : [];

    // 2. Row count verification
    if (actRows.length !== expRows.length) {
      return {
        verdict: 'WRONG_ANSWER',
        reason: `Row count mismatch: expected ${expRows.length} rows, received ${actRows.length} rows`,
      };
    }

    if (actRows.length === 0 && expRows.length === 0) {
      return { verdict: 'ACCEPTED', reason: '' };
    }

    // 3. Row values and ordering verification
    if (isOrdered) {
      for (let i = 0; i < expRows.length; i++) {
        if (!this.areRowsEqual(actRows[i], expRows[i], cols)) {
          const multisetMatches = this.matchesMultiset(actRows, expRows, cols);
          if (multisetMatches) {
            return { verdict: 'WRONG_ANSWER', reason: 'Row order mismatch' };
          }
          return { verdict: 'WRONG_ANSWER', reason: 'Row values mismatch' };
        }
      }
      return { verdict: 'ACCEPTED', reason: '' };
    } else {
      const matches = this.matchesMultiset(actRows, expRows, cols);
      return {
        verdict: matches ? 'ACCEPTED' : 'WRONG_ANSWER',
        reason: matches ? '' : 'Row values mismatch',
      };
    }
  }

  /**
   * Execute SQL query using disposable in-memory SQLite database
   */
  async executeSqlite({ schemaDdl, query, expectedOutput, timeoutMs = 2000 }) {
    const startTime = Date.now();
    const jobId = `uap-sql-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const securityCheck = this.validateQuerySecurity(query);
    if (!securityCheck.allowed) {
      return {
        jobId,
        verdict: 'SECURITY_VIOLATION',
        exitCode: 1,
        stdout: '',
        stderr: securityCheck.error,
        rows: [],
        executionTimeMs: Date.now() - startTime,
        mode: 'SQLITE_ISOLATED',
      };
    }

    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(':memory:');

      try {
        if (schemaDdl && schemaDdl.trim().length > 0) {
          db.exec(schemaDdl);
        }

        const stmt = db.prepare(query);
        const rawRows = stmt.all();
        const rows = this.normalizeSqlRows(rawRows);
        const columns = rawRows.length > 0 ? Object.keys(rawRows[0]) : (typeof stmt.columns === 'function' ? stmt.columns().map((c) => c.name) : []);
        const executionTimeMs = Date.now() - startTime;

        const comparison = this.compareSqlExpected(rows, columns, expectedOutput);
        const verdict = comparison.verdict;

        return {
          jobId,
          verdict,
          exitCode: verdict === 'ACCEPTED' ? 0 : 1,
          stdout: JSON.stringify(rows, null, 2),
          stderr: comparison.reason || '',
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs,
          mode: 'SQLITE_ISOLATED',
        };
      } finally {
        db.close();
      }
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      logger.warn('SQLite execution error', { jobId, error: err.message });

      return {
        jobId,
        verdict: 'RUNTIME_ERROR',
        exitCode: 1,
        stdout: '',
        stderr: `SQL Execution Error: ${err.message}`,
        rows: [],
        executionTimeMs,
        mode: 'SQLITE_ISOLATED',
      };
    }
  }

  /**
   * Execute PostgreSQL query via isolated PostgreSQL engine or fallback
   */
  async executePostgres({ schemaDdl, query, expectedOutput, timeoutMs = 2000 }) {
    const startTime = Date.now();
    const jobId = `uap-pg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const securityCheck = this.validateQuerySecurity(query);
    if (!securityCheck.allowed) {
      return {
        jobId,
        verdict: 'SECURITY_VIOLATION',
        exitCode: 1,
        stdout: '',
        stderr: securityCheck.error,
        rows: [],
        executionTimeMs: Date.now() - startTime,
        mode: 'POSTGRESQL_ISOLATED',
      };
    }

    try {
      const { Client } = require('pg');
      const client = new Client({
        host: env.POSTGRES_HOST,
        port: env.POSTGRES_PORT,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        database: env.POSTGRES_DB,
        statement_timeout: timeoutMs,
        connectionTimeoutMillis: 1500,
      });

      await client.connect();

      const schemaName = `sandbox_${crypto.randomBytes(4).toString('hex')}`;
      try {
        await client.query(`CREATE SCHEMA ${schemaName}; SET search_path TO ${schemaName};`);

        if (schemaDdl && schemaDdl.trim().length > 0) {
          await client.query(schemaDdl);
        }

        const res = await client.query(query);
        const rows = this.normalizeSqlRows(res.rows);
        const columns = res.fields ? res.fields.map((f) => f.name) : (res.rows.length > 0 ? Object.keys(res.rows[0]) : []);
        const executionTimeMs = Date.now() - startTime;

        const comparison = this.compareSqlExpected(rows, columns, expectedOutput);
        const verdict = comparison.verdict;

        return {
          jobId,
          verdict,
          exitCode: verdict === 'ACCEPTED' ? 0 : 1,
          stdout: JSON.stringify(rows, null, 2),
          stderr: comparison.reason || '',
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs,
          mode: 'POSTGRESQL_ENGINE',
        };
      } finally {
        try {
          await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`);
        } catch (_) {}
        await client.end();
      }
    } catch (err) {
      // If PostgreSQL engine is offline or unreachable in local test mode, fall back to SQLite isolated engine
      if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
        logger.info('Postgres engine not reached, evaluating via SQL emulation engine', { jobId });
        return await this.executeSqlite({ schemaDdl, query, expectedOutput, timeoutMs });
      }

      const executionTimeMs = Date.now() - startTime;
      return {
        jobId,
        verdict: 'RUNTIME_ERROR',
        exitCode: 1,
        stdout: '',
        stderr: `PostgreSQL Execution Error: ${err.message}`,
        rows: [],
        executionTimeMs,
        mode: 'POSTGRESQL_ENGINE',
      };
    }
  }

  /**
   * Execute MySQL query via isolated MySQL engine or fallback
   */
  async executeMySql({ schemaDdl, query, expectedOutput, timeoutMs = 2000 }) {
    const startTime = Date.now();
    const jobId = `uap-mysql-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const securityCheck = this.validateQuerySecurity(query);
    if (!securityCheck.allowed) {
      return {
        jobId,
        verdict: 'SECURITY_VIOLATION',
        exitCode: 1,
        stdout: '',
        stderr: securityCheck.error,
        rows: [],
        executionTimeMs: Date.now() - startTime,
        mode: 'MYSQL_ISOLATED',
      };
    }

    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: env.MYSQL_HOST,
        port: env.MYSQL_PORT,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DB,
        connectTimeout: 1500,
      });

      const ephemeralDb = `sandbox_${crypto.randomBytes(4).toString('hex')}`;
      try {
        await connection.query(`CREATE DATABASE ${ephemeralDb};`);
        await connection.query(`USE ${ephemeralDb};`);

        if (schemaDdl && schemaDdl.trim().length > 0) {
          const statements = schemaDdl.split(';').map((s) => s.trim()).filter(Boolean);
          for (const stmt of statements) {
            await connection.query(stmt);
          }
        }

        const [results, fields] = await connection.query(query);
        const rows = this.normalizeSqlRows(Array.isArray(results) ? results : []);
        const columns = fields ? fields.map((f) => f.name) : (rows.length > 0 ? Object.keys(rows[0]) : []);
        const executionTimeMs = Date.now() - startTime;

        const comparison = this.compareSqlExpected(rows, columns, expectedOutput);
        const verdict = comparison.verdict;

        return {
          jobId,
          verdict,
          exitCode: verdict === 'ACCEPTED' ? 0 : 1,
          stdout: JSON.stringify(rows, null, 2),
          stderr: comparison.reason || '',
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs,
          mode: 'MYSQL_ENGINE',
        };
      } finally {
        try {
          await connection.query(`DROP DATABASE IF EXISTS ${ephemeralDb};`);
        } catch (_) {}
        await connection.end();
      }
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
        logger.info('MySQL engine not reached, evaluating via SQL emulation engine', { jobId });
        return await this.executeSqlite({ schemaDdl, query, expectedOutput, timeoutMs });
      }

      const executionTimeMs = Date.now() - startTime;
      return {
        jobId,
        verdict: 'RUNTIME_ERROR',
        exitCode: 1,
        stdout: '',
        stderr: `MySQL Execution Error: ${err.message}`,
        rows: [],
        executionTimeMs,
        mode: 'MYSQL_ENGINE',
      };
    }
  }

  /**
   * Route SQL execution through the isolated SQLite implementation.
   * PostgreSQL and MySQL are rejected for active examinations.
   * Legacy execution methods executePostgres/executeMySql remain preserved for legacy infrastructure.
   */
  async execute({ dialect = 'sqlite', schemaDdl = '', query, expectedOutput = null, timeoutMs = 2000 }) {
    const d = (dialect || 'sqlite').toLowerCase();
    if (['postgresql', 'postgres', 'mysql'].includes(d)) {
      return {
        jobId: `uap-sql-rejected-${Date.now()}`,
        verdict: 'SECURITY_VIOLATION',
        exitCode: 1,
        stdout: '',
        stderr: `SQL dialect '${d}' is rejected at API boundary. Active SQL examination is restricted to SQLite only.`,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        mode: 'SQLITE_ISOLATED',
      };
    }
    return await this.executeSqlite({ schemaDdl, query, expectedOutput, timeoutMs });
  }
}

module.exports = new SqlRunnerService();
