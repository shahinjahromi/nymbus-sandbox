/**
 * REQ-F-005: Prioritized implementation tranche 3.
 * Success proves customer transfer mutations, debit-card flows, and wire lifecycle routes are specialized.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-005: prioritized endpoint implementations tranche 3", () => {
  it("supports customer transfer mutation, debit card actions, and wire lifecycle updates", async () => {
    const tokenRes = await request(app)
      .post("/v1.0/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: "sandbox_dev_001",
        client_secret: "sandbox_secret_change_in_production",
        grant_type: "client_credentials",
      })
      .expect(200);

    const accessToken = tokenRes.body.access_token as string;

    const customersExtRes = await request(app)
      .get("/v1.0/customers-ext")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(customersExtRes.body.total).toBeGreaterThan(0);

    const customerSearchRes = await request(app)
      .post("/v1.0/customers/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ text: "jordan" })
      .expect(200);

    expect(Array.isArray(customerSearchRes.body.data)).toBe(true);

    const createCustomerRes = await request(app)
      .post("/v1.0/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        first_name: "Tranche",
        last_name: "Three",
        email: `tranche3-${Date.now()}@example.test`,
      })
      .expect(201);

    const customerId = createCustomerRes.body.customer.id as string;

    const createAccountRes = await request(app)
      .post(`/v1.0/customers/${customerId}/accounts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ type: "checking", initial_balance: 200 })
      .expect(201);

    const accountId = createAccountRes.body.account.id as string;

    const patchAccountRes = await request(app)
      .patch(`/v1.0/customers/${customerId}/accounts/${accountId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ status: "frozen", metadata: { reason: "test" } })
      .expect(200);

    expect(patchAccountRes.body.account.status).toBe("frozen");

    await request(app)
      .post(`/v1.0/customers/${customerId}/accounts/${accountId}/close`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const reopenAccountRes = await request(app)
      .post(`/v1.0/customers/${customerId}/accounts/${accountId}/reopen`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(reopenAccountRes.body.account.status).toBe("active");

    const createTransferRes = await request(app)
      .post(`/v1.0/customers/${customerId}/transfers/transfer`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        from_account_id: accountId,
        to_account_id: "acct_sand_001",
        amount: 12,
        type: "internal",
      })
      .expect(201);

    const transferId = createTransferRes.body.id as string;

    const patchTransferRes = await request(app)
      .patch(`/v1.0/customers/${customerId}/transfers/${transferId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ status: "completed", description: "updated" })
      .expect(200);

    expect(patchTransferRes.body.transfer.status).toBe("completed");

    await request(app)
      .delete(`/v1.0/customers/${customerId}/transfers/${transferId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const createCardRes = await request(app)
      .post(`/v1.0/customers/${customerId}/debitCards`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ card_number: "4111111111111234" })
      .expect(201);

    const debitCardId = createCardRes.body.debitCard.id as string;
    const referenceId = createCardRes.body.debitCard.referenceId as string;

    const freezeCardRes = await request(app)
      .post(`/v1.0/customers/${customerId}/debitCards/${debitCardId}/freezeCard`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(freezeCardRes.body.debitCard.status).toBe("frozen");

    await request(app)
      .post(`/v1.0/customers/${customerId}/debitCards/${debitCardId}/unfreezeCard`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .post("/v1.0/debitCards/activateCardByCardNumber")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ card_number: "4111111111111234" })
      .expect(200);

    const referenceRes = await request(app)
      .get(`/v1.0/debitCards/referenceId/${referenceId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(referenceRes.body.debitCard.referenceId).toBe(referenceId);

    const outgoingWireRes = await request(app)
      .post("/v1.0/transactions/createOutgoingWire")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        account_id: accountId,
        amount: 18,
        routing_number: "021000021",
        account_number: "1234567890",
      })
      .expect(201);

    const outgoingTransferId = outgoingWireRes.body.transfer.id as string;

    const updateOutgoingRes = await request(app)
      .post("/v1.0/transactions/updateOutgoingWireStatus")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ transfer_id: outgoingTransferId, status: "completed" })
      .expect(200);

    expect(updateOutgoingRes.body.transfer.status).toBe("completed");

    await request(app)
      .post("/v1.0/transactions/commitWireTransaction")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ transfer_id: outgoingTransferId })
      .expect(200);

    await request(app)
      .post("/v1.0/transactions/disbursement")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ from_account_id: accountId, to_account_id: "acct_sand_001", amount: 7 })
      .expect(201);

    await request(app)
      .post("/v1.0/onboarding/loanOnboardingFunding")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ account_id: accountId, amount: 5 })
      .expect(201);
  });
});
