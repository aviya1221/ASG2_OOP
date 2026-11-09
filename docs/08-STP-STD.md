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

### Attendance

### TC-010: Register a face from one photo

- Verifies: REQ-07, UC-06
- Preconditions: `S1` has no registered face.
- Steps: 1. Give the page the photo. 2. Record every request that leaves the browser.
- Input data: A generated photo of one face.
- Expected result: The server receives only a hash of 64 hexadecimal characters. No request carries the photo or the face-print, and `my_face_status` shows that the student is registered.
- Automation: Browser

### TC-011: Ask for another photo when no face is found

- Verifies: REQ-07, UC-06
- Preconditions: `S1` has no registered face.
- Steps: 1. Give the page the photo.
- Input data: A photo with no face.
- Expected result: The page asks for another photo, and nothing is sent.
- Automation: Browser

### TC-012: Opt out of face recognition

- Verifies: REQ-08, UC-06
- Preconditions: `S1` has no registered face.
- Steps: 1. Press the opt-out button. 2. Start a round in `L1`. 3. Open the site as `S1`.
- Input data: None.
- Expected result: `my_face_status` shows the opt-out, no hash exists, and no attendance response is sent.
- Automation: Browser

### TC-013: Replacing a face needs a teacher's approval

- Verifies: REQ-09, UC-06
- Preconditions: `S1` is registered.
- Steps: 1. `S1` registers a new hash. 2. `T2` tries to approve it. 3. `T1` approves it.
- Input data: A new hash.
- Expected result: Step 1 answers 202, and the saved hash stays the same until step 3. Step 2 is refused, and after step 3 the new hash is saved.
- Automation: Integration

### TC-014: Send the class photos with no photo leaving the phone

- Verifies: REQ-10, UC-01
- Preconditions: `L1` is in progress, and `T1` is signed in.
- Steps: 1. Give the page 3 photos. 2. Record the request to `POST /attendance/class`.
- Input data: 3 generated photos of a class.
- Expected result: The request holds only boxes and face-prints of 128 numbers, with no image data. A round opens that ends 60 minutes later.
- Automation: Browser

### TC-015: Refuse a round outside the lesson, or a second round

- Verifies: REQ-10, UC-01
- Preconditions: `T1` is signed in.
- Steps: 1. Send photos for `L2`, which has ended. 2. Send photos for `L1`. 3. Send photos for `L1` again.
- Input data: Generated face-prints.
- Expected result: `outside_lesson`, then 201, then `round_exists`.
- Automation: Integration

### TC-016: Notify every student of the course

- Verifies: REQ-11, UC-01
- Preconditions: 3 students of course A and `S51` are subscribed, and one subscription answers 410.
- Steps: 1. Start a round in `L1`, with a fake sender.
- Input data: Fake subscriptions.
- Expected result: The sender is called once for each subscription of course A and never for `S51`, and the one that answered 410 is removed.
- Automation: Unit

### TC-017: Collect a response when the student opens the site

- Verifies: REQ-12, UC-01
- Preconditions: A round is open in `L1`, and `S1` is registered in this browser.
- Steps: 1. `S1` opens the site and touches nothing.
- Input data: None.
- Expected result: Exactly one response is sent, and the attendance tab shows the result.
- Automation: Browser

### TC-018: Decide the result in the agreed order

- Verifies: REQ-13, UC-01
- Preconditions: A round of generated face-prints.
- Steps: 1. Respond with each input in turn.
- Input data: A face-print that does not fit the hash, a best score of 0.3599 and a best score of 0.36.
- Expected result: `review` with no comparison, then `not_found`, then `present`.
- Automation: Unit

### TC-019: Two students on one face get Conflict

- Verifies: REQ-13, UC-01
- Preconditions: A round is open in `L1`.
- Steps: 1. `S1` responds and matches one face. 2. `S2` responds and matches the same face.
- Input data: Face-prints built to match the same face.
- Expected result: After step 1, `S1` is `present`. After step 2, both are `conflict`, and the page of `S1` shows the change.
- Automation: Integration

