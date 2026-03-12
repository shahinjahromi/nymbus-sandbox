/**
 * REQ-F-011: OpenAPI contract version and change visibility.
 * Success of this test proves the requirement definition exists and excludes SDK/Try-It scope.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-F-011: Contract version and change visibility requirement doc", () => {
  it("requirement doc exists in requirements/functional", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-011-openapi-contract-version-and-change-visibility.md");
    expect(existsSync(path)).toBe(true);
  });

  it("references project-managed Nymbus OpenAPI artifacts", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-011-openapi-contract-version-and-change-visibility.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/OpenAPI|project-managed|project managed|Nymbus/i);
  });

  it("requires version metadata, change log, and deprecation visibility", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-011-openapi-contract-version-and-change-visibility.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/version/i);
    expect(content).toMatch(/change log|changes/i);
    expect(content).toMatch(/deprecated|deprecation/i);
  });

  it("explicitly excludes SDK distribution and embedded Try It", () => {
    const path = join(repoRoot, "requirements", "functional", "REQ-F-011-openapi-contract-version-and-change-visibility.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/does not require SDK distribution|does not require.*Try It|Try It/i);
  });
});
