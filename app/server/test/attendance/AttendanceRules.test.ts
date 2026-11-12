import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AttendanceRules } from "../../src/attendance/AttendanceRules.ts";

describe("AttendanceRules.needsNumbers", () => {
  const rules = new AttendanceRules();

  it("asks for numbers only when more students confirmed than there are faces", () => {
    assert.equal(rules.needsNumbers(40, 41), false, "fewer confirmations");
    assert.equal(rules.needsNumbers(41, 41), false, "as many as the faces");
    assert.equal(rules.needsNumbers(42, 41), true, "one more than the faces");
    assert.equal(rules.needsNumbers(0, 0), false, "no one confirmed");
    assert.equal(rules.needsNumbers(1, 0), true, "a photo with no face");
  });
});
