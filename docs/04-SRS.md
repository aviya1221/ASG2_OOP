# Step 4: Software Requirements Specification (SRS)

<!--
LECTURER GUIDELINES: SRS (lecture 02a, slides 3, 5, 6, 19, 22)
(Hidden on GitHub, visible when editing.)

"SRS: what the system must do."
Answers: What must the system do? (with use cases)
Written by: analyst, product owner. Read by: developers, testers, client.
When: requirements phase.
Cheat sheet: what the system shall do, in testable statements.
Language (lecture 03a, slide 5, PRD vs SRS): "The system shall..."

Structure:
1. Introduction: purpose, scope, definitions, references
2. Overall description: product perspective, user classes, operating
   environment, constraints, assumptions
3. Specific requirements: functional requirements, external interfaces,
   non-functional requirements
4. Appendices: use cases, data dictionary, traceability matrix

Two kinds of requirement:
- Functional: behaviour the system provides.
  "REQ-12: The system shall let a librarian register a loan for a member."
- Non-functional: qualities and constraints (performance, security,
  reliability, usability, maintainability, legal and platform constraints).
  "NFR-03: 99.5% monthly availability during opening hours."

Writing requirements that can be tested (slide 6):
  Weak: "The system should be fast."
    Problem: not measurable
    Better: 95% of searches shall return within 0.5 s with 1,000 concurrent users
  Weak: "The UI shall be user-friendly."
    Problem: subjective
    Better: a new librarian shall complete a loan in under 2 minutes after a
    15-minute tutorial
  Weak: "The system shall support many users."
    Problem: vague quantity
    Better: the system shall support 5,000 members and 200 concurrent sessions
  Weak: "Send email and SMS and log everything."
    Problem: several in one
    Better: split into REQ-21 (email), REQ-22 (SMS) and REQ-23 (audit log)

A good requirement is: unambiguous, verifiable, complete, consistent,
traceable, prioritised.

Traceability matrix (slide 19):
  Requirement | Use case | Design | Test cases | Status
  REQ-12 Register a loan | UC-03 | SDD §4.2, EDD-Loan | TC-045, TC-046 | Passed
  REQ-13 Renew a loan | UC-04 | SDD §4.2, EDD-Loan | TC-050 | Failed
  REQ-21 Email reminder | UC-07 | SDD §4.4 | None yet | Gap

PRD vs SRS (lecture 03a, slide 5): the SRS is measured by passing acceptance
tests. Priorities can use MoSCoW (Must / Should / Could / Won't).
SRR gate (lecture 03a, slide 4): "Is the SRS complete and testable?"
PDR package (lecture 03a, slide 6): "Baselined SRS with requirement IDs".

FOR OUR PROJECT
ID ranges (see docs/README.md): REQ-10..19 attendance, REQ-20..29 comments,
REQ-30..39 polls, REQ-40..49 video summary, REQ-50..59 homework review.
Each requirement row also cites the SoW deliverable it comes from (D-n).
-->

## 1. Introduction

### 1.1 Purpose
### 1.2 Scope
### 1.3 Definitions
### 1.4 References

## 2. Overall description

### 2.1 Product perspective
### 2.2 User classes
### 2.3 Operating environment
### 2.4 Constraints
### 2.5 Assumptions

## 3. Specific requirements

### 3.1 Functional requirements

<!-- One table per feature:
| ID | Requirement | Priority | Source |
| REQ-11 | The system shall ... | Must | D-1 |
-->

#### F1: Attendance and spreadsheet (main feature), REQ-10 to REQ-19
#### F2: Comments and suggestions, REQ-20 to REQ-29
#### F3: Polls, REQ-30 to REQ-39
#### F4: Class video ML summary, REQ-40 to REQ-49
#### F5: LLM homework review, REQ-50 to REQ-59

### 3.2 External interfaces

### 3.3 Non-functional requirements

<!-- NFR-nn, each one measurable. Check against the weak / better table above. -->

| ID | Category | Requirement | Priority |
|----|----------|-------------|----------|

## 4. Appendices

### A. Use cases

See [05-use-cases.md](05-use-cases.md).

### B. Data dictionary

| Entity / field | Type | Description |
|----------------|------|-------------|

### C. Traceability matrix

| Requirement | Use case | Design | Test cases | Status |
|-------------|----------|--------|------------|--------|
