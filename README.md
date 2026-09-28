Unified Assessment Platform (UAP)

A full-stack assessment and learning platform for managing assessments, question banks, student submissions, evaluation, analytics, proctoring, notifications, and role-based administration.

UAP provides separate workflows for Students, Instructors, and Administrators, with secure authentication, RBAC, MFA, assessment lifecycle management, document-based submissions, question-bank management, AI-assisted question classification, analytics, and examination telemetry.

Table of Contents
Overview
Features
How It Works
Architecture
Project Structure
Technology Stack
Getting Started
Environment Configuration
Demo Accounts
Application Workflows
API Structure
Authentication and Security
Assessment Engine
Question Bank and Intelligent Import
Document Submissions
Analytics
Proctoring
Testing
Deployment
Known Limitations
Roadmap
Overview

The Unified Assessment Platform (UAP) is a web-based assessment system built using React, Node.js, Express and MongoDB.

It provides a complete assessment lifecycle:

Instructor
    ↓
Create Assessment
    ↓
Add Questions
    ↓
Publish / Assign
    ↓
Student
    ↓
View Assessment
    ↓
Start Attempt
    ↓
Answer + Autosave
    ↓
Submit
    ↓
Evaluation
    ↓
Result
    ↓
Analytics

The backend follows a layered architecture where middleware handles security, routes expose APIs, controllers coordinate requests, services implement business rules, and Mongoose models persist data in MongoDB Atlas.

Features
Capability	Description
Authentication	Email/password authentication with JWT
Google SSO	Google OAuth/OIDC authentication
MFA / 2FA	TOTP-based multi-factor authentication
RBAC	Student, Instructor and Admin access control
Account Governance	Pending, active, rejected and revoked account lifecycle
Assessment Builder	Create, edit, publish and manage assessments
Question Types	MCQ, Short Answer, Long Answer, True/False, Code and File Upload
Assessment Access	Public and restricted/assigned assessments
Examination Engine	Server-controlled timing, autosave and submission lifecycle
Evaluation	Automatic objective grading + instructor evaluation
Document Submission	PDF/DOC/DOCX submissions
Google Docs	Secure Google Docs URL submissions
Question Bank	Reusable, tagged and versioned questions
Intelligent Import	PDF/DOCX/Google Forms question extraction
AI Classification	AI-assisted question classification and metadata
Analytics	Student, instructor and admin analytics
Leaderboard	Privacy-aware configurable leaderboard
Streaks	Academic activity streak tracking
Proctoring	Session and examination telemetry
Notifications	In-app and email notifications
Audit Logging	Administrative and security activity tracking
Dark Mode	Light and dark application themes
API Documentation	OpenAPI/Swagger documentation
E2E Testing	Playwright multi-role browser testing
How It Works

The application is divided into a React frontend and Node.js backend.

                    Browser
                       │
                       ▼
                React Frontend
                       │
                     Axios
                       │
                     HTTPS
                       │
                       ▼
               Express REST API
                       │
              ┌────────┴────────┐
              │                 │
        Security Layer       API Routes
              │                 │
       JWT / RBAC / MFA        │
       Validation / Upload     │
              │                 │
              └────────┬────────┘
                       ▼
                  Controllers
                       │
                       ▼
                    Services
                       │
                       ▼
                Mongoose Models
                       │
                       ▼
                 MongoDB Atlas

The request flow follows:

React
 ↓
Axios
 ↓
Express
 ↓
Middleware
 ↓
Routes
 ↓
Controllers
 ↓
Services
 ↓
Mongoose
 ↓
MongoDB Atlas
 ↓
Response
 ↓
React UI

This layered request flow is the core backend architecture documented for UAP.

Architecture
Backend
Request
   │
   ▼
Authentication
   │
   ▼
Authorization / RBAC
   │
   ▼
Validation
   │
   ▼
Route
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
Mongoose Model
   │
   ▼
MongoDB Atlas
Architectural responsibilities
Layer	Responsibility
Routes	REST API endpoints
Middleware	Authentication, RBAC, validation, upload security, errors
Controllers	HTTP request/response coordination
Services	Business/domain logic
Models	MongoDB schema and persistence
Validators	Request validation and sanitization
Utils	Shared infrastructure utilities
Config	Database and environment configuration

Controllers are intentionally kept thin while business rules remain in services.

Project Structure
unified-assessment-platform/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── validators/
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── storage/
│   │   └── documents/
│   │
│   ├── uploads/
│   ├── test/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── config/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── vercel.json
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
├── tests/
│   ├── e2e/
│   ├── playwright.config.js
│   └── playwright-report/
│
├── docs/
│   ├── api/
│   ├── architecture/
│   └── design/
│
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
Technology Stack
Frontend
React
Vite
React Router
Tailwind CSS
Formik
Yup
Axios
Recharts
React Toastify
React Quill
Lucide React
Backend
Node.js
Express.js
Mongoose
MongoDB Atlas
JWT
bcryptjs
Google OAuth
Multer
Nodemailer
express-validator
Helmet
CORS
Winston
Morgan
Testing
Node Test Runner
mongodb-memory-server
Playwright
Deployment
GitHub
    ↓
