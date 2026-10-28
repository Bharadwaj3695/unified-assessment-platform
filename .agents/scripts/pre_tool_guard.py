#!/usr/bin/env python3
"""
PreToolUse Guard Hook for Unified Assessment Platform (UAP).

Minimizes repetitive permission prompts for routine, approved dev operations
while strictly requiring explicit approval for destructive, sensitive, or high-risk actions.
"""

import sys
import json
import os
import re
from pathlib import Path

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Sensitive file patterns requiring explicit approval or denial
SENSITIVE_FILE_PATTERNS = [
    re.compile(r"(^|[/\\])\.env(\.[a-zA-Z0-9_\-]+)?$", re.IGNORECASE),
    re.compile(r"(^|[/\\])oauth_creds\.json$", re.IGNORECASE),
    re.compile(r"(^|[/\\])\.git[/\\]", re.IGNORECASE),
    re.compile(r"(^|[/\\])(id_rsa|id_ed25519)(\.pub)?$", re.IGNORECASE),
    re.compile(r"\.(pem|key|pfx|pkcs12)$", re.IGNORECASE),
    re.compile(r"(^|[/\\])\.agents[/\\]hooks\.json$", re.IGNORECASE),
]

# Destructive commands that MUST ALWAYS require explicit approval or be denied
DESTRUCTIVE_COMMAND_PATTERNS = [
    # Elevated privileges
    (re.compile(r"^\s*(sudo|su)(\s+|$)"), "deny", "Elevated privileges are strictly forbidden."),
    (re.compile(r"(curl|wget)\s+.*\|\s*(ba)?sh"), "deny", "Piping downloaded remote scripts into shell is strictly forbidden."),
    
    # Destructive Git operations
    (re.compile(r"\bgit\s+reset\s+--hard\b"), "force_ask", "Hard git reset is destructive and requires explicit user confirmation."),
    (re.compile(r"\bgit\s+push\s+.*(--force|-f)\b"), "force_ask", "Force git push can overwrite remote history and requires explicit approval."),
    (re.compile(r"\bgit\s+clean\s+-[a-zA-Z]*f"), "force_ask", "git clean removes untracked files permanently and requires explicit approval."),
    (re.compile(r"\bgit\s+branch\s+-D\b"), "force_ask", "Force deleting a branch requires explicit confirmation."),
    (re.compile(r"\bgit\s+checkout\s+--\s+\."), "force_ask", "Discarding all working tree changes requires explicit confirmation."),

    # Database drops, seeding, admin provisioning
    (re.compile(r"\b(dropdb|dropDatabase|db\.dropDatabase)\b"), "force_ask", "Database deletion/drop operations require explicit approval."),
    (re.compile(r"\bnpm\s+(run\s+)?seed\b"), "force_ask", "Running database seed scripts alters database state and requires explicit approval."),
    (re.compile(r"\bnode\s+.*seed\.js\b"), "force_ask", "Running seed scripts alters database state and requires explicit approval."),
    (re.compile(r"\bnpm\s+(run\s+)?provision:admin\b"), "force_ask", "Admin account provisioning alters security state and requires explicit approval."),
    (re.compile(r"\bnode\s+.*provisionAdmin\.js\b"), "force_ask", "Admin account provisioning alters security state and requires explicit approval."),

    # Destructive file deletions
    (re.compile(r"\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f?|-[a-zA-Z]*f[a-zA-Z]*r?)\s+(/|~|\.\.|backend|frontend|\.git|\.agents|\*)"), "force_ask", "Broad or recursive file deletion requires explicit approval."),
    
    # Production publishing / deployments
    (re.compile(r"\bnpm\s+publish\b"), "force_ask", "Publishing packages requires explicit approval."),
]

