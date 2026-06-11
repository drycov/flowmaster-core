# ЕСЭДО / Flowmaster Core — Node production image
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_SUPABASE_URL=https://placeholder.supabase.co
ARG VITE_SUPABASE_PUBLISHABLE_KEY=placeholder-anon-key
ARG SUPABASE_URL=https://placeholder.supabase.co
ARG SUPABASE_PUBLISHABLE_KEY=placeholder-anon-key
ARG SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role
ARG SUPABASE_JWT_SECRET=placeholder-jwt-secret
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./vite.config.ts
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["npm", "run", "start"]
