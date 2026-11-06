---
name: lecturer-doc-check
description: Verifies that changes to the ASG2_OOP assignment documents do not contradict the lecturer's definitions (lectures 02a and 03a). It checks structure, wording rules, IDs, traceability and which content belongs in which document. Use it whenever you create, edit, fill in, restructure or review README.md, TODO.md, anything under docs/ (tools report, SoW, SRS, use cases, SDD, EDD, STP/STD, demo plan, conclusion) or app/README.md, even for a one-line edit, and always before committing document changes. Also use it when the user asks whether a document follows the lecturer or the assignment, or wants a teammate's document changes reviewed.
---

# Lecturer document check

The assignment is graded against the lecturer's definition of each document, so every change must stay consistent with it. The definitions live in the repository, which means this check never depends on memory:

- **The hidden block at the top of each document file** (`<!-- LECTURER GUIDELINES ... -->`). It holds the lecturer's definition for that document: required sections, wording rules and examples. Its last part, "FOR OUR PROJECT", holds team conventions.
- **[docs/README.md](../../../docs/README.md)**: the document chain, the shared ID scheme (`D-n`, `REQ-nn`, `NFR-nn`, `UC-nn`, `TC-nnn`, `ADR-n`, `EDD-<Name>`) and the UML map (which diagram goes in which document).
- **The assignment brief**, summarised in the main README (Features, Requirements, Guidelines).

A change contradicts the lecturer when it does any of the following:

- drops a required section, or renames or reorders it beyond recognition
- puts content in the wrong document (design detail in the SRS, a sequence diagram in the SDD)
- breaks a wording rule (a requirement that is not "The system shall...", or is not measurable)
- breaks traceability (a duplicate ID, or a reference to an ID that does not exist)
- edits or deletes a guideline block itself

## Workflow

### 1. Find what changed

From the repository root:

```bash
git status --short
git diff            # unstaged
git diff --cached   # staged
```

For a teammate's work, diff their commits: `git diff <base>..HEAD -- README.md TODO.md docs app/README.md`.
When you write a document section yourself, run this check after writing it and before you report it done or commit it.

### 2. Run the automatic checks

```bash
python .claude/skills/lecturer-doc-check/scripts/check_docs.py
```

(Use `py` instead of `python` on Windows if `python` is missing.) The script prints `ERROR`, `WARN` and `INFO` lines with `file:line` and the lecturer rule behind each one. It exits with code 1 if there is any ERROR. It covers:

- guideline blocks unchanged (compared against `guidelines.lock.json`)
- required sections present, in the lecturer's order
- IDs: defined once, no dangling references, REQ numbers inside their feature's range
- requirement wording: "shall", weak words, measurable NFRs, a priority, several requirements in one
- use-case fields, user stories with Given / When / Then
- test-case fields, and every test verifies a requirement or use case
- the 8 EDD sections in every component EDD
- SoW: the three short sections (why, what, how much) and vague deliverables
- Mermaid diagram type versus document (UML map)
- demo rows tied to use cases / requirements
- traceability gaps and requirement allocation to components

ERROR lines are real contradictions. WARN lines are heuristics, so read the text before acting on one, because a WARN can be a false positive (for example "simple" inside a quoted feature name). Sections that are still empty are reported as not started, not as errors.

### 3. Review the meaning

The script cannot judge meaning. For each changed file:

1. Read its guideline block.
2. Read the changed text, plus enough around it to judge consistency.
3. Go through that document's part of [references/checklist.md](references/checklist.md), and the cross-document checks at the end of it.

Focus on the diff, but remember the lecturer's third rule: keep documents current. A new requirement eventually needs a use case, a component and a test, so mention what else must be updated.

### 4. Report

Use this format, in the user's language (for Hebrew: plain Hebrew, with English only for IDs and file names):

```
Lecturer check: <files checked>
Result: consistent | <n> contradictions, <n> warnings

CONTRADICTION  docs/04-SRS.md:57
  What: REQ-23 "The UI shall be easy to use" is not measurable.
  Lecturer: 02a slide 6, "user-friendly" is subjective; a requirement must be verifiable.
  Fix: "A student shall complete check-in within 30 seconds of opening the link."

WARNING  docs/05-use-cases.md:40
  What: UC-02 has no alternative flows.
  Lecturer: 02a slide 7, use cases include branches and errors.
  Fix: add 3a. "Session already closed: system shows ..."
```

Always name the lecturer source (lecture + slide, or "assignment brief") so the reader can verify it.

### 5. Fix

- **Your own change:** fix it before finishing, then run the script again until there are no ERRORs.
- **Someone else's text** (a teammate's commit, text the user wrote): report it and propose the fix. Apply it only if the user agrees, because it's their content.
- **Guideline blocks are read-only.** If one was edited or deleted, restore it from git (`git log -p -- <file>` shows the original) rather than bending it to fit the content. Change one only when the lecturer publishes new definitions and the user asks for it, then run the script with `--update-lock`.
- **The lecturer wins.** If a "FOR OUR PROJECT" note or a TODO item disagrees with the lecturer's definition, follow the lecturer and point out the conflict.
- **Commits:** don't commit document changes while there are ERRORs. The commit history is graded, so commit each fix as its own small commit and tick the matching TODO.md checkbox in the same commit.
