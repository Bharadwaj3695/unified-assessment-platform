# Hardened Ephemeral SQLite 3 Runner
FROM alpine:3.19

# Install SQLite CLI and minimal dependencies
RUN apk add --no-cache sqlite

# Security: Remove setuid/setgid binaries to prevent privilege escalation
RUN find / -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true

# Create unprivileged sandbox user (UID/GID 10001)
RUN adduser -u 10001 -D -h /home/sandbox sandbox && \
    mkdir -p /home/sandbox/app && \
    chown -R sandbox:sandbox /home/sandbox

USER sandbox
WORKDIR /home/sandbox/app

# Default command: run sqlite in ephemeral in-memory mode
CMD ["sqlite3", ":memory:"]