### TC-020: Two responses at the same moment cannot both be Present

- Verifies: REQ-13, UC-01
- Preconditions: A round is open in `L1`.
- Steps: 1. Send both responses at the same moment, 20 times, each time in a new round.
- Input data: Face-prints built to match the same face.
- Expected result: Both are `conflict` every time.
- Automation: Integration

### TC-021: Show No response after the hour

- Verifies: REQ-13, UC-01
- Preconditions: A round whose hour is over, and `S3` sent nothing.
- Steps: 1. Read `attendance_sheet` as `T1`.
- Input data: None.
- Expected result: `S3` shows `no_response`. During the hour the same row shows no result yet.
- Automation: Integration

### TC-022: A second response returns the saved result

- Verifies: REQ-13, UC-01
- Preconditions: `S1` already has a result.
- Steps: 1. Respond again.
- Input data: The same face-print.
- Expected result: The saved result returns, and the comparison does not run again.
- Automation: Unit

### TC-023: Request row and seat only when allowed

- Verifies: REQ-14, UC-01
- Preconditions: `S1` and `S6` have `not_found`, `S4` opted out and `S5` is `present`.
- Steps: 1. `S1` asks during the hour. 2. `S1` asks after the hour. 3. `S4` asks during the hour. 4. `S5` asks after the hour. 5. `S6` asks for row 16 after the hour.
- Input data: Row 3, seat 5, on a map of 15 rows by 20 seats.
- Expected result: Refused, accepted, accepted, refused, refused.
- Automation: Integration

### TC-024: The teacher decides a request

- Verifies: REQ-15, UC-01
- Preconditions: `S1` and `S2` have requests in `L1`.
- Steps: 1. `T1` approves the request of `S1`. 2. `T1` rejects the request of `S2`. 3. `T2` tries to decide the request of `S1`.
- Input data: None.
- Expected result: The sheet shows `S1` as present by row and seat, `S2` keeps the earlier result, and `T2` is refused.
- Automation: Integration

### TC-025: Keep every request, one per lesson

- Verifies: REQ-16, UC-01
- Preconditions: `S1` may send a request.
- Steps: 1. `S1` sends a request. 2. `S1` sends another in the same lesson. 3. `T1` reads the requests.
- Input data: Row 3, seat 5.
- Expected result: The second is refused, and the first is kept with its time and decision.
- Automation: Integration

### TC-026: Flag a student

- Verifies: REQ-17, UC-01
- Preconditions: Requests exist in course A.
- Steps: 1. Read `attendance_sheet`.
- Input data: `S1` has 1 rejected request, `S2` has 2 approved and `S3` has 3 approved.
- Expected result: `S1` and `S3` are flagged, and `S2` is not.
- Automation: Integration

### TC-027: The sheet updates with each new result

- Verifies: REQ-18, UC-01
- Preconditions: A round is open, and `T1` has the attendance tab open.
- Steps: 1. `S1` responds. 2. `S2` responds.
- Input data: None.
- Expected result: Each result appears within 2 s, with no reload.
- Automation: Browser

### TC-028: Download the sheet

- Verifies: REQ-19, UC-01
- Preconditions: Results exist for `L1`.
- Steps: 1. Press download. 2. Read the file.
- Input data: An ID number that starts with 0, and a name that starts with `=`.
- Expected result: One row per student, in the columns of REQ-19. Every cell is text, the zero stays, no cell is a formula, and the sheet is right to left.
- Automation: Browser

### TC-029: A student's face-print is deleted right after the comparison

- Verifies: NFR-09, UC-01
- Preconditions: A round is open.
- Steps: 1. Respond and keep a reference to the buffer of the face-print. 2. Search the tables and the server log for its numbers.
- Input data: A generated face-print.
- Expected result: Within 1 s the buffer is all zeros, and no table or log holds the numbers.
- Automation: Unit, Integration

### Forum

### TC-040: Each lesson has its own forum

