# REQ-NF-003: Architecture conforms to SOLID principles

**ID:** REQ-NF-003  
**Type:** Non-functional (architecture)  
**Status:** Implemented

## Description

The design and implementation MUST conform to SOLID principles as described in:

**Reference:** [Software Architecture: S.O.L.I.D Principles](https://medium.com/@ankurpratik/software-architecture-s-o-l-i-d-principles-967930d2812b) (Ankur Pratik, Medium).

## Principles (summary)

| Letter | Principle | Summary |
|--------|------------|---------|
| **S** | Single Responsibility | Each class/method has one reason to change; separate distinct operations into distinct classes/methods. |
| **O** | Open/Closed | Open for extension, closed for modification; add new functionality with minimal changes to existing code (e.g. via interfaces and new implementations). |
| **L** | Liskov Substitution | Subtypes must be substitutable for their base types without breaking the application. |
| **I** | Interface Segregation | Avoid fat interfaces; classes should not implement methods they do not use; split interfaces by concern. |
| **D** | Dependency Inversion | High-level modules should not depend on low-level modules; both should depend on abstractions (e.g. interfaces). |

## Acceptance criteria

1. Design documentation describes how SOLID is applied and references the article above.
2. New and changed code follows SOLID: single responsibility per module, extension over modification, substitutable subtypes, small interfaces, dependency on abstractions.
3. LLM instructions in `requirements/design/SOLID.md` guide implementation and reviews.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-NF-003 | `tests/req-nf-003-solid.test.ts` | Design doc `requirements/design/SOLID.md` exists and describes all five SOLID principles and references the Medium article. |

## Change history

- 2026-03-12: Initial requirement logged.
