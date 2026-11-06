# Ex2: Vibe Coding & Deep Designing: Web-based Teaching Tool

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

_TODO: one sentence that says what this app is._

Introduction to Software Engineering (OOP, OOD), Assignment 2.

**Goal:** Design an end-to-end web application for teaching in class.
The assignment is a design challenge first; the implementation is secondary, and reusing existing code is preferred.

## Problem statement

Today's online teaching tools don't work well enough. We need simpler, LLM-ready tools that support real learning in class.

## Features (from the assignment)

1. **Attendance (main feature):** students mark their attendance in class automatically. The lecturer gets an online/offline spreadsheet with the details.
2. **Comments & suggestions:** students can comment and raise suggestions, in real time or offline.
3. **Polls:** lecturers can create quick (KISS) on-the-spot polls about the current material.
4. **Video summary:** lecturers can get an ML summary of their recorded class video (Zoom, Meet, Google Classroom).
5. **Homework review:** students and teachers can get a deep LLM review of their homework, including comparisons to other students' work.

## Requirements

1. It must work in this class, shown in a real demo.
2. KISS: students use a simple smartphone app (a web-based application).

## Guidelines

- No integration with Moodle, Zoom or personal information systems is needed.
- Design only what can actually be implemented.
- No need to write everything from scratch, but we must be able to build a web app and demo it in class (10 minutes).

## Scope

_TODO (step 1): define what is in scope and out of scope, and which features are implemented in the demo versus design-only._

## Team

_TODO: names and GitHub usernames._

## Quick start

_TODO (step 9): how to install and run the app, and the public URL._

## Usage example

_TODO (step 9): a short walkthrough, e.g. the lecturer opens a session and a student checks in from a phone._

## Configuration and environment

_TODO (step 9): environment variables, API keys and how to set them (never commit secrets)._

## Running the tests

_TODO (step 9): the command that runs the tests._

## Repository structure

| Step | Deliverable | Location |
|------|-------------|----------|
| 1 | Problem and scope | `README.md` (this file) |
| 2 | Technical tools report | [docs/02-tools-report.md](docs/02-tools-report.md) |
| 3 | Statement of Work (SoW) | [docs/03-SoW.md](docs/03-SoW.md) |
| 4 | Software Requirements Spec (SRS) | [docs/04-SRS.md](docs/04-SRS.md) |
| 5 | Use cases / client stories | [docs/05-use-cases.md](docs/05-use-cases.md) |
| 6 | Main software components (SDD) | [docs/06-SDD.md](docs/06-SDD.md) |
| 7 | Class and sequence diagrams (EDD) | [docs/07-EDD/](docs/07-EDD/) |
| 8 | Testing strategy (STP / STD) | [docs/08-STP-STD.md](docs/08-STP-STD.md) |
| 9 | Demo web application | [app/](app/) |
| 10 | Demo in class | [docs/10-demo-plan.md](docs/10-demo-plan.md) |
| 11 | Conclusion | [docs/11-conclusion.md](docs/11-conclusion.md) |

Images and screenshots go in [docs/assets/](docs/assets/).
How the documents connect: [docs/README.md](docs/README.md).

## How to contribute

See the commit rules in [TODO.md](TODO.md#commit-rules): small commits, one task per commit, and every team member commits from their own account.

## Project progress

See [TODO.md](TODO.md) for the roadmap, which follows the assignment's 11 steps.

## License and contact

_TODO: license (e.g. MIT) and the team's contact details._
