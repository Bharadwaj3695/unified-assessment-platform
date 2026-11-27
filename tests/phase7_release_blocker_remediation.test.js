const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

describe('UAP Phase 7: Release Blocker Remediation & Verification Suite', () => {
  const backendDockerfile = readProjectFile('backend/docker/Dockerfile');
  const frontendDockerfile = readProjectFile('frontend/docker/Dockerfile');
  const nginxConf = readProjectFile('frontend/docker/nginx.conf');
  const composeMain = readProjectFile('docker-compose/docker-compose.yml');
  const composeBackend = readProjectFile('docker-compose/docker-compose.backend.yml');
  const composeFrontend = readProjectFile('docker-compose/docker-compose.frontend.yml');
  const composeExecutor = readProjectFile('docker-compose/docker-compose.code-executor.yml');
  const executorApiDockerfile = readProjectFile('code-IDE-service/docker/Dockerfile.api');
  const executorWorkerDockerfile = readProjectFile('code-IDE-service/docker/Dockerfile.worker');
  const dockerRunnerService = readProjectFile('code-IDE-service/src/services/dockerRunner.service.js');
  const backendServer = readProjectFile('backend/src/server.js');
  const backendApp = readProjectFile('backend/src/app.js');

  describe('1. Blocker 1: Docker Engine Socket Architecture & Isolation', () => {
    test('1.1 Docker socket is strictly isolated to uap-execution-worker only', () => {
      // Must be mounted in execution-worker
      assert.match(
        composeMain,
        /uap-execution-worker:[\s\S]*?volumes:[\s\S]*?- \/var\/run\/docker\.sock:\/var\/run\/docker\.sock/,
        'docker.sock must be mounted in uap-execution-worker'
      );

      // Must NEVER be mounted in general backend
      const backendSection = composeMain.match(/uap-backend:[\s\S]*?(?=uap-frontend:|$)/)?.[0] || '';
      assert.doesNotMatch(backendSection, /\/var\/run\/docker\.sock/, 'docker.sock must NOT be mounted in uap-backend');

      // Must NEVER be mounted in code-executor REST API
      const executorApiSection = composeMain.match(/uap-code-executor:[\s\S]*?(?=uap-execution-worker:|$)/)?.[0] || '';
      assert.doesNotMatch(executorApiSection, /\/var\/run\/docker\.sock/, 'docker.sock must NOT be mounted in uap-code-executor');

      // Must NEVER be mounted in frontend
      const frontendSection = composeMain.match(/uap-frontend:[\s\S]*?(?=networks:|$)/)?.[0] || '';
      assert.doesNotMatch(frontendSection, /\/var\/run\/docker\.sock/, 'docker.sock must NOT be mounted in uap-frontend');
    });

    test('1.2 uap-execution-worker has zero public network exposure', () => {
      const workerSection = composeMain.match(/uap-execution-worker:[\s\S]*?(?=(uap-postgres-engine|uap-backend):|$)/)?.[0] || '';
      assert.doesNotMatch(workerSection, /ports:/, 'Execution worker must not expose public host ports');
      assert.match(workerSection, /uap-queue-net/, 'Execution worker must be connected to internal queue network');
    });

    test('1.3 uap-code-executor REST API container does not require or mount docker socket', () => {
      assert.doesNotMatch(
        executorApiDockerfile,
        /DOCKER_SOCKET_PATH/,
        'Dockerfile.api must not configure DOCKER_SOCKET_PATH'
      );
      assert.match(executorApiDockerfile, /CMD \["node", "src\/server\.js"\]/);
    });

    test('1.4 dockerRunner.service.js enforces air-gapped network and unprivileged user in containers', () => {
      assert.match(dockerRunnerService, /NetworkMode:\s*'none'/, 'Container network must be air-gapped (none)');
      assert.match(dockerRunnerService, /User:\s*'10001:10001'/, 'Container execution must use non-root UID 10001');
      assert.match(dockerRunnerService, /CapDrop:\s*\['ALL'\]/, 'Linux capabilities must be dropped');
      assert.match(dockerRunnerService, /SecurityOpt:\s*\['no-new-privileges:true'\]/, 'Must prevent privilege escalation');
    });

    test('1.5 dockerRunner.service.js enforces memory, CPU, PID limits and guaranteed container cleanup', () => {
      assert.match(dockerRunnerService, /MemorySwap:\s*memoryLimitMb/, 'Swap memory must be disabled');
      assert.match(dockerRunnerService, /NanoCPUs:/, 'NanoCPUs must be enforced');
      assert.match(dockerRunnerService, /PidsLimit:\s*env\.MAX_PIDS|PidsLimit:\s*32/, 'PID limit must be enforced');
      assert.match(dockerRunnerService, /finally\s*\{[\s\S]*?container\.remove\(\{ force: true \}\)/, 'Must guarantee container removal in finally block');
    });
  });

  describe('2. Blocker 2: Backend Production Entrypoint', () => {
    test('2.1 Backend Dockerfile invokes production Node.js entrypoint directly without npm run dev', () => {
      assert.doesNotMatch(
        backendDockerfile,
        /npm\s+run\s+dev/i,
        'Backend Dockerfile must not contain npm run dev'
      );
      assert.match(
        backendDockerfile,
        /CMD\s+\["node",\s*"src\/server\.js"\]/,
        'Backend Dockerfile must execute node src/server.js directly'
      );
    });

    test('2.2 Backend Dockerfile specifies production environment and clean production install', () => {
      assert.match(backendDockerfile, /ENV\s+NODE_ENV=production/, 'Backend Dockerfile must set NODE_ENV=production');
      assert.match(backendDockerfile, /npm\s+ci\s+--omit=dev/, 'Backend Dockerfile must use npm ci --omit=dev');
    });

    test('2.3 Backend Dockerfile preserves container healthcheck probe', () => {
      assert.match(
        backendDockerfile,
        /HEALTHCHECK[\s\S]*?curl\s+-f\s+http:\/\/localhost:5000\/api\/health/,
        'Backend Dockerfile must preserve healthcheck against /api/health'
      );
    });

    test('2.4 Backend server.js implements graceful shutdown on SIGTERM and SIGINT', () => {
      assert.match(backendServer, /process\.on\('SIGTERM',\s*\(\)\s*=>\s*shutdown\('SIGTERM'\)\)/);
      assert.match(backendServer, /process\.on\('SIGINT',\s*\(\)\s*=>\s*shutdown\('SIGINT'\)\)/);
      assert.match(backendServer, /disconnectDB\(\)/, 'Graceful shutdown must disconnect MongoDB');
    });

    test('2.5 Backend app.js exposes healthy/unhealthy status on both /api/health and /health', () => {
      assert.match(backendApp, /app\.get\('\/api\/health'/);
      assert.match(backendApp, /app\.get\('\/health'/);
    });
  });

  describe('3. Blocker 2: Frontend Production Nginx Entrypoint & Configuration', () => {
    test('3.1 Frontend Dockerfile is a multi-stage production build using Nginx', () => {
      assert.match(frontendDockerfile, /FROM\s+node:[\w.-]+\s+AS\s+builder/i, 'Must have Node build stage');
      assert.match(frontendDockerfile, /npm\s+run\s+build/, 'Must compile Vite bundle in build stage');
      assert.match(frontendDockerfile, /FROM\s+nginx:[\w.-]+/i, 'Must use Nginx base image in runtime stage');
      assert.doesNotMatch(frontendDockerfile, /npm\s+run\s+dev/, 'Must not run npm run dev');
      assert.match(frontendDockerfile, /CMD\s+\["nginx",\s*"-g",\s*"daemon\s+off;"\]/, 'Must start Nginx in foreground');
    });

    test('3.2 Frontend Nginx config implements Single Page Application (SPA) fallback routing', () => {
      assert.match(
        nginxConf,
        /location\s+\/\s*\{[\s\S]*?try_files\s+\$uri\s+\$uri\/\s+\/index\.html;[\s\S]*?\}/,
        'Nginx config must implement try_files $uri $uri/ /index.html;'
      );
    });

    test('3.3 Frontend Nginx config reverse-proxies /api/ and /uploads/ to backend service', () => {
      assert.match(
        nginxConf,
        /location\s+\/api\/\s*\{[\s\S]*?proxy_pass\s+http:\/\/uap-backend:5000\/api\/;/,
        'Nginx must proxy /api/ to http://uap-backend:5000/api/'
      );
      assert.match(
        nginxConf,
        /location\s+\/uploads\/\s*\{[\s\S]*?proxy_pass\s+http:\/\/uap-backend:5000\/uploads\/;/,
        'Nginx must proxy /uploads/ to http://uap-backend:5000/uploads/'
      );
    });

    test('3.4 Frontend Nginx config includes health probe endpoint and security headers', () => {
      assert.match(nginxConf, /location\s*=\s*\/health\s*\{[\s\S]*?return\s+200\s+'healthy\\n';/, 'Must provide /health endpoint');
      assert.match(nginxConf, /X-Frame-Options\s+"SAMEORIGIN"/, 'Must set X-Frame-Options');
      assert.match(nginxConf, /X-Content-Type-Options\s+"nosniff"/, 'Must set X-Content-Type-Options');
      assert.match(nginxConf, /X-XSS-Protection/, 'Must set X-XSS-Protection');
      assert.match(nginxConf, /Referrer-Policy/, 'Must set Referrer-Policy');
    });

    test('3.5 Frontend Nginx config enforces long-term caching for immutable hashed assets', () => {
      assert.match(
        nginxConf,
        /location\s+\/assets\/\s*\{[\s\S]*?expires\s+1y;[\s\S]*?Cache-Control\s+"public,\s*immutable";/,
        'Static assets must be cached with 1y expiry and public, immutable'
      );
    });
  });

  describe('4. Docker Compose Production Configuration Integrity', () => {
    test('4.1 docker-compose.yml sets production environment for all application containers', () => {
      assert.match(composeMain, /uap-backend:[\s\S]*?NODE_ENV:\s*production/);
      assert.match(composeMain, /uap-code-executor:[\s\S]*?NODE_ENV:\s*production/);
      assert.match(composeMain, /uap-execution-worker:[\s\S]*?NODE_ENV:\s*production/);
    });

    test('4.2 docker-compose.yml preserves persistent uploads and isolates frontend container dependencies', () => {
      const backendSection = composeMain.match(/uap-backend:[\s\S]*?(?=uap-frontend:|$)/)?.[0] || '';
      assert.doesNotMatch(backendSection, /- \.\.\/backend:\/app/, 'Must remove ../backend:/app dev mount');
      assert.match(backendSection, /uap_uploads_data:\/app\/uploads/, 'Must preserve persistent uploads volume');

      const frontendSection = composeMain.match(/uap-frontend:[\s\S]*?(?=networks:|$)/)?.[0] || '';
      assert.match(frontendSection, /- \.\.\/frontend:\/app/, 'Must mount frontend source for dev auto-updates');
      assert.match(frontendSection, /- \/app\/node_modules/, 'Must isolate container node_modules volume');
    });

    test('4.3 docker-compose.yml exposes frontend on ports 80 and 5173 with healthcheck and Nginx production probe', () => {
      const frontendSection = composeMain.match(/uap-frontend:[\s\S]*?(?=\nvolumes:|\nnetworks:|$)/)?.[0] || '';
      assert.match(frontendSection, /- "80:80"/, 'Must expose port 80');
      assert.match(frontendSection, /- "5173:5173"/, 'Must expose port 5173');
      assert.match(frontendSection, /healthcheck:[\s\S]*?http:\/\/127\.0\.0\.1:5173\//, 'Must include frontend healthcheck');
      assert.match(frontendDockerfile, /HEALTHCHECK[\s\S]*?http:\/\/localhost:80\/health/, 'Production Nginx Dockerfile must include /health probe');
    });

    test('4.4 Master and modular compose files maintain clean service separation and production/dev readiness', () => {
      const frontendMatches = composeMain.match(/^\s{2}uap-frontend[^:]*:/gm) || [];
      const backendMatches = composeMain.match(/^\s{2}uap-backend[^:]*:/gm) || [];
      assert.strictEqual(frontendMatches.length, 1, 'Master compose must have exactly one frontend service');
      assert.strictEqual(backendMatches.length, 1, 'Master compose must have exactly one backend service');
      assert.doesNotMatch(composeMain, /uap-ai-worker/, 'Must not include AI worker Docker service');

      assert.match(composeFrontend, /ports:[\s\S]*?- "80:80"[\s\S]*?- "5173:80"/);
      assert.match(composeFrontend, /uap-frontend-dev:[\s\S]*?docker\/Dockerfile\.dev/);
      assert.match(composeFrontend, /healthcheck:/);
      assert.match(composeBackend, /uap_uploads_data:\/app\/uploads/);
      assert.match(composeExecutor, /uap-code-executor:/);
      assert.match(composeExecutor, /uap-execution-worker:/);
    });
  });
});
