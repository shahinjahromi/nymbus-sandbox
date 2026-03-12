/**
 * REQ-NF-005: Sensitive data masking in audit storage.
 * Success of this test proves secrets and OTP values are not persisted in audit trail payloads.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-NF-005: Sensitive data masking", () => {
  it("does not persist client_secret, passwords, or OTP values in audit records", async () => {
    const email = `mask_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Masking Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const credentialRes = await request(app)
      .post("/portal-api/credentials")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ label: "Mask Credential" })
      .expect(201);

    const generatedSecret = credentialRes.body.client_secret as string;

    const otpRes = await request(app)
      .post("/portal-api/password-reset/request")
      .set("Content-Type", "application/json")
      .send({ email })
      .expect(200);

    const otpPreview = otpRes.body.otpPreview as string;

    const auditRes = await request(app)
      .get("/portal-api/audit")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const serialized = JSON.stringify(auditRes.body.data);

    expect(serialized.includes(generatedSecret)).toBe(false);
    expect(serialized.includes(otpPreview)).toBe(false);
    expect(serialized.toLowerCase().includes("client_secret")).toBe(false);
    expect(serialized.toLowerCase().includes("password")).toBe(false);
    expect(serialized.toLowerCase().includes("otp")).toBe(false);
  });
});
