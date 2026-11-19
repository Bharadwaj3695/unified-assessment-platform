const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Load execution service app to act as test target
const executionApp = require('../../code-IDE-service/src/app');
const executionEnv = require('../../code-IDE-service/src/config/env');
const executionClient = require('../src/services/executionClient.service');

let executionServer;
let originalUrl;

before(async () => {
  await new Promise((resolve) => {
    executionServer = http.createServer(executionApp);
    executionServer.listen(0, () => {
      const port = executionServer.address().port;
      originalUrl = executionClient.baseUrl;
      executionClient.baseUrl = `http://127.0.0.1:${port}`;
      executionClient.apiKey = executionEnv.INTERNAL_API_KEY;
      resolve();
    });
  });
});

after(async () => {
  executionClient.baseUrl = originalUrl;
  await new Promise((resolve) => executionServer.close(resolve));
});

describe('Backend ExecutionClientService — Microservice Integration', () => {
  it('should query execution service health probe and receive healthy state', async () => {
    const res = await executionClient.checkHealth();
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'healthy');
    assert.equal(res.data.service, 'uap-code-IDE-service');
  });

  it('should retrieve supported runtime environments through internal client', async () => {
    const res = await executionClient.getRuntimes();
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.data));
    assert.equal(res.data.data.length, 3);

    const py = res.data.data.find((r) => r.id === 'python');
    assert.ok(py);
    assert.equal(py.name, 'Python 3.11');
    assert.equal(py.version, '3.11.8');

    const js = res.data.data.find((r) => r.id === 'javascript');
    assert.ok(js);
    assert.equal(js.name, 'JavaScript (Node.js 20)');

    const sqlite = res.data.data.find((r) => r.id === 'sqlite');
    assert.ok(sqlite);
    assert.equal(sqlite.name, 'SQLite 3');
  });

  it('should reject postgresql and mysql at API boundary via execution client', async () => {
    const resPg = await executionClient.executeSql({
      dialect: 'postgresql',
      schemaDdl: '',
      query: 'SELECT 1;',
    });
    assert.equal(resPg.ok, false);
    assert.equal(resPg.status, 400);
    assert.match(resPg.data.errors[0], /Active SQL examination is restricted to SQLite only/i);

    const resMy = await executionClient.executeSql({
      dialect: 'mysql',
      schemaDdl: '',
      query: 'SELECT 1;',
    });
    assert.equal(resMy.ok, false);
    assert.equal(resMy.status, 400);
    assert.match(resMy.data.errors[0], /Active SQL examination is restricted to SQLite only/i);
  });

  it('should execute single code snippet via backend client', async () => {
    const res = await executionClient.executeCode({
      language: 'python',
      code: 'print("Backend Client Test")',
      expectedOutput: 'Backend Client Test',
    });

    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.verdict, 'ACCEPTED');
    assert.equal(res.data.data.stdout.trim(), 'Backend Client Test');
  });

  it('should execute test case suite via backend client with score fraction', async () => {
    const testCases = [
      { input: '1', expectedOutput: '2', isHidden: false, weight: 2 },
      { input: '2', expectedOutput: '4', isHidden: true, weight: 3 },
    ];

    const res = await executionClient.executeSuite({
      language: 'python',
      code: 'print("2")',
      testCases,
    });

    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.totalCount, 2);
    assert.equal(res.data.data.totalWeight, 5);
    assert.ok(res.data.data.scoreFraction >= 0);
  });

  it('should execute SQL query via backend client against isolated SQLite engine', async () => {
    const res = await executionClient.executeSql({
      dialect: 'sqlite',
      schemaDdl: "CREATE TABLE items (id INT, label TEXT); INSERT INTO items VALUES (1, 'Laptop');",
      query: 'SELECT label FROM items WHERE id = 1;',
      expectedOutput: [{ label: 'Laptop' }],
    });

    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.verdict, 'ACCEPTED');
    assert.deepEqual(res.data.data.rows, [{ label: 'Laptop' }]);
  });

  it('should handle execution service network failure gracefully', async () => {
    const badClient = Object.create(executionClient);
    badClient.baseUrl = 'http://127.0.0.1:59999'; // dead port

    const res = await badClient.executeCode({
      language: 'python',
      code: 'print("fail")',
    });

    assert.equal(res.ok, false);
    assert.equal(res.status, 503);
    assert.match(res.data.message, /Execution service unavailable/i);
  });
});
