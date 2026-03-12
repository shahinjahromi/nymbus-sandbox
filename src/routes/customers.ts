import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { mockCustomers, getCustomerById } from "../services/mock-data.js";
import type { PaginatedResponse } from "../types/index.js";
import type { Customer } from "../types/index.js";

export const customersRouter = Router();
customersRouter.use(requireAuth);

customersRouter.get("/customers", (_req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(_req.query.page), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(_req.query.page_size), 10) || 20));
  const total = mockCustomers.length;
  const start = (page - 1) * pageSize;
  const data = mockCustomers.slice(start, start + pageSize);

  const response: PaginatedResponse<Customer> = {
    data,
    total,
    page,
    pageSize,
    hasMore: start + data.length < total,
  };
  res.json(response);
});

customersRouter.get("/customers/:id", (req: Request, res: Response) => {
  const customer = getCustomerById(req.params.id);
  if (!customer) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Customer not found",
      details: { customerId: req.params.id },
    });
    return;
  }
  res.json(customer);
});
