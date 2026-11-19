const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../src/app');
const env = require('../src/config/env');
const { RUNTIMES, SUPPORTED_LANGUAGES } = require('../src/config/runtimes');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('Execution Service — Infrastructure & Security Configuration', () => {
  it('should pin all supported language and SQL runtimes with exact versions and images', () => {
    assert.deepEqual(SUPPORTED_LANGUAGES, ['python', 'javascript', 'sqlite']);

    assert.equal(RUNTIMES.python.version, '3.11.8');
    assert.equal(RUNTIMES.python.image, 'uap-runner-python:3.11-alpine');

    assert.equal(RUNTIMES.javascript.version, '20.11.1');
    assert.equal(RUNTIMES.javascript.image, 'uap-runner-node:20-alpine');

    assert.equal(RUNTIMES.sqlite.version, '3.45.1');
  });

  it('should define strict resource limits in configuration', () => {
    assert.equal(env.DEFAULT_TIMEOUT_MS, 2000);
    assert.equal(env.MAX_TIMEOUT_MS, 10000);
    assert.equal(env.DEFAULT_MEMORY_MB, 256);
    assert.equal(env.MAX_MEMORY_MB, 512);
    assert.equal(env.MAX_OUTPUT_BYTES, 65536);
    assert.equal(env.MAX_PIDS, 64);
  });
});

describe('Execution Service — Health & Monitoring Endpoints', () => {
  it('should respond to public /health/live probe with 200 OK', async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, 'OK');
  });

  it('should return detailed diagnostic state from /health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.status, 'healthy');
    assert.equal(body.service, 'uap-code-IDE-service');
    assert.ok(typeof body.uptimeSeconds === 'number');
    assert.ok(body.docker);
    assert.ok(['LIVE_DOCKER', 'SIMULATION_SANDBOX'].includes(body.docker.mode));
    assert.deepEqual(body.runtimes.all, SUPPORTED_LANGUAGES);
    assert.ok(body.sqlEngines);
  });
});

describe('Execution Service — Internal API Authentication & Network Guard', () => {
  it('should reject unauthenticated requests without x-internal-api-key', async () => {
    const res = await fetch(`${baseUrl}/api/v1/runtimes`, {
      method: 'GET',
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Unauthorized/i);
  });

  it('should reject requests with invalid x-internal-api-key', async () => {
    const res = await fetch(`${baseUrl}/api/v1/runtimes`, {
      method: 'GET',
      headers: { 'x-internal-api-key': 'tampered_or_invalid_key' },
    });
    assert.equal(res.status, 401);
  });

  it('should allow requests with valid internal API key to retrieve runtimes', async () => {
    const res = await fetch(`${baseUrl}/api/v1/runtimes`, {
      method: 'GET',
      headers: { 'x-internal-api-key': env.INTERNAL_API_KEY },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 3);
    assert.equal(body.data[0].id, 'python');
    assert.equal(body.data[1].id, 'javascript');
    assert.equal(body.data[2].id, 'sqlite');
  });
});

describe('Execution Service — Payload Validation', () => {
  const authHeaders = {
    'Content-Type': 'application/json',
    'x-internal-api-key': env.INTERNAL_API_KEY,
  };

  it('should reject request with missing language', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ code: 'print("hello")' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /Language is required/i);
  });

  it('should reject unsupported language', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ language: 'rust', code: 'fn main() {}' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /Unsupported language 'rust'/i);
  });

  it('should reject empty code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ language: 'python', code: '   ' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /Code cannot be empty/i);
  });

  it('should reject timeout exceeding max bound', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ language: 'python', code: 'print("test")', timeoutMs: 999999 }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /timeoutMs must be an integer between 500 and 10000/i);
  });

  it('should reject memory exceeding max bound', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ language: 'python', code: 'print("test")', memoryLimitMb: 2048 }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /memoryLimitMb must be an integer between 64 and 512/i);
  });

  it('should reject postgresql at API boundary for execute', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ language: 'postgresql', code: 'SELECT 1;' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /Active SQL examination is restricted to SQLite only/i);
  });

  it('should reject mysql at API boundary for execute', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ language: 'mysql', code: 'SELECT 1;' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /Active SQL examination is restricted to SQLite only/i);
  });

  it('should reject postgresql at API boundary for execute-sql', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ dialect: 'postgresql', query: 'SELECT 1;' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /Active SQL examination is restricted to SQLite only/i);
  });

  it('should reject mysql at API boundary for execute-sql', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ dialect: 'mysql', query: 'SELECT 1;' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.errors[0], /Active SQL examination is restricted to SQLite only/i);
  });
});

