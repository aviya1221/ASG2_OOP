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

#### F0: Accounts, timetable and lesson page, REQ-01 to REQ-09

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-01 | The system shall require a user to sign in before showing any lesson. | Must | D-1 to D-5 |
| REQ-02 | The system shall let the admin create a course with its teacher, weekly hours and list of students. | Must | D-1 to D-5 |
| REQ-03 | The system shall allow only the admin to change the timetable. | Must | D-1 to D-5 |
| REQ-04 | The system shall show each teacher and each student only the lessons of their own courses. | Must | D-1 to D-5 |
| REQ-05 | The system shall give each student access to their lessons with no room code or join step. | Must | D-1 to D-5 |
| REQ-06 | The system shall show each lesson as one page with one tab per feature. | Must | D-1 to D-5 |
| REQ-07 | The system shall let a student register their face once, from 3 photos taken on their own phone: one close, one from 2 meters and one at a slight angle. | Must | D-1 |
| REQ-08 | The system shall let a student opt out of face recognition. | Must | D-1 |
| REQ-09 | The system shall require approval from a teacher of one of the student's courses before the student replaces their registered face. | Should | D-1 |

#### F1: Attendance and spreadsheet (main feature), REQ-10 to REQ-19

Face registration and opting out are REQ-07 to REQ-09.

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-10 | The system shall let the teacher of a lesson take 1 to 3 photos of the class during that lesson. | Must | D-1 |
| REQ-11 | The system shall notify every student of the course after the teacher has taken the photos. | Must | D-1 |
| REQ-12 | The system shall collect a student's response when the student opens the app at any time in the 1 hour after the photos, with no further action by the student. | Must | D-1 |
| REQ-13 | The system shall give each student one attendance result, by the rules in the table below. | Must | D-1 |
| REQ-14 | The system shall let a student who is not marked present after that hour, or who opted out, request attendance by entering their row and seat. | Must | D-1 |
| REQ-15 | The system shall let the teacher approve or reject each row-and-seat request. | Must | D-1 |
| REQ-16 | The system shall keep a record of every row-and-seat request. | Should | D-1 |
| REQ-17 | The system shall flag a student who has a rejected request, or who has made 3 or more requests in the same course. | Should | D-1 |
| REQ-18 | The system shall show the teacher the lesson's attendance sheet inside the app, updated with each new result. | Must | D-1 |
| REQ-19 | The system shall let the teacher download a lesson's attendance sheet as a spreadsheet file with one row per student: name, attendance, how it was decided and a note for flagged students. | Must | D-1 |

Rules for REQ-13, checked in this order. Only the result "Present" marks the student present.

| Order | Condition | Result |
|-------|-----------|--------|
| 1 | The student's face-print does not fit the hash saved at registration | Review |
| 2 | The student's best score is below the match threshold | Not found |
| 3 | The score is at or above the match threshold, and no other student matched the same face | Present |
| 4 | Two or more students matched the same face | Conflict: the system does not choose among them |
| 5 | The student sent nothing within the hour | No response |

#### F2: Comments and suggestions, REQ-20 to REQ-29

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-20 | The system shall open a separate forum for each lesson. | Must | D-2 |
| REQ-21 | The system shall list a course's forums in order of lecture number, each titled with the course name, the lecture number and the lecture topic. | Must | D-2 |
| REQ-22 | The system shall let the teacher enter a lecture's topic, before or during the lecture. | Must | D-2 |
| REQ-23 | The system shall keep the forum of each lesson with all its messages, open for writing with no closing date. | Must | D-2 |
| REQ-24 | The system shall show a forum's messages to everyone linked to the lesson, with new messages appearing without reloading the page. | Must | D-2 |
| REQ-25 | The system shall let everyone linked to the lesson write a new message or reply to a message. | Must | D-2 |
| REQ-26 | The system shall always show the teacher who wrote each message, and show the class the writer's name only if the student chose this for that message. | Must | D-2 |
| REQ-27 | The system shall limit a message to text, which can include links. | Must | D-2 |
| REQ-28 | The system shall not allow a published message to be edited. | Must | D-2 |
| REQ-29 | The system shall allow only the teacher to delete a message. | Must | D-2 |

