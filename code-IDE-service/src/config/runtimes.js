/**
 * Supported Language Runtime Configurations with Pinned Versions
 */

/**
 * Supported Language Runtime Configurations with Pinned Versions
 * Active SQL examination is restricted to SQLite 3 only.
 * Legacy SQL engines (PostgreSQL, MySQL) are preserved under LEGACY_RUNTIMES.
 */

const RUNTIMES = {
  python: {
    id: 'python',
    name: 'Python 3.11',
    version: '3.11.8',
    image: process.env.RUNNER_IMAGE_PYTHON || 'uap-runner-python:3.11-alpine',
    extension: 'py',
    filename: 'main.py',
    compiled: false,
    runCmd: ['python3', 'main.py'],
    env: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
    defaultStarter: '# Write your solution here\nimport sys\n\ndef main():\n    # Read input from standard input\n    input_data = sys.stdin.read().split()\n    if not input_data:\n        return\n    # Process input and print result\n    print("Hello from Python")\n\nif __name__ == "__main__":\n    main()\n',
  },
  javascript: {
    id: 'javascript',
    name: 'JavaScript (Node.js 20)',
    version: '20.11.1',
    image: process.env.RUNNER_IMAGE_JAVASCRIPT || 'uap-runner-node:20-alpine',
    extension: 'js',
    filename: 'main.js',
    compiled: false,
    runCmd: ['node', '--max-old-space-size=128', 'main.js'],
    env: { NODE_ENV: 'production' },
    defaultStarter: '// Write your solution here\nconst fs = require("fs");\n\nfunction main() {\n  const input = fs.readFileSync(0, "utf-8").trim();\n  // Process input and output result\n  console.log("Hello from JavaScript");\n}\n\nmain();\n',
  },
  sqlite: {
    id: 'sqlite',
    name: 'SQLite 3',
    version: '3.45.1',
    category: 'sql',
    image: process.env.RUNNER_IMAGE_SQLITE || 'uap-runner-sqlite:3.45-alpine',
    extension: 'sql',
    filename: 'query.sql',
    compiled: false,
    runCmd: ['sqlite3', ':memory:'],
    env: {},
    defaultStarter: '-- Write your SQL query here\nSELECT * FROM students;\n',
  },
};

const LEGACY_RUNTIMES = {
  postgresql: {
    id: 'postgresql',
    name: 'PostgreSQL 16 (Legacy)',
    version: '16.2',
    category: 'sql',
    legacy: true,
    image: 'postgres:16.2-alpine3.19',
    extension: 'sql',
    filename: 'query.sql',
    compiled: false,
    runCmd: ['psql'],
    env: {},
    defaultStarter: '-- Write your PostgreSQL query here\nSELECT * FROM students;\n',
  },
  mysql: {
    id: 'mysql',
    name: 'MySQL 8.3 (Legacy)',
    version: '8.3.0',
    category: 'sql',
    legacy: true,
    image: 'mysql:8.3.0-oracle',
    extension: 'sql',
    filename: 'query.sql',
    compiled: false,
    runCmd: ['mysql'],
    env: {},
    defaultStarter: '-- Write your MySQL query here\nSELECT * FROM students;\n',
  },
};

const SUPPORTED_LANGUAGES = Object.keys(RUNTIMES);
const CODE_LANGUAGES = Object.values(RUNTIMES).filter((r) => r.category !== 'sql').map((r) => r.id);
const SQL_LANGUAGES = Object.values(RUNTIMES).filter((r) => r.category === 'sql').map((r) => r.id);
const LEGACY_SQL_LANGUAGES = Object.keys(LEGACY_RUNTIMES);

module.exports = {
  RUNTIMES,
  LEGACY_RUNTIMES,
  SUPPORTED_LANGUAGES,
  CODE_LANGUAGES,
  SQL_LANGUAGES,
  LEGACY_SQL_LANGUAGES,
};
