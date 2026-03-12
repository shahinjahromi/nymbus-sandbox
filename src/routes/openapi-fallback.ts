import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parse } from "yaml";
import { validateAccessToken } from "../auth/oauth.js";
import { checkApiRateLimit } from "../services/security-rate-limit.js";
import { enforceEnvironmentScope } from "../auth/middleware.js";
import { durableStore } from "../services/durable-store.js";

type RouteMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";
type JsonObject = Record<string, unknown>;

interface ContractRoute {
  method: RouteMethod;
  openApiPath: string;
  expressPath: string;
  resourcePath: string;
  pathParamNames: string[];
  successStatus: number;
  operationId?: string;
  secured: boolean;
  successResponseSchema?: JsonObject;
}

interface OpenApiDocument {
  security?: unknown;
  paths?: Record<string, Record<string, JsonObject>>;
  components?: {
    schemas?: Record<string, JsonObject>;
  };
}

interface StoredRecord {
  id: string;
  data: JsonObject;
  createdAt: string;
  updatedAt: string;
}

interface ContractCatalog {
  document: OpenApiDocument;
  routes: ContractRoute[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const supportedMethods: RouteMethod[] = ["get", "post", "put", "patch", "delete", "options", "head"];
const operationMethods = new Set<RouteMethod>(["get", "post", "put", "patch", "delete"]);

const runtimeStoreByTenant = new Map<string, Map<string, Map<string, StoredRecord>>>();

let cachedCatalog: ContractCatalog | null = null;

function toExpressPath(openApiPath: string): string {
  return openApiPath.replace(/\{([^}]+)\}/g, ":$1");
}

function toResourcePath(openApiPath: string): string {
  return openApiPath.replace(/\/\{[^}]+\}/g, "");
}

