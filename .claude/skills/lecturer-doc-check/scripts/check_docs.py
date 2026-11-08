#!/usr/bin/env python3
"""Automatic checks of the ASG2_OOP documents against the lecturer's definitions.

Usage (from the repository root):
    python .claude/skills/lecturer-doc-check/scripts/check_docs.py
    python .claude/skills/lecturer-doc-check/scripts/check_docs.py --quiet
    python .claude/skills/lecturer-doc-check/scripts/check_docs.py --repo <path>
    python .claude/skills/lecturer-doc-check/scripts/check_docs.py --update-lock

Prints ERROR / WARN / INFO findings and exits with code 1 if there is any ERROR.

The rules come from the hidden "LECTURER GUIDELINES" block at the top of each
document (lecture 02a "Software Engineering Documents", lecture 03a "Software
Project Management") and from the shared conventions in docs/README.md.

--update-lock re-records the guideline blocks. Use it only when the lecturer
publishes new definitions and the user approved the change.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
LOCK_FILE = SKILL_DIR / "guidelines.lock.json"
DEFAULT_REPO = SKILL_DIR.parents[2]  # <repo>/.claude/skills/<skill>
GUIDELINE_MARK = "LECTURER GUIDELINES"

# Required sections per document, in the lecturer's order.
# "## phrase" means a level-2 heading whose text contains the phrase (case-insensitive).
REQUIRED_SECTIONS: dict[str, tuple[str, list[str]]] = {
    "README.md": ("02a slide 20; assignment step 1", [
        "## problem statement", "## scope", "## quick start", "## usage example",
        "## configuration and environment", "## running the tests",
        "## repository structure", "## how to contribute", "## license and contact",
    ]),
    "docs/02-tools-report.md": ("03a slide 6; 02a slide 21", [
        "## evaluation criteria", "## candidate tools", "## spikes",
        "## comparison table", "## decisions", "## technology risks",
    ]),
    # Team decision (2026-11-06): the SoW answers only why, what is delivered
    # and at what cost (no milestones section).
    "docs/03-SoW.md": ("02a slide 4, short form agreed by the team", [
        "## objectives", "## deliverables", "## cost",
    ]),
    "docs/04-SRS.md": ("02a slide 5", [
        "## introduction", "## overall description", "## specific requirements",
        "### functional requirements", "### external interfaces",
        "### non-functional requirements", "## appendices", "### use cases",
        "### data dictionary", "### traceability matrix",
    ]),
    "docs/05-use-cases.md": ("02a slides 7-11", [
        "## actors", "## use-case diagram", "## use cases", "## activity diagrams",
        "## user stories",
    ]),
    "docs/06-SDD.md": ("02a slide 12; 03a slide 6", [
        "## context", "## decomposition", "## interfaces", "## data", "## deployment",
        "## rationale", "## requirement allocation",
    ]),
    "docs/08-STP-STD.md": ("02a slide 18; assignment step 8", [
        "## test plan (stp)", "### scope and items under test", "### test levels",
        "### unit tests per class", "### approach and tools",
        "### environment and test data", "### entry and exit criteria",
        "### schedule, roles and risks", "## test cases (std)",
    ]),
    "docs/10-demo-plan.md": ("03a slides 15-16", [
        "## demo script", "## release", "## demo data", "## rehearsals",
        "## backup plan", "## known issues",
    ]),
    "docs/11-conclusion.md": ("03a slide 17; assignment step 11", [
        "## results summary", "## plan vs. actual", "## demo results",
        "## retrospective", "## future work",
    ]),
}

EDD_SECTIONS = (
    "02a slide 13",
    [
        "## module and class design", "## algorithms and data structures",
        "## database schema and data formats", "## sequence diagrams for key flows",
        "## error handling and edge cases", "## configuration and performance budget",
        "## alternatives considered and trade-offs", "## testing and rollout plan",
    ],
)

ID_RE = {
    "REQ": re.compile(r"\bREQ-(\d+)\b"),
    "NFR": re.compile(r"\bNFR-(\d+)\b"),
    "UC": re.compile(r"\bUC-(\d+)\b"),
    "D": re.compile(r"\bD-(\d+)\b"),
    "TC": re.compile(r"\bTC-(\d+)\b"),
    "ADR": re.compile(r"\bADR-(\d+)\b"),
}
ID_HOME = {
    "REQ": "docs/04-SRS.md (section 3)",
    "NFR": "docs/04-SRS.md (section 3)",
    "UC": "docs/05-use-cases.md (section 3)",
    "D": "docs/03-SoW.md (deliverables table)",
    "TC": "docs/08-STP-STD.md (Part B)",
    "ADR": "docs/02-tools-report.md (decisions)",
}
EDD_REF_RE = re.compile(r"\bEDD-([A-Z][A-Za-z]*)\b")
TRACE_SRC = "02a slide 19, traceability"

WEAK_WORDS = [
    "fast", "quick", "quickly", "user-friendly", "user friendly", "easy", "easily",
    "intuitive", "simple", "simply", "many", "several", "a lot", "lots of", "etc",
    "flexible", "efficient", "efficiently", "robust", "seamless", "seamlessly",
    "modern", "nice", "good", "appropriate", "as soon as possible", "asap", "and/or",
    "should", "might", "may", "could", "some", "various", "usually", "if possible",
    "as needed",
]
PRIORITY_RE = re.compile(r"^(must|should|could|won'?t|high|medium|med|low|p[0-3])$", re.I)
VAGUE_DELIVERABLES = [
    "working system", "working app", "working application", "full system",
    "complete system", "everything",
]

COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
CLASS_RE = re.compile(r"^\s*class\s+([A-Za-z_]\w*)")
MEMBER_RE = re.compile(r"^\s*([A-Za-z_]\w*)\s*:\s*[-+#~]?\s*\w")
SEVERITY_ORDER = {"ERROR": 0, "WARN": 1, "INFO": 2}


# --------------------------------------------------------------------------- #
# Markdown helpers
# --------------------------------------------------------------------------- #

def strip_comments(text: str) -> str:
    """Remove HTML comments but keep the line count, so line numbers stay right."""
    return COMMENT_RE.sub(lambda m: "\n" * m.group(0).count("\n"), text)


def is_row(s: str) -> bool:
    return len(s) > 1 and s.startswith("|") and s.endswith("|")


def is_sep(s: str) -> bool:
    return is_row(s) and "-" in s and re.fullmatch(r"\|[\s:\-|]+\|", s) is not None


def cells(s: str) -> list[str]:
    return [c.strip() for c in s[1:-1].split("|")]


def clean_label(line: str) -> str:
    """'- **Main success flow:**' -> 'main success flow:**'."""
    return re.sub(r"^[\s#>*\-+\d.)_]*", "", line).lower()


class Doc:
    def __init__(self, rel: str, raw: str):
        self.rel = rel
        self.raw = raw
        self.lines = strip_comments(raw).split("\n")
        self.headings: list[tuple[int, int, str]] = []  # (line index, level, text)
        self.heading_lines: set[int] = set()
        in_fence = False
        for i, line in enumerate(self.lines):
            if line.lstrip().startswith("```"):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            m = HEADING_RE.match(line)
            if m:
                self.headings.append((i, len(m.group(1)), m.group(2).strip()))
                self.heading_lines.add(i)

    def find(self, spec: str, start_k: int = 0) -> int | None:
        level = len(spec) - len(spec.lstrip("#"))
        phrase = spec.lstrip("#").strip().lower()
        for k in range(start_k, len(self.headings)):
            _, lvl, text = self.headings[k]
            if lvl == level and phrase in text.lower():
                return k
        return None

    def span(self, k: int) -> tuple[int, int]:
        """Line range of a section's body (until the next heading of the same or higher level)."""
        line, level, _ = self.headings[k]
        end = len(self.lines)
        for j in range(k + 1, len(self.headings)):
            if self.headings[j][1] <= level:
                end = self.headings[j][0]
                break
        return line + 1, end

    def sub_headings(self, k: int, level: int) -> list[int]:
        start, end = self.span(k)
        return [j for j, (line, lvl, _) in enumerate(self.headings)
                if start <= line < end and lvl == level]

    def is_header(self, i: int) -> bool:
        return i + 1 < len(self.lines) and is_sep(self.lines[i + 1].strip())

    def rows(self, start: int, end: int):
        for i in range(start, end):
            s = self.lines[i].strip()
            if is_row(s) and not is_sep(s) and not self.is_header(i):
                yield i, cells(s)

    def content(self, start: int, end: int) -> list[int]:
        """Lines with real content: not headings, placeholders, table headers or empty rows."""
        out = []
        for i in range(start, end):
            s = self.lines[i].strip()
            if not s or i in self.heading_lines or s.startswith("_TODO") or s.startswith("```"):
                continue
            if is_row(s):
                if is_sep(s) or self.is_header(i):
                    continue
                c = cells(s)
                filled = sum(1 for x in c if x)
                if filled < 3 and filled < len(c):
                    continue
            out.append(i)
        return out

    def mermaid_blocks(self) -> list[tuple[int, list[str]]]:
        blocks, i = [], 0
        while i < len(self.lines):
            if self.lines[i].strip().lower().startswith("```mermaid"):
                j, body = i + 1, []
                while j < len(self.lines) and not self.lines[j].strip().startswith("```"):
                    body.append(self.lines[j])
                    j += 1
                blocks.append((i, body))
                i = j + 1
            else:
                i += 1
        return blocks