describe('Execution Service — Execution Verdicts & Resource Handling', () => {
  const authHeaders = {
    'Content-Type': 'application/json',
    'x-internal-api-key': env.INTERNAL_API_KEY,
  };

  it('should execute Python program and return ACCEPTED when output matches', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        language: 'python',
        code: 'print("42")',
        expectedOutput: '42',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'ACCEPTED');
    assert.equal(body.data.exitCode, 0);
    assert.equal(body.data.stdout.trim(), '42');
  });

  it('should return WRONG_ANSWER when actual output differs from expected', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        language: 'python',
        code: 'print("99")',
        expectedOutput: '100',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'WRONG_ANSWER');
  });

  it('should detect infinite loop / timeout and assign TIME_LIMIT_EXCEEDED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        language: 'python',
        code: '# __TRIGGER_TLE__\nwhile(True):\n    pass\n',
        timeoutMs: 1000,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'TIME_LIMIT_EXCEEDED');
    assert.equal(body.data.exitCode, 124);
  });

  it('should detect memory exhaustion and assign MEMORY_LIMIT_EXCEEDED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        language: 'python',
        code: '# __TRIGGER_MLE__\na = []\n',
        memoryLimitMb: 128,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'MEMORY_LIMIT_EXCEEDED');
    assert.equal(body.data.exitCode, 137);
  });

  it('should detect compilation / syntax errors', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        language: 'python',
        code: '// __TRIGGER_SYNTAX_ERROR__\ndef invalid_syntax(:\n',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'COMPILATION_ERROR');
    assert.equal(body.data.exitCode, 1);
  });

  it('should enforce output size cap and set outputTruncated flag', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        language: 'javascript',
        code: '// __TRIGGER_LARGE_OUTPUT__\nconsole.log("X".repeat(100000));\n',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.outputTruncated, true);
    assert.ok(body.data.stdout.length <= env.MAX_OUTPUT_BYTES);
  });

  it('should reject execution with 503 when NODE_ENV is production and Docker daemon is unavailable', async () => {
    const originalEnv = env.NODE_ENV;
    const dockerRunner = require('../src/services/dockerRunner.service');
    const originalDocker = dockerRunner.isDockerAvailable;
    try {
      env.NODE_ENV = 'production';
      dockerRunner.isDockerAvailable = false;
      const res = await fetch(`${baseUrl}/api/v1/execute`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          language: 'python',
          code: 'print("untrusted")',
        }),
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.message, /Container isolation is required|unavailable/i);
    } finally {
      env.NODE_ENV = originalEnv;
      dockerRunner.isDockerAvailable = originalDocker;
    }
  });
});

