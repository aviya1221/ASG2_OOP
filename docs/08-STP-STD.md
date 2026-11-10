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
| EDD-Attendance | `FaceEngine` | `findFaces`, `makePrint` | A prepared photo gives the known faces, and 128 numbers of length 1 | TC-010, TC-011, TC-014 |
| EDD-Attendance | `FaceStore` | `save`, `load` | What is saved comes back unchanged | TC-010 |
| EDD-Attendance | `AttendanceResponder` | `respondToOpenRounds` | One response per open round, and none after opting out | TC-012, TC-017 |
| EDD-Attendance | `AttendanceSheet` | `load`, `download` | The columns, and every cell as text | TC-028 |
| EDD-Attendance | `AttendanceRoutes` | `registerFace`, `startRound`, `respond`, `subscribe` | A wrong role, a wrong face-print and a closed round get the right error | TC-013, TC-015, TC-100 |
| EDD-Attendance | `AttendanceService` | `startRound`, `respond`, `registerFace` | The order of the decisions, one comparison per student, and the face-print overwritten | TC-018, TC-022, TC-029 |
| EDD-Attendance | `FaceMatcher` | `best` | The highest score across all the photos of the round | TC-018 |
| EDD-Attendance | `AttendanceRules` | `decide` | Every branch, and the threshold itself | TC-018 |
| EDD-Attendance | `ClassFaceCache` | `get`, `put` | Returns nothing after the end of the hour | TC-100 |
| EDD-Attendance | `AttendanceRepository` | `recordMatch`, `saveRound`, `findHash` | Two students on one face, also at the same moment | TC-019, TC-020 |
| EDD-Attendance | `NotificationService` | `subscribe`, `notifyCourse` | Only the course, and an expired subscription is removed | TC-016 |
| EDD-Forum | `ForumApi` | `post`, `remove`, `setTopic`, `watch` | Calls the right function, and reloads after a lost connection | TC-042, TC-044, TC-049 |
| EDD-Forum | `ForumTab` | `open`, `send` | The text stays in the box on failure | TC-051 |
| EDD-Forum | `ConversationWindow` | `open`, `close` | Fills a phone screen, and the user can write | TC-050 |
| EDD-Forum | `MessageLinks` | `split` | Addresses become links, and HTML stays text | TC-047 |
| EDD-Polls | `SurveyApi` | `publishPoll`, `saveForm`, `answer`, `close`, `loadAnswers`, `watch` | Sends the right data, and reports a refusal | TC-060, TC-062, TC-067 |
| EDD-Polls | `PollCard` | `choose` | Shows the first answer after a refusal | TC-063 |
| EDD-Polls | `ResultsChart` | `show` | The bars follow the totals | TC-065 |
| EDD-Polls | `FormBuilder` | `addQuestion`, `save` | All four types of question | TC-070, TC-071 |
| EDD-Polls | `FormWindow` | `open`, `submit`, `missingAnswers` | Finds every unanswered question | TC-071, TC-072 |
| EDD-LessonSummary | `SummaryPage` | `open`, `saveEdit` | Each status, and a failure after 15 minutes | TC-080, TC-087, TC-102 |
| EDD-LessonSummary | `SummaryRoutes` | `create` | 202 before the AI service answers, and the refusals | TC-080, TC-082 |
| EDD-LessonSummary | `SummaryService` | `start`, `run` | The status at each stage, and deleting on failure | TC-088, TC-102 |
| EDD-LessonSummary | `SummaryGenerator` | `generate` | The order of the requests, 300 words and the sound fallback | TC-083, TC-084, TC-085, TC-086 |
| EDD-LessonSummary | `SoundExtractor` | `extract` | The sound track of a short clip | TC-084 |
| EDD-LessonSummary | `SummaryRepository` | `markStarted`, `saveReady`, `markFailed`, `setTopicIfEmpty` | Keeps an existing topic | TC-089, TC-102 |
| EDD-LessonSummary | `LlmClient`, `GeminiLlmClient`, `FakeLlmClient` | `generateJson`, `uploadFile`, `deleteFile` | The contract, the errors and the upload, in the existing tests of the server | TC-083 |
| EDD-HomeworkReview | `HomeworkTab` | `publish`, `check` | Publishes a homework, sends a solution and opens the report | TC-130, TC-132 |
| EDD-HomeworkReview | `ReportView` | `show` | Every section, and the notice of unanswered sections | TC-133, TC-134 |
| EDD-HomeworkReview | `ClassChart` | `show`, `places` | Equal scores share a place, and the filter | TC-137 |
| EDD-HomeworkReview | `HomeworkRoutes` | `publish`, `check` | A wrong role, a file that is not a PDF and a file that is too large | TC-130, TC-139 |
| EDD-HomeworkReview | `HomeworkService` | `publish`, `check` | Three checks, a failure that does not count, and the solution dropped | TC-136, TC-139 |
| EDD-HomeworkReview | `GuideGenerator` | `generate` | One request per homework, with an answer of the right shape | TC-131 |
| EDD-HomeworkReview | `SolutionReviewer` | `review` | Lifting 0 to 1, another seed after a rejected answer, and Arabic letters | TC-134 |
| EDD-HomeworkReview | `ScoreCalculator` | `questionScores`, `overall` | Plain averages, rounding, and at least 1 | TC-135 |
| EDD-HomeworkReview | `HomeworkRepository` | `saveHomework`, `findGuide`, `countChecks`, `saveCheck` | Counts only checks that were saved | TC-136 |
| Domain model | `User`, `Student`, `Teacher`, `Admin`, `Course`, `Lesson`, `FaceRegistration`, `AttendanceRound`, `ClassFace`, `AttendanceResult`, `SeatRequest`, `ForumMessage`, `Survey`, `Question`, `Answer`, `LessonSummary`, `Homework`, `ReviewGuide`, `HomeworkCheck`, `PushSubscription` | Rows in the database | Keys and access rules | TC-003, TC-004, TC-046, TC-063 |

