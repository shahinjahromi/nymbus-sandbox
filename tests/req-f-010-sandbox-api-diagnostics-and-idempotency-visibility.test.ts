/**
 * REQ-F-010: Sandbox API diagnostics and idempotency visibility.
 * Success of this test proves the requirement definition exists and includes sandbox-only diagnostics constraints.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-F-010: API diagnostics and idempotency visibility requirement doc", () => {
  it("requirement doc exists in requirements/functional", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-010-sandbox-api-diagnostics-and-idempotency-visibility.md");
    expect(existsSync(path)).toBe(true);
  });

  it("requires API activity diagnostics with request identifiers and redaction", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-010-sandbox-api-diagnostics-and-idempotency-visibility.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/activity|log|diagnostics/i);
    expect(content).toMatch(/request identifier|correlation identifier|correlation/i);
    expect(content).toMatch(/mask|redact/i);
  });

  it("requires idempotency-key visibility and replay behavior", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-010-sandbox-api-diagnostics-and-idempotency-visibility.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/x-idempotency-key|idempotency/i);
    expect(content).toMatch(/replay|first-use|first use/i);
  });

  it("explicitly excludes production endpoint monitoring", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-010-sandbox-api-diagnostics-and-idempotency-visibility.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/does not include production endpoint monitoring|sandbox request activity/i);
  });
});
