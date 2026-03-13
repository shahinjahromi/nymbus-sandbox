import { createHash } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parse } from "yaml";

type RouteMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

interface OpenApiDocument {
  openapi?: string;
  info?: {
    version?: string;
    title?: string;
    description?: string;
  };
  paths?: Record<string, Record<string, Record<string, unknown>>>;
  components?: {
    schemas?: Record<string, Record<string, unknown>>;
  };
}

interface OperationSignature {
  summary?: string;
  operationId?: string;
  requestBodyRef?: string;
  responseCodes: string[];
}

interface ContractCache {
  original: OpenApiDocument;
  bundled: OpenApiDocument;
  originalRaw: string;
  bundledRaw: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const supportedMethods: RouteMethod[] = ["get", "post", "put", "patch", "delete", "options", "head"];
let cache: ContractCache | null = null;

function readOpenApiYaml(fileName: string): string {
  const path = join(__dirname, "..", "..", "openapi", fileName);
  return readFileSync(path, "utf-8");
}

function loadContracts(): ContractCache {
  if (cache) {
    return cache;
  }

  const originalRaw = readOpenApiYaml("nymbus-baas-original.yml");
  const bundledRaw = readOpenApiYaml("nymbus-baas-bundled.yml");

  cache = {
    originalRaw,
    bundledRaw,
    original: parse(originalRaw) as OpenApiDocument,
    bundled: parse(bundledRaw) as OpenApiDocument,
  };

  return cache;
}

function operationCount(document: OpenApiDocument): number {
  return pathMethodMap(document).size;
}

function pathCount(document: OpenApiDocument): number {
  return Object.keys(document.paths ?? {}).length;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function listApiVersions(document: OpenApiDocument): string[] {
  const versions = new Set<string>();
  for (const path of Object.keys(document.paths ?? {})) {
    const match = path.match(/^\/(v\d+\.\d+)/);
    if (match) {
      versions.add(match[1]);
    }
  }

  return [...versions].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function deprecatedOperations(document: OpenApiDocument): Array<{
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
}> {
  const result: Array<{ method: string; path: string; operationId?: string; summary?: string }> = [];
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of supportedMethods) {
      const operation = pathItem?.[method];
      if (!operation || operation.deprecated !== true) {
        continue;
      }

      result.push({
        method: method.toUpperCase(),
        path,
        operationId: typeof operation.operationId === "string" ? operation.operationId : undefined,
        summary: typeof operation.summary === "string" ? operation.summary : undefined,
      });
    }
  }

  return result;
}

function deprecatedSchemaFields(document: OpenApiDocument): Array<{
  schema: string;
  field: string;
}> {
  const result: Array<{ schema: string; field: string }> = [];
  for (const [schemaName, schema] of Object.entries(document.components?.schemas ?? {})) {
    const properties = schema?.properties as Record<string, Record<string, unknown>> | undefined;
    if (!properties) {
      continue;
    }

    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      if (fieldDef?.deprecated === true) {
        result.push({ schema: schemaName, field: fieldName });
      }
    }
  }

  return result;
}

function normalizeOperationSignature(operation: Record<string, unknown>): OperationSignature {
  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  const content = requestBody?.content as Record<string, Record<string, unknown>> | undefined;
  const jsonSchema = content?.["application/json"]?.schema as
    | Record<string, unknown>
    | undefined;
  const jsonSchemaRef = jsonSchema?.["$ref"];
  const responses = (operation.responses as Record<string, unknown> | undefined) ?? {};

  return {
    summary: typeof operation.summary === "string" ? operation.summary : undefined,
    operationId: typeof operation.operationId === "string" ? operation.operationId : undefined,
    requestBodyRef: typeof jsonSchemaRef === "string" ? jsonSchemaRef : undefined,
    responseCodes: Object.keys(responses).sort(),
  };
}

function pathMethodMap(document: OpenApiDocument): Map<string, OperationSignature> {
  const map = new Map<string, OperationSignature>();

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of supportedMethods) {
      const operation = pathItem?.[method];
      if (!operation) {
        continue;
      }

      map.set(`${method.toUpperCase()} ${path}`, normalizeOperationSignature(operation));
    }
  }

  return map;
}

