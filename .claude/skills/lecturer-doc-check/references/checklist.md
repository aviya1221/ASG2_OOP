# Meaning checklist per document

These are the checks the script cannot make. They are derived from the lecturer's definitions (lecture 02a "Software Engineering Documents", lecture 03a "Software Project Management") and the assignment brief. The guideline block at the top of each file is the full source. If this list and a guideline block ever disagree, the guideline block wins.

## Contents

- [Every document](#every-document)
- [README](#readme)
- [Step 2: Tools report](#step-2-tools-report)
- [Step 3: SoW](#step-3-sow)
- [Step 4: SRS](#step-4-srs)
- [Step 5: Use cases](#step-5-use-cases)
- [Step 6: SDD](#step-6-sdd)
- [Step 7: EDD and API docs](#step-7-edd-and-api-docs)
- [Step 8: STP / STD](#step-8-stp--std)
- [Step 9: App README](#step-9-app-readme)
- [Step 10: Demo plan](#step-10-demo-plan)
- [Step 11: Conclusion](#step-11-conclusion)
- [Across documents](#across-documents)
- [TODO.md](#todomd)

## Every document

The lecturer's three rules (02a slide 2):

- **Written for its reader.** The SRS is for developers, testers and the client, so it avoids implementation jargon. The EDD is for implementers, so it is precise about classes and flows.
- **Traced** to the documents before and after it, using the shared IDs.
- **Kept current.** A change in one document that makes another one wrong is a contradiction until both are updated.

Assignment brief limits that apply everywhere:

- No integration with Moodle, Zoom or personal-information systems.
- Design only what can be implemented.
- KISS: students use a simple smartphone web app.
- The system must work in this class, in a real 10-minute demo.

A document that plans a Moodle integration, or depends on real student personal data, contradicts the brief.

## README

(02a slide 20)

- The first line under the title says what the app is, in one sentence.
- The 8 sections are present: what it is, quick start, usage example, configuration and environment, how to run the tests, project structure, how to contribute, license and contact.
- Step 1 of the assignment also puts the problem definition and the scope here.
- Quick start uses real commands that work once the app exists. No secrets or API keys anywhere.

## Step 2: Tools report

(Assignment step 2; PDR package, 03a slide 6; ADRs, 02a slide 21)

- **Every tool that is suggested has a real hands-on spike with evidence** (what we tried, result, screenshot). The assignment says "make sure to test (in real life) with any suggested tool". A tool recommended without a spike is a contradiction, not a warning.
- Alternatives are listed, with the reason each was rejected.
- Every major choice has an ADR: context, decision, alternatives rejected, consequences.
- Risky choices (external LLM or video APIs) have a mitigation, such as a fallback alternative or a mocked API behind an interface.
- The chosen tools are consistent with the SDD rationale and the app.

## Step 3: SoW

(02a slides 3-4; 03a slides 11-14)

- Objectives state the business problem, goals and background, not features.
- **Deliverables are concrete** and each one can be accepted or rejected. "A working system" is the lecturer's example of a vague deliverable.
- Every deliverable has an acceptance criterion that someone can actually judge, otherwise "delivery turns into an argument".
- **The out-of-scope list is explicit.** The brief's exclusions (Moodle, Zoom, personal info) belong there, and so do the features that are design-only.
- Milestones have dates, up to the demo.
- Assumptions, constraints and dependencies are listed.
- Roles say who does what (RACI).
- The risk register has a mitigation for each risk.
- Nothing promised in the SoW is missing from the SRS, and nothing in the SRS falls outside the SoW scope.

## Step 4: SRS

(02a slides 5-6, 19; 03a slide 5)

- **What, not how.** Requirements describe behaviour and qualities. Technology choices ("uses React", "stores in Firebase") belong in the SDD or EDD. A real constraint is allowed under constraints, for example "runs in a smartphone browser without installing an app".
- Functional requirements read "The system shall...", **one behaviour per ID**. Split "export CSV and email it and log it".
- Non-functional requirements are measurable: number, unit and condition, as in the lecturer's "95% within 0.5 s with 1,000 concurrent users".
- Each requirement is unambiguous, verifiable, complete, consistent (no two requirements conflict), traceable (to a `D-n`) and prioritised.
- **All 5 assignment features are covered.** Attendance plus the spreadsheet is the main feature, so it needs the most complete set of requirements.
- The appendices exist: use cases (a link), a data dictionary and a traceability matrix.
- The requirements match the scope chosen in the SoW.

## Step 5: Use cases

(02a slides 7-11)

- Names are verb phrases ("Mark attendance", not "Attendance").
- The actor is who starts the use case: a person or another system.
- Preconditions are things that must be true before it starts.
- The main success flow has numbered steps, alternating between actor and system.
- **Alternative flows include errors** and are numbered from the step they leave (`2a.`, `3a.`). A main feature with no error branches is incomplete.
- Postconditions state what is guaranteed at the end.
- Each use case lists the `REQ-nn` it covers, and every in-scope requirement is covered by some use case.
- Use-case diagram:
  - `<<include>>` means the inner use case is always performed.
  - `<<extend>>` means it is optional, under a condition.
  - Swapping them is a contradiction.
  - Actors sit outside the system boundary.
- An activity diagram matches its use-case text: the same steps and the same branches.
- User stories are one sentence ("As a ... I want ... so that ...") plus Given / When / Then acceptance criteria.

## Step 6: SDD

(02a slides 9, 12-13; 03a slide 6)

- **Whole system, "what are the parts?"** Classes with attributes, algorithms, schemas and sequence diagrams belong in the EDD. At most, a high-level class view is allowed here.
- The 6 contents are present: context, decomposition, interfaces, data, deployment, rationale.
- Diagrams are component and deployment diagrams, not sequence diagrams.
- The rationale gives alternatives and why this design was chosen, consistent with the ADRs.
- **Every requirement is allocated to a component** (the PDR exit criterion).
- Sections are numbered, so the traceability matrix can cite `SDD §n`.

## Step 7: EDD and API docs

(02a slides 9, 13-17; 03a slide 7)

- **One component or feature per EDD file**, named `EDD-<Name>`, with the 8 sections.
- The EDD matches its SDD component: the same name, the same responsibility, no new responsibilities that the SDD doesn't know about.
- Class diagram notation:
  - `+` public / `-` private
  - Hollow triangle = inheritance ("is a")
  - Filled diamond = composition (same lifetime)
  - Multiplicities on associations
  - Using composition where the parts outlive the whole is wrong.
- Sequence diagrams:
  - The participants are objects or classes from the class diagram.
  - Solid arrows are synchronous calls; dashed arrows are returns.
  - The flow matches the use case it implements.
- Objects with a lifecycle (session, poll) have a state machine: states, then transitions labelled "event [guard] / action".
- Error handling and edge cases cover the use cases' alternative flows.
- API docs have: overview and auth, endpoint reference, responses and errors (status codes), real examples, limits.

## Step 8: STP / STD

(02a slides 18-19; assignment step 8; 03a slide 7)

- STP: scope and items under test, levels (unit, integration, system, acceptance), approach and tools, environment and test data, entry and exit criteria, schedule, roles and risks.
- **It addresses the classes from step 7** (assignment). Every class in the EDDs appears in the unit-test table. A class with no planned test is a gap.
- STD: every test case has an ID and title, the requirement it verifies, preconditions, steps, input data and an expected result (plus Pass / Fail, tester and date once run).
- The expected result is concrete and checkable ("check-in recorded with timestamp", not "works").
- State-machine transitions have tests.
- Test data uses fake students, never real personal data.
- The traceability matrix "Test cases" column matches the STD. Requirements in demo scope have no Gap.

## Step 9: App README

(02a slides 20-21; 03a slides 8, 16)

- The definition of done is respected: a feature is not done until its docs and tests are updated.
- Reused code is listed with its source and license.
- The README quick start matches how the app actually runs.

## Step 10: Demo plan

(03a slides 15-16; assignment: 10 minutes, real demo in class)

- The total time is 10 minutes or less, with time left for Q&A.
- The structure is: context (up to about 2 min), live scenario, evidence, lessons, Q&A.
- **The golden rule:** every minute maps to a requirement or a result. The live part walks real use cases end to end.
- The evidence shows results against requirements and tests.
- Preparation includes a frozen tagged release, two timed rehearsals, seeded demo data, a backup video and a plan B for network and hardware.
- Known issues are stated, not hidden.
- No live coding, last-minute merges or "show every feature".

## Step 11: Conclusion

(03a slide 17; assignment step 11)

- It is short (the assignment asks for "a short description of the results").
- Plan vs. actual covers scope, time and effort, against the SoW deliverables and acceptance criteria.
- The retrospective lists what to keep, stop and start.
- The handover is complete: repository, README, documents and deployment notes are up to date.

## Across documents

- **Names are consistent.** The same actor, component and class names are used in every document.
- **Traceability holds in both directions:** `D-n` (SoW), then `REQ-nn` (SRS), then `UC-nn` (use cases), then `SDD §n`, then `EDD-<Name>`, then `TC-nnn` (STD). Check the matrix in the SRS appendix.
- **Scope is consistent.** A feature marked design-only in the README or SoW should not appear as demo-ready in the demo plan, and the other way round.
- **Diagrams sit in the right document** (02a slide 9):
  - Use case and activity diagrams: SRS / use cases
  - Class diagrams: SDD (high level) and EDD
  - Component and deployment diagrams: SDD
  - Sequence diagrams: EDD and API docs
  - State machines: EDD and STD

## TODO.md

- A ticked checkbox whose section is still empty contradicts the commit rules ("tick the checkbox in the same commit that finishes the task").
- New work that the lecturer's definition requires but TODO.md lacks should be added as a task.
