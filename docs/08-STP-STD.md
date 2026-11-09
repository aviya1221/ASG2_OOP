# Testing Strategy (STP / STD)

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

**Under test:** the web client, our server, and the database functions, access rules and jobs in Supabase, for the classes of the EDDs.

**Not under test:** Google Gemini, Supabase, Netlify and Render themselves. Fakes replace the AI service and the notification services in automated runs.

**Not yet covered:** the homework review. Its classes and test cases are added together with its design.

### A.2 Test levels

| Level | What is tested | Tool | Who |
|-------|----------------|------|-----|
| Unit | One class at a time, with its neighbours replaced by fakes | `node:test` on the server, Vitest with Testing Library in the client | Automatic, on every push |
| Integration | The server calls, database functions, access rules and jobs against a real local Supabase, signed in as each role | `node:test` with the Supabase client library, on the Supabase CLI in Docker | Automatic, on every push |
| System | Whole flows with several users at once, in Chromium with a phone profile and WebKit with an iPhone profile | Playwright | Automatic, on every push |
| Acceptance | The flows on real phones in a real hall, the real AI service and the load targets | The manual test cases in Part B and the load scripts | The team, before each release |

### A.3 Unit tests per class (from step 7)

| EDD | Class | Method | What is checked | Test cases |
|-----|-------|--------|-----------------|------------|

### A.4 Approach and tools

### A.5 Environment and test data

- **Local and on every push:** Node.js 22, Docker and the Supabase CLI, with a fresh database for each run.
- **Before a release:** the deployed site and server, one Android phone with Chrome and one iPhone with Safari.
- **Users:** admin `A1`, teachers `T1` (course A) and `T2` (course B), students `S1` to `S50` in course A and `S51` in course B. All the names and ID numbers are made up.
- **Lessons:** `L1` of course A, in progress. `L2` of course A, ended.
- **Face data:** face-prints are generated numbers with a known similarity, and photos are generated pictures of people who do not exist. Automated tests use no photo of a real person.

### A.6 Entry and exit criteria

**Entry:** the type check passes, the test data loads and the classes of the feature exist.

**Exit, for a release:**

- Every automated test passes on the commit of the release.
- Every manual test in Part B has been run, and its result recorded.
- Every requirement has a test case, and none has the status Gap or Failed.
- Line coverage is at least 80% on the server and in the client logic, and 100% in `AttendanceRules` and `FaceMatcher`.
- No open defect remains against a requirement of priority Must.

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

### Accounts and timetable

### TC-001: Refuse a lesson without signing in

- Verifies: REQ-01, UC-08
- Preconditions: Nobody is signed in.
- Steps: 1. Open the address of `L1`. 2. Read the table `lessons` with only the public key. 3. Sign in as `S1` with a wrong password.
- Input data: A wrong password.
- Expected result: The page shows the sign-in screen, the read returns 0 rows, and the wrong password is refused.
- Automation: Browser, Integration

### TC-002: The admin creates a course

- Verifies: REQ-02, UC-07
- Preconditions: `A1` is signed in, and course number 101 does not exist.
- Steps: 1. Fill in the form for a new course and save. 2. Save the same number again.
- Input data: Number 101, a name, teacher `T1`, weekly hours and 3 students.
- Expected result: The course and its lessons appear in the timetable. The second save is refused and shows what to fix.
- Automation: Browser

### TC-003: Only the admin changes the timetable

- Verifies: REQ-03, UC-07
- Preconditions: Each role is signed in, in turn.
- Steps: 1. As `T1`, add a course. 2. As `S1`, change a course. 3. As `A1`, change a course.
- Input data: Course A.
- Expected result: The first two are refused, and the third is saved.
- Automation: Integration

### TC-004: Users see only their own lessons

- Verifies: REQ-04, UC-08
- Preconditions: `S51` is only in course B, and `T2` teaches only course B.
- Steps: 1. As `S51`, read the lessons. 2. As `T2`, read the lessons.
- Input data: None.
- Expected result: Each gets only the lessons of course B.
- Automation: Integration

### TC-005: Reach a lesson with no code, on one page with three tabs

- Verifies: REQ-05, REQ-06, UC-08
- Preconditions: `S1` is signed in.
- Steps: 1. Choose `L1` from the list. 2. Press each tab.
- Input data: None.
- Expected result: The lesson page opens with no code or join step, with the tabs attendance, forum and homework.
- Automation: Browser
