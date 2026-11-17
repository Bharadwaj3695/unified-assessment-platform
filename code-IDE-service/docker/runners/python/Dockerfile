# Hardened Ephemeral Python Runner
FROM python:3.11.8-alpine3.19

# Security: Remove setuid/setgid binaries to prevent privilege escalation
RUN find / -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true

# Create unprivileged sandbox user
RUN adduser -u 10001 -D -h /home/sandbox sandbox && \
    mkdir -p /home/sandbox/app && \
    chown -R sandbox:sandbox /home/sandbox

USER sandbox
WORKDIR /home/sandbox/app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["python3", "main.py"]