describe('Execution Service — Suite Execution & Test-Case Masking', () => {
  const authHeaders = {
    'Content-Type': 'application/json',
    'x-internal-api-key': env.INTERNAL_API_KEY,
  };

  it('should evaluate suite of public and hidden test cases, masking hidden cases', async () => {
    const testCases = [
      { input: '2 3', expectedOutput: '5', isHidden: false, weight: 1 },
      { input: '10 20', expectedOutput: '30', isHidden: false, weight: 2 },
      { input: '100 200', expectedOutput: '300', isHidden: true, weight: 3 },
    ];

    const res = await fetch(`${baseUrl}/api/v1/execute-suite`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        language: 'python',
        code: 'print("5")',
        testCases,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const suite = body.data;
    assert.equal(suite.totalCount, 3);
    assert.equal(suite.totalWeight, 6);
    assert.ok(typeof suite.scoreFraction === 'number');

    // Verify hidden test case masking
    const hiddenCase = suite.testCases.find((tc) => tc.isHidden === true);
    assert.ok(hiddenCase);
    assert.equal(hiddenCase.input, '[HIDDEN]');
    assert.equal(hiddenCase.expectedOutput, '[HIDDEN]');
  });
});

describe('Execution Service — SQL Runtimes & Database Sandbox', () => {
  const authHeaders = {
    'Content-Type': 'application/json',
    'x-internal-api-key': env.INTERNAL_API_KEY,
  };

  const schemaDdl = `
    CREATE TABLE employees (id INT PRIMARY KEY, name VARCHAR(50), department VARCHAR(50), salary INT);
    INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000);
    INSERT INTO employees VALUES (2, 'Bob', 'Marketing', 65000);
    INSERT INTO employees VALUES (3, 'Charlie', 'Engineering', 85000);
  `;

  it('should execute SQLite query against schema and return ACCEPTED when rows match', async () => {
    const query = "SELECT name, salary FROM employees WHERE department = 'Engineering' ORDER BY salary DESC;";
    const expectedOutput = [
      { name: 'Alice', salary: 90000 },
      { name: 'Charlie', salary: 85000 },
    ];

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl,
        query,
        expectedOutput,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'ACCEPTED');
    assert.equal(body.data.exitCode, 0);
    assert.equal(body.data.rowCount, 2);
    assert.deepEqual(body.data.rows, expectedOutput);
  });

  it('should return WRONG_ANSWER when SQL query returns unexpected result rows', async () => {
    const query = "SELECT name, salary FROM employees WHERE department = 'Marketing';";
    const expectedOutput = [
      { name: 'Alice', salary: 90000 },
    ];

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl,
        query,
        expectedOutput,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'WRONG_ANSWER');
  });

  it('should evaluate structured SQL comparison with columns and rows accurately', async () => {
    const query = "SELECT name, salary FROM employees WHERE department = 'Engineering' ORDER BY salary DESC;";
    const structuredExpected = {
      columns: ['name', 'salary'],
      rows: [
        ['Alice', 90000],
        ['Charlie', 85000],
      ],
    };

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl,
        query,
        expectedOutput: structuredExpected,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'ACCEPTED');
    assert.deepEqual(body.data.columns, ['name', 'salary']);
    assert.equal(body.data.rowCount, 2);
  });

  it('should fail structured SQL comparison with WRONG_ANSWER when columns mismatch', async () => {
    const query = "SELECT name, salary FROM employees WHERE department = 'Engineering';";
    const mismatchColumnsExpected = {
      columns: ['id', 'name'],
      rows: [[1, 'Alice']],
    };

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl,
        query,
        expectedOutput: mismatchColumnsExpected,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'WRONG_ANSWER');
    assert.match(body.data.stderr, /Column mismatch/i);
  });

  it('should block dangerous administrative SQL statements with SECURITY_VIOLATION', async () => {
    const maliciousQuery = "ATTACH DATABASE '/etc/passwd' AS pwned; SELECT * FROM pwned;";

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl,
        query: maliciousQuery,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'SECURITY_VIOLATION');
    assert.match(body.data.stderr, /Prohibited SQL statement/i);
  });

  it('should block privilege escalation queries (GRANT / SHUTDOWN)', async () => {
    const maliciousQuery = "GRANT ALL PRIVILEGES ON DATABASE uap TO student;";

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        query: maliciousQuery,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.verdict, 'SECURITY_VIOLATION');
  });

  it('should handle SQL syntax errors with RUNTIME_ERROR verdict', async () => {
    const invalidQuery = "SELECT FROM WHERE INVALID SQL SYNTAX;";

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl,
        query: invalidQuery,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'RUNTIME_ERROR');
    assert.match(body.data.stderr, /syntax error/i);
  });

  it('should allow SQL execution via generic /api/v1/execute with language sqlite', async () => {
    const query = "SELECT COUNT(*) as count FROM employees;";
    const expectedOutput = [{ count: 3 }];

    const res = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        language: 'sqlite',
        code: query,
        schemaDdl,
        expectedOutput,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'ACCEPTED');
    assert.equal(body.data.rows[0].count, 3);
  });
});