### A.4 Approach and tools

Everything that can run without a real phone or a limited service is automated. Of the 86 test cases in Part B, 77 run automatically on every push, 2 are load scripts that run before each release, and 7 are manual.

- **On every push:** GitHub Actions runs the type check and then the unit, integration and browser tests. A failed run is fixed before new work starts.
- **One ID from requirement to report:** the name of each automated test starts with its test case ID, for example `TC-018`. A script reads the test reports and writes Passed or Failed into the Status column of the traceability matrix.
- **Fakes:** `FakeLlmClient` replaces the AI service, so automated runs use none of its daily limit, and a fake sender replaces Web Push.
- **Time:** unit tests use a controlled clock, and integration tests create rounds and lessons with times in the past instead of waiting.
- **Camera:** browser tests give the page prepared photos in place of the camera.
- **Load:** the spike scripts in [app/spikes/backend-realtime/](../app/spikes/backend-realtime/) and [app/spikes/hosting/](../app/spikes/hosting/) become repeatable load tests. They run only before a release, because they use the free quotas.

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

**Schedule:** unit tests are written with their class, integration tests with each database change, and browser tests when a feature works end to end. Load and manual tests run before each release. A feature is not done until its tests pass.

**Roles:** the development team owns the tests and runs the manual ones, and the AI assistant writes the first version of the test code (ADR-8).

| Risk | Mitigation |
|------|------------|
| WebKit in Playwright behaves differently from Safari on an iPhone | A manual run on a real iPhone before each release (TC-114) |
| Live updates make browser tests unstable | Tests wait for the result on the screen rather than for a fixed time, with one retry on the push run |
| Load tests use up the free quotas | They run only before a release, never on a push |
| A fake hides a real difference in the AI service | One real run before each release (TC-113) |

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
- Input data: Number 101, a name, teacher `T1`, weekly hours, a first date, 13 weeks and 3 students.
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

