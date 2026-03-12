# ---- Build stage ----
FROM node:20-slim AS build

WORKDIR /app

# Backend dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Portal build
COPY portal/package.json portal/package-lock.json portal/
RUN cd portal && npm ci

COPY portal/ portal/
RUN cd portal && npx ng build --configuration=production

# Backend build
COPY tsconfig.json ./
COPY openapi/ openapi/
COPY src/ src/
RUN npx tsc

# ---- Runtime stage ----
FROM node:20-slim

WORKDIR /app

# Production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Rebuild better-sqlite3 native module for the container arch
RUN npm rebuild better-sqlite3

# Compiled backend
COPY --from=build /app/dist/ dist/

# OpenAPI spec (needed at runtime by fallback router)
COPY --from=build /app/openapi/ openapi/

# Portal static assets
COPY --from=build /app/portal/dist/ portal/dist/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