#### F3: Polls, REQ-30 to REQ-39

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-30 | The system shall let the teacher publish, during the lesson, a poll in the forum of that lesson date: one multiple-choice question with at least 2 answer options. | Must | D-3 |
| REQ-31 | The system shall show a published poll in the forum to every student of that lesson. | Must | D-3 |
| REQ-32 | The system shall let a student choose one answer to a poll only while the poll is open. | Must | D-3 |
| REQ-33 | The system shall refuse a student's second answer to a poll unless the teacher allowed another answer when creating it. | Must | D-3 |
| REQ-34 | The system shall let the teacher allow another answer when creating a poll, in which case the new answer replaces the student's earlier one. | Must | D-3 |
| REQ-35 | The system shall show everyone linked to the lesson a chart of a poll's answers that updates without reloading the page. | Must | D-3 |
| REQ-36 | The system shall show the teacher who gave each answer to a poll. | Must | D-3 |
| REQ-37 | The system shall let the teacher close an open poll at any time. | Must | D-3 |
| REQ-38 | The system shall close a poll that is still open at the end of the lesson. | Must | D-3 |
| REQ-39 | The system shall keep a poll and its results in the forum of its lesson date. | Must | D-3 |
#### F4: Class video ML summary, REQ-40 to REQ-49

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-40 | The system shall show, in the forum of each lesson, a button that takes everyone linked to the lesson to the lesson's summary page. | Must | D-4 |
| REQ-41 | The system shall open the summary page only after the lesson has ended and the teacher has uploaded its recording. | Must | D-4 |
| REQ-42 | The system shall let the teacher upload a recording of a lesson, and create a new summary from each upload. | Must | D-4 |
| REQ-43 | The system shall create the summary automatically from the full video, picture and sound. | Must | D-4 |
| REQ-44 | The system shall create the summary from the sound alone when the file exceeds the AI service's file size limit or a usage limit is reached. | Must | D-4 |
| REQ-45 | The system shall show four parts on the summary page: a short summary of the lesson, the topics in order with their start times, the students' questions with the teacher's answers, and the content from the board. | Must | D-4 |
| REQ-46 | The system shall check the summary against the transcript and the list of board content, correct spelling mistakes and garbled copying, and add no new content. | Must | D-4 |
| REQ-47 | The system shall let the teacher edit the text of the summary by hand. | Must | D-4 |
| REQ-48 | The system shall delete the recording once the summary is ready. | Must | D-4 |
| REQ-49 | The system shall use the topic from the lesson summary as the lecture topic of the forum title when the teacher has not entered one. | Must | D-4 |

#### F5: LLM homework review, REQ-50 to REQ-59
#### F6: Forms, REQ-60 to REQ-69

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-60 | The system shall let the teacher build a form of one or more questions inside the product, before or during the lesson. | Must | D-3 |
| REQ-61 | The system shall offer four question types in a form: single choice, multiple choice, rating on a scale and free text. | Must | D-3 |
| REQ-62 | The system shall let the teacher publish a form in the forum of a lesson date. | Must | D-3 |
| REQ-63 | The system shall open a form in a window over the forum, so that a student answers it without leaving the forum. | Must | D-3 |
| REQ-64 | The system shall accept a student's answers to a form only while the form is open. | Must | D-3 |
| REQ-65 | The system shall refuse a student's second answer to a form unless the teacher allowed another answer when creating it. | Must | D-3 |
| REQ-66 | The system shall let the teacher allow another answer when creating a form, in which case the new answer replaces the student's earlier one. | Must | D-3 |
| REQ-67 | The system shall show a form's answers, including who gave each one, only to the teacher. | Must | D-3 |
| REQ-68 | The system shall let the teacher close an open form at any time. | Must | D-3 |
| REQ-69 | The system shall keep a form and its answers in the forum of its lesson date. | Must | D-3 |

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