# Routine commands approved for automatic execution without prompts
ROUTINE_COMMAND_PATTERNS = [
    # Git inspections
    re.compile(r"^\s*git\s+status(\s+.*)?$"),
    re.compile(r"^\s*git\s+diff(\s+.*)?$"),
    re.compile(r"^\s*git\s+log(\s+.*)?$"),
    re.compile(r"^\s*git\s+branch(\s+(-[avrl]+|--list))?$"),
    re.compile(r"^\s*git\s+show(\s+.*)?$"),
    
    # Build & Bundling
    re.compile(r"^\s*npm\s+(run\s+)?build(\s+.*)?$"),
    re.compile(r"^\s*npm\s+--prefix\s+frontend\s+run\s+build(\s+.*)?$"),
    re.compile(r"^\s*npm\s+--prefix\s+frontend\s+build(\s+.*)?$"),
    re.compile(r"^\s*npm\s+run\s+preview(\s+.*)?$"),
    
    # Tests
    re.compile(r"^\s*npm\s+test(\s+.*)?$"),
    re.compile(r"^\s*npm\s+(run\s+)?test(:[a-zA-Z0-9_\-]+)?(\s+.*)?$"),
    re.compile(r"^\s*npm\s+--prefix\s+backend\s+test(\s+.*)?$"),
    re.compile(r"^\s*npx\s+playwright\s+test(\s+.*)?$"),
    re.compile(r"^\s*node\s+--test(\s+.*)?$"),
    
    # Local Dev Servers
    re.compile(r"^\s*npm\s+(run\s+)?dev(\s+.*)?$"),
    re.compile(r"^\s*npm\s+(run\s+)?dev:(frontend|backend)(\s+.*)?$"),
    
    # Linting & Formatting
    re.compile(r"^\s*npm\s+(run\s+)?lint(\s+.*)?$"),
    re.compile(r"^\s*npx\s+(eslint|prettier)(\s+.*)?$"),
    
    # Safe inspect & navigation tools
    re.compile(r"^\s*(pwd|ls|dir)(\s+.*)?$"),
    re.compile(r"^\s*(node|npm|python3|git)\s+(--version|-v)$"),
]


def is_sensitive_path(file_path: str) -> bool:
    norm = os.path.normpath(file_path)
    for pat in SENSITIVE_FILE_PATTERNS:
        if pat.search(norm):
            return True
    return False


def is_outside_workspace(file_path: str) -> bool:
    try:
        abs_path = os.path.abspath(file_path)
        return not abs_path.startswith(WORKSPACE_ROOT)
    except Exception:
        return True


def evaluate_command(cmd: str) -> dict:
    cmd_clean = cmd.strip()

    # 1. Check Destructive / Dangerous rules first
    for pat, decision, reason in DESTRUCTIVE_COMMAND_PATTERNS:
        if pat.search(cmd_clean):
            return {"decision": decision, "reason": reason}

    # 2. Check for sensitive file access in command string
    if re.search(r"(^|\s)(\.env|oauth_creds\.json|\.git/)(\s|$)", cmd_clean):
        return {
            "decision": "force_ask",
            "reason": "Command references sensitive credentials or git repository internals."
        }

    # 3. Check Routine Allowed Commands
    for pat in ROUTINE_COMMAND_PATTERNS:
        if pat.match(cmd_clean):
            return {
                "decision": "allow",
                "reason": f"Pre-approved routine UAP development command: `{cmd_clean}`"
            }

    # Default fallback: ask user for confirmation
    return {
        "decision": "ask",
        "reason": f"Command `{cmd_clean}` requires user review (not in routine auto-approval list)."
    }


def evaluate_file_op(tool_name: str, args: dict) -> dict:
    file_path = args.get("Path", "")
    if not file_path:
        return {"decision": "ask", "reason": "No file path specified."}

    # Check outside workspace
    if is_outside_workspace(file_path):
        return {
            "decision": "force_ask",
            "reason": f"File operation targets a path outside UAP workspace: {file_path}"
        }

    # Check sensitive files
    if is_sensitive_path(file_path):
        return {
            "decision": "force_ask",
            "reason": f"Operation touches sensitive file/directory: {file_path}"
        }

    # Routine project source file edit/write
    if tool_name in ("write_file", "edit_file"):
        # Safe project directories
        rel = os.path.relpath(os.path.abspath(file_path), WORKSPACE_ROOT)
        safe_prefixes = ("frontend/src", "backend/src", "tests", "docs", "test-results")
        if any(rel.startswith(p) for p in safe_prefixes):
            return {
                "decision": "allow",
                "reason": f"Routine edit/write to project source file: {rel}"
            }
        return {
            "decision": "ask",
            "reason": f"Modifying project configuration/root file requires review: {rel}"
        }

    return {"decision": "allow", "reason": f"Routine file operation on {file_path}"}


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        # If payload cannot be read, fail safe to asking
        print(json.dumps({"decision": "ask", "reason": "Failed to parse hook payload"}))
        return

    tool_call = payload.get("toolCall", {})
    tool_name = tool_call.get("name", "")
    args = tool_call.get("args", {})

    if tool_name == "run_command":
        cmd = args.get("CommandLine", "")
        res = evaluate_command(cmd)
    elif tool_name in ("write_file", "edit_file"):
        res = evaluate_file_op(tool_name, args)
    elif tool_name == "read_file":
        path = args.get("Path", "")
        if is_sensitive_path(path):
            res = {"decision": "force_ask", "reason": f"Reading sensitive file requires approval: {path}"}
        else:
            res = {"decision": "allow", "reason": f"Safe read of workspace file: {path}"}
    else:
        res = {"decision": "ask", "reason": f"Tool `{tool_name}` requires user review."}

    print(json.dumps(res))


if __name__ == "__main__":
    main()
