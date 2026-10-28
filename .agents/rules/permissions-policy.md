# UAP Workspace Permission Policy

> [!IMPORTANT]
> This policy enforces least privilege for the Unified Assessment Platform repository.

### Auto-Approved Routine Operations
- File reads, greps, and code navigation within `/home/bhara/Unified Assessment Platform [original]`.
- Non-destructive Git status queries: `git status`, `git diff`, `git log`, `git branch`.
- Targeted unit & E2E tests: `npm test`, `npm --prefix backend test`, `npx playwright test`.
- Local builds & dev workflow: `npm run build`, `npm --prefix frontend run build`, `npm run dev`.
- Source file editing under `frontend/src/`, `backend/src/`, `tests/`, `docs/`.

### Explicit Confirmation Required
- Destructive Git (`reset --hard`, `push --force`, `clean -f`).
- Database mutations (`npm run seed`, `npm run provision:admin`, dropping databases).
- Any access or alteration to `.env`, credentials, or security configurations.
- Any shell commands requiring `sudo` or downloading remote scripts.
- Deleting files or directories with `rm -rf`.
