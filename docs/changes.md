# Unified Assessment Platform (UAP) — Operational Guidelines & Permission Policy

This project uses Google Antigravity (AGY) for development. Follow the boundaries below to ensure routine tasks execute with minimal interruptions while sensitive and destructive actions remain strictly protected.

## 1. Routine Pre-Approved Tasks (Execute Autonomously)
The agent is authorized to execute the following routine development operations without prompting for permission:
- **Repository Inspection**: Read, search, grep, and inspect files inside the repository.
- **Git Status & History**: `git status`, `git diff`, `git diff --staged`, `git log`, `git branch`, `git show`.
- **Source Code Edits**: Edit, refactor, and create project source files under `frontend/src/`, `backend/src/`, `tests/`, `docs/`, and `test-results/`.
- **Approved Project Scripts**:
  - `npm test` / `npm --prefix backend test`
  - `npm run test:e2e` / `npx playwright test`
  - `npm run build` / `npm --prefix frontend run build`
  - `npm run dev` / `npm run dev:frontend` / `npm run dev:backend`
  - `npm run lint` / `npx eslint`

## 2. Hard Boundaries — Explicit User Approval Required
The agent MUST pause, explain the proposed action, and obtain explicit user confirmation before executing any of the following:
1. **Destructive Git Operations**:
   - `git reset --hard`, `git clean -f`, `git push --force`, `git checkout -- .`, `git branch -D`, or altering commit history.
2. **File & Directory Deletion**:
   - `rm -rf`, deleting repository folders (`backend`, `frontend`, `tests`, `.git`, `.agents`), or overwriting critical configuration files.
3. **Database Changes & Account Provisioning**:
   - Database dropping (`dropdb`, `dropDatabase`), running destructive migrations, bulk data modifications.
   - Running seeding scripts (`npm run seed`, `node src/config/seed.js`) or admin provisioning (`npm run provision:admin`, `node src/scripts/provisionAdmin.js`).
4. **Secrets & Credentials**:
   - Reading, exposing, transmitting, or editing `.env`, `.env.*`, `oauth_creds.json`, API keys, OAuth tokens, MFA secrets, private keys, or certificates.
5. **Security, Auth & Permissions**:
   - Changing authentication flows, MFA logic, RBAC policies, or permission rules (`hooks.json`, `settings.json`, `.gemini/config`).
6. **Elevated Privileges & External Scripts**:
   - Using `sudo`, `su`, installing untrusted system packages, or piping remote web scripts into a shell (`curl ... | bash`).
7. **External & Non-Workspace Actions**:
   - Accessing or modifying files outside `/home/bhara/Unified Assessment Platform [original]`.
   - Production deployments or package publishing (`npm publish`).