### TC-006: A first sign-in works only for someone on the list, and only once

- Verifies: REQ-01, UC-08
- Preconditions: One person is on the list with no account, and another is not on the list.
- Steps: 1. The first person chooses a password. 2. The first person chooses a password again. 3. The second person chooses a password.
- Input data: Two ID numbers and a password.
- Expected result: The account is created and linked to the person. Steps 2 and 3 are refused.
- Automation: Integration

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

### Polls and forms

### TC-060: Publish a poll only during the lesson

- Verifies: REQ-30, UC-03
- Preconditions: `T1` is signed in.
- Steps: 1. Publish a poll in `L1`. 2. Publish a poll in `L2`, which has ended. 3. Publish a poll with 1 option.
- Input data: A question with 2 options.
- Expected result: Accepted, refused, refused.
- Automation: Integration

### TC-061: Show a poll to the students of the lesson

- Verifies: REQ-31, UC-03
- Preconditions: `S1` and `S51` are signed in.
- Steps: 1. `T1` publishes a poll in `L1`.
- Input data: A question with 2 options.
- Expected result: `S1` sees it in the forum with no reload, and `S51` cannot reach it.
- Automation: Browser

### TC-062: Accept an answer only while open

- Verifies: REQ-32, REQ-64, UC-03
- Preconditions: An open and a closed survey of each kind.
- Steps: 1. `S1` answers each of them.
- Input data: A valid answer.
- Expected result: The open ones are saved, and the closed ones are refused.
- Automation: Integration

### TC-063: Refuse a second answer

- Verifies: REQ-33, REQ-65, UC-03
- Preconditions: A poll and a form with `allow_change` off, and `S1` has answered both.
- Steps: 1. `S1` answers each again.
- Input data: Another answer.
- Expected result: Both are refused, and the first answers stay.
- Automation: Integration

### TC-064: An allowed second answer replaces the first

- Verifies: REQ-34, REQ-66, UC-03
- Preconditions: A poll and a form with `allow_change` on, and `S1` chose option A.
- Steps: 1. `S1` answers with option B.
- Input data: Option B.
- Expected result: One answer remains, with B. `poll_totals` shows A at 0 and B at 1.
- Automation: Integration

### TC-065: The chart updates for everyone

- Verifies: REQ-35, UC-03
- Preconditions: `T1` and `S1` have an open poll on screen.
- Steps: 1. `S2`, `S3` and `S4` answer.
- Input data: One option each.
- Expected result: The chart shows 3 answers on both screens within 2 s, with no reload.
- Automation: Browser

### TC-066: Only the teacher sees who answered a poll

- Verifies: REQ-36, UC-03
- Preconditions: `S1` and `S2` answered the poll.
- Steps: 1. As `S2`, read `answers` and `poll_totals`. 2. As `T1`, read `answers`.
- Input data: None.
- Expected result: `S2` gets only the answer of `S2` and the totals, and `T1` gets both answers.
- Automation: Integration

### TC-067: The teacher closes a poll or a form

- Verifies: REQ-37, REQ-68, UC-03
- Preconditions: An open poll and an open form.
- Steps: 1. `S1` tries to close them. 2. `T1` closes them.
- Input data: None.
- Expected result: `S1` is refused, and after `T1` both are closed.
- Automation: Integration

### TC-068: A poll closes at the end of the lesson

- Verifies: REQ-38, UC-03
- Preconditions: An open poll and an open form in a lesson that has just ended.
- Steps: 1. Run the database job.
- Input data: None.
- Expected result: The poll is closed, and the form stays open.
- Automation: Integration

### TC-069: A poll or form stays in the forum

