# Use cases

<!--
LECTURER GUIDELINES: USE CASES (lecture 02a, slides 3, 7, 8, 9, 10, 11, 22)
(Hidden on GitHub, visible when editing.)

"Use cases: requirements as user goals."
Answers: How do users interact with it?
Written by: analyst, UX designer. Read by: developers, testers, client.
When: with the SRS (use cases are an SRS appendix).
Cheat sheet: how each actor reaches a goal, including the errors.

Use-case template (slide 7):
1. Name and ID: verb phrase, e.g. "UC-03 Borrow a book"
2. Actor: who starts it (a person or another system)
3. Preconditions: what must be true before it starts
4. Main success flow: numbered steps, actor and system alternating
5. Alternative flows: branches and errors, numbered from the step they leave
6. Postconditions: what is guaranteed when it ends

Lecturer's example:
  UC-03 Borrow a book
  Actor: Member
  Precondition: Member is logged in and has no overdue loans
  Main flow:
    1. Member scans the book barcode
    2. System checks the book is available
    3. System records the loan, due in 14 days
    4. System shows a receipt
  Alternative: 2a. Book is reserved by another member: system offers to join
               the waiting list
  Postcondition: Book status is "on loan"

Use case vs user story (slide 8):
  Use case
    Unit: a complete user goal with all its flows
    Best for: complex interactions, many exceptions, contracts
    Lives in: the SRS or a use-case model
    Typical size: one to three pages
  User story
    Unit: one small slice of value
    Best for: agile backlogs and sprint planning
    Lives in: issue tracker such as Jira or GitHub Issues
    Typical size: one sentence plus acceptance criteria

  Example user story with acceptance criteria:
    As a member, I want to renew a loan online so that I avoid a late fee.
      Given a loan with no reservations on the book
      When I click Renew
      Then the due date moves 14 days later and I get a confirmation email

Use-case diagram (slide 10), "who does what":
  Stick figure: an actor (a role outside the system)
  Oval: a use case (one user goal)
  Box: the system boundary
  Solid line: the actor takes part
  <<include>>: always performed as part of
  <<extend>>: optional, under a condition

Activity diagram (slide 11): the same content as the use-case text, but gaps
and missing branches are easier to spot in a picture.
  Filled dot: start. Ringed dot: end. Rounded box: action.
  Diamond: decision. [guard]: condition for taking a flow.
Both diagrams go in the SRS / use cases (slide 9).

FOR OUR PROJECT
Each use case lists the requirements it covers (REQ-nn), so the SRS
traceability matrix can fill its "Use case" column.
-->

## 1. Actors

| Actor | Description |
|-------|-------------|

## 2. Use-case diagram

## 3. Use cases

<!-- Template for each use case:
### UC-nn: <verb phrase>
- Actor:
- Preconditions:
- Main success flow:
  1. ...
- Alternative flows:
  - 2a. ...
- Postconditions:
- Covers: REQ-nn, REQ-nn
-->

### UC-01: Mark attendance
### UC-02: Open a class session and export the attendance spreadsheet
### UC-03: Post a comment or suggestion
### UC-04: Create a poll and vote
### UC-05: Get a class video summary
### UC-06: Request a homework review

## 4. Activity diagrams

## 5. User stories

<!-- As a <role>, I want <goal> so that <benefit>.
       Given ...
       When ...
       Then ...
-->
