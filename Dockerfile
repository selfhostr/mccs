FROM node:26-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data

WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public

# Réglages modifiés dans l'admin (volume monté sur /data).
RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server/start.js"]
