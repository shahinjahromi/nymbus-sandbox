/**
 * REQ-F-005: OpenAPI endpoint coverage.
 * Success of this test proves every bundled contract path/method pair is routable by the backend (non-404/405).
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { app } from "../src/app.js";

type RouteMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

interface CoverageRoute {
  method: RouteMethod;
  path: string;
  secured: boolean;
}

const supportedMethods: RouteMethod[] = ["get", "post", "put", "patch", "delete", "options", "head"];

function hasSecurityRequirement(
  operation: Record<string, unknown> | undefined,
  rootSecurity: unknown
): boolean {
  const operationSecurity = operation?.security;
  const effectiveSecurity = operationSecurity ?? rootSecurity;
  return Array.isArray(effectiveSecurity) && effectiveSecurity.length > 0;
}

function materializePath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_full, name: string) => {
    const key = name.toLowerCase();
    if (key.includes("account") && !key.includes("number")) return "acct_sand_001";
    if (key.includes("customer")) return "cust_sand_001";
    if (key.includes("transaction")) return "txn_sand_001";
    if (key.includes("transfer")) return "trf_sand_001";
    if (key.includes("card") && key.includes("number")) return "4111111111111111";
    if (key.includes("id")) return "sample_id";
    return "sample";
  });
}

function requestBodyFor(path: string): Record<string, unknown> {
  if (path.endsWith("/oauth/token")) {
    return {
      client_id: "sandbox_dev_001",
      client_secret: "sandbox_secret_change_in_production",
      grant_type: "client_credentials",
    };
  }

  if (path.includes("/transfers")) {
    return {
      type: "internal",
      from_account_id: "acct_sand_001",
      to_account_id: "acct_sand_002",
      amount: 10,
    };
  }

  return {};
}

describe("REQ-F-005: OpenAPI endpoint coverage", () => {
  it("routes all bundled OpenAPI path/method pairs", async () => {
    const bundled = readFileSync("openapi/nymbus-baas-bundled.yml", "utf-8");
    const document = parse(bundled) as {
      security?: unknown;
      paths?: Record<string, Record<string, Record<string, unknown>>>;
    };

    const rootSecurity = document.security;
    const routes: CoverageRoute[] = [];

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      for (const method of supportedMethods) {
        const operation = pathItem?.[method];
        if (!operation) continue;

        routes.push({
          method,
          path,
          secured: hasSecurityRequirement(operation, rootSecurity),
        });
      }
    }

    expect(routes.length).toBeGreaterThan(0);

    const tokenRes = await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send(requestBodyFor("/oauth/token"))
      .expect(200);

    const accessToken = tokenRes.body.access_token as string;
    const failures: Array<{ method: string; path: string; status: number }> = [];

    for (const route of routes) {
      const resolvedPath = materializePath(route.path);
      let req = request(app)[route.method](resolvedPath);

      if (route.secured) {
        req = req.set("Authorization", `Bearer ${accessToken}`);
      }

      if (["post", "put", "patch", "delete"].includes(route.method)) {
        req = req.set("Content-Type", "application/json").send(requestBodyFor(route.path));
      }

      const res = await req;
      if (res.status === 404 || res.status === 405) {
        failures.push({ method: route.method.toUpperCase(), path: route.path, status: res.status });
      }
    }

    if (failures.length > 0) {
      const preview = failures
        .slice(0, 20)
        .map((failure) => `${failure.method} ${failure.path} -> ${failure.status}`)
        .join("\n");
      throw new Error(`OpenAPI route coverage failures (${failures.length}):\n${preview}`);
    }
  });
});