describe('Execution Service — SQL Structured Result Comparison Scenarios', () => {
  const authHeaders = {
    'Content-Type': 'application/json',
    'x-internal-api-key': env.INTERNAL_API_KEY,
  };

  const baseSchemaDdl = `
    CREATE TABLE employees (id INT PRIMARY KEY, name VARCHAR(50), department VARCHAR(50), salary INT, notes TEXT, code VARCHAR(20));
    INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 90000, NULL, '0123');
    INSERT INTO employees VALUES (2, 'Bob', 'Marketing', 65000, '', '0456');
    INSERT INTO employees VALUES (3, 'Charlie', 'Engineering', 85000, 'Senior Lead', '0789');
  `;

  // 1. Same rows returned in a different order
  it('Scenario 1: should accept same rows in different order when unordered, and reject when ordered: true', async () => {
    const query = "SELECT name, salary FROM employees WHERE department = 'Engineering' ORDER BY salary ASC;";
    const unorderedExpected = {
      columns: ['name', 'salary'],
      rows: [
        ['Alice', 90000],
        ['Charlie', 85000],
      ],
      ordered: false,
    };

    const resUnordered = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: unorderedExpected,
      }),
    });
    const bodyUnordered = await resUnordered.json();
    assert.equal(bodyUnordered.success, true);
    assert.equal(bodyUnordered.data.verdict, 'ACCEPTED');

    const orderedExpected = {
      columns: ['name', 'salary'],
      rows: [
        ['Alice', 90000],
        ['Charlie', 85000],
      ],
      ordered: true,
    };

    const resOrdered = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: orderedExpected,
      }),
    });
    const bodyOrdered = await resOrdered.json();
    assert.equal(bodyOrdered.success, true);
    assert.equal(bodyOrdered.data.verdict, 'WRONG_ANSWER');
    assert.match(bodyOrdered.data.stderr, /Row order mismatch/i);
  });

  // 2. Duplicate rows
  it('Scenario 2: should preserve duplicate rows and enforce multiset bag multiplicity', async () => {
    const ddlWithDups = `
      CREATE TABLE inventory (item VARCHAR(20), qty INT);
      INSERT INTO inventory VALUES ('apple', 10);
      INSERT INTO inventory VALUES ('apple', 10);
      INSERT INTO inventory VALUES ('banana', 20);
    `;
    const query = 'SELECT item, qty FROM inventory;';

    // Exact duplicate matching
    const resExact = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: ddlWithDups,
        query,
        expectedOutput: {
          columns: ['item', 'qty'],
          rows: [
            ['banana', 20],
            ['apple', 10],
            ['apple', 10],
          ],
        },
      }),
    });
    const bodyExact = await resExact.json();
    assert.equal(bodyExact.data.verdict, 'ACCEPTED');

    // Missing one duplicate (count mismatch)
    const resCountMismatch = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: ddlWithDups,
        query,
        expectedOutput: {
          columns: ['item', 'qty'],
          rows: [
            ['banana', 20],
            ['apple', 10],
          ],
        },
      }),
    });
    const bodyCountMismatch = await resCountMismatch.json();
    assert.equal(bodyCountMismatch.data.verdict, 'WRONG_ANSWER');
    assert.match(bodyCountMismatch.data.stderr, /Row count mismatch/i);

    // Same row count but wrong duplicate frequency
    const resWrongDups = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: ddlWithDups,
        query,
        expectedOutput: {
          columns: ['item', 'qty'],
          rows: [
            ['banana', 20],
            ['banana', 20],
            ['apple', 10],
          ],
        },
      }),
    });
    const bodyWrongDups = await resWrongDups.json();
    assert.equal(bodyWrongDups.data.verdict, 'WRONG_ANSWER');
    assert.match(bodyWrongDups.data.stderr, /Row values mismatch/i);
  });

  // 3. NULL versus empty string
  it('Scenario 3: should distinguish NULL from empty string strictly', async () => {
    const queryAlice = "SELECT notes FROM employees WHERE name = 'Alice';";

    // Expected notes is empty string '' while DB returned NULL -> must fail
    const resNullVsEmpty = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query: queryAlice,
        expectedOutput: {
          columns: ['notes'],
          rows: [['']],
        },
      }),
    });
    const bodyNullVsEmpty = await resNullVsEmpty.json();
    assert.equal(bodyNullVsEmpty.data.verdict, 'WRONG_ANSWER');
    assert.match(bodyNullVsEmpty.data.stderr, /Row values mismatch/i);

    // Expected notes is NULL while DB returned NULL -> must accept
    const resNullMatch = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query: queryAlice,
        expectedOutput: {
          columns: ['notes'],
          rows: [[null]],
        },
      }),
    });
    const bodyNullMatch = await resNullMatch.json();
    assert.equal(bodyNullMatch.data.verdict, 'ACCEPTED');
  });

  // 4. Integer versus decimal values
  it('Scenario 4: should accept integer and decimal equivalence numerically', async () => {
    const query = "SELECT salary FROM employees WHERE name = 'Alice';";

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: {
          columns: ['salary'],
          rows: [[90000.000000]],
        },
      }),
    });
    const body = await res.json();
    assert.equal(body.data.verdict, 'ACCEPTED');
  });

  // 5. Numeric strings versus numeric database values
  it('Scenario 5: should safely compare numeric strings to numbers without converting arbitrary codes', async () => {
    const resNumericStr = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query: "SELECT salary FROM employees WHERE name = 'Alice';",
        expectedOutput: {
          columns: ['salary'],
          rows: [['90000.00']],
        },
      }),
    });
    const bodyNumericStr = await resNumericStr.json();
    assert.equal(bodyNumericStr.data.verdict, 'ACCEPTED');

    const resLeadingZero = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query: "SELECT code FROM employees WHERE name = 'Alice';",
        expectedOutput: {
          columns: ['code'],
          rows: [[123]],
        },
      }),
    });
    const bodyLeadingZero = await resLeadingZero.json();
    assert.equal(bodyLeadingZero.data.verdict, 'WRONG_ANSWER');
    assert.match(bodyLeadingZero.data.stderr, /Row values mismatch/i);
  });

  // 6. Case differences in column names
  it('Scenario 6: should match column names case-insensitively', async () => {
    const query = "SELECT name AS EmpName, salary AS EmpSalary FROM employees WHERE id = 1;";

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: {
          columns: ['empname', 'empsalary'],
          rows: [['Alice', 90000]],
        },
      }),
    });
    const body = await res.json();
    assert.equal(body.data.verdict, 'ACCEPTED');
  });

  // 7. Column ordering differences
  it('Scenario 7: should detect column order mismatch strictly, or accept with ignoreColumnOrder', async () => {
    const query = "SELECT salary, name FROM employees WHERE id = 1;";

    const resStrict = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: {
          columns: ['name', 'salary'],
          rows: [['Alice', 90000]],
        },
      }),
    });
    const bodyStrict = await resStrict.json();
    assert.equal(bodyStrict.data.verdict, 'WRONG_ANSWER');
    assert.match(bodyStrict.data.stderr, /Column order mismatch/i);

    const resRelaxed = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: {
          columns: ['name', 'salary'],
          rows: [['Alice', 90000]],
          ignoreColumnOrder: true,
        },
      }),
    });
    const bodyRelaxed = await resRelaxed.json();
    assert.equal(bodyRelaxed.data.verdict, 'ACCEPTED');
  });

  // 8. Empty result sets
  it('Scenario 8: should correctly match empty result sets and reject non-empty against empty', async () => {
    const emptyQuery = "SELECT name, salary FROM employees WHERE 1 = 0;";

    const resEmpty = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query: emptyQuery,
        expectedOutput: {
          columns: ['name', 'salary'],
          rows: [],
        },
      }),
    });
    const bodyEmpty = await resEmpty.json();
    assert.equal(bodyEmpty.data.verdict, 'ACCEPTED');
    assert.equal(bodyEmpty.data.rowCount, 0);

    const resNotEmpty = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query: "SELECT name, salary FROM employees WHERE id = 1;",
        expectedOutput: {
          columns: ['name', 'salary'],
          rows: [],
        },
      }),
    });
    const bodyNotEmpty = await resNotEmpty.json();
    assert.equal(bodyNotEmpty.data.verdict, 'WRONG_ANSWER');
    assert.match(bodyNotEmpty.data.stderr, /Row count mismatch/i);
  });

  // 9. Missing expected columns
  it('Scenario 9: should reject queries missing required expected columns', async () => {
    const query = "SELECT name FROM employees WHERE id = 1;";

    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: {
          columns: ['name', 'salary'],
          rows: [['Alice', 90000]],
        },
      }),
    });
    const body = await res.json();
    assert.equal(body.data.verdict, 'WRONG_ANSWER');
    assert.match(body.data.stderr, /Column mismatch/i);
  });

  // 10. Malformed expected-output JSON
  it('Scenario 10: should handle malformed expected-output JSON gracefully with WRONG_ANSWER', async () => {
    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query: "SELECT name FROM employees WHERE id = 1;",
        expectedOutput: "{ columns: ['name'], rows: invalid-json-payload",
      }),
    });
    const body = await res.json();
    assert.equal(body.data.verdict, 'WRONG_ANSWER');
    assert.match(body.data.stderr, /Malformed expected output JSON/i);
  });

  // 11. Object-array and 2D-array representations
  it('Scenario 11: should support both 2D-array and object-array expected representations', async () => {
    const query = "SELECT id, name FROM employees WHERE id IN (1, 2) ORDER BY id ASC;";

    const res2D = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: {
          columns: ['id', 'name'],
          rows: [
            [1, 'Alice'],
            [2, 'Bob'],
          ],
        },
      }),
    });
    const body2D = await res2D.json();
    assert.equal(body2D.data.verdict, 'ACCEPTED');

    const resObj = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: {
          columns: ['id', 'name'],
          rows: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
        },
      }),
    });
    const bodyObj = await resObj.json();
    assert.equal(bodyObj.data.verdict, 'ACCEPTED');

    const resArray = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: baseSchemaDdl,
        query,
        expectedOutput: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      }),
    });
    const bodyArray = await resArray.json();
    assert.equal(bodyArray.data.verdict, 'ACCEPTED');
  });

  // 12. Large result sets within configured execution limits
  it('Scenario 12: should evaluate large result sets efficiently within execution limits', async () => {
    let insertStatements = 'CREATE TABLE large_catalog (id INT PRIMARY KEY, title VARCHAR(50), price INT);\n';
    const expectedRows = [];
    for (let i = 1; i <= 500; i++) {
      insertStatements += `INSERT INTO large_catalog VALUES (${i}, 'Item ${i}', ${i * 10});\n`;
      expectedRows.push([i, `Item ${i}`, i * 10]);
    }

    const startTime = Date.now();
    const res = await fetch(`${baseUrl}/api/v1/execute-sql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dialect: 'sqlite',
        schemaDdl: insertStatements,
        query: 'SELECT id, title, price FROM large_catalog ORDER BY id ASC;',
        expectedOutput: {
          columns: ['id', 'title', 'price'],
          rows: expectedRows,
          ordered: true,
        },
        timeoutMs: 4000,
      }),
    });
    const durationMs = Date.now() - startTime;
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.data.verdict, 'ACCEPTED');
    assert.equal(body.data.rowCount, 500);
    assert.ok(body.data.executionTimeMs < 3000);
    assert.ok(durationMs < 4000);
  });
});
