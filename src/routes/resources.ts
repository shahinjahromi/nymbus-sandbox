import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { enforceApiRateLimit } from "../auth/rate-limit.js";
import { captureApiActivity } from "../services/api-activity-log.js";

export const resourcesRouter = Router();
resourcesRouter.use(requireAuth);
resourcesRouter.use(enforceApiRateLimit);
resourcesRouter.use(captureApiActivity);

/* ── Notice Templates ── */
resourcesRouter.get("/resources/noticeTemplates", (_req: Request, res: Response) => {
  res.json({
    responseStatus: { success: true, errors: [] },
    noticeTemplates: [
      {
        id: "nt_001",
        name: "Account Statement",
        description: "Monthly account statement template",
        category: "statement",
        active: true,
      },
      {
        id: "nt_002",
        name: "Rate Change Notice",
        description: "Notification of interest rate change",
        category: "rateChange",
        active: true,
      },
      {
        id: "nt_003",
        name: "Overdraft Notice",
        description: "Overdraft alert notification template",
        category: "overdraft",
        active: true,
      },
      {
        id: "nt_004",
        name: "Maturity Notice",
        description: "Certificate maturity notification",
        category: "maturity",
        active: true,
      },
    ],
    environment: "sandbox",
  });
});

/* ── Reference Data: Account ── */
resourcesRouter.get("/resources/referenceData/account", (_req: Request, res: Response) => {
  res.json({
    responseStatus: { success: true, errors: [] },
    referenceData: {
      accountTypes: [
        { code: "DDA", description: "Demand Deposit Account" },
        { code: "SAV", description: "Savings Account" },
        { code: "MMA", description: "Money Market Account" },
        { code: "CD", description: "Certificate of Deposit" },
        { code: "IRA", description: "Individual Retirement Account" },
        { code: "LOC", description: "Line of Credit" },
        { code: "LOAN", description: "Loan" },
        { code: "MORT", description: "Mortgage" },
      ],
      accountStatuses: [
        { code: "active", description: "Active" },
        { code: "closed", description: "Closed" },
        { code: "dormant", description: "Dormant" },
        { code: "frozen", description: "Frozen" },
        { code: "chargedOff", description: "Charged Off" },
      ],
      ownershipTypes: [
        { code: "individual", description: "Individual" },
        { code: "joint", description: "Joint" },
        { code: "trust", description: "Trust" },
        { code: "estate", description: "Estate" },
        { code: "corporate", description: "Corporate" },
      ],
    },
    environment: "sandbox",
  });
});

/* ── Reference Data: Escrow Disbursement ── */
resourcesRouter.get(
  "/resources/referenceData/escrowDisbursement",
  (_req: Request, res: Response) => {
    res.json({
      responseStatus: { success: true, errors: [] },
      referenceData: {
        disbursementTypes: [
          { code: "TAX", description: "Tax Disbursement" },
          { code: "INS", description: "Insurance Disbursement" },
          { code: "PMI", description: "Private Mortgage Insurance" },
          { code: "HOA", description: "Homeowner Association Fees" },
          { code: "OTHER", description: "Other Escrow Disbursement" },
        ],
        disbursementFrequencies: [
          { code: "monthly", description: "Monthly" },
          { code: "quarterly", description: "Quarterly" },
          { code: "semiAnnual", description: "Semi-Annual" },
          { code: "annual", description: "Annual" },
        ],
        disbursementStatuses: [
          { code: "scheduled", description: "Scheduled" },
          { code: "paid", description: "Paid" },
          { code: "cancelled", description: "Cancelled" },
          { code: "pending", description: "Pending" },
        ],
      },
      environment: "sandbox",
    });
  }
);
