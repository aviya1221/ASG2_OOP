# Software Requirements Specification (SRS)

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

This document states what the live-lesson web app must do. Developers build from it, testers test against it, and the client accepts the product against it.

### 1.2 Scope

The product is the web app described in the [SoW](03-SoW.md): the college's admin builds the timetable, and each lesson has one tab per feature (D-1 to D-5). The product does not connect to Moodle, Zoom or the college's personal-information systems.

### 1.3 Definitions

| Term | Meaning |
|------|---------|
| Lesson | One scheduled meeting of a course in the timetable |
| Face-print | A list of numbers that describes a face, used to compare two faces |
| Hash | A one-way code made from a face-print at registration, used to detect a changed face-print |
| Match threshold | The score at or above which two face-prints count as the same person ([ADR-1](02-tools-report.md#adr-1-face-tool-for-photo-attendance)) |
| Row and seat | A place in the hall: row 1 is nearest the board, seat 1 is next to the window |
| Pilot | The first use of the product in a live class |

### 1.4 References

- [Statement of Work](03-SoW.md)
- [Technical tools report](02-tools-report.md)
- [Use cases](05-use-cases.md)
- [Polls build strategy](features/F3-polls-strategy.md)
- [Attendance flow mock](assets/F1-attendance-flow-demo.html)

## 2. Overall description

### 2.1 Product perspective

The product is standalone: every feature runs inside it, with no outside poll or attendance site. It calls outside services only for AI processing (section 3.2).

### 2.2 User classes

| Class | What they do |
|-------|--------------|
| Admin | Builds the timetable: courses, their teachers, weekly hours and students |
| Teacher | Runs the lessons of their courses |
| Student | Takes part in the lessons of their courses from a phone |

### 2.3 Operating environment

The product runs in a web browser on a phone or a computer. The teacher's phone and each student's phone need a camera for attendance, and every user needs a network connection.

### 2.4 Constraints

- Nothing is installed on a phone: the product is a website.
- The product does not connect to Moodle, Zoom or personal-information systems.
- Every service runs on a free tier during the pilot.
- The server never receives a photo of a face.

### 2.5 Assumptions

- The admin has the list of students for each course.
- Every student has a phone with a camera and a browser.
- The teacher's phone takes photos in which the back-row faces are at least 28 px high ([ADR-1](02-tools-report.md#adr-1-face-tool-for-photo-attendance)).

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
