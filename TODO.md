# TODO: Ex2 roadmap

This roadmap follows the 11 "To Do" steps from the assignment, in order.
Each step is split into small tasks. **Every checkbox = at least one commit.**

## Commit rules

The commit history is part of the grade, so commit small and often.

- One task per commit. Don't bundle a whole document into a single commit; commit it section by section.
- Tick the checkbox (`[ ]` → `[x]`) in the same commit that finishes the task.
- Every team member commits from their own GitHub account, so contributions show in the history.
- Pull before you start working (`git pull`) to avoid conflicts.
- Message format: `<type>(<area>): <what was done>`
  - Types: `docs`, `feat`, `test`, `fix`, `refactor`, `chore`
  - Areas: `readme`, `tools`, `sow`, `srs`, `usecases`, `components`, `design`, `testing`, `app`, `demo`, `conclusion`
  - Examples:
    - `docs(srs): add functional requirements for attendance`
    - `docs(design): add sequence diagram for poll voting`
    - `feat(app): add QR check-in page for students`
    - `test(app): add unit tests for AttendanceService`

---

## Step 1: Repository, problem and scope (README)

- [x] Create the GitHub repository
- [x] Add an initial README with the problem statement and features
- [x] Add this TODO roadmap
- [x] Add the folder structure for all deliverables (`docs/`, `app/`)
- [ ] Add team members (names + GitHub usernames) to the README
- [ ] Define the scope: in scope / out of scope (no Moodle, Zoom or personal-info integration)
- [ ] Decide which of the 5 features are implemented in the demo and which are design-only
- [ ] Add a "Repository structure" section to the README

## Step 2: Technical tools report → [docs/02-tools-report.md](docs/02-tools-report.md)

The lecturer requires that we **actually test** every tool we suggest.

- [ ] Define evaluation criteria (cost / free tier, simplicity, works on smartphones, time to set up)
- [ ] List candidate tools per need:
  - [ ] Frontend / web framework
  - [ ] Backend / BaaS + realtime database
  - [ ] Spreadsheet export (CSV / Excel / Google Sheets)
  - [ ] Attendance check-in method (QR code, session code, location, etc.)
  - [ ] Hosting / deployment (public URL that works from phones)
  - [ ] LLM API (homework review)
  - [ ] Speech-to-text / video summarization (class video summary)
  - [ ] Vibe-coding tools (AI coding assistants, app generators)
- [ ] Hands-on test of each shortlisted tool: what we tried, the result, and a screenshot (one commit per tool)
- [ ] Comparison table
- [ ] Final tool choice with justification

## Step 3: SoW (Statement of Work) → [docs/03-SoW.md](docs/03-SoW.md)

- [ ] Background and objectives
- [ ] Scope of work (in / out)
- [ ] Deliverables list (mapped to the 11 steps)
- [ ] Timeline and milestones (up to the demo date)
- [ ] Roles and responsibilities (who does what)
- [ ] Assumptions, constraints and risks
- [ ] Acceptance criteria

## Step 4: SRS (Software Requirements Specification) → [docs/04-SRS.md](docs/04-SRS.md)

- [ ] Introduction: purpose, scope, definitions, references
- [ ] Overall description: user types (student, lecturer), operating environment (smartphone browser), constraints
- [ ] Functional requirements with IDs (e.g. `FR-ATT-01`), one commit per feature:
  - [ ] F1 Attendance + spreadsheet (main feature)
  - [ ] F2 Comments and suggestions (realtime + offline)
  - [ ] F3 Polls
  - [ ] F4 Class video ML summary
  - [ ] F5 LLM homework review and comparison
- [ ] Non-functional requirements: usability (KISS), performance (whole class at once), security and privacy, availability
- [ ] Data requirements (main entities, spreadsheet columns)

## Step 5: Main use cases (client stories) → [docs/05-use-cases.md](docs/05-use-cases.md)

- [ ] Actors list
- [ ] Use-case diagram
- [ ] UC-1: Student marks attendance
- [ ] UC-2: Lecturer opens a class session and exports the attendance spreadsheet
- [ ] UC-3: Student posts a comment / suggestion
- [ ] UC-4: Lecturer creates a poll, students vote, results are shown
- [ ] UC-5: Lecturer uploads a class video and gets a summary
- [ ] UC-6: Student / teacher requests a homework review
- [ ] User stories ("As a ... I want ... so that ...") with acceptance criteria

## Step 6: Main software components → [docs/06-components.md](docs/06-components.md)

- [ ] High-level architecture diagram (client / server / database / external APIs)
- [ ] Component list and responsibilities (sessions, attendance, comments, polls, export, video summary, homework review)
- [ ] Interfaces between components (API endpoints / realtime events)
- [ ] Deployment diagram

## Step 7: Class diagrams and sequence diagrams → [docs/07-design/](docs/07-design/)

Use Mermaid or PlantUML so the diagrams live in the repo as text (easy to review and commit).

- [ ] Class diagram: domain model (e.g. User, Student, Lecturer, Course, ClassSession, AttendanceRecord, Comment, Poll, Vote, VideoSummary, Homework, Review)
- [ ] Class diagram: services / controllers layer
- [ ] Sequence diagram: student marks attendance
- [ ] Sequence diagram: lecturer exports the spreadsheet
- [ ] Sequence diagram: comment in real time
- [ ] Sequence diagram: create poll + vote
- [ ] Sequence diagram: video summary
- [ ] Sequence diagram: homework review

## Step 8: Testing strategy → [docs/08-testing-strategy.md](docs/08-testing-strategy.md)

The testing strategy must address the classes from step 7.

- [ ] Test levels: unit, integration, end-to-end, manual demo rehearsal
- [ ] Unit-test plan per class from step 7 (table: class → methods → test cases)
- [ ] Integration tests (API + database)
- [ ] End-to-end scenario: a full class flow on a smartphone
- [ ] Non-functional tests: many students at once, different mobile browsers
- [ ] Testing tools
- [ ] Traceability table: requirement (SRS) → test

## Step 9: Implement the demo web app (KISS) → [app/](app/)

- [ ] Decide: vibe code vs. find and compose existing code; document the decision, sources and licenses
- [ ] Project scaffold + `.gitignore`
- [ ] Lecturer: create a class session (QR code / session code)
- [ ] Student: join from a phone and mark attendance
- [ ] Prevent duplicate check-ins (one record per student per session)
- [ ] Lecturer: live attendance list
- [ ] Lecturer: export the attendance spreadsheet
- [ ] Comments and suggestions
- [ ] Polls
- [ ] Video summary (if in demo scope)
- [ ] Homework review (if in demo scope)
- [ ] Unit tests for the core classes (per step 8)
- [ ] Deploy to a public URL
- [ ] Add run instructions and the URL to the README

## Step 10: Demo in class (10 minutes) → [docs/10-demo-plan.md](docs/10-demo-plan.md)

- [ ] Minute-by-minute demo script
- [ ] Slide / screen with the QR code and link for the students
- [ ] At least 2 rehearsals on real phones
- [ ] Backup plan (screen recording, fallback if the network fails)
- [ ] After the demo: save the results (attendance count, poll results) without personal student data

## Step 11: Conclusion → [docs/11-conclusion.md](docs/11-conclusion.md)

- [ ] What was achieved vs. planned, per feature
- [ ] Demo results
- [ ] Lessons learned (vibe coding vs. deep design)
- [ ] Future work
- [ ] Final README pass with links to all documents

---

## Open questions for the lecturer

- [ ] Can we get a list of all the students in the class (for the attendance demo)?
