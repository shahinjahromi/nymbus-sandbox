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
