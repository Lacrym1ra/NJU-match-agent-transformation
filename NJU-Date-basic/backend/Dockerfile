FROM node:24-alpine AS harness
WORKDIR /workspace/agent-harness
COPY agent-harness/package.json agent-harness/package-lock.json agent-harness/tsconfig.json ./
COPY agent-harness/src ./src
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:24-alpine AS builder
WORKDIR /workspace
COPY --from=harness /workspace/agent-harness ./agent-harness
COPY NJU-Date-basic/backend/package.json NJU-Date-basic/backend/package-lock.json ./NJU-Date-basic/backend/
WORKDIR /workspace/NJU-Date-basic/backend
RUN npm ci
COPY NJU-Date-basic/backend/tsconfig.json ./
COPY NJU-Date-basic/backend/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=builder /workspace/agent-harness ./agent-harness
COPY --from=builder /workspace/NJU-Date-basic/backend/package.json /workspace/NJU-Date-basic/backend/package-lock.json ./NJU-Date-basic/backend/
COPY --from=builder /workspace/NJU-Date-basic/backend/node_modules ./NJU-Date-basic/backend/node_modules
COPY --from=builder /workspace/NJU-Date-basic/backend/dist ./NJU-Date-basic/backend/dist
WORKDIR /workspace/NJU-Date-basic/backend
EXPOSE 3000
CMD ["npm", "run", "start"]