function signaturesEqual(left: OperationSignature, right: OperationSignature): boolean {
  if ((left.summary ?? "") !== (right.summary ?? "")) return false;
  if ((left.operationId ?? "") !== (right.operationId ?? "")) return false;
  if ((left.requestBodyRef ?? "") !== (right.requestBodyRef ?? "")) return false;
  if (left.responseCodes.length !== right.responseCodes.length) return false;

  for (let index = 0; index < left.responseCodes.length; index += 1) {
    if (left.responseCodes[index] !== right.responseCodes[index]) {
      return false;
    }
  }

  return true;
}

export function getActiveContractMetadata(): {
  active: {
    sourceFile: string;
    title: string;
    openapiVersion: string;
    contractVersion: string;
    sha256: string;
    endpointCount: number;
    operationCount: number;
    apiVersions: string[];
    deprecatedOperationCount: number;
    deprecatedFieldCount: number;
  };
  compareTo: {
    sourceFile: string;
    contractVersion: string;
    sha256: string;
    endpointCount: number;
    operationCount: number;
  };
  environment: "sandbox";
} {
  const contracts = loadContracts();

  const bundledDepOps = deprecatedOperations(contracts.bundled);
  const bundledDepFields = deprecatedSchemaFields(contracts.bundled);

  return {
    active: {
      sourceFile: "openapi/nymbus-baas-bundled.yml",
      title: contracts.bundled.info?.title ?? "Unknown",
      openapiVersion: contracts.bundled.openapi ?? "unknown",
      contractVersion: contracts.bundled.info?.version ?? "unknown",
      sha256: sha256(contracts.bundledRaw),
      endpointCount: pathCount(contracts.bundled),
      operationCount: operationCount(contracts.bundled),
      apiVersions: listApiVersions(contracts.bundled),
      deprecatedOperationCount: bundledDepOps.length,
      deprecatedFieldCount: bundledDepFields.length,
    },
    compareTo: {
      sourceFile: "openapi/nymbus-baas-original.yml",
      contractVersion: contracts.original.info?.version ?? "unknown",
      sha256: sha256(contracts.originalRaw),
      endpointCount: pathCount(contracts.original),
      operationCount: operationCount(contracts.original),
    },
    environment: "sandbox",
  };
}

export function getContractChangeLog(): {
  summary: {
    addedOperations: number;
    removedOperations: number;
    modifiedOperations: number;
    breakingChangeCount: number;
  };
  added: string[];
  removed: string[];
  modified: string[];
  migrationNotes: string[];
  environment: "sandbox";
} {
  const contracts = loadContracts();
  const originalMap = pathMethodMap(contracts.original);
  const bundledMap = pathMethodMap(contracts.bundled);

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const signature of bundledMap.keys()) {
    if (!originalMap.has(signature)) {
      added.push(signature);
      continue;
    }

    if (!signaturesEqual(originalMap.get(signature)!, bundledMap.get(signature)!)) {
      modified.push(signature);
    }
  }

  for (const signature of originalMap.keys()) {
    if (!bundledMap.has(signature)) {
      removed.push(signature);
    }
  }

  const migrationNotes: string[] = [];
  if (removed.length > 0) {
    migrationNotes.push(
      "Removed operations are considered breaking; update integrations to supported alternatives before upgrading simulator contract versions."
    );
  }
  if (modified.length > 0) {
    migrationNotes.push(
      "Modified operations may require payload/response adjustment; review operation summaries, request bodies, and response codes for impacted endpoints."
    );
  }

  return {
    summary: {
      addedOperations: added.length,
      removedOperations: removed.length,
      modifiedOperations: modified.length,
      breakingChangeCount: removed.length,
    },
    added: added.slice(0, 200),
    removed: removed.slice(0, 200),
    modified: modified.slice(0, 200),
    migrationNotes,
    environment: "sandbox",
  };
}