Vercel
    ↓
React Frontend

Render
    ↓
Node/Express Backend

MongoDB Atlas
    ↓
Database
Getting Started
Prerequisites

Install:

Node.js
npm
MongoDB Atlas account
Git

Optional integrations:

Google Cloud OAuth
SMTP provider
1. Clone repository
git clone <your-repository-url>
cd "Unified Assessment Platform"
2. Install dependencies

From the project root:

npm install

Backend:

cd backend
npm install

Frontend:

cd ../frontend
npm install
Environment Configuration

Create:

backend/.env

from:

backend/.env.example

Configure the required values for:

MongoDB
JWT
Refresh tokens
MFA
Google OAuth
SMTP
Frontend URL

Frontend:

frontend/.env

from:

frontend/.env.example

Configure the backend API URL.

Important

Never commit:

.env
.envx
private keys
OAuth secrets
JWT secrets
SMTP passwords
MFA encryption keys

Only commit .env.example.

Running Locally
Terminal 1 — Backend
cd backend
npm run dev

Backend:

http://localhost:5000

Health check:

http://localhost:5000/api/health
Terminal 2 — Frontend
cd frontend
npm run dev

Frontend:

http://localhost:5173
Demo Accounts

Development/demo accounts can be initialized through the project's seed mechanism.

Example account groups:

Students
std01@uap.edu
std02@uap.edu
std03@uap.edu
std04@uap.edu
std05@uap.edu

Instructors
ins01@uap.edu
ins02@uap.edu
ins03@uap.edu
ins04@uap.edu
ins05@uap.edu

Admins
admin01@uap.edu
admin02@uap.edu

Do not use development credentials in a real production environment.

Application Workflows
Student
Login
 ↓
Dashboard
 ↓
Assessment Catalog
 ↓
Assessment Details
 ↓
Start Attempt
 ↓
Answer Questions
 ↓
Autosave
 ↓
Submit
 ↓
Evaluation
 ↓
Result
 ↓
Analytics
Instructor
Login
 ↓
Instructor Dashboard
 ↓
Create Assessment
 ↓
Add Questions
 ↓
Assign Students
 ↓
Publish
 ↓
Monitor Submissions
 ↓
Evaluate
 ↓
Send Feedback
 ↓
Analytics
Administrator
Login
 ↓
Admin Dashboard
 ↓
User Governance
 ↓
Approve / Reject / Revoke
 ↓
Platform Monitoring
 ↓
Assessment Oversight
 ↓
Audit Logs
 ↓
System Settings
API Structure

All backend APIs are exposed under:

/api

Major API groups:

/api/auth
/api/assessments
/api/submissions
/api/evaluations
/api/users
/api/admin
/api/analytics
/api/question-bank
/api/question-import
/api/notifications
/api/proctoring

Examples:

POST /api/auth/login

GET /api/assessments

POST /api/assessments

POST /api/submissions/:id/submit

POST /api/evaluations

GET /api/analytics/student/...

GET /api/question-bank

API documentation is available through Swagger/OpenAPI when configured:

/api-docs
Authentication and Security

UAP implements multiple authentication and security mechanisms.

Authentication
Email + Password
        │
        ▼
Password Verification
        │
        ▼
MFA Required?
   │          │
  No         Yes
   │          │
   ▼          ▼
JWT       MFA Challenge
              │
              ▼
          TOTP / Recovery
              │
              ▼
         Access + Refresh
Security controls
JWT authentication
RBAC
MFA / TOTP
Google OAuth
Password hashing
Refresh-token lifecycle
Token versioning
Input validation
CORS
Helmet
Rate limiting
File validation
Filename sanitization
OAuth state validation
Private document storage
Audit logging

The backend middleware layer specifically handles authentication, role authorization, request validation, file-upload security and error handling.

Assessment Engine

The examination engine follows a controlled lifecycle:

OPEN
  ↓
Assessment Details
  ↓
START
  ↓
IN_PROGRESS
  ↓
Answer / Autosave
  ↓
SUBMIT
  ↓
EVALUATION
  ↓
RESULT

The system uses:

Server-side timing
startedAt
deadlineAt
Autosave
Attempt ownership
Duplicate-attempt protection
Idempotent submission
Deadline enforcement
Question-level answer persistence

This prevents the browser from being the sole authority for exam timing and state.

Evaluation

UAP separates objective and subjective evaluation.

Objective Questions
       ↓
Automatic Score
       │
       └─────────┐
                 ▼
Subjective Questions
       ↓
Instructor Evaluation
       ↓
Manual Score
       │
       ▼
Final Score
       ↓
Percentage
       ↓
PASS / FAIL

The system avoids treating incomplete subjective evaluation as a finalized result.

Question Bank and Intelligent Import

The Question Bank provides reusable assessment content.

PDF / DOCX / Google Forms
          ↓
       Extraction
          ↓
     Normalization
          ↓
Heuristic / AI Classification
          ↓
       Preview
          ↓
    Faculty Review
          ↓
      Approval
          ↓
    Question Bank

