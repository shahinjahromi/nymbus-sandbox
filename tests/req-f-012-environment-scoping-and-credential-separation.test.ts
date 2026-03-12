/**
 * REQ-F-012: Environment scoping and credential separation.
 * Success of this test proves the requirement definition exists and keeps environment context sandbox-focused.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-F-012: Environment scoping and credential separation requirement doc", () => {
  it("requirement doc exists in requirements/functional", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-012-environment-scoping-and-credential-separation.md");
    expect(existsSync(path)).toBe(true);
  });

  it("describes explicit environment labeling and partitioning", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-012-environment-scoping-and-credential-separation.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/environment/i);
    expect(content).toMatch(/label|labels/i);
    expect(content).toMatch(/partition|separation|scope/i);
  });

  it("requires credentials to be bound to environment scope", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-012-environment-scoping-and-credential-separation.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/credential/i);
    expect(content).toMatch(/cannot be used outside|bound to a specific environment scope/i);
  });

  it("explicitly states no production endpoint monitoring is required", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-012-environment-scoping-and-credential-separation.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/does not require production endpoint monitoring/i);
  });
});
