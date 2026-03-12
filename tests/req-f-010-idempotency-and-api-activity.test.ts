/**
 * REQ-F-010: Sandbox API diagnostics and idempotency visibility.
 * Success of this test proves transfer idempotency replay and tenant-scoped API activity visibility.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-010: Idempotency and API activity", () => {
  it("replays transfer with same idempotency key and exposes activity entries", async () => {
    const email = `logs_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Logs Tester" })
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
      .send({ label: "Activity Credential" })
      .expect(201);

    const clientId = credentialRes.body.credential.clientId as string;
    const clientSecret = credentialRes.body.client_secret as string;

    const oauthRes = await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" })
      .expect(200);

    const accessToken = oauthRes.body.access_token as string;
    const idempotencyKey = `idem-${Date.now()}`;

    const firstTransferRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .set("x-idempotency-key", idempotencyKey)
      .send({
        type: "internal",
        from_account_id: "acct_sand_001",
        to_account_id: "acct_sand_002",
        amount: 50,
      })
      .expect(201);

    const secondTransferRes = await request(app)
      .post("/transfers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .set("x-idempotency-key", idempotencyKey)
      .send({
        type: "internal",
        from_account_id: "acct_sand_001",
        to_account_id: "acct_sand_002",
        amount: 50,
      })
      .expect(201);

    expect(secondTransferRes.headers["x-idempotent-replay"]).toBe("true");
    expect(secondTransferRes.body.id).toBe(firstTransferRes.body.id);

    const activityRes = await request(app)
      .get("/portal-api/api-activity")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(Array.isArray(activityRes.body.data)).toBe(true);
    expect(activityRes.body.environment).toBe("sandbox");

    const transferEntries = activityRes.body.data.filter(
      (entry: { path: string; method: string }) => entry.path.includes("/transfers") && entry.method === "POST"
    );
    expect(transferEntries.length).toBeGreaterThanOrEqual(2);
    expect(transferEntries.some((entry: { idempotencyKey?: string }) => entry.idempotencyKey === idempotencyKey)).toBe(true);
    expect(transferEntries.some((entry: { idempotencyReplay?: boolean }) => entry.idempotencyReplay === true)).toBe(true);
  });
});
