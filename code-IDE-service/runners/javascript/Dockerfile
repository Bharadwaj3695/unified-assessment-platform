# Hardened Ephemeral JavaScript (Node.js) Runner
FROM node:20.11.1-alpine3.19

# Security: Remove setuid/setgid binaries
RUN find / -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true

# Create unprivileged sandbox user
RUN adduser -u 10001 -D -h /home/sandbox sandbox && \
    mkdir -p /home/sandbox/app && \
    chown -R sandbox:sandbox /home/sandbox

USER sandbox
WORKDIR /home/sandbox/app

ENV NODE_ENV=production

CMD ["node", "--max-old-space-size=128", "main.js"]
