/**
 * REQ-NF-004: Database design conforms to best practices for financial systems.
 * Success of this test proves the financial DB design doc exists and describes key practices.
 * Reference: https://medium.com/@keemsisi/the-ideal-database-for-financial-transactions-unraveling-the-best-options-d5fef359fe09
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-NF-004: Financial database design doc", () => {
  it("DATABASE-FINANCIAL design doc exists at requirements/design/DATABASE-FINANCIAL.md", () => {
    const path = join(repoRoot, "requirements", "design", "DATABASE-FINANCIAL.md");
    expect(existsSync(path)).toBe(true);
  });

  it("financial DB doc references the Medium article", () => {
    const path = join(repoRoot, "requirements", "design", "DATABASE-FINANCIAL.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/medium\.com.*keemsisi.*financial|ideal-database.*financial/i);
  });

  it("financial DB doc describes ACID", () => {
    const path = join(repoRoot, "requirements", "design", "DATABASE-FINANCIAL.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/ACID|Atomicity|Consistency|Isolation|Durability/i);
  });

  it("financial DB doc describes auditability", () => {
    const path = join(repoRoot, "requirements", "design", "DATABASE-FINANCIAL.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/audit|immutable|transaction log|compliance/i);
  });

  it("financial DB doc describes security", () => {
    const path = join(repoRoot, "requirements", "design", "DATABASE-FINANCIAL.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/security|encrypt|sensitive/i);
  });

  it("financial DB doc mentions DECIMAL or numeric types for money", () => {
    const path = join(repoRoot, "requirements", "design", "DATABASE-FINANCIAL.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/DECIMAL|NUMERIC|money|monetary|amount/i);
  });
});
