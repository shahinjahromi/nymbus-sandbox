/**
 * REQ-NF-002: Two-phase deployment model (Azure backend; Phase 1 Vercel front-end, Phase 2 Azure front-end).
 * Success of this test proves the deployment design doc exists and describes both phases.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

describe("REQ-NF-002: Two-phase deployment design (Azure + Vercel → Azure)", () => {
  it("deployment design doc exists at requirements/design/DEPLOYMENT.md", () => {
    const path = join(repoRoot, "requirements", "design", "DEPLOYMENT.md");
    expect(existsSync(path)).toBe(true);
  });

  it("deployment doc describes backend always on Azure", () => {
    const path = join(repoRoot, "requirements", "design", "DEPLOYMENT.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/Azure/i);
    expect(content).toMatch(/backend|server|API/i);
  });

  it("deployment doc describes Phase 1 with Vercel front-end", () => {
    const path = join(repoRoot, "requirements", "design", "DEPLOYMENT.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/Phase 1|phase 1/i);
    expect(content).toMatch(/Vercel/i);
    expect(content).toMatch(/front-end|frontend/i);
  });

  it("deployment doc describes Phase 2 with Azure front-end", () => {
    const path = join(repoRoot, "requirements", "design", "DEPLOYMENT.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/Phase 2|phase 2/i);
    expect(content).toMatch(/Azure.*front|front.*Azure/i);
  });

  it("deployment doc includes LLM instructions for host-agnostic front-end", () => {
    const path = join(repoRoot, "requirements", "design", "DEPLOYMENT.md");
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/LLM|instruction|environment variable|config/i);
  });
});
