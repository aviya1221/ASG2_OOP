# Step 8: Testing Strategy (STP / STD)

<!--
LECTURER GUIDELINES: STP AND STD (lecture 02a, slides 3, 9, 18, 19, 22)
(Hidden on GitHub, visible when editing.)

Assignment step 8: "Define a testing strategy; make sure to address the
classes (as in 7)."

"STP and STD: planning and describing the tests."
Cheat sheet: how we will test, and the tests themselves.

STP (Software Test Plan)
  Answers: How will we test; when are we done?
  Written by: test lead. Read by: QA team, project manager.
  When: once requirements settle.
  Contents:
  - Scope and items under test
  - Test levels: unit, integration, system, acceptance
  - Approach and tools
  - Environment and test data
  - Entry and exit criteria
  - Schedule, roles and risks

STD (Software Test Description)
  Answers: Which exact tests, steps, results?
  Written by: test engineers. Read by: testers, auditors.
  When: before test execution.
  Contents of each test case:
  - Test case ID and title
  - Requirement it verifies
  - Preconditions and setup
  - Step-by-step actions
  - Input data
  - Expected result

Lecturer's example test case:
  TC-045  Loan an available book
  Verifies: REQ-12, UC-03
  Pre: Member M-1042 has no loans
  Steps: 1. Scan book B-7781  2. Confirm
  Expected: Loan created, due date today + 14 days, book shown as on loan
  Result: Pass / Fail, tester, date

State machines go in the STD too (slide 9): test every state transition.

Traceability (slide 19): every requirement traces to design and to test
cases; the matrix has a Status column (Passed / Failed / Gap). A requirement
with no test case is a Gap.

CDR (lecture 03a, slide 7): "Test plan (STP) traced to requirements". Exit
criterion: "Every requirement traced to design and a test".
Docs as code (lecture 02a, slide 21): "A feature is not done until its docs
and tests are updated."

FOR OUR PROJECT
Because the assignment asks us to address the classes from step 7, the STP
has a unit-test table per EDD class (A.3). Test case IDs: TC-001, TC-002, ...
-->

## Part A: Test plan (STP)

### A.1 Scope and items under test

### A.2 Test levels

| Level | What is tested | Tool | Who |
|-------|----------------|------|-----|
| Unit | | | |
| Integration | | | |
| System | | | |
| Acceptance | | | |

### A.3 Unit tests per class (from step 7)

| EDD | Class | Method | What is checked | Test cases |
|-----|-------|--------|-----------------|------------|

### A.4 Approach and tools

### A.5 Environment and test data

### A.6 Entry and exit criteria

### A.7 Schedule, roles and risks

## Part B: Test cases (STD)

<!-- One block per test case:
### TC-nnn: <title>
- Verifies: REQ-nn, UC-nn
- Preconditions:
- Steps:
  1. ...
- Input data:
- Expected result:
- Result: Pass / Fail, tester, date
-->
