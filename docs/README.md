# Documentation guide

This explains how the documents in this folder fit together. It is based on the lecturer's slides (Boaz Ben-Moshe, Intro2SE):

- **Lecture 02a: Software Engineering Documents** (SOW, SRS, use cases, SDD, EDD, API docs, STP/STD, README)
- **Lecture 03a: Software Project Management** (milestones, risks, roles, the demo, closing the project)

> **Every document file starts with a hidden comment block (`<!-- ... -->`) holding the lecturer's definition of that document.**
> You see it when you edit the file; GitHub hides it when it renders the page. Fill each section according to that definition.

## The chain of documents

From the slides, "One project, a chain of documents":

| Step | Our file | Lecturer's document | Answers | Written by | Read by |
|------|----------|---------------------|---------|------------|---------|
| 1 | [README.md](../README.md) | README | How do I install, run, contribute? | Maintainers | New developers, users |
| 2 | [02-tools-report.md](02-tools-report.md) | _(not a separate document; the PDR asks for "key technology choices, backed by spikes or prototypes")_ | Which tools, and did we really test them? | The team | The team, reviewers |
| 3 | [03-SoW.md](03-SoW.md) | Scope of Work | What is delivered, when, at what cost? | Project manager, client | Client, management, team |
| 4 | [04-SRS.md](04-SRS.md) | SRS | What must the system do? | Analyst, product owner | Developers, testers, client |
| 5 | [05-use-cases.md](05-use-cases.md) | Use cases | How do users interact with it? | Analyst, UX designer | Developers, testers, client |
| 6 | [06-SDD.md](06-SDD.md) | SDD | How is the system structured? | Architect | Team leads, developers |
| 7 | [07-EDD/](07-EDD/) | EDD (+ API docs) | How is this component built? How do I call it? | Component engineer | Implementers, reviewers |
| 8 | [08-STP-STD.md](08-STP-STD.md) | STP / STD | How will we test; which exact tests? | Test lead / test engineers | QA team, PM / testers, auditors |
| 9 | [../app/](../app/) | Code + README quick start | | Developers | Users |
| 10 | [10-demo-plan.md](10-demo-plan.md) | The demo (lecture 03a) | Does it meet the requirements? | The team | Lecturer, class |
| 11 | [11-conclusion.md](11-conclusion.md) | Closing the project (lecture 03a) | Plan versus actual | The team | Lecturer |

The lecturer's three rules for every document:

1. Write each document **for its reader**.
2. **Trace** it to the documents before and after it.
3. **Keep it current** as the code changes.

## Shared ID scheme (traceability)

"Traceability ties the documents together" (lecture 02a, slide 19). Every item gets an ID so the next document can point back at it:

| Prefix | Meaning | Defined in | Example |
|--------|---------|------------|---------|
| `D-n` | Deliverable | SoW | D-1 Attendance module |
| `REQ-nn` | Functional requirement | SRS | REQ-11 The system shall... |
| `NFR-nn` | Non-functional requirement | SRS | NFR-01 |
| `UC-nn` | Use case | Use cases | UC-01 Mark attendance |
| `SDD §n` | Component (section in the SDD) | SDD | SDD §2.1 Attendance service |
| `EDD-<Name>` | Detailed design of one component | EDD | EDD-Attendance |
| `TC-nnn` | Test case | STD | TC-001 |
| `R-n` | Risk | SoW / tools report | R-1 |
| `ADR-n` | Architecture decision record | Tools report / SDD | ADR-1 |

Requirement number ranges per feature:

| Feature | Requirement IDs |
|---------|-----------------|
| F0 Accounts, timetable and lesson page (shared by all features) | REQ-01 to REQ-09, REQ-71, REQ-72 |
| F1 Attendance + spreadsheet (main) | REQ-10 to REQ-19 |
| F2 Comments and suggestions | REQ-20 to REQ-29, REQ-70 |
| F3 Polls | REQ-30 to REQ-39 |
| F4 Class video summary | REQ-40 to REQ-49 |
| F5 Homework review | REQ-50 to REQ-59 |
| F6 Forms (surveys with more than one question, published in the forum) | REQ-60 to REQ-69 |

The **traceability matrix** lives in the SRS appendix and grows with each step:

| Requirement | Use case | Design | Test cases | Status |
|-------------|----------|--------|------------|--------|
| REQ-11 | UC-01 | SDD §2.1, EDD-Attendance | TC-001, TC-002 | Passed |

A requirement with no test case is a **Gap**.

## UML: which diagram goes where

From lecture 02a, slide 9:

| Diagram | Kind | Shows | Goes in |
|---------|------|-------|---------|
| Use case | Behaviour | Actors, their goals and the system boundary | SRS / [05-use-cases.md](05-use-cases.md) |
| Activity | Behaviour | Step-by-step flow with decisions and parallel work | SRS, use cases |
| Sequence | Behaviour | Messages between objects, in time order | EDD, API docs |
| State machine | Behaviour | States of one object and the events that change them | EDD, STD |
| Class | Structure | Classes, attributes, operations and relationships | SDD, EDD |
| Component | Structure | Deployable parts and the interfaces between them | SDD |
| Deployment | Structure | Servers, devices and what runs on each | SDD |

Tools the lecturer lists: PlantUML and Mermaid (diagrams as code), draw.io, Visual Paradigm, Enterprise Architect.
**We use Mermaid**, because GitHub renders it directly inside Markdown files.

## Docs as code

From lecture 02a, slide 21, "Keeping documents alive":

- **Version with the code:** Markdown in the repository, next to what it describes.
- **Review in pull requests:** a change to behaviour updates the doc in the same commit / PR.
- **Generate what you can:** API reference, test reports.
- **Diagrams as code:** Mermaid instead of images nobody can edit.
- **Record decisions:** a short Architecture Decision Record (ADR) for each major choice.
- **Definition of done:** a feature is not done until its docs and tests are updated.
