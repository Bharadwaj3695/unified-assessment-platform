// Express web framework providing HTTP request handling, middleware pipelines, and routing architecture
const express = require('express');
// CORS middleware providing Cross-Origin Resource Sharing control headers for frontend web clients
const cors = require('cors');
// Helmet middleware configuring security-focused HTTP response headers to protect against common web vulnerabilities
const helmet = require('helmet');
// Morgan HTTP request logging middleware for logging method, status, URL, and response latency
const morgan = require('morgan');
// Node.js path module for resolving local and absolute filesystem paths across platforms
const path = require('path');
// Centralized application error handling middleware that captures and formats synchronous and asynchronous errors
const { errorHandler } = require('./middleware/error.middleware');
// Mongoose ODM for database connection state inspection
const mongoose = require('mongoose');
// Database readiness middleware preventing queries against disconnected database
const { checkDbReady } = require('./middleware/dbCheck.middleware');

// Authentication and session management routes (register, login, MFA, Google SSO, password recovery)
const authRoutes = require('./routes/auth.routes');
// Assessment authoring, retrieval, publishing, scheduling, and lifecycle routes
const assessmentRoutes = require('./routes/assessment.routes');
// Student attempt initiation, autosave, file answer upload, and submission routes
const submissionRoutes = require('./routes/submission.routes');
// Instructor manual grading, score aggregation, and evaluation feedback routes
const evaluationRoutes = require('./routes/evaluation.routes');
// User profile management, avatar image upload, and student directory routes
const userRoutes = require('./routes/user.routes');
// System administration, user approval queue, master registry management, and audit log routes
const adminRoutes = require('./routes/admin.routes');
// In-app notifications retrieval, mark as read, and status update routes
const notificationRoutes = require('./routes/notification.routes');
// Online proctoring session lifecycle, camera permission tracking, and integrity event routes
const proctoringRoutes = require('./routes/proctoring.routes');
// Platform analytics, student performance history, category mastery, and score trend routes
const analyticsRoutes = require('./routes/analytics.routes');
// Question bank repository, taxonomy indexing, difficulty tagging, and versioning routes
const questionBankRoutes = require('./routes/questionBank.routes');
// Question document ingestion (PDF, DOCX) and Google Forms import pipeline routes
const questionImportRoutes = require('./routes/questionImport.routes');
// Student credential, award snapshot, and certificate verification routes
const certificateRoutes = require('./routes/certificate.routes');
// System-wide broadcast announcement routes
const announcementRoutes = require('./routes/announcement.routes');
// Unified Test API route aggregator
const testRoutes = require('./routes');
// Mock test authoring, lifecycle, and attempt routes
const mockTestRoutes = require('./routes/mockTest.routes');
// Centralized Question Bank subsystem routes
const questionsRoutes = require('./routes/questions.routes');
const subjectTopicRoutes = require('./routes/subjectTopic.routes');
const topicsRoutes = require('./routes/topics.routes');
const questionBanksRoutes = require('./routes/questionBanks.routes');
const questionGenerationRoutes = require('./routes/questionGeneration.routes');
// Faculty-to-Student Interview & Proctoring subsystem routes
const interviewRoutes = require('./routes/interview.routes');
// Centralized rate limiting middleware to prevent brute-force attacks and throttle excessive API traffic
const { apiRateLimiter } = require('./middleware/rateLimit.middleware');

// Initialize the root Express application instance
const app = express();

// Trust the first reverse proxy hop (Nginx, Cloudflare, load balancer) for accurate client IP identification
app.set('trust proxy', 1);

/* When setting your JWT/session cookie on login:
const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
res.cookie('token', token, {
  httpOnly: true,
  secure: true,       // Required because Cloudflare uses HTTPS
  sameSite: 'lax',    // Works reliably when frontend & API share the Vite proxy
  // DO NOT set 'domain: localhost' here! Leave domain undefined.
  maxAge: 24 * 60 * 60 * 1000, // 1 day
}); */
// Mount Helmet security middleware configuring cross-origin resource policy to permit static file downloads
app.use(helmet({
  // Allow cross-origin access to uploaded static assets like question files and avatars
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Import centralized origin validator ensuring consistency between CORS and CSRF
const { isOriginAllowed } = require('./utils/origin');

// Mount CORS middleware with consistent origin evaluation and credential sharing support
app.use(cors({
  // Dynamic origin validator function
  origin: (origin, callback) => {
    // Allow non-browser requests (such as curl, Postman, or server-to-server calls) lacking Origin headers
    if (!origin) return callback(null, true);
    // Check if client origin is approved according to centralized security policy
    if (isOriginAllowed(origin, process.env.NODE_ENV)) {
      return callback(null, true);
    }
    // Reject origins that do not match configured client URLs
    const corsError = new Error(`CORS blocked for origin: ${origin}`);
    corsError.statusCode = 403;
    return callback(corsError);
  },
  // Permit authorization cookies and headers across cross-origin requests
  credentials: true,
}));

// Mount zero-dependency cookie parser populating req.cookies
const { parseCookies } = require('./utils/cookie');
app.use((req, res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  next();
});

// Enforce strict no-store Cache-Control headers across all API endpoints
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Reject prohibited test bypass headers in production environments
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-test-bypass']) {
    return res.status(403).json({
      success: false,
      message: 'Test bypass headers are strictly prohibited in production environment.',
    });
  }
  next();
});