- Verifies: REQ-39, REQ-69, UC-03
- Preconditions: A closed poll and a closed form in `L1`.
- Steps: 1. Reload the forum.
- Input data: None.
- Expected result: Both are in their place, and the poll shows its results.
- Automation: Browser

### TC-070: Build a form and publish it in the forum

- Verifies: REQ-60, REQ-62, UC-03
- Preconditions: `T1` is signed in, and a future lesson exists.
- Steps: 1. Build a form with one question of each type. 2. Save it before the lesson. 3. Publish it in the forum of that lesson.
- Input data: Four questions.
- Expected result: The draft is visible only to `T1`, and the published form appears in the forum.
- Automation: Browser

### TC-071: Four types of question

- Verifies: REQ-61, UC-03
- Preconditions: `FormBuilder` and `FormWindow`.
- Steps: 1. Build and answer one question of each type.
- Input data: Single choice, multiple choice, rating and free text.
- Expected result: Each type shows its own control, and each answer is saved in its own form.
- Automation: Unit

### TC-072: Answer a form in a window over the forum

- Verifies: REQ-63, UC-03
- Preconditions: A published form, and `S1` is in the forum.
- Steps: 1. Open the form. 2. Submit with one question unanswered. 3. Answer it and submit.
- Input data: Answers to all the questions but one.
- Expected result: The form opens over the forum. The first submit marks the question and sends nothing, and the second saves the answers.
- Automation: Browser

### TC-073: Only the teacher sees the answers of a form

- Verifies: REQ-67, UC-03
- Preconditions: `S1` answered a form.
- Steps: 1. As `S2`, read the answers of `S1`. 2. As `T1`, read them.
- Input data: None.
- Expected result: `S2` gets 0 rows, and `T1` gets the answers with who gave them.
- Automation: Integration

### Lesson summary

### TC-080: The summary page opens only after the lesson and an upload

- Verifies: REQ-40, REQ-41, UC-04
- Preconditions: `L1` is in progress, and `L2` has ended with no summary.
- Steps: 1. Press the summary button in each forum. 2. `T1` uploads a recording for `L1`. 3. `T1` uploads a recording for `L2` and presses the button once it is ready.
- Input data: A small video file.
- Expected result: The button is in both forums and the page says it is not ready. The upload for `L1` is refused with `lesson_not_ended`, and after the upload for `L2` the page opens.
- Automation: Browser, Integration

### TC-081: Each upload creates a new summary

- Verifies: REQ-42, UC-04
- Preconditions: `L2` has a ready summary.
- Steps: 1. `T1` uploads a new recording, with a fake AI service that waits. 2. Read the summary. 3. Let the fake answer.
- Input data: A small video file.
- Expected result: During the wait the old text stays and the status is `in_progress`. At the end the new text replaces it.
- Automation: Integration

### TC-082: The server answers before calling the AI service

- Verifies: REQ-42, UC-04
- Preconditions: A fake AI service that never answers.
- Steps: 1. Call `POST /summaries`.
- Input data: A small video file.
- Expected result: 202 arrives while the fake has not answered, and the status is `in_progress`.
- Automation: Unit

### TC-083: Make the summary from the full video

- Verifies: REQ-43, UC-04
- Preconditions: `FakeLlmClient`.
- Steps: 1. Generate a summary.
- Input data: A small video file.
- Expected result: The first request carries the video file and asks for a transcript and the board list.
- Automation: Unit

### TC-084: Fall back to sound alone

- Verifies: REQ-44, UC-04
- Preconditions: `FakeLlmClient` that answers that the file is too large, and then one that answers that a usage limit was reached.
- Steps: 1. Generate a summary with each.
- Input data: A short video with sound.
- Expected result: `SoundExtractor` runs, the next request carries only the sound, and the board list is empty.
- Automation: Unit

### TC-085: Show four parts, with up to 300 words

