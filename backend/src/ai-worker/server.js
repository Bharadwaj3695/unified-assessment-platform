const http = require('node:http');
const { runTranscriptPipeline } = require('./pipelines/transcript.pipeline');
const { runProctoringPipeline } = require('./pipelines/proctoring.pipeline');
const { CANDIDATE_MODEL_CATALOG } = require('./providers/base.provider');

const PORT = parseInt(process.env.PORT || '5060', 10);
const INTERNAL_API_KEY = process.env.AI_WORKER_API_KEY || '';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const urlPath = (req.url || '').split('?')[0];

    if (req.method === 'GET' && urlPath === '/health') {
      return sendJson(res, 200, {
        status: 'healthy',
        service: 'uap-ai-worker',
        provider: process.env.AI_PROVIDER || 'deterministic_stub',
      });
    }

    if (INTERNAL_API_KEY) {
      const provided = req.headers['x-internal-api-key'];
      if (provided !== INTERNAL_API_KEY) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized internal worker call' });
      }
    }

    if (req.method === 'GET' && urlPath === '/api/v1/models/catalog') {
      return sendJson(res, 200, { success: true, data: CANDIDATE_MODEL_CATALOG });
    }

    if (req.method === 'POST' && urlPath === '/api/v1/pipeline/transcript') {
      try {
        const body = await readJsonBody(req);
        const result = await runTranscriptPipeline(body);
        return sendJson(res, 200, { success: true, data: result });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message });
      }
    }

    if (req.method === 'POST' && urlPath === '/api/v1/pipeline/proctoring') {
      try {
        const body = await readJsonBody(req);
        const result = await runProctoringPipeline(body);
        return sendJson(res, 200, { success: true, data: result });
      } catch (err) {
        return sendJson(res, 400, { success: false, message: err.message });
      }
    }

    return sendJson(res, 404, { success: false, message: 'Route not found' });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`[uap-ai-worker] Listening on port ${PORT} (provider=${process.env.AI_PROVIDER || 'deterministic_stub'})`);
  });
}

module.exports = { createServer };