// Parse JSON request bodies with an expanded 10MB limit to accommodate rich question schemas and imports
app.use(express.json({ limit: '10mb' }));
// Parse URL-encoded form request bodies with 10MB limit and extended object support
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general API rate limiting across all /api routes to prevent denial-of-service degradation
app.use('/api', apiRateLimiter);

// Enable Morgan HTTP console logging in development and production, suppressing output during automated tests
if (process.env.NODE_ENV !== 'test') {
  // Output concise color-coded request logs for interactive inspection
  app.use(morgan('dev'));
}

// Serve uploaded user files and avatars statically with controlled caching
app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '../uploads'), {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    },
  })
);

// Root landing endpoint providing platform status metadata and an index of available API endpoints
app.get('/', (req, res) => {
  // Return HTTP 200 with platform health, frontend URL, and API directory map
  res.status(200).json({
    // Status flag indicating active server process
    status: 'online',
    // Human-readable welcoming message
    message: 'Unified Assessment Platform Backend API is running.',
    // Target frontend client URL
    frontendUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    // Standard health check path
    healthCheck: '/api/health',
    // Map of primary REST resource route prefixes
    endpoints: {
      tests: '/api/tests',
      auth: '/api/auth',
      assessments: '/api/assessments',
      certificates: '/api/certificates',
      submissions: '/api/submissions',
      evaluations: '/api/evaluations',
      users: '/api/users',
      admin: '/api/admin',
      analytics: '/api/analytics',
      questionBank: '/api/question-bank',
      questionImport: '/api/question-import',
      notifications: '/api/notifications',
      proctoring: '/api/proctoring',
      interviews: '/api/interviews',
      announcements: '/api/announcements',
    },
  });
});

// Centralized health check handler returning JSON status and timestamp for container orchestrators and monitoring
const handleHealthCheck = (req, res) => {
  // Check active Mongoose database connection state (1 = connected)
  const isDbConnected = mongoose.connection.readyState === 1;
  const status = isDbConnected ? 'healthy' : 'unhealthy';
  const statusCode = isDbConnected ? 200 : 503;

  // Return health status along with explicit database connectivity state
  res.status(statusCode).json({
    // Service operational state
    status,
    // Database connectivity state
    database: isDbConnected ? 'connected' : 'disconnected',
    // Current UTC timestamp in ISO 8601 format
    timestamp: new Date().toISOString(),
    // Service name identifier
    service: 'Unified Assessment Platform API',
  });
};
// Bind health check handler to /api/health for standard API consumers
app.get('/api/health', handleHealthCheck);
// Bind health check handler to /health for load balancer probes and Kubernetes readiness probes
app.get('/health', handleHealthCheck);

// Guard all stateful API endpoints ensuring database is ready before executing queries
app.use('/api', (req, res, next) => {
  // Allow health checks through unconditionally
  if (req.path === '/health' || req.path === '/health/') {
    return next();
  }
  return checkDbReady(req, res, next);
});

// Mount authentication routes (authRateLimiter is applied specifically to credential, MFA, and recovery endpoints in auth.routes.js)
app.use('/api/auth', authRoutes);
// Mount assessment authoring, scheduling, and catalog management routes
app.use('/api/assessments', assessmentRoutes);
// Mount student credential awards and certificate verification routes
app.use('/api/certificates', certificateRoutes);
// Mount student assessment attempt and autosave submission routes
app.use('/api/submissions', submissionRoutes);
// Mount instructor evaluation, subjective grading, and feedback routes
app.use('/api/evaluations', evaluationRoutes);
// Mount user profile and account self-service routes
app.use('/api/users', userRoutes);
// Mount administrator operations, approval queue, master registries, and audit log routes
app.use('/api/admin', adminRoutes);
// Mount user in-app notification query and status update routes
app.use('/api/notifications', notificationRoutes);
// Mount proctoring session monitoring, camera verification, and integrity violation event routes
app.use('/api/proctoring', proctoringRoutes);
// Mount student, instructor, and administrative analytics aggregation routes
app.use('/api/analytics', analyticsRoutes);
// Mount question bank question management, taxonomy indexing, and retrieval routes
app.use('/api/question-bank', questionBankRoutes);
// Mount multi-format question file parser and Google Forms import processing routes
app.use('/api/question-import', questionImportRoutes);
// Mount system-wide broadcast announcement routes
app.use('/api/announcements', announcementRoutes);

// Mount Unified Test API facade
app.use('/api/tests', testRoutes);
// Mount Mock Test domain routes (legacy API prefix)
app.use('/api/mock-tests', mockTestRoutes);
// Mount Centralized Question Bank subsystem routes
app.use('/api/questions', questionsRoutes);
app.use('/api/subjects', subjectTopicRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/question-banks', questionBanksRoutes);
app.use('/api/question-generation', questionGenerationRoutes);
app.use('/api/interviews', interviewRoutes);

// Register centralized error handling middleware as the terminal handler in the Express pipeline
app.use(errorHandler);

// Export configured Express application instance for HTTP server binding and integration testing
module.exports = app;