export function getContractDeprecations(): {
  operations: Array<{ method: string; path: string; operationId?: string; summary?: string }>;
  schemaFields: Array<{ schema: string; field: string }>;
  guidance: string[];
  environment: "sandbox";
} {
  const contracts = loadContracts();
  const operations = deprecatedOperations(contracts.bundled);
  const schemaFields = deprecatedSchemaFields(contracts.bundled);

  const guidance: string[] = [
    "Deprecated operations and fields may be removed in future contract releases; avoid introducing new integrations that depend on them.",
    "Use contract change log and migration notes when planning version upgrades.",
  ];

  return {
    operations,
    schemaFields,
    guidance,
    environment: "sandbox",
  };
}

/* ── Endpoint catalog (full request / response documentation) ── */

/** Paths handled by real sandbox route handlers (not the OpenAPI fallback). */
const implementedPaths = new Set([
  // auth
  "POST /oauth/token",
  // accounts
  "GET /accounts", "POST /accounts/search", "GET /accounts-ext", "GET /accounts/:id",
  "GET /accounts/:accountId",
  "GET /accounts/:accountId/transactions", "GET /accounts/:accountId/transactions/:transactionId",
  "GET /accounts/:accountId/transactions/:transactionId/image",
  "PATCH /accounts/:accountId/updateRewardProgramLevel",
  "GET /accounts/:accountId/loanPayments", "PATCH /accounts/:accountId/loanPayments",
  "DELETE /accounts/:accountId/loanPayments/:paymentId",
  "GET /accounts/:accountId/escrowDisbursements", "POST /accounts/:accountId/escrowDisbursements",
  "GET /accounts/:accountId/escrowProjections", "POST /accounts/:accountId/escrowProjections",
  "PATCH /accounts/:accountId/escrowProjections",
  "GET /accounts/:accountId/loanChargeAssessment", "POST /accounts/:accountId/loanChargeAssessment",
  "POST /accounts/:accountId/reservePremium", "POST /accounts/:accountId/originalLtv",
  "POST /accounts/:accountId/remoteDeposits",
  "GET /accounts/:accountId/statements", "GET /accounts/:accountId/statements/:statementId",
  "POST /accounts/:accountId/stopCheckPayments",
  "POST /accounts/reserveAccountNumber",
  "GET /accounts/:accountId/lockouts",
  "POST /accounts/:accountId/futureRatePaymentChanges",
  "POST /accounts/:accountId/accountNotes",
  // transactions
  "GET /transactions", "GET /transactions/:id", "POST /transactions",
  "POST /transactions/transfer", "POST /transactions/externalTransfer",
  "POST /transactions/createIncomingWire", "POST /transactions/createOutgoingWire",
  "POST /transactions/updateIncomingWireStatus", "POST /transactions/updateOutgoingWireStatus",
  "POST /transactions/commitWireTransaction", "POST /transactions/disbursement",
  "POST /onboarding/loanOnboardingFunding",
  "POST /transactions/officialCheckTransactions",
  "POST /transactions/officialCheckTransactions/confirm",
  // transfers
  "GET /transfers", "GET /transfers/:id", "POST /transfers",
  // customers
  "GET /customers", "POST /customers", "GET /customers/:id", "PATCH /customers/:id",
  "GET /customers/:customerId", "PATCH /customers/:customerId",
  "GET /customers/:customerId/accounts", "POST /customers/:customerId/accounts",
  "GET /customers/:customerId/accounts/:accountId",
  "GET /customers/:customerId/userDefinedFields", "POST /customers/:customerId/userDefinedFields",
  "GET /customers/:customerId/accounts/:accountId/userDefinedFields",
  "POST /customers/:customerId/accounts/:accountId/userDefinedFields",
  "PATCH /customers/:customerId/accounts/:accountId/userDefinedFields",
  "DELETE /customers/:customerId/accounts/:accountId/userDefinedFields/:id",
  "POST /customers/:customerId/documents",
  "GET /customers/:customerId/documents/:documentRootId",
  "PATCH /customers/:customerId/documents/:documentRootId",
  "DELETE /customers/:customerId/documents/:documentRootId",
  "GET /customers/:customerId/accounts/:accountId/documents",
  "POST /customers/:customerId/accounts/:accountId/documents",
  "GET /customers/:customerId/accounts/:accountId/documents/:documentRootId",
  "PATCH /customers/:customerId/accounts/:accountId/documents/:documentRootId",
  "DELETE /customers/:customerId/accounts/:accountId/documents/:documentRootId",
  "GET /customers/:customerId/transfers",
  "POST /customers/:customerId/transfers/transfer",
  "POST /customers/:customerId/transfers/externalTransfer",
  "GET /customers-ext", "POST /customers/search",
  "PATCH /customers/:customerId/transfers/:transferId",
  "DELETE /customers/:customerId/transfers/:transferId",
  "PATCH /customers/:customerId/accounts/:accountId",
  "POST /customers/:customerId/accounts/:accountId/close",
  "POST /customers/:customerId/accounts/:accountId/reopen",
  "GET /customers/:customerId/accounts/:accountId/stopCheckPayments",
  "POST /customers/:customerId/accounts/:accountId/stopCheckPayments",
  "DELETE /customers/:customerId/accounts/:accountId/stopCheckPayments/:stopCheckPaymentId",
  "GET /customers/:customerId/accounts/:accountId/stopAchPayments",
  "POST /customers/:customerId/accounts/:accountId/stopAchPayments",
  "DELETE /customers/:customerId/accounts/:accountId/stopAchPayments/:stopAchPaymentId",
  "POST /customers/:customerId/linkBeneficiaryOwner/:beneficiaryId",
  "DELETE /customers/:customerId/linkBeneficiaryOwner/:beneficiaryId",
  "POST /customers/:customerId/updateOLBFlag",
  "GET /customers/:customerId/collaterals", "POST /customers/:customerId/collaterals",
  "POST /customers/:customerId/creditCards",
  "POST /customers/uploadFiles",
  "GET /customers/:customerId/debitCards", "POST /customers/:customerId/debitCards",
  "POST /customers/:customerId/debitCards/:debitCardId/activateCard",
  "POST /customers/:customerId/debitCards/:debitCardId/freezeCard",
  "POST /customers/:customerId/debitCards/:debitCardId/unfreezeCard",
  "POST /debitCards/activateCardByCardNumber",
  "GET /debitCards/referenceId/:refId",
  "PATCH /debitCards/updateStatusByCardNumber",
  "PATCH /debitCards/updatePinOffset",
  "PATCH /debitCards/updatePinOffsetByCardNumber",
  "GET /customers/:customerId/accounts/:accountId/accountInstructions",
  // resources
  "GET /resources/noticeTemplates",
  "GET /resources/referenceData/account",
  "GET /resources/referenceData/escrowDisbursement",
]);

