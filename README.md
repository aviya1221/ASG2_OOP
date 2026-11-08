# Web-based Teaching Tool

<!--
LECTURER GUIDELINES: README (lecture 02a, slides 3, 20)
(Hidden on GitHub, visible when editing.)

"README: the front door of the repository."
Answers: How do I install, run, contribute?
Written by: maintainers. Read by: new developers, users.
When: from the first commit.
Cheat sheet: how to install, run and contribute in minutes.

What goes in a README:
1. What it is, in one sentence
2. Quick start: install and run
3. Usage example
4. Configuration and environment
5. How to run the tests
6. Project structure
7. How to contribute
8. License and contact

Lecturer's example:
  # LibraryHub
  Loan and catalogue system for small libraries.
  ## Quick start
  git clone https://github.com/org/libraryhub
  cd libraryhub && docker compose up
  open http://localhost:8080
  ## Tests
  npm test
  ## Docs
  SRS, SDD and API reference: see /docs
  ## License
  MIT

FOR OUR PROJECT
The assignment's step 1 also puts the problem definition and the scope here.
Sections 2-5 are filled in step 9, once the app exists.
-->

A general system for managing in-person lessons, where everything a lesson needs (attendance, polls, comments, video summaries and homework reviews) sits under the lesson and opens from a supporting web app on every student's phone.

**Approach:** design first, and reuse existing open-source code wherever we can.

## Problem statement

In-person lessons run on scattered tools, each with its own login or room code. Teachers need one simple app, ready for AI features, that supports real learning in class.

## Features

1. **Attendance (main feature):** students mark their attendance in class automatically. The lecturer gets an online/offline spreadsheet with the details.
2. **Comments & suggestions:** students can comment and raise suggestions, in real time or offline.
3. **Polls:** lecturers can create quick (KISS) on-the-spot polls about the current material.
4. **Video summary:** lecturers can get an ML summary of their recorded class video (Zoom, Meet, Google Classroom).
5. **Homework review:** students and teachers can get a deep LLM review of their homework, including comparisons to other students' work.

## Product requirements

1. The product is proven in a pilot in a live class, presented in 10 minutes.
2. KISS: students use the app in their phone's browser, with nothing to install.

## Constraints

- No integration with Moodle, Zoom or personal-information systems.
- Design only what can actually be implemented.
- Reuse existing code where possible instead of writing everything from scratch.

## Scope

_TODO: define what is in scope and out of scope, and which features the pilot includes versus design-only._

## Team

_TODO: names and GitHub usernames._

## Quick start

_TODO: how to install and run the app, and the public URL._

## Usage example

_TODO: a short walkthrough, e.g. the lecturer opens a lesson and a student checks in from a phone._

## Configuration and environment

_TODO: environment variables, API keys and how to set them (never commit secrets)._

## Running the tests

_TODO: the command that runs the tests._

## Repository structure

| Document | Location |
|----------|----------|
| Problem and scope | `README.md` (this file) |
| Technical tools report | [docs/02-tools-report.md](docs/02-tools-report.md) |
| Statement of Work (SoW) | [docs/03-SoW.md](docs/03-SoW.md) |
| Software Requirements Spec (SRS) | [docs/04-SRS.md](docs/04-SRS.md) |
| Use cases / client stories | [docs/05-use-cases.md](docs/05-use-cases.md) |
| Main software components (SDD) | [docs/06-SDD.md](docs/06-SDD.md) |
| Class and sequence diagrams (EDD) | [docs/07-EDD/](docs/07-EDD/) |
| Testing strategy (STP / STD) | [docs/08-STP-STD.md](docs/08-STP-STD.md) |
| Web app | [app/](app/) |
| Pilot presentation plan | [docs/10-demo-plan.md](docs/10-demo-plan.md) |
| Project closure | [docs/11-conclusion.md](docs/11-conclusion.md) |

Images and screenshots go in [docs/assets/](docs/assets/).
How the documents connect: [docs/README.md](docs/README.md).

## How to contribute

See the commit rules in [TODO.md](TODO.md#commit-rules): small commits, one task per commit, and every team member commits from their own account.

## Project progress

See [TODO.md](TODO.md) for the roadmap.

## License and contact

_TODO: license (e.g. MIT) and the team's contact details._
