# REQ-NF-004: Database design conforms to best practices for financial systems

**ID:** REQ-NF-004  
**Type:** Non-functional (database / architecture)  
**Status:** Implemented

## Description

The database design MUST conform to best practices for financial systems as described in:

**Reference:** [The Ideal Database for Financial Transactions: Unraveling the Best Options](https://medium.com/@keemsisi/the-ideal-database-for-financial-transactions-unraveling-the-best-options-d5fef359fe09) (Adeshina Lasisi, Medium).

## Key practices (summary)

- **Auditability:** Immutable records, transaction logs, regulatory compliance.
- **Security:** Encryption, secure storage of sensitive data (e.g. card numbers, PII).
- **Scalability:** Handle growing transaction volume.
- **Data integrity:** ACID (Atomicity, Consistency, Isolation, Durability) for core transactional data.
- **Core systems:** Use relational DBs (e.g. PostgreSQL, Oracle, SQL Server) for strong consistency and transactional integrity; proper indexing (e.g. on transaction_date).
- **Supplementary workloads:** NoSQL (e.g. MongoDB for metadata/audit trails, Cassandra for real-time/fraud detection) where appropriate; specialized ledgers (e.g. QLDB) for immutable audit.
- **Design:** Clear schema for transactions (e.g. transaction_id, amount as DECIMAL, account_from/to, status, indexes for query performance).

## Acceptance criteria

1. Design documentation describes financial DB practices and references the article above.
2. Schema and data access patterns support ACID for core financial data, auditability, and security considerations.
3. LLM instructions in `requirements/design/DATABASE-FINANCIAL.md` guide DB design and changes.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-NF-004 | `tests/req-nf-004-database-financial.test.ts` | Design doc `requirements/design/DATABASE-FINANCIAL.md` exists and describes ACID, auditability, security, and references the Medium article. |

## Change history

- 2026-03-12: Initial requirement logged.