/** Convert OpenAPI path like /v1.0/customers/{customerId}/accounts to a normalised form for matching */
function normalisePathForMatch(openApiPath: string): string {
  // Strip leading version prefix
  const stripped = openApiPath.replace(/^\/v\d+\.\d+/, "");
  // Convert {param} to :param
  return stripped.replace(/\{([^}]+)\}/g, ":$1");
}

interface SchemaField {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

interface EndpointDetail {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  implemented: boolean;
  deprecated: boolean;
  parameters: Array<{ name: string; in: string; type: string; required: boolean; description?: string }>;
  requestBody: SchemaField[];
  responses: Array<{ code: string; description: string; fields: SchemaField[] }>;
}

function resolveSchemaRef(document: OpenApiDocument, ref: string | undefined): Record<string, unknown> | undefined {
  if (!ref || !ref.startsWith("#/components/schemas/")) return undefined;
  const name = ref.replace("#/components/schemas/", "");
  return document.components?.schemas?.[name] as Record<string, unknown> | undefined;
}

function extractSchemaFields(document: OpenApiDocument, schema: Record<string, unknown> | undefined, depth = 0): SchemaField[] {
  if (!schema || depth > 2) return [];

  // Follow $ref
  const ref = schema["$ref"] as string | undefined;
  if (ref) {
    const resolved = resolveSchemaRef(document, ref);
    return extractSchemaFields(document, resolved, depth + 1);
  }

  const requiredSet = new Set<string>(Array.isArray(schema.required) ? schema.required as string[] : []);
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) {
    // Array type – describe items
    if (schema.type === "array" && schema.items) {
      const items = schema.items as Record<string, unknown>;
      const itemRef = items["$ref"] as string | undefined;
      if (itemRef) {
        const resolved = resolveSchemaRef(document, itemRef);
        return extractSchemaFields(document, resolved, depth + 1);
      }
      return extractSchemaFields(document, items, depth + 1);
    }
    return [];
  }