Supported metadata includes:

Question type
Difficulty
Bloom level
Tags
Marks
Source
Version
AI confidence

AI classification assists the instructor but does not automatically publish questions.

Document Submissions

UAP supports document-based assessment responses.

Supported formats include:

PDF
DOC
DOCX

The upload pipeline validates:

File extension
MIME type
File size
Filename
Storage location
Ownership
Assessment deadline

Documents are stored privately rather than exposed through unrestricted public URLs.

Proctoring

Proctoring is implemented as examination telemetry rather than an automatic cheating verdict.

Assessment Attempt
       ↓
Proctoring Session
       ↓
Proctoring Events
       ↓
Telemetry

Tracked information can include:

Camera status
Clipboard events
Session lifecycle
Event severity
Assessment telemetry

The system does not automatically declare that a student cheated based solely on telemetry.

Analytics
Student analytics
Average Score
Attempts
Completed Assessments
Pass Rate
Category Performance
Score Trends
Recent Results
Current Streak
Best Streak
Leaderboard Position
Instructor analytics
Assessment Average
Highest Score
Lowest Score
Pass Rate
Attempt Count
Question Statistics
Score Distribution
Student Performance
Admin analytics
Platform Activity
Users
Assessments
Submissions
System Metrics
Security Events
Notifications

UAP supports:

In-app notifications
Email notifications

The notification architecture uses:

Application Event
       ↓
Notification Service
       ├──→ Database
       └──→ Email / SMTP

Nodemailer is used for email delivery.

Testing

Testing is performed at multiple levels.

Backend

Backend tests cover areas including:

Authentication
RBAC
MFA
Assessments
Submissions
Evaluation
Question Bank
Question Import
Proctoring
Analytics
Security
Admin governance
End-to-End

Playwright tests verify real browser workflows:

Student
Instructor
Admin
Authentication
MFA
Navigation
Assessment lifecycle
Security boundaries

Run backend tests:

cd backend
npm test

Run frontend build:

cd frontend
npm run build

Run Playwright:

npx playwright test
Deployment

Production architecture:

                    Users
                      │
                    HTTPS
                      │
                      ▼
                 ┌─────────┐
                 │ Vercel  │
                 │ React   │
                 └────┬────┘
                      │
                      │ HTTPS REST
                      ▼
                 ┌─────────┐
                 │ Render  │
                 │ Express │
                 └────┬────┘
                      │
                      ▼
              ┌──────────────┐
              │ MongoDB Atlas│
              └──────────────┘

Supporting services:

GitHub
GitHub Actions
Google OAuth
SMTP
Known Limitations

Current limitations should be tracked explicitly rather than hidden.

Local filesystem document storage

The current implementation uses application-side storage for documents. Production-scale deployments should migrate to dedicated object storage.

Proctoring

Current proctoring focuses on telemetry and event capture. It does not provide automated AI-based cheating detection.

AI classification

AI-assisted question classification requires faculty review before questions become approved reusable content.

Multi-tenancy

Institution/college-level multi-tenancy is a future architectural extension and is not part of the current UAP implementation.

Production configuration

Development credentials, local URLs and development seed data must be replaced with production-specific configuration before deployment.

Roadmap
Completed
 Authentication
 JWT
 RBAC
 Google SSO
 MFA / TOTP
 Account governance
 Assessment access control
 Assessment attempt engine
 Autosave
 Evaluation
 Document submissions
 Proctoring telemetry
 Notifications
 Analytics
 Leaderboard
 Question Bank
 Intelligent Question Import
 AI-assisted classification
 Professional landing page
 Role-based dashboards
 Structured dashboard navigation
 Production security hardening
 OpenAPI/Swagger preparation
Future
Multi-tenant college architecture
        ↓
Institution management
        ↓
Department / Subject management
        ↓
Institution branding
        ↓
College-specific portals

Additional scaling improvements:

Object storage
Redis caching
Background workers
Queue-based processing
WebSockets / SSE
Advanced observability
Horizontal backend scaling
Core Design Principle

The central design principle of UAP is separation of concerns:

Routes
  ↓
HTTP/API boundary

Controllers
  ↓
Request/response coordination

Services
  ↓
Business rules

Models
  ↓
Data persistence

Middleware
  ↓
Security + cross-cutting concerns

This keeps the backend maintainable as new assessment, evaluation, analytics and institutional capabilities are added.

Project Status

Unified Assessment Platform — Full-stack Assessment & Learning Platform

Frontend     React + Vite
Backend      Node.js + Express
Database     MongoDB Atlas
Auth         JWT + Google OAuth + TOTP MFA
Testing      Node Tests + Playwright
Deployment   Vercel + Render
API          REST + OpenAPI
One thing I would change before you put this on GitHub

Don't publish the real demo passwords, .env, .envx, OAuth credentials, SMTP credentials, JWT secrets, or MFA encryption keys.

Your README can describe the demo-account structure, but I would either document placeholder credentials or provide a safe development-seed instruction. The README should be safe to make public.