def diagram_kind(body: list[str]) -> str:
    in_front_matter = False
    for line in body:
        s = line.strip()
        if not s or s.startswith("%%"):
            continue
        if s == "---":
            in_front_matter = not in_front_matter
            continue
        if not in_front_matter:
            return s.split()[0]
    return ""


def is_edd_component(rel: str) -> bool:
    return rel.startswith("docs/07-EDD/") and Path(rel).name not in ("README.md", "_template.md")


def scans_references(rel: str) -> bool:
    """Deliverable documents. The guide, TODO and templates hold example IDs on purpose."""
    if rel.startswith("app/"):
        return True
    return (rel.startswith("docs/") and rel != "docs/README.md"
            and not rel.endswith("/_template.md"))


# --------------------------------------------------------------------------- #
# Findings
# --------------------------------------------------------------------------- #

class Findings:
    def __init__(self):
        self.items: list[tuple[str, str, int, str, str]] = []

    def add(self, severity: str, rel: str, line: int, message: str, source: str = ""):
        self.items.append((severity, rel, line, message, source))

    def count(self, severity: str) -> int:
        return sum(1 for item in self.items if item[0] == severity)


# --------------------------------------------------------------------------- #
# Guideline lock
# --------------------------------------------------------------------------- #

def guideline_block(raw: str) -> str | None:
    for m in COMMENT_RE.finditer(raw):
        if GUIDELINE_MARK in m.group(0):
            return m.group(0)
    return None


