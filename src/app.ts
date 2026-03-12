import express from "express";
import cors from "cors";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { accountsRouter } from "./routes/accounts.js";
import { transactionsRouter } from "./routes/transactions.js";
import { customersRouter } from "./routes/customers.js";
import { transfersRouter } from "./routes/transfers.js";
import { portalRouter } from "./routes/portal.js";
import { openApiFallbackRouter } from "./routes/openapi-fallback.js";
import { flushTenantStore } from "./services/tenant-store.js";
import { flushFallbackRuntimeStore } from "./routes/openapi-fallback.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const portalDistPath = join(__dirname, "..", "portal", "dist", "browser");

export const app = express();
const coreApiVersions = ["/v1.0", "/v1.1", "/v1.2", "/v1.3", "/v1.4", "/v1.5"] as const;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((_, res, next) => {
  res.once("finish", () => {
    flushTenantStore();
    flushFallbackRuntimeStore();
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    environment: "sandbox",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/docs", (_req, res) => {
  try {
    const specPath = join(__dirname, "..", "openapi", "sandbox-api.yaml");
    const yaml = readFileSync(specPath, "utf-8");
    res.type("text/yaml").send(yaml);
  } catch {
    res.status(404).json({ code: "NOT_FOUND", message: "OpenAPI spec not found" });
  }
});

app.get("/", (_req, res) => {
  res.json({
    name: "Nymbus Sandbox API",
    description:
      "Sandbox environment for Nymbus processor integration. Use OAuth client_credentials to obtain an access token, then call the API with Bearer token.",
    documentation: "/docs",
    health: "/health",
    oauth: {
      token_url: `${config.sandboxBaseUrl}/oauth/token`,
      grant_type: "client_credentials",
    },
    portal: `${config.sandboxBaseUrl}/portal`,
    endpoints: {
      accounts: "/accounts",
      transactions: "/transactions",
      customers: "/customers",
      transfers: "/transfers",
      portalApi: "/portal-api",
    },
    api_versions: [...coreApiVersions],
  });
});

app.use(authRouter);
app.use(portalRouter);

/* ── Angular portal frontend (built static assets) ── */
if (existsSync(portalDistPath)) {
  app.use("/portal", express.static(portalDistPath, { index: "index.html" }));
  // SPA fallback: serve index.html for any unmatched /portal/* route
  app.use("/portal", (_req, res) => {
    res.sendFile(join(portalDistPath, "index.html"));
  });
}

for (const versionPrefix of coreApiVersions) {
  app.use(versionPrefix, authRouter);
  app.use(versionPrefix, accountsRouter);
  app.use(versionPrefix, transactionsRouter);
  app.use(versionPrefix, customersRouter);
  app.use(versionPrefix, transfersRouter);
}

app.use(accountsRouter);
app.use(transactionsRouter);
app.use(customersRouter);
app.use(transfersRouter);
app.use(openApiFallbackRouter);
