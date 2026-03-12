/**
 * REQ-F-009: Sandbox credential lifecycle controls.
 * Success of this test proves the requirement definition exists and includes required controls.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-F-009: Credential lifecycle controls requirement doc", () => {
  it("requirement doc exists in requirements/functional", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-009-sandbox-credential-lifecycle-controls.md");
    expect(existsSync(path)).toBe(true);
  });

  it("describes credential creation, rotation, revocation, and expiration", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-009-sandbox-credential-lifecycle-controls.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/create|creation/i);
    expect(content).toMatch(/rotate|rotation/i);
    expect(content).toMatch(/revoke|revocation/i);
    expect(content).toMatch(/expire|expiration/i);
  });

  it("requires one-time secret visibility and tenant isolation", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-009-sandbox-credential-lifecycle-controls.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/not retrievable in plaintext|one-time|one time/i);
    expect(content).toMatch(/tenant/i);
  });

  it("references audit trail recording for lifecycle actions", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-009-sandbox-credential-lifecycle-controls.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/audit/i);
  });
});
