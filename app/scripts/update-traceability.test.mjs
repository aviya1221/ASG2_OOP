import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requirementStatus, resultsFromReports, updateMatrix } from "./update-traceability.mjs";

describe("resultsFromReports", () => {
  it("finds the test case ID in the name, wherever it is", () => {
    const results = resultsFromReports([
      '<testsuite><testcase name="TC-001 first" time="1"/><testcase name="accounts.spec.ts › TC-002 second" time="1"></testcase></testsuite>',
    ]);
    assert.deepEqual([...results], [["TC-001", "passed"], ["TC-002", "passed"]]);
  });

  it("marks a case failed when any of its tests failed, in any report", () => {
    const results = resultsFromReports([
      '<testcase name="TC-001 a"/>',
      '<testcase name="TC-001 b"><failure message="no">trace</failure></testcase>',
      '<testcase name="TC-001 c"/>',
    ]);
    assert.equal(results.get("TC-001"), "failed");
  });

  it("ignores skipped tests and tests with no ID", () => {
    const results = resultsFromReports(['<testcase name="TC-009 s"><skipped/></testcase><testcase name="plain test"/>']);
    assert.equal(results.size, 0);
  });
});

describe("requirementStatus", () => {
  const results = new Map([["TC-001", "passed"], ["TC-002", "failed"]]);

  it("passes only when every test case passed", () => {
    assert.equal(requirementStatus(["TC-001"], results), "Passed");
    assert.equal(requirementStatus(["TC-001", "TC-003"], results), "Not run");
    assert.equal(requirementStatus(["TC-001", "TC-002"], results), "Failed");
  });
});

describe("updateMatrix", () => {
  const MATRIX = [
    "| REQ-01 Sign in | UC-08 | SDD §2.2 | TC-001 | Not run |",
    "| REQ-02 Create | UC-07 | SDD §2.2 | TC-002 | Passed |",
    "| REQ-50 Homework | UC-05 | SDD §2.8 | None yet | Gap |",
    "| Not a row | at all |",
  ].join("\n");

  it("writes the status of each requirement, and leaves a Gap alone", () => {
    const { updated, counts } = updateMatrix(MATRIX, new Map([["TC-001", "passed"]]));
    const lines = updated.split("\n");
    assert.equal(lines[0], "| REQ-01 Sign in | UC-08 | SDD §2.2 | TC-001 | Passed |");
    assert.equal(lines[1], "| REQ-02 Create | UC-07 | SDD §2.2 | TC-002 | Not run |");
    assert.equal(lines[2], "| REQ-50 Homework | UC-05 | SDD §2.8 | None yet | Gap |");
    assert.equal(lines[3], "| Not a row | at all |");
    assert.deepEqual(counts, { Passed: 1, Failed: 0, "Not run": 1, Gap: 1 });
  });

  it("keeps Windows line endings", () => {
    const { updated } = updateMatrix("| REQ-01 S | U | D | TC-001 | Not run |\r\n", new Map([["TC-001", "passed"]]));
    assert.equal(updated, "| REQ-01 S | U | D | TC-001 | Passed |\r\n");
  });
});
