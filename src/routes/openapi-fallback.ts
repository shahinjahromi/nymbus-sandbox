import { Router, type Request, type Response, type NextFunction } from "express";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parse } from "yaml";
import { validateAccessToken } from "../auth/oauth.js";
import { checkApiRateLimit } from "../services/security-rate-limit.js";

type RouteMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

interface ContractRoute {
  method: RouteMethod;
  openApiPath: string;
  expressPath: string;
  successStatus: number;
  operationId?: string;
  secured: boolean;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const supportedMethods: RouteMethod[] = ["get", "post", "put", "patch", "delete", "options", "head"];

let cachedRoutes: ContractRoute[] | null = null;

function toExpressPath(openApiPath: string): string {
  return openApiPath.replace(/\{([^}]+)\}/g, ":$1");
}

function pickSuccessStatus(operation: Record<string, unknown> | undefined): number {
  const responses = operation?.responses as Record<string, unknown> | undefined;
  if (!responses) {
    return 200;
  }

  const successCodes = Object.keys(responses)
    .filter((code) => /^2\d\d$/.test(code))
    .map((code) => Number.parseInt(code, 10))
    .sort((a, b) => a - b);

  return successCodes[0] ?? 200;
}

function hasSecurityRequirement(
  operation: Record<string, unknown> | undefined,
  rootSecurity: unknown
): boolean {
  const operationSecurity = operation?.security;
  const effectiveSecurity = operationSecurity ?? rootSecurity;

  if (!Array.isArray(effectiveSecurity)) {
    return false;
  }

  return effectiveSecurity.length > 0;
}

function loadBundledContractRoutes(): ContractRoute[] {
  const bundledPath = join(__dirname, "..", "..", "openapi", "nymbus-baas-bundled.yml");
  const raw = readFileSync(bundledPath, "utf-8");
  const document = parse(raw) as {
    security?: unknown;
    paths?: Record<string, Record<string, Record<string, unknown>>>;
  };

  const rootSecurity = document.security;
  const paths = document.paths ?? {};
  const routes: ContractRoute[] = [];

  for (const [openApiPath, pathItem] of Object.entries(paths)) {
    for (const method of supportedMethods) {
      const operation = pathItem?.[method];
      if (!operation) {
        continue;
      }

      routes.push({
        method,
        openApiPath,
        expressPath: toExpressPath(openApiPath),
        successStatus: pickSuccessStatus(operation),
        operationId:
          typeof operation.operationId === "string" ? operation.operationId : undefined,
        secured: hasSecurityRequirement(operation, rootSecurity),
      });
    }
  }

  return routes;
}

export function getBundledContractRoutes(): ContractRoute[] {
  if (!cachedRoutes) {
    cachedRoutes = loadBundledContractRoutes();
  }
  return cachedRoutes;
}

function ensureFallbackAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Missing or invalid Authorization header. Use Bearer <access_token>.",
    });
    return;
  }

  const token = auth.slice(7);
  const { valid, clientId, tenantId, credentialId } = validateAccessToken(token);
  if (!valid || !clientId || !tenantId) {
    res.status(401).json({
      code: "INVALID_OR_EXPIRED_TOKEN",
      message: "Access token is invalid or expired. Use the token endpoint to obtain a new one.",
    });
    return;
  }

  req.clientId = clientId;
  req.tenantId = tenantId;
  req.credentialId = credentialId;
  next();
}

function sendStubResponse(route: ContractRoute, req: Request, res: Response): void {
  res.setHeader("x-sandbox-contract-stub", "true");

  if (route.successStatus === 204) {
    res.status(204).send();
    return;
  }

  const body = {
    id: `stub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: "accepted",
    environment: "sandbox",
    operation: route.operationId ?? `${route.method.toUpperCase()} ${route.openApiPath}`,
    message:
      "This endpoint is recognized from bundled OpenAPI and is served by sandbox contract stub until full behavior is implemented.",
    path: req.originalUrl,
    method: req.method.toUpperCase(),
    tenantId: req.tenantId,
    data: [],
  };

  res.status(route.successStatus).json(body);
}

function enforceFallbackApiRateLimit(route: ContractRoute, req: Request, res: Response): boolean {
  if (!req.tenantId || !req.clientId) {
    return true;
  }

  const result = checkApiRateLimit({
    tenantId: req.tenantId,
    credentialId: req.credentialId,
    method: req.method,
    route: route.openApiPath,
  });

  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds ?? 60));
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Rate limit exceeded for this credential/tenant scope. Retry later.",
    });
    return false;
  }

  return true;
}

export const openApiFallbackRouter = Router();

for (const route of getBundledContractRoutes()) {
  openApiFallbackRouter[route.method](route.expressPath, (req: Request, res: Response) => {
    if (!route.secured) {
      sendStubResponse(route, req, res);
      return;
    }

    ensureFallbackAuth(req, res, () => {
      if (!enforceFallbackApiRateLimit(route, req, res)) {
        return;
      }
      sendStubResponse(route, req, res);
    });
  });
}
