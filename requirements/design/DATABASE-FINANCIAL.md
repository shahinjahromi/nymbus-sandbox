# Database design for financial systems — best practices and LLM instructions

**Reference:** [The Ideal Database for Financial Transactions: Unraveling the Best Options](https://medium.com/@keemsisi/the-ideal-database-for-financial-transactions-unraveling-the-best-options-d5fef359fe09) (Adeshina Lasisi, Medium).

The database design MUST conform to best practices for financial systems. Use this doc when designing or changing schemas, APIs, or data access.

---

## Core requirements for financial data

| Concern | Practice |
|--------|----------|
| **Auditability** | Immutable records where required; transaction logs; support for regulatory compliance and audit trails. |
| **Security** | Encryption at rest and in transit; secure storage of sensitive data (e.g. card numbers, PII); access control. |
| **Scalability** | Design for growing transaction volume; indexing and partitioning where appropriate. |
| **Data integrity** | Core transactional data must comply with **ACID**: Atomicity, Consistency, Isolation, Durability. |

---

## ACID and core transactional storage

- **Core systems** (accounts, transactions, balances, transfers) should use a **relational** or **ACID-compliant** store (e.g. PostgreSQL, SQL Server, Oracle on Azure).
- Use **transactions** for any operation that updates multiple rows/tables (e.g. debit one account, credit another).
- Prefer **DECIMAL/NUMERIC** for monetary amounts; avoid floating point for money.
- Use **indexes** on frequently queried columns (e.g. transaction_date, account_id, status) for performance.

---

## Schema and naming

- Clear, consistent naming (e.g. `transaction_id`, `account_from`, `account_to`, `amount`, `status`, `transaction_date`).
- Primary keys and foreign keys to preserve referential integrity.
- Status and type fields where needed for filtering and audit.

---

## Supplementary workloads (optional)

- **Audit trails / metadata:** Consider append-only or immutable stores (e.g. ledger-style) where regulatory requirements demand it.
- **Analytics / real-time:** NoSQL or read replicas may be used for reporting or fraud detection without weakening ACID for core transactional data.

---

## Instructions for the LLM

When designing or changing database schema or data access:

1. **Core financial data:** Use ACID-compliant storage; wrap multi-step updates in transactions; use DECIMAL for money.
2. **Auditability:** Ensure transaction logs or immutable audit records where required; do not overwrite or delete financial transaction records without a defined retention/archival policy.
3. **Security:** Assume sensitive fields are encrypted or tokenized; document assumptions in design.
4. **Performance:** Add indexes for common query patterns (e.g. by date, account, status).
5. **References:** Align schema and patterns with the practices in the Medium article above (relational for core, ACID, indexing, auditability).

Reference: REQ-NF-004.
