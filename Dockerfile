# Builds the forc.pub Next.js frontend (app/) as a standalone server for Railway.
# The Rust backend has its own image in deployment/Dockerfile and is not part of this build.
# Build context is the repo root; the Next app lives in app/.

FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
# Inlined into the client bundle at build time. Railway passes service variables as build args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_REDIRECT_URI
ARG NEXT_PUBLIC_APP_ORIGIN
ARG NEXT_PUBLIC_ROOT_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_REDIRECT_URI=$NEXT_PUBLIC_REDIRECT_URI \
    NEXT_PUBLIC_APP_ORIGIN=$NEXT_PUBLIC_APP_ORIGIN \
    NEXT_PUBLIC_ROOT_URL=$NEXT_PUBLIC_ROOT_URL
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN npm run build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
# app/ has its own lockfile, so next's file tracing root is app/ and the standalone tree
# lands at app/build/standalone/server.js (distDir is "build"). The server reads static
# chunks from ./build/static next to server.js.
WORKDIR /app/app
COPY --from=build /app/app/build/standalone ./
COPY --from=build /app/app/build/static ./build/static
COPY --from=build /app/app/public ./public
EXPOSE 3000
# next's standalone server listens on $PORT (Railway injects it).
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
