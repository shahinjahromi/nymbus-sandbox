import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { accountsRouter } from "./routes/accounts.js";
import { transactionsRouter } from "./routes/transactions.js";
import { customersRouter } from "./routes/customers.js";
import { transfersRouter } from "./routes/transfers.js";
import { portalRouter } from "./routes/portal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  });
});

app.use(authRouter);
app.use(portalRouter);
app.use(accountsRouter);
app.use(transactionsRouter);
app.use(customersRouter);
app.use(transfersRouter);
