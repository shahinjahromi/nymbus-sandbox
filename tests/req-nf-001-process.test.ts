/**
 * REQ-NF-001: Implementation process — requirements folder, traceability, build runs tests.
 * Success of this test proves the process artifacts exist and build is configured correctly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-NF-001: Requirements folder and process artifacts exist", () => {
  it("requirements folder exists", () => {
    expect(existsSync(join(repoRoot, "requirements"))).toBe(true);
  });

  it("PROCESS.md exists and mentions traceability and delta", () => {
    const path = join(repoRoot, "requirements", "PROCESS.md");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/traceability|Traceability/i);
    expect(content).toMatch(/delta|Delta/i);
  });

  it("TRACEABILITY.md exists", () => {
    expect(existsSync(join(repoRoot, "requirements", "TRACEABILITY.md"))).toBe(true);
  });

  it("DEFECTS.md exists", () => {
    expect(existsSync(join(repoRoot, "requirements", "DEFECTS.md"))).toBe(true);
  });

  it("functional and non-functional requirement subfolders exist", () => {
    expect(existsSync(join(repoRoot, "requirements", "functional"))).toBe(true);
    expect(existsSync(join(repoRoot, "requirements", "non-functional"))).toBe(true);
  });

  it("package.json build script runs test (build entails test execution)", () => {
    const pkgPath = join(repoRoot, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const buildScript = pkg.scripts?.build ?? "";
    expect(buildScript).toMatch(/test|vitest/);
  });

  it("package.json has test script", () => {
    const pkgPath = join(repoRoot, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.scripts?.test).toBeDefined();
  });
});