- Verifies: REQ-45, UC-04
- Preconditions: `FakeLlmClient`.
- Steps: 1. Generate with an overview of 300 words. 2. Generate with an overview of 301 words. 3. Open the page of the first.
- Input data: Overviews of 300 and 301 words.
- Expected result: 300 is accepted and 301 is refused. The page shows the four parts.
- Automation: Unit, Browser

### TC-086: The review corrects and adds nothing

- Verifies: REQ-46, UC-04
- Preconditions: `FakeLlmClient`.
- Steps: 1. Generate a summary.
- Input data: A second answer with a spelling mistake, and a corrected third answer.
- Expected result: The third request carries the transcript and the board list, and the saved text is the corrected one.
- Automation: Unit

### TC-087: The teacher edits the summary

- Verifies: REQ-47, UC-04
- Preconditions: `L2` has a ready summary.
- Steps: 1. `T1` changes the overview. 2. `S1` tries to change it. 3. `T1` tries to change the status.
- Input data: A new overview.
- Expected result: Saved, refused, refused.
- Automation: Integration

### TC-088: Delete the recording, on success and on failure

- Verifies: REQ-48, UC-04
- Preconditions: A file in the temporary folder.
- Steps: 1. Run a summary that succeeds. 2. Run a summary that fails.
- Input data: A small video file.
- Expected result: Both times the file is gone from the disk, and `deleteFile` was called.
- Automation: Unit

### TC-089: Take the forum topic from the summary

- Verifies: REQ-49, UC-04
- Preconditions: `L2` has no topic, and another lesson has one.
- Steps: 1. Save a summary for each.
- Input data: A summary with a topic.
- Expected result: `L2` takes the topic of the summary, and the other lesson keeps its own.
- Automation: Integration

### State transitions

### TC-100: Every transition of an attendance round

- Verifies: REQ-10, REQ-12, NFR-10, UC-01
- Preconditions: `L1` has no round.
- Steps: 1. `T1` sends the photos. 2. `S1` responds. 3. Set the end of the hour to the past and run the database job. 4. `S2` responds.
- Input data: Generated face-prints.
- Expected result: The round opens and the course is notified. `S1` gets a result. The job is scheduled every minute, and after it 0 rows of the round stay in `class_faces` and `ClassFaceCache` is empty. `S2` is refused with `round_closed`.
- Automation: Integration

### TC-101: Every transition of a poll or form

- Verifies: REQ-30, REQ-37, REQ-38, REQ-60, REQ-62, REQ-68, UC-03
- Preconditions: `L1` is in progress.
- Steps: 1. Save a form, and publish it. 2. Publish a poll. 3. `T1` closes the form. 4. Let the lesson end and run the job. 5. Try to reopen the closed poll.
- Input data: A form and a poll.
- Expected result: Draft and then open. The poll is open. The form is closed. The job closes the poll. Reopening is refused.
- Automation: Integration

### TC-102: Every transition of a lesson summary

- Verifies: REQ-41, REQ-42, REQ-48, UC-04
- Preconditions: `FakeLlmClient`.
- Steps: 1. Upload, and let the fake succeed. 2. Upload, and let the fake fail. 3. Upload, and upload again during the first 15 minutes. 4. Set the start time 16 minutes back, open the page and upload again.
- Input data: A small video file.
- Expected result: In progress and then ready. In progress and then failed. The second upload is refused with `summary_in_progress`. After 16 minutes the page shows a failure, and the upload is accepted.
- Automation: Unit

### Quality requirements

### TC-110: Forum and poll updates reach 50 students within 2 s

- Verifies: NFR-02, UC-02, UC-03
- Preconditions: The deployed product, with the real access rules and 50 signed-in clients.
- Steps: 1. Run the load script at the rates of the Supabase spike.
- Input data: 50 generated users.
- Expected result: 95% of the deliveries arrive within 2 s.
- Automation: Load

### TC-111: 50 attendance responses in one minute

