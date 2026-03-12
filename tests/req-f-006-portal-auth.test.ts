/**
 * REQ-F-006: Developer portal authentication, access, and API credentials.
 * Success of this test proves registration, login, and OTP reset flows are operational.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-006: Portal auth flow", () => {
  it("registers, logs in, resets password with OTP, and logs in again", async () => {
    const email = `portal_${Date.now()}@example.com`;
    const initialPassword = "Initial!123";
    const newPassword = "Changed!456";

    const registerRes = await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password: initialPassword, name: "Portal Tester" });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user).toHaveProperty("tenantId");

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password: initialPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("portal_token");

    const resetRequestRes = await request(app)
      .post("/portal-api/password-reset/request")
      .set("Content-Type", "application/json")
      .send({ email });

    expect(resetRequestRes.status).toBe(200);
    expect(resetRequestRes.body).toHaveProperty("otpPreview");

    const resetConfirmRes = await request(app)
      .post("/portal-api/password-reset/confirm")
      .set("Content-Type", "application/json")
      .send({
        email,
        otp: resetRequestRes.body.otpPreview,
        new_password: newPassword,
      });

    expect(resetConfirmRes.status).toBe(200);
    expect(resetConfirmRes.body).toMatchObject({ ok: true });

    const loginWithNewPasswordRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password: newPassword });

    expect(loginWithNewPasswordRes.status).toBe(200);
    expect(loginWithNewPasswordRes.body).toHaveProperty("portal_token");
  });
});
