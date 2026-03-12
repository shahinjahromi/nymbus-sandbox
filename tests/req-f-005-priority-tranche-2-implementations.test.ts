/**
 * REQ-F-005: Prioritized implementation tranche 2.
 * Success proves accounts-ext, loan payment, and customer UDF/document routes execute specialized local behavior.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-005: prioritized endpoint implementations tranche 2", () => {
  it("supports accounts-ext, loan payments, and customer UDF/document workflows", async () => {
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

    const accountsExtRes = await request(app)
      .get("/v1.0/accounts-ext")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(accountsExtRes.body.data)).toBe(true);
    expect(accountsExtRes.body.total).toBeGreaterThan(0);

    const loanPaymentsRes = await request(app)
      .get("/v1.0/accounts/acct_sand_001/loanPayments")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(loanPaymentsRes.body.total).toBeGreaterThan(0);
    const firstLoanPaymentId = loanPaymentsRes.body.loanPayments[0].id as string;

    const loanPaymentPatchRes = await request(app)
      .patch("/v1.0/accounts/acct_sand_001/loanPayments")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        loanPayments: {
          id: firstLoanPaymentId,
          amount: 321.5,
          frequency: "biweekly",
          status: "active",
        },
      })
      .expect(200);

    const updatedLoanPayment = loanPaymentPatchRes.body.loanPayments.find(
      (item: { id: string }) => item.id === firstLoanPaymentId
    ) as { amount: number; frequency: string };

    expect(updatedLoanPayment.amount).toBe(321.5);
    expect(updatedLoanPayment.frequency).toBe("biweekly");

    await request(app)
      .delete("/v1.0/accounts/acct_sand_001/loanPayments/nonexistent")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const createCustomerRes = await request(app)
      .post("/v1.0/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        first_name: "Tranche",
        last_name: "Two",
        email: `tranche2-${Date.now()}@example.test`,
      })
      .expect(201);

    const customerId = createCustomerRes.body.customer.id as string;

    const createAccountRes = await request(app)
      .post(`/v1.0/customers/${customerId}/accounts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        type: "checking",
        initial_balance: 125,
      })
      .expect(201);

    const accountId = createAccountRes.body.account.id as string;

    const customerUdfCreateRes = await request(app)
      .post(`/v1.0/customers/${customerId}/userDefinedFields`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        userDefinedFields: {
          id: "udf_customer_1",
          key: "segment",
          value: "gold",
        },
      })
      .expect(201);

    expect(customerUdfCreateRes.body.total).toBeGreaterThan(0);

    const accountUdfCreateRes = await request(app)
      .post(`/v1.0/customers/${customerId}/accounts/${accountId}/userDefinedFields`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        userDefinedFields: {
          id: "udf_account_1",
          key: "risk_band",
          value: "medium",
        },
      })
      .expect(201);

    expect(accountUdfCreateRes.body.total).toBeGreaterThan(0);

    await request(app)
      .patch(`/v1.0/customers/${customerId}/accounts/${accountId}/userDefinedFields`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        userDefinedFields: {
          id: "udf_account_1",
          key: "risk_band",
          value: "high",
        },
      })
      .expect(200);

    await request(app)
      .delete(`/v1.0/customers/${customerId}/accounts/${accountId}/userDefinedFields/udf_account_1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const customerDocumentCreateRes = await request(app)
      .post(`/v1.0/customers/${customerId}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        documentRootId: "doc_customer_1",
        title: "Customer identity document",
        type: "id",
      })
      .expect(201);

    expect(customerDocumentCreateRes.body.document.id).toBe("doc_customer_1");

    await request(app)
      .get(`/v1.0/customers/${customerId}/documents/doc_customer_1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .patch(`/v1.0/customers/${customerId}/documents/doc_customer_1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        status: "verified",
      })
      .expect(200);

    await request(app)
      .delete(`/v1.0/customers/${customerId}/documents/doc_customer_1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const accountDocumentCreateRes = await request(app)
      .post(`/v1.0/customers/${customerId}/accounts/${accountId}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        documentRootId: "doc_account_1",
        title: "Account disclosure",
        type: "disclosure",
      })
      .expect(201);

    expect(accountDocumentCreateRes.body.document.id).toBe("doc_account_1");

    const accountDocumentsRes = await request(app)
      .get(`/v1.0/customers/${customerId}/accounts/${accountId}/documents`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(accountDocumentsRes.body.total).toBeGreaterThan(0);

    await request(app)
      .get(`/v1.0/customers/${customerId}/accounts/${accountId}/documents/doc_account_1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .patch(`/v1.0/customers/${customerId}/accounts/${accountId}/documents/doc_account_1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        status: "archived",
      })
      .expect(200);

    await request(app)
      .delete(`/v1.0/customers/${customerId}/accounts/${accountId}/documents/doc_account_1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
  });
});
