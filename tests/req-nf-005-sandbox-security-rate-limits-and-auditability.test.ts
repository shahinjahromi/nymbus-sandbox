/**
 * REQ-NF-005: Sandbox security guardrails, abuse controls, and auditability.
 * Success of this test proves the requirement definition exists and includes sandbox-only security constraints.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-NF-005: Sandbox security and auditability requirement doc", () => {
  it("requirement doc exists in requirements/non-functional", () => {
    const path = join(repoRoot, "requirements", "non-functional", "REQ-NF-005-sandbox-security-rate-limits-and-auditability.md");
    expect(existsSync(path)).toBe(true);
  });

  it("requires rate limiting and abuse controls", () => {
    const path = join(repoRoot, "requirements", "non-functional", "REQ-NF-005-sandbox-security-rate-limits-and-auditability.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/rate limit|throttle|throttling/i);
    expect(content).toMatch(/failed authentication|OTP reset|abuse/i);
  });

  it("requires append-only audit trail with actor, tenant, and outcome", () => {
    const path = join(repoRoot, "requirements", "non-functional", "REQ-NF-005-sandbox-security-rate-limits-and-auditability.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/append-only|append only|audit trail/i);
    expect(content).toMatch(/actor|tenant|outcome/i);
  });

  it("requires masking of sensitive data and excludes production endpoint monitoring", () => {
    const path = join(repoRoot, "requirements", "non-functional", "REQ-NF-005-sandbox-security-rate-limits-and-auditability.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/never stored in plaintext|sensitive|mask/i);
    expect(content).toMatch(/does not impose production endpoint monitoring/i);
  });
});
