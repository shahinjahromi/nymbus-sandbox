# SOLID principles — architecture and LLM instructions

**Reference:** [Software Architecture: S.O.L.I.D Principles](https://medium.com/@ankurpratik/software-architecture-s-o-l-i-d-principles-967930d2812b) (Ankur Pratik, Medium).

The design and implementation MUST conform to SOLID. Use this doc when adding or changing code.

---

## S: Single Responsibility Principle (SRP)

- Every class, module, or method should have **one reason to change**.
- If a class does multiple operations (e.g. validation, I/O, business logic), split into separate classes/modules.
- Prefer small, focused modules over large multi-purpose ones.

---

## O: Open/Closed Principle (OCP)

- Software entities should be **open for extension, closed for modification**.
- Prefer adding new behavior via new types/implementations (e.g. new classes implementing an interface) rather than editing existing code.
- Use abstractions (interfaces, abstract classes) so new behavior is added by extending, not by changing existing logic.

---

## L: Liskov Substitution Principle (LSP)

- Subtypes must be **substitutable** for their base types without breaking the application.
- Any code that depends on a base type should work when given a derived type; derived types must not weaken contracts or throw where the base type does not.

---

## I: Interface Segregation Principle (ISP)

- Avoid **fat interfaces** that force implementors to provide methods they do not need.
- Prefer many small, focused interfaces over one large interface.
- Classes should not implement methods they do not use.

---

## D: Dependency Inversion Principle (DIP)

- **High-level modules should not depend on low-level modules.** Both should depend on **abstractions** (e.g. interfaces).
- Depend on interfaces/abstract types, not concrete implementations; inject dependencies (e.g. via constructor or factory) so that swapping implementations does not require changing high-level code.

---

## Instructions for the LLM

When implementing or changing code:

1. **New features:** Prefer new modules/classes that implement existing interfaces over modifying existing logic (OCP).
2. **Refactors:** Ensure each module has a single responsibility (SRP); split if it has multiple reasons to change.
3. **Abstractions:** Depend on interfaces/abstractions; inject concrete implementations (DIP).
4. **Interfaces:** Keep interfaces small and role-specific (ISP).
5. **Inheritance/subtyping:** Ensure subtypes are substitutable for base types and do not break callers (LSP).

Reference: REQ-NF-003.