- Verifies: NFR-03, UC-01
- Preconditions: The deployed server, awake, with an open round of 50 faces.
- Steps: 1. Send 50 responses within one minute.
- Input data: 50 generated face-prints.
- Expected result: 95% are answered within 2 s, including saving the result.
- Automation: Load

### TC-112: Find the faces on a phone within 2 minutes per photo

- Verifies: NFR-04, UC-01
- Preconditions: One Android phone and one iPhone.
- Steps: 1. Open the attendance tab. 2. Time finding the faces.
- Input data: A generated photo with 50 faces.
- Expected result: Under 2 minutes per photo on both phones.
- Automation: Manual

### TC-113: Summarise a real 10-minute recording within 5 minutes

- Verifies: NFR-05, REQ-43, REQ-46, UC-04
- Preconditions: The real AI service, with 3 requests left in the daily limit.
- Steps: 1. Upload the recording. 2. Time it until the summary is ready. 3. Read the summary against the recording.
- Input data: A 10-minute recording of a public lecture, kept out of the repository.
- Expected result: Ready within 5 minutes of the end of the upload, with four parts and no invented content.
- Automation: Manual

### TC-114: Work with nothing installed in the supported browsers

- Verifies: NFR-07, UC-01, UC-02
- Preconditions: Automatic: Chromium with a phone profile and WebKit with an iPhone profile. Manual: Chrome on Android and Safari on iPhone, in their last 2 versions.
- Steps: 1. Sign in. 2. Respond to attendance. 3. Post in the forum.
- Input data: The seed.
- Expected result: Every step works with nothing installed.
- Automation: Browser, Manual

### TC-115: The AI service key appears in no response

- Verifies: NFR-08
- Preconditions: The server runs with a marked value as the service key.
- Steps: 1. Make every server call, including those that fail. 2. Search every response and the built client files for the value.
- Input data: A marked key.
- Expected result: The value appears 0 times.
- Automation: Integration

### TC-116: Stay available during a full rehearsal

- Verifies: NFR-11
- Preconditions: A rehearsal of a full lesson on the deployed product.
- Steps: 1. Probe the site and the server once a minute for the whole lesson.
- Input data: None.
- Expected result: At least 99% of the probes succeed.
- Automation: Manual

### TC-117: Fit every screen width

- Verifies: NFR-12
- Preconditions: The seed.
- Steps: 1. Open each screen at each width.
- Input data: 320, 375, 768, 1280 and 1920 px.
- Expected result: No page scrolls sideways, except inside the box of the map of the hall.
- Automation: Browser

### TC-118: Run a whole lesson on real phones

- Verifies: REQ-10, REQ-11, REQ-12, UC-01
- Preconditions: Volunteers in a real hall, each registered on their own phone.
- Steps: 1. The teacher photographs the class. 2. Each volunteer receives the notification and opens the site. 3. The teacher downloads the sheet.
- Input data: The volunteers' own phones. No photo is kept.
- Expected result: A notification arrives on each phone (R20). Each volunteer who is present gets a result, and the sheet matches who was there.
- Automation: Manual

### Homework review

### TC-130: Publish a homework PDF

- Verifies: REQ-50, UC-05
- Preconditions: `T1` is signed in, in `L1`.
- Steps: 1. Publish a homework PDF in the homework tab. 2. `S1` opens the tab. 3. `S51` tries to open it.
- Input data: A made-up homework PDF of 2 pages.
- Expected result: The homework appears for `S1` with its PDF, and `S51` cannot reach it.
- Automation: Browser, Integration

### TC-131: Make the review guide once and use it unchanged

- Verifies: REQ-51, UC-05
- Preconditions: A fake AI service that counts its requests.
- Steps: 1. Publish a homework. 2. Check 2 solutions. 3. As `S1`, read the guide.
- Input data: Made-up PDFs.
- Expected result: The guide is made once, both checks send the same guide, and `S1` gets 0 rows.
- Automation: Unit, Integration