  const fields: SchemaField[] = [];
  for (const [name, def] of Object.entries(properties)) {
    const fieldRef = def["$ref"] as string | undefined;
    let type = (def.type as string) ?? (fieldRef ? fieldRef.replace("#/components/schemas/", "") : "object");
    if (type === "array") {
      const itemsDef = def.items as Record<string, unknown> | undefined;
      const itemType = (itemsDef?.type as string) ?? (itemsDef?.["$ref"] as string)?.replace("#/components/schemas/", "") ?? "object";
      type = `${itemType}[]`;
    }
    fields.push({
      name,
      type,
      description: (def.description as string) ?? undefined,
      required: requiredSet.has(name),
    });
  }
  return fields;
}

export function getEndpointCatalog(): {
  total: number;
  implemented: number;
  fallback: number;
  endpoints: EndpointDetail[];
  environment: "sandbox";
} {
  const contracts = loadContracts();
  const doc = contracts.bundled;
  const endpoints: EndpointDetail[] = [];

  for (const [openApiPath, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const method of supportedMethods) {
      const operation = pathItem?.[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const normPath = normalisePathForMatch(openApiPath);
      const matchKey = `${method.toUpperCase()} ${normPath}`;
      const isImplemented = implementedPaths.has(matchKey);

      // Parameters
      const rawParams = (operation.parameters ?? []) as Array<Record<string, unknown>>;
      const parameters = rawParams
        .filter((p) => p.in !== "header" || (p.name as string) !== "Authorization")
        .map((p) => ({
          name: p.name as string,
          in: p.in as string,
          type: ((p.schema as Record<string, unknown>)?.type as string) ?? "string",
          required: (p.required as boolean) ?? false,
          description: (p.description as string) ?? undefined,
        }));

      // Request body
      const requestBodyObj = operation.requestBody as Record<string, unknown> | undefined;
      const rbContent = requestBodyObj?.content as Record<string, Record<string, unknown>> | undefined;
      const rbJsonSchema = rbContent?.["application/json"]?.schema as Record<string, unknown> | undefined;
      const requestBody = extractSchemaFields(doc, rbJsonSchema);

      // Responses
      const rawResponses = (operation.responses ?? {}) as Record<string, Record<string, unknown>>;
      const responses: EndpointDetail["responses"] = [];
      for (const [code, respDef] of Object.entries(rawResponses)) {
        const respContent = respDef.content as Record<string, Record<string, unknown>> | undefined;
        const respJsonSchema = respContent?.["application/json"]?.schema as Record<string, unknown> | undefined;
        responses.push({
          code,
          description: (respDef.description as string) ?? "",
          fields: extractSchemaFields(doc, respJsonSchema),
        });
      }

      const tags = Array.isArray(operation.tags) ? (operation.tags as string[]) : [];

      endpoints.push({
        method: method.toUpperCase(),
        path: openApiPath,
        operationId: typeof operation.operationId === "string" ? operation.operationId : undefined,
        summary: typeof operation.summary === "string" ? operation.summary : undefined,
        description: typeof operation.description === "string" ? operation.description.trim() : undefined,
        tags,
        implemented: isImplemented,
        deprecated: operation.deprecated === true,
        parameters,
        requestBody,
        responses,
      });
    }
  }

  const implemented = endpoints.filter((e) => e.implemented).length;

  return {
    total: endpoints.length,
    implemented,
    fallback: endpoints.length - implemented,
    endpoints,
    environment: "sandbox",
  };
}