def block_hash(block: str) -> str:
    normalized = "\n".join(line.rstrip() for line in block.replace("\r\n", "\n").split("\n"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def current_blocks(raws: dict[str, str]) -> dict[str, str]:
    out = {}
    for rel, raw in raws.items():
        block = guideline_block(raw)
        if block:
            out[rel] = block_hash(block)
    return out


def check_lock(raws: dict[str, str], f: Findings):
    src = "guideline blocks are read-only"
    if not LOCK_FILE.exists():
        f.add("WARN", LOCK_FILE.name, 0, "no lock file, so guideline blocks are not protected; "
              "run with --update-lock once", src)
        return
    lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
    current = current_blocks(raws)
    for rel, expected in sorted(lock.items()):
        if rel not in raws:
            f.add("ERROR", rel, 0, "a document with lecturer guidelines was deleted or moved", src)
        elif rel not in current:
            f.add("ERROR", rel, 1, "the hidden LECTURER GUIDELINES block was removed; "
                  f"restore it from git (git log -p -- {rel})", src)
        elif current[rel] != expected:
            f.add("ERROR", rel, 1, "the LECTURER GUIDELINES block was changed; restore it from git "
                  f"(git log -p -- {rel}) unless the lecturer published new definitions", src)
    for rel in sorted(set(current) - set(lock)):
        f.add("WARN", rel, 1, "this guideline block is not in the lock; if it is the lecturer's "
              "text and the user approved it, run with --update-lock", src)


# --------------------------------------------------------------------------- #
# Structure
# --------------------------------------------------------------------------- #

def check_sections(doc: Doc, source: str, specs: list[str], f: Findings):
    prev, filled = -1, 0
    for spec in specs:
        name = spec.lstrip("#").strip()
        k = doc.find(spec, prev + 1)
        if k is None:
            k = doc.find(spec, 0)
            if k is None:
                f.add("ERROR", doc.rel, 0, f'required section "{name}" is missing', source)
                continue
            f.add("WARN", doc.rel, doc.headings[k][0] + 1,
                  f'section "{name}" is out of the lecturer\'s order', source)
        else:
            prev = k
        if doc.content(*doc.span(k)):
            filled += 1
    f.add("INFO", doc.rel, 0, f"{filled}/{len(specs)} required sections have content")


def check_edd_component(doc: Doc, f: Findings):
    check_sections(doc, EDD_SECTIONS[0], EDD_SECTIONS[1], f)
    h1 = [text for _, lvl, text in doc.headings if lvl == 1]
    if not h1 or not h1[0].startswith("EDD-"):
        f.add("WARN", doc.rel, 1, 'the title should start with "EDD-<Name>" so other documents '
              "can cite it", TRACE_SRC)


# --------------------------------------------------------------------------- #
# IDs and traceability
# --------------------------------------------------------------------------- #

def collect_definitions(docs: dict[str, Doc], f: Findings):
    defs: dict[str, dict[int, tuple[str, int]]] = {p: {} for p in ID_RE}
    edd: dict[str, tuple[str, int]] = {}

    def define(prefix: str, num: str, rel: str, i: int):
        n = int(num)
        if n in defs[prefix]:
            orel, oi = defs[prefix][n]
            f.add("ERROR", rel, i + 1, f"{prefix}-{num} is defined twice (also at {orel}:{oi + 1})",
                  TRACE_SRC)
        else:
            defs[prefix][n] = (rel, i)

    def heading_ids(doc: Doc, section: str, prefix: str):
        k = doc.find(section)
        if k is None:
            return
        for j in doc.sub_headings(k, 3):
            line, _, text = doc.headings[j]
            m = re.match(rf"{prefix}-(\d+)\b", text)
            if m:
                define(prefix, m.group(1), doc.rel, line)

    sow = docs.get("docs/03-SoW.md")
    if sow and (k := sow.find("## deliverables")) is not None:
        for i, c in sow.rows(*sow.span(k)):
            if m := re.fullmatch(r"D-(\d+)", c[0]):
                define("D", m.group(1), sow.rel, i)

    srs = docs.get("docs/04-SRS.md")
    if srs and (k := srs.find("## specific requirements")) is not None:
        for i, c in srs.rows(*srs.span(k)):
            if m := re.fullmatch(r"(REQ|NFR)-(\d+)", c[0]):
                define(m.group(1), m.group(2), srs.rel, i)

    if uc := docs.get("docs/05-use-cases.md"):
        heading_ids(uc, "## use cases", "UC")
    if std := docs.get("docs/08-STP-STD.md"):
        heading_ids(std, "## test cases (std)", "TC")
    if tools := docs.get("docs/02-tools-report.md"):
        heading_ids(tools, "## decisions", "ADR")

    for rel, doc in docs.items():
        if is_edd_component(rel):
            for line, lvl, text in doc.headings:
                if lvl == 1 and (m := re.match(r"EDD-([A-Z][A-Za-z]*)\b", text)):
                    edd[m.group(1)] = (rel, line)
                    break
    return defs, edd


def check_references(docs: dict[str, Doc], defs, edd, f: Findings):
    for rel, doc in docs.items():
        if not scans_references(rel):
            continue
        seen: set[str] = set()
        for i, line in enumerate(doc.lines):
            if i in doc.heading_lines:  # headings are titles or definitions, not references
                continue
            for prefix, rx in ID_RE.items():
                for m in rx.finditer(line):
                    if int(m.group(1)) not in defs[prefix] and m.group(0) not in seen:
                        seen.add(m.group(0))
                        f.add("ERROR", rel, i + 1, f"{m.group(0)} is referenced but not defined in "
                              f"{ID_HOME[prefix]}", TRACE_SRC)
            for m in EDD_REF_RE.finditer(line):
                if m.group(1) not in edd and m.group(0) not in seen:
                    seen.add(m.group(0))
                    f.add("ERROR", rel, i + 1, f"{m.group(0)} is referenced but there is no "
                          "docs/07-EDD/ file titled with it", TRACE_SRC)


def ids_in(doc: Doc, prefix: str) -> set[int]:
    return {int(m.group(1)) for i, line in enumerate(doc.lines) if i not in doc.heading_lines
            for m in ID_RE[prefix].finditer(line)}


def check_traceability(docs: dict[str, Doc], defs, f: Findings):
    reqs = sorted(defs["REQ"])
    std = docs.get("docs/08-STP-STD.md")
    if std and defs["TC"] and reqs:
        missing = [n for n in reqs if n not in ids_in(std, "REQ")]
        if missing:
            f.add("WARN", std.rel, 0, "requirements with no test case (Gap): "
                  + ", ".join(f"REQ-{n:02d}" for n in missing), TRACE_SRC)

    sdd = docs.get("docs/06-SDD.md")
    if sdd and reqs and (k := sdd.find("## requirement allocation")) is not None:
        start, end = sdd.span(k)
        if any(sum(1 for x in c if x) >= 2 for _, c in sdd.rows(start, end)):
            missing = [n for n in reqs if n not in ids_in(sdd, "REQ")]
            if missing:
                f.add("WARN", sdd.rel, sdd.headings[k][0] + 1,
                      "requirements not allocated to a component: "
                      + ", ".join(f"REQ-{n:02d}" for n in missing),
                      "03a slide 6, PDR exit criterion")


# --------------------------------------------------------------------------- #
# Per-document content rules
# --------------------------------------------------------------------------- #

def check_srs(doc: Doc, f: Findings):
    k = doc.find("## specific requirements")
    if k is None:
        return
    start, end = doc.span(k)
    heading_at = {line: (lvl, text) for line, lvl, text in doc.headings}
    feature = None
    for i in range(start, end):
        if i in heading_at:
            lvl, text = heading_at[i]
            m = re.match(r"F(\d)\b", text)
            if lvl == 4 and m:
                feature = int(m.group(1))
            elif lvl <= 3:
                feature = None
            continue
        s = doc.lines[i].strip()
        if not is_row(s) or is_sep(s) or doc.is_header(i):
            continue
        c = cells(s)
        m = re.fullmatch(r"(REQ|NFR)-(\d+)", c[0])
        if not m:
            continue
        rid, n = m.group(0), int(m.group(2))
        text = max(c[1:], key=len) if len(c) > 1 else ""
        row_text = " ".join(c[1:])

        if m.group(1) == "REQ":
            if not 1 <= n <= 69:
                f.add("WARN", doc.rel, i + 1, f"{rid} is outside the feature ranges REQ-01..69 "
                      "(docs/README.md)", TRACE_SRC)
            elif feature and n // 10 != feature:
                f.add("WARN", doc.rel, i + 1, f"{rid} sits under F{feature} but its number belongs "
                      f"to F{n // 10} (ID ranges in docs/README.md)", TRACE_SRC)
            if not re.search(r"\bshall\b", text, re.I):
                f.add("ERROR", doc.rel, i + 1, f'{rid} is not written as "The system shall ..."',
                      "02a slide 5; 03a slide 5")
            if not ID_RE["D"].search(row_text):
                f.add("WARN", doc.rel, i + 1, f"{rid} is not traced to a SoW deliverable (D-n)",
                      TRACE_SRC)
        elif not re.search(r"\d", text):
            f.add("WARN", doc.rel, i + 1, f"{rid} is not measurable (no number, unit or condition)",
                  "02a slide 6")

        weak = [w for w in WEAK_WORDS
                if re.search(r"(?<![\w-])" + re.escape(w) + r"(?![\w-])", text, re.I)]
        if weak:
            f.add("WARN", doc.rel, i + 1, f"{rid} uses vague wording ({', '.join(weak)}); "
                  "requirements must be unambiguous and verifiable", "02a slide 6")
        if len(re.findall(r"\bshall\b", text, re.I)) > 1 or len(re.findall(r"\band\b", text, re.I)) >= 2:
            f.add("WARN", doc.rel, i + 1, f"{rid} may bundle several requirements; split them",
                  "02a slide 6, several in one")
        if not any(PRIORITY_RE.match(x) for x in c[1:]):
            f.add("WARN", doc.rel, i + 1, f"{rid} has no priority (e.g. Must / Should / Could)",
                  "02a slide 6, prioritised; 03a slide 5")


def check_fields(doc: Doc, k: int, fields, source: str, f: Findings) -> list[str] | None:
    """Return the section's lines, or None when it is not started. Reports missing fields."""
    start, end = doc.span(k)
    if not doc.content(start, end):
        return None
    lines = doc.lines[start:end]
    labels = [clean_label(line) for line in lines]
    name = doc.headings[k][2].split(":")[0]
    for field, prefixes in fields:
        if not any(label.startswith(p) for label in labels for p in prefixes):
            f.add("ERROR", doc.rel, doc.headings[k][0] + 1, f"{name} has no {field}", source)
    return lines


def check_use_cases(doc: Doc, f: Findings):
    src = "02a slide 7"
    fields = [
        ("actor", ["actor"]), ("preconditions", ["precondition"]),
        ("main success flow", ["main success flow", "main flow"]),
        ("alternative flows", ["alternative"]), ("postconditions", ["postcondition"]),
    ]
    k = doc.find("## use cases")
    if k is not None:
        not_started = []
        for j in doc.sub_headings(k, 3):
            line, _, text = doc.headings[j]
            if not re.match(r"UC-\d+", text):
                continue
            lines = check_fields(doc, j, fields, src, f)
            name = text.split(":")[0]
            if lines is None:
                not_started.append(name)
                continue
            body = "\n".join(lines)
            if not (ID_RE["REQ"].search(body) or ID_RE["NFR"].search(body)):
                f.add("WARN", doc.rel, line + 1, f"{name} does not list the requirements it covers",
                      TRACE_SRC)
            if any(clean_label(x).startswith("alternative") for x in lines) and \
                    not re.search(r"\b\d+[a-z]\b", body):
                f.add("WARN", doc.rel, line + 1, f"{name}: alternative flows should be numbered from "
                      'the step they leave (e.g. "2a.") and include errors', src)
        if not_started:
            f.add("INFO", doc.rel, 0, "use cases not written yet: " + ", ".join(not_started))

    k = doc.find("## user stories")
    if k is not None:
        lines = doc.lines[slice(*doc.span(k))]
        stories = sum(1 for x in lines if re.match(r"^\s*(?:[-*]\s*|\d+\.\s*)?(?:\*\*)?As an?\b", x))
        steps = [sum(1 for x in lines if re.match(rf"^\s*(?:[-*]\s*)?(?:\*\*)?{w}\b", x))
                 for w in ("Given", "When", "Then")]
        if stories and min(steps) < stories:
            f.add("WARN", doc.rel, doc.headings[k][0] + 1, f"user stories: {stories}, complete "
                  f"Given / When / Then acceptance criteria: {min(steps)}", "02a slide 8")


def check_test_cases(doc: Doc, f: Findings):
    src = "02a slide 18, STD"
    fields = [
        ("requirement it verifies", ["verifies"]),
        ("preconditions", ["precondition", "pre:", "pre "]),
        ("steps", ["steps"]), ("input data", ["input"]), ("expected result", ["expected"]),
    ]
    k = doc.find("## test cases (std)")
    if k is None:
        return
    for j in doc.sub_headings(k, 3):
        line, _, text = doc.headings[j]
        if not re.match(r"TC-\d+", text):
            continue
        lines = check_fields(doc, j, fields, src, f)
        if lines is None:
            continue
        verifies = [x for x in lines if clean_label(x).startswith("verifies")]
        if verifies and not any(ID_RE[p].search(x) for x in verifies for p in ("REQ", "NFR", "UC")):
            f.add("ERROR", doc.rel, line + 1, f"{text.split(':')[0]} does not name the requirement "
                  "or use case it verifies", src)


def check_sow(doc: Doc, f: Findings):
    k_in, k_out = doc.find("### in scope"), doc.find("### out of scope")
    if k_in is not None and k_out is not None:
        if doc.content(*doc.span(k_in)) and not doc.content(*doc.span(k_out)):
            f.add("ERROR", doc.rel, doc.headings[k_out][0] + 1, "in-scope items are listed but the "
                  "out-of-scope list is empty", '02a slide 4, pitfall "no out-of-scope list"')
    k = doc.find("## deliverables")
    if k is None:
        return
    for i, c in doc.rows(*doc.span(k)):
        if not re.fullmatch(r"D-\d+", c[0]):
            continue
        if len(c) < 2 or not c[-1]:
            f.add("ERROR", doc.rel, i + 1, f"{c[0]} has no acceptance criterion",
                  '02a slide 4, pitfall "no acceptance test"')
        row = " ".join(c).lower()
        vague = [v for v in VAGUE_DELIVERABLES if v in row]
        if vague:
            f.add("WARN", doc.rel, i + 1, f'{c[0]} is vague ("{vague[0]}") and cannot be accepted '
                  "or rejected", '02a slide 4, pitfall "vague deliverables"')


def check_demo(doc: Doc, f: Findings):
    k = doc.find("## demo script")
    if k is None:
        return
    for i, c in doc.rows(*doc.span(k)):
        if sum(1 for x in c if x) < 3:
            continue
        if m := re.fullmatch(r"(\d{1,2}):(\d{2})", c[0]):
            if int(m.group(1)) * 60 + int(m.group(2)) >= 600:
                f.add("WARN", doc.rel, i + 1, f"row starts at {c[0]}, but the demo slot is 10 minutes",
                      "assignment step 10")
        row = " ".join(c)
        if any("live" in x.lower() for x in c) and not (ID_RE["UC"].search(row) or ID_RE["REQ"].search(row)):
            f.add("WARN", doc.rel, i + 1, "live-scenario row is not tied to a use case or requirement",
                  "03a slide 15, golden rule")


def check_diagram_placement(docs: dict[str, Doc], f: Findings):
    src = "02a slide 9, UML map"
    for rel, doc in docs.items():
        edd = rel.startswith("docs/07-EDD/")
        for line, body in doc.mermaid_blocks():
            kind = diagram_kind(body)
            if kind == "sequenceDiagram" and not edd:
                f.add("WARN", rel, line + 1, "sequence diagrams belong in the EDD and API docs", src)
            elif kind == "classDiagram" and not (edd or rel == "docs/06-SDD.md"):
                f.add("WARN", rel, line + 1, "class diagrams belong in the SDD and EDD", src)
            elif kind.startswith("stateDiagram") and not (edd or rel == "docs/08-STP-STD.md"):
                f.add("WARN", rel, line + 1, "state machines belong in the EDD and STD", src)
            elif kind == "gantt" and rel not in ("docs/03-SoW.md", "docs/11-conclusion.md"):
                f.add("WARN", rel, line + 1, "Gantt charts belong in the plan (SoW)", "03a slide 11")


def check_classes_tested(docs: dict[str, Doc], f: Findings):
    std = docs.get("docs/08-STP-STD.md")
    if not std or (k := std.find("### unit tests per class")) is None:
        return
    if not std.content(*std.span(k)):
        return
    classes: set[str] = set()
    for rel, doc in docs.items():
        if rel.startswith("docs/07-EDD/") and not rel.endswith("_template.md"):
            for _, body in doc.mermaid_blocks():
                if diagram_kind(body) == "classDiagram":
                    for line in body:
                        if m := (CLASS_RE.match(line) or MEMBER_RE.match(line)):
                            classes.add(m.group(1))
    text = "\n".join(std.lines)
    missing = sorted(c for c in classes if not re.search(rf"\b{re.escape(c)}\b", text))
    if missing:
        f.add("WARN", std.rel, std.headings[k][0] + 1, "classes from step 7 with no planned test: "
              + ", ".join(missing), "assignment step 8")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def collect_files(repo: Path) -> dict[str, str]:
    paths = [p for p in (repo / "README.md", repo / "TODO.md") if p.exists()]
    for base in ("docs", "app"):
        if (repo / base).exists():
            paths += sorted(p for p in (repo / base).rglob("*.md") if "node_modules" not in p.parts)
    return {p.relative_to(repo).as_posix(): p.read_text(encoding="utf-8") for p in paths}


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", type=Path, default=DEFAULT_REPO, help="repository root")
    ap.add_argument("--update-lock", action="store_true",
                    help="re-record the guideline blocks (only for new lecturer definitions)")
    ap.add_argument("--quiet", action="store_true", help="hide INFO lines")
    args = ap.parse_args()

    repo = args.repo.resolve()
    raws = collect_files(repo)
    if not raws:
        print(f"No documents found under {repo}")
        return 1

    if args.update_lock:
        blocks = current_blocks(raws)
        LOCK_FILE.write_text(json.dumps(blocks, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"Recorded {len(blocks)} guideline blocks in {LOCK_FILE}")
        return 0

    docs = {rel: Doc(rel, raw) for rel, raw in raws.items()}
    f = Findings()

    check_lock(raws, f)
    for rel, (source, specs) in REQUIRED_SECTIONS.items():
        if rel in docs:
            check_sections(docs[rel], source, specs, f)
        else:
            f.add("ERROR", rel, 0, "document is missing", "assignment To Do list")
    for rel, doc in docs.items():
        if is_edd_component(rel):
            check_edd_component(doc, f)

    defs, edd = collect_definitions(docs, f)
    check_references(docs, defs, edd, f)
    check_traceability(docs, defs, f)
    if "docs/03-SoW.md" in docs:
        check_sow(docs["docs/03-SoW.md"], f)
    if "docs/04-SRS.md" in docs:
        check_srs(docs["docs/04-SRS.md"], f)
    if "docs/05-use-cases.md" in docs:
        check_use_cases(docs["docs/05-use-cases.md"], f)
    if "docs/08-STP-STD.md" in docs:
        check_test_cases(docs["docs/08-STP-STD.md"], f)
    if "docs/10-demo-plan.md" in docs:
        check_demo(docs["docs/10-demo-plan.md"], f)
    check_diagram_placement(docs, f)
    check_classes_tested(docs, f)

    print(f"Lecturer document check: {repo}")
    for sev, rel, line, msg, src in sorted(f.items, key=lambda x: (SEVERITY_ORDER[x[0]], x[1], x[2])):
        if args.quiet and sev == "INFO":
            continue
        loc = f"{rel}:{line}" if line else rel
        print(f"{sev:<5}  {loc}  {msg}" + (f"  [{src}]" if src else ""))
    errors, warns = f.count("ERROR"), f.count("WARN")
    print(f"\nSummary: {errors} error(s), {warns} warning(s), {f.count('INFO')} info")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