- Verifies: REQ-20, UC-02
- Preconditions: `S1` is in course A.
- Steps: 1. Post a message in `L1`. 2. Read the messages of `L2`.
- Input data: A short text.
- Expected result: The message appears in `L1` only.
- Automation: Integration

### TC-041: List the forums by lecture number

- Verifies: REQ-21, UC-02
- Preconditions: Lessons with lecture numbers 3, 1 and 2, and a topic only on number 1.
- Steps: 1. Open the list of forums.
- Input data: None.
- Expected result: The order is 1, 2, 3. Number 1 shows the course, the number and the topic, and the others show the course and the number.
- Automation: Browser

### TC-042: The teacher enters the topic

- Verifies: REQ-22, UC-08
- Preconditions: `L1` has no topic.
- Steps: 1. `T1` saves a topic. 2. `S1` tries to save one.
- Input data: A topic.
- Expected result: The title shows the topic, and `S1` is refused.
- Automation: Integration

### TC-043: A forum never closes

- Verifies: REQ-23, UC-02
- Preconditions: `L2` ended long ago and has messages.
- Steps: 1. Read its messages. 2. Post a new one.
- Input data: A short text.
- Expected result: All the old messages are there, and the new one is saved.
- Automation: Integration

### TC-044: A new message appears with no reload

- Verifies: REQ-24, UC-02
- Preconditions: `S1`, `S2` and `T1` have the forum of `L1` open.
- Steps: 1. `S1` posts a message.
- Input data: A short text.
- Expected result: It appears for `S2` and `T1` within 2 s, with no reload.
- Automation: Browser

### TC-045: Write a message and a reply

- Verifies: REQ-25, UC-02
- Preconditions: `S1` and `S2` are in `L1`, and `S51` is not linked to it.
- Steps: 1. `S1` posts a message. 2. `S2` replies to it. 3. `S51` tries to post.
- Input data: Short texts.
- Expected result: The reply appears under the message, and `S51` is refused.
- Automation: Browser, Integration

### TC-046: A hidden name stays hidden from the class

- Verifies: REQ-26, UC-02
- Preconditions: `S1` is in the forum of `L1`.
- Steps: 1. `S1` posts and hides the name. 2. As `S2`, read the message and its writer. 3. As `T1`, read the writer.
- Input data: A short text.
- Expected result: `S2` gets an empty name and 0 rows of the writer, and `T1` gets `S1`.
- Automation: Integration

### TC-047: Messages are text, and links work

- Verifies: REQ-27, UC-02
- Preconditions: `S1` is in the forum of `L1`.
- Steps: 1. Post the text.
- Input data: `<img src=x onerror=alert(1)> https://example.com`
- Expected result: The tag appears as text, no script runs, and only the address is a link.
- Automation: Unit, Browser

### TC-048: Nobody can edit a message

- Verifies: REQ-28, UC-02
- Preconditions: `S1` has a message.
- Steps: 1. `S1` tries to update it. 2. `T1` tries to update it.
- Input data: A new text.
- Expected result: Both are refused, and the text does not change.
- Automation: Integration

### TC-049: Only the teacher deletes a message

- Verifies: REQ-29, UC-02
- Preconditions: `S1` has a message with a reply, and `S2` has the forum open.
- Steps: 1. `S1` tries to delete it. 2. `T1` deletes it.
- Input data: None.
- Expected result: `S1` is refused. After `T1`, the text and the name are empty for everyone, the reply stays and the open page updates.
- Automation: Integration, Browser

### TC-050: Write in the expanded window

- Verifies: REQ-70, UC-02
- Preconditions: A phone profile, with the forum of `L1` open.
- Steps: 1. Press expand. 2. Write a message.
- Input data: A short text.
- Expected result: The window fills the screen, the message is saved, and a poll appears in it as one line.
- Automation: Browser

### TC-051: A message with no network stays in the box

- Verifies: REQ-25, UC-02
- Preconditions: `S1` is in the forum of `L1`.
- Steps: 1. Cut the network and send. 2. Restore the network and send again.
- Input data: A short text.
- Expected result: The first send fails and the text stays in the box. The second saves the message exactly once.
- Automation: Browser