### TC-132: Upload a solution from the button next to the homework

- Verifies: REQ-52, UC-05
- Preconditions: A published homework, and `S1` has made no check.
- Steps: 1. Press the check button next to the homework. 2. Upload the solution.
- Input data: A made-up solution PDF.
- Expected result: The report opens on the same page.
- Automation: Browser

### TC-133: Show the report only to the student who asked

- Verifies: REQ-53, UC-05
- Preconditions: A published homework.
- Steps: 1. `S1` checks a solution. 2. As `S2`, read the checks of `S1`.
- Input data: A made-up solution PDF.
- Expected result: `S1` sees, for each section, the score, what meets the requirements, what is missing and a direction. `S2` gets 0 reports.
- Automation: Integration, Browser

### TC-134: Score answered and unanswered sections

- Verifies: REQ-54, UC-05
- Preconditions: `FakeLlmClient`.
- Steps: 1. Check a solution.
- Input data: An answer with one section not answered, and one answered with 0.
- Expected result: The unanswered section gets 0, with a notice at the top of the report, and the answered one is lifted to 1.
- Automation: Unit, Browser

### TC-135: Calculate the question and overall scores

- Verifies: REQ-55, UC-05
- Preconditions: A guide with 2 questions.
- Steps: 1. Calculate the scores.
- Input data: Question 1 with sections of 80 and 61, question 2 with one section of 0, and points in the homework that differ by question.
- Expected result: Question 1 is 70.5, question 2 is 0, and the overall score is 35, whatever points the homework states. An overall score below 1 becomes 1.
- Automation: Unit

### TC-136: Allow up to 3 checks, not counting a failure

- Verifies: REQ-56, UC-05
- Preconditions: A published homework.
- Steps: 1. Make a check that fails for a technical reason. 2. Make 3 checks. 3. Try a fourth.
- Input data: A fake AI service that fails once.
- Expected result: The failed check is not saved. The fourth is refused with `no_checks_left`, and the chart shows the third.
- Automation: Unit, Integration

### TC-137: Show the class chart with places and a filter

- Verifies: REQ-57, UC-05
- Preconditions: Three students have checks.
- Steps: 1. Open the chart as one of them. 2. Filter by a question, then by a section.
- Input data: Overall scores of 80, 80 and 60.
- Expected result: Places 1, 1 and 3, with the viewing student highlighted, and the filter changes the order.
- Automation: Unit, Browser

### TC-138: Never give the answer in a report

- Verifies: REQ-58, UC-05
- Preconditions: The real AI service and the spike's test set.
- Steps: 1. Check the partial solution, and the solution that asks for the answer, in both subjects.
- Input data: The made-up homework of the spike.
- Expected result: No report holds an item from the list of results and requested ideas.
- Automation: Manual

### TC-139: Delete the solution file within 1 minute

- Verifies: REQ-59, UC-05
- Preconditions: A published homework.
- Steps: 1. Check a solution. 2. Look for the file on the server's disk, in the database and among the files uploaded to the AI service.
- Input data: A made-up solution PDF.
- Expected result: The file was never written to disk or uploaded, and the database keeps only the scores, the report, the check number and the time.
- Automation: Unit, Integration

### TC-140: Raise no section by more than 10 points with hidden instructions

- Verifies: NFR-01, UC-05
- Preconditions: The real AI service.
- Steps: 1. Review each file 3 times, with different seeds.
- Input data: The partial solution, with and without hidden and visible instructions in 4 languages.
- Expected result: The median of every section rises by at most 10 points.
- Automation: Manual

### TC-141: Report on 20 pages within 3 minutes

- Verifies: NFR-06, UC-05
- Preconditions: The real AI service.
- Steps: 1. Check the solution.
- Input data: A made-up solution of 20 pages.
- Expected result: The report arrives within 3 minutes.
- Automation: Manual