function pathParamNames(openApiPath: string): string[] {
  return [...openApiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

function pickSuccessResponse(operation: JsonObject | undefined): {
  statusCode: number;
  schema?: JsonObject;
} {
  const responses = operation?.responses as JsonObject | undefined;
  if (!responses) {
    return { statusCode: 200 };
  }

  const successCodes = Object.keys(responses)
    .filter((code) => /^2\d\d$/.test(code))
    .map((code) => Number.parseInt(code, 10))
    .sort((a, b) => a - b);

  const selectedCode = successCodes[0] ?? 200;
  const responseObject = responses[String(selectedCode)] as JsonObject | undefined;
  const content = responseObject?.content as JsonObject | undefined;
  const jsonContent = content?.["application/json"] as JsonObject | undefined;
  const schema = jsonContent?.schema as JsonObject | undefined;

  return {
    statusCode: selectedCode,
    schema,
  };
}

function hasSecurityRequirement(operation: JsonObject | undefined, rootSecurity: unknown): boolean {
  const operationSecurity = operation?.security;
  const effectiveSecurity = operationSecurity ?? rootSecurity;

  if (!Array.isArray(effectiveSecurity)) {
    return false;
  }

  return effectiveSecurity.length > 0;
}

function loadContractCatalog(): ContractCatalog {
  const bundledPath = join(__dirname, "..", "..", "openapi", "nymbus-baas-bundled.yml");
  const raw = readFileSync(bundledPath, "utf-8");
  const document = parse(raw) as OpenApiDocument;

  const rootSecurity = document.security;
  const paths = document.paths ?? {};
  const routes: ContractRoute[] = [];

  for (const [openApiPath, pathItem] of Object.entries(paths)) {
    for (const method of supportedMethods) {
      const operation = pathItem?.[method];
      if (!operation) {
        continue;
      }

      const successResponse = pickSuccessResponse(operation);

      routes.push({
        method,
        openApiPath,
        expressPath: toExpressPath(openApiPath),
        resourcePath: toResourcePath(openApiPath),
        pathParamNames: pathParamNames(openApiPath),
        successStatus: successResponse.statusCode,
        operationId:
          typeof operation.operationId === "string" ? operation.operationId : undefined,
        secured: hasSecurityRequirement(operation, rootSecurity),
        successResponseSchema: successResponse.schema,
      });
    }
  }

  return { document, routes };
}

export function getBundledContractRoutes(): ContractRoute[] {
  if (!cachedCatalog) {
    cachedCatalog = loadContractCatalog();
  }
  return cachedCatalog.routes;
}

function getCatalog(): ContractCatalog {
  if (!cachedCatalog) {
    cachedCatalog = loadContractCatalog();
  }

  return cachedCatalog;
}

function serializeTenantStore(tenantStore: Map<string, Map<string, StoredRecord>>): string {
  const payload = [...tenantStore.entries()].map(([resourcePath, records]) => [
    resourcePath,
    [...records.entries()],
  ]);

  return JSON.stringify(payload);
}

function deserializeTenantStore(payload: string): Map<string, Map<string, StoredRecord>> {
  const parsed = JSON.parse(payload) as Array<[string, Array<[string, StoredRecord]>]>;
  const tenantStore = new Map<string, Map<string, StoredRecord>>();

  for (const [resourcePath, records] of parsed) {
    tenantStore.set(resourcePath, new Map(records));
  }

  return tenantStore;
}

function saveTenantStore(tenantId: string, tenantStore: Map<string, Map<string, StoredRecord>>): void {
  durableStore.saveFallbackDatasetPayload(tenantId, serializeTenantStore(tenantStore));
}

function getTenantStore(tenantId: string): Map<string, Map<string, StoredRecord>> {
  let tenantStore = runtimeStoreByTenant.get(tenantId);
  if (!tenantStore) {
    const persisted = durableStore.getFallbackDatasetPayload(tenantId);

    if (persisted) {
      try {
        tenantStore = deserializeTenantStore(persisted);
      } catch {
        tenantStore = new Map<string, Map<string, StoredRecord>>();
      }
    } else {
      tenantStore = new Map<string, Map<string, StoredRecord>>();
    }

    runtimeStoreByTenant.set(tenantId, tenantStore);
  }

  return tenantStore;
}

function getResourceStore(tenantId: string, resourcePath: string): Map<string, StoredRecord> {
  const tenantStore = getTenantStore(tenantId);
  let resourceStore = tenantStore.get(resourcePath);
  if (!resourceStore) {
    resourceStore = new Map<string, StoredRecord>();
    tenantStore.set(resourcePath, resourceStore);
  }

  return resourceStore;
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

  if (!enforceEnvironmentScope(req, res)) {
    return;
  }

  req.clientId = clientId;
  req.tenantId = tenantId;
  req.credentialId = credentialId;
  next();
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function candidateFromSources(
  propertyName: string,
  sources: Array<Record<string, unknown> | undefined>
): unknown {
  const normalizedProperty = normalizeKey(propertyName);

  for (const source of sources) {
    if (!source) continue;

    for (const [key, value] of Object.entries(source)) {
      if (normalizeKey(key) === normalizedProperty) {
        return value;
      }
    }
  }

  return undefined;
}

function coercePrimitive(schema: JsonObject, input: unknown): unknown {
  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;
  if (enumValues && enumValues.length > 0) {
    if (input !== undefined && enumValues.includes(input)) {
      return input;
    }
    return enumValues[0];
  }

  const type = typeof schema.type === "string" ? schema.type : undefined;
  if (type === "integer") {
    if (typeof input === "number") return Math.trunc(input);
    if (typeof input === "string") {
      const parsed = Number.parseInt(input, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
  if (type === "number") {
    if (typeof input === "number") return input;
    if (typeof input === "string") {
      const parsed = Number.parseFloat(input);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
  if (type === "boolean") {
    if (typeof input === "boolean") return input;
    if (typeof input === "string") return input.toLowerCase() === "true";
    return true;
  }

  const format = typeof schema.format === "string" ? schema.format : "";
  if (format === "date-time") {
    return typeof input === "string" && input.length > 0 ? input : nowIso();
  }
  if (format === "date") {
    return typeof input === "string" && input.length > 0 ? input : nowIso().slice(0, 10);
  }
  if (format === "email") {
    return typeof input === "string" && input.length > 0 ? input : "sandbox@example.com";
  }

  if (typeof input === "string") return input;
  if (typeof input === "number" || typeof input === "boolean") return String(input);
  return "sample";
}

function resolveSchema(document: OpenApiDocument, schema: JsonObject | undefined): JsonObject | undefined {
  if (!schema) {
    return undefined;
  }

  const ref = schema["$ref"];
  if (typeof ref === "string" && ref.startsWith("#/components/schemas/")) {
    const schemaName = ref.replace("#/components/schemas/", "");
    const resolved = document.components?.schemas?.[schemaName];
    if (resolved) {
      return resolveSchema(document, resolved);
    }
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return resolveSchema(document, schema.oneOf[0] as JsonObject);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return resolveSchema(document, schema.anyOf[0] as JsonObject);
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return resolveSchema(document, schema.allOf[0] as JsonObject);
  }

  return schema;
}

function buildPayloadFromSchema(params: {
  document: OpenApiDocument;
  schema?: JsonObject;
  record?: StoredRecord;
  records?: StoredRecord[];
  req: Request;
  depth?: number;
}): unknown {
  const depth = params.depth ?? 0;
  if (depth > 6) {
    return null;
  }

  const schema = resolveSchema(params.document, params.schema);
  if (!schema) {
    if (params.records) {
      return params.records.map((record) => record.data);
    }
    return params.record?.data ?? {};
  }

  const type = typeof schema.type === "string" ? schema.type : undefined;
  if (type === "array") {
    const itemSchema = schema.items as JsonObject | undefined;
    if (params.records) {
      return params.records.map((record) =>
        buildPayloadFromSchema({
          document: params.document,
          schema: itemSchema,
          record,
          req: params.req,
          depth: depth + 1,
        })
      );
    }

    const single = buildPayloadFromSchema({
      document: params.document,
      schema: itemSchema,
      record: params.record,
      req: params.req,
      depth: depth + 1,
    });
    return single === null ? [] : [single];
  }

  if (type === "object" || schema.properties) {
    const output: JsonObject = {};
    const properties = (schema.properties as Record<string, JsonObject> | undefined) ?? {};
    const recordData = params.record?.data;

    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      const nestedResolved = resolveSchema(params.document, propertySchema);
      const nestedType = typeof nestedResolved?.type === "string" ? nestedResolved?.type : undefined;

      if (nestedType === "object" || nestedType === "array" || nestedResolved?.properties) {
        output[propertyName] = buildPayloadFromSchema({
          document: params.document,
          schema: nestedResolved,
          record: params.record,
          req: params.req,
          depth: depth + 1,
        });
        continue;
      }

      const candidate = candidateFromSources(propertyName, [
        recordData,
        params.req.body as Record<string, unknown> | undefined,
        params.req.params as Record<string, unknown> | undefined,
        params.req.query as Record<string, unknown> | undefined,
      ]);

      if (candidate !== undefined) {
        output[propertyName] = coercePrimitive(nestedResolved ?? propertySchema, candidate);
        continue;
      }

      if (normalizeKey(propertyName) === "id" && params.record?.id) {
        output[propertyName] = params.record.id;
        continue;
      }

      if (normalizeKey(propertyName) === "environment") {
        output[propertyName] = "sandbox";
        continue;
      }

      output[propertyName] = coercePrimitive(nestedResolved ?? propertySchema, undefined);
    }

    if (Object.keys(output).length === 0) {
      return params.record?.data ?? {};
    }

    return output;
  }

  return coercePrimitive(schema, params.record?.data ?? undefined);
}

function inferEntityId(route: ContractRoute, req: Request): string {
  for (const name of route.pathParamNames) {
    const value = req.params[name];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  const body = req.body as Record<string, unknown> | undefined;
  const idCandidates = ["id", "referenceId", "customerId", "accountId", "cardId", "transferId", "transactionId"];
  for (const candidate of idCandidates) {
    const snakeCaseCandidate = candidate.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    const value = body?.[candidate] ?? body?.[snakeCaseCandidate];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return `rec_${randomUUID().slice(0, 12)}`;
}

function listResourceRecords(resourceStore: Map<string, StoredRecord>, req: Request): StoredRecord[] {
  const all = [...resourceStore.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pageOffsetRaw = req.query.pageOffset ?? req.query.page_offset ?? 0;
  const pageLimitRaw = req.query.pageLimit ?? req.query.page_limit ?? 100;
  const pageOffset = Math.max(0, Number.parseInt(String(pageOffsetRaw), 10) || 0);
  const pageLimit = Math.max(1, Math.min(1000, Number.parseInt(String(pageLimitRaw), 10) || 100));
  const start = pageOffset * pageLimit;
  return all.slice(start, start + pageLimit);
}

function executeContractRequest(route: ContractRoute, req: Request, res: Response): void {
  const tenantId = req.tenantId ?? "tenant_public";
  const tenantStore = getTenantStore(tenantId);
  const resourceStore = getResourceStore(tenantId, route.resourcePath);
  const method = route.method;

  if (!operationMethods.has(method)) {
    if (route.successStatus === 204) {
      res.status(204).send();
      return;
    }

    res.status(route.successStatus).json({
      success: true,
      environment: "sandbox",
      operation: route.operationId ?? `${method.toUpperCase()} ${route.openApiPath}`,
    });
    return;
  }

  if (method === "delete") {
    const entityId = inferEntityId(route, req);
    resourceStore.delete(entityId);
    saveTenantStore(tenantId, tenantStore);

    if (route.successStatus === 204) {
      res.status(204).send();
      return;
    }

    res.status(route.successStatus).json({
      success: true,
      id: entityId,
      deleted: true,
      environment: "sandbox",
    });
    return;
  }

  if (method === "get") {
    const document = getCatalog().document;

    if (route.pathParamNames.length > 0) {
      const entityId = inferEntityId(route, req);
      let record = resourceStore.get(entityId);
      if (!record) {
        const now = nowIso();
        const seedData: JsonObject = {
          id: entityId,
          ...req.params,
          ...((req.query as Record<string, unknown>) ?? {}),
          environment: "sandbox",
        };
        record = {
          id: entityId,
          data: seedData,
          createdAt: now,
          updatedAt: now,
        };
        resourceStore.set(entityId, record);
        saveTenantStore(tenantId, tenantStore);
      }

      if (route.successStatus === 204) {
        res.status(204).send();
        return;
      }

      const payload = buildPayloadFromSchema({
        document,
        schema: route.successResponseSchema,
        record,
        req,
      });
      res.status(route.successStatus).json(payload);
      return;
    }

    const records = listResourceRecords(resourceStore, req);
    const payload = buildPayloadFromSchema({
      document,
      schema: route.successResponseSchema,
      records,
      req,
    });

    if (route.successStatus === 204) {
      res.status(204).send();
      return;
    }

    res.status(route.successStatus).json(payload);
    return;
  }

  const entityId = inferEntityId(route, req);
  const now = nowIso();
  const existing = resourceStore.get(entityId);
  const requestBody =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as JsonObject)
      : { value: req.body };

  const nextRecord: StoredRecord = {
    id: entityId,
    data: {
      ...(existing?.data ?? {}),
      ...requestBody,
      ...req.params,
      id: entityId,
      environment: "sandbox",
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  resourceStore.set(entityId, nextRecord);
  saveTenantStore(tenantId, tenantStore);

  if (route.successStatus === 204) {
    res.status(204).send();
    return;
  }

  const payload = buildPayloadFromSchema({
    document: getCatalog().document,
    schema: route.successResponseSchema,
    record: nextRecord,
    req,
  });

  res.status(route.successStatus).json(payload);
}

export function flushFallbackRuntimeStore(): void {
  for (const [tenantId, tenantStore] of runtimeStoreByTenant.entries()) {
    saveTenantStore(tenantId, tenantStore);
  }
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
      executeContractRequest(route, req, res);
      return;
    }

    ensureFallbackAuth(req, res, () => {
      if (!enforceFallbackApiRateLimit(route, req, res)) {
        return;
      }
      executeContractRequest(route, req, res);
    });
  });
}
