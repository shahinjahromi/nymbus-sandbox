/**
 * REQ-NF-003: Architecture conforms to SOLID principles.
 * Success of this test proves the SOLID design doc exists and describes all five principles.
 * Reference: https://medium.com/@ankurpratik/software-architecture-s-o-l-i-d-principles-967930d2812b
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-NF-003: SOLID principles design doc", () => {
  it("SOLID design doc exists at requirements/design/SOLID.md", () => {
    const path = join(repoRoot, "requirements", "design", "SOLID.md");
    expect(existsSync(path)).toBe(true);
  });

  it("SOLID doc references the Medium article", () => {
    const path = join(repoRoot, "requirements", "design", "SOLID.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/medium\.com/i);
    expect(content).toMatch(/ankurpratik/i);
  });

  it("SOLID doc describes Single Responsibility (S)", () => {
    const path = join(repoRoot, "requirements", "design", "SOLID.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/Single Responsibility|SRP|one reason to change/i);
  });

  it("SOLID doc describes Open/Closed (O)", () => {
    const path = join(repoRoot, "requirements", "design", "SOLID.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/Open.?Closed|OCP|extension.*modification/i);
  });

  it("SOLID doc describes Liskov Substitution (L)", () => {
    const path = join(repoRoot, "requirements", "design", "SOLID.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/Liskov|LSP|substitutab/i);
  });

  it("SOLID doc describes Interface Segregation (I)", () => {
    const path = join(repoRoot, "requirements", "design", "SOLID.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/Interface Segregation|ISP|fat interface/i);
  });

  it("SOLID doc describes Dependency Inversion (D)", () => {
    const path = join(repoRoot, "requirements", "design", "SOLID.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/Dependency Inversion|DIP|abstraction/i);
  });
});
