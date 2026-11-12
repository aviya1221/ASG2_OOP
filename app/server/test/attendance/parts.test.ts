import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AttendanceRules } from "../../src/attendance/AttendanceRules.ts";
import { ClassFaceCache } from "../../src/attendance/ClassFaceCache.ts";
import { FaceMatcher } from "../../src/attendance/FaceMatcher.ts";
import { MATCH_THRESHOLD } from "../../src/attendance/types.ts";

describe("FaceMatcher", () => {
  const matcher = new FaceMatcher();

  it("TC-018 finds the highest score across all the photos of the round", () => {
    const best = matcher.best([1, 0], [
      { photoNo: 0, faceNo: 0, print: [0, 1] },
      { photoNo: 1, faceNo: 4, print: [1, 0.1] },
      { photoNo: 2, faceNo: 1, print: [1, 1] },
    ]);
    assert.equal(best?.photoNo, 1);
    assert.equal(best?.faceNo, 4);
    assert.ok(best!.score > 0.99);
  });

  it("gives no match when the round has no faces", () => {
    assert.equal(matcher.best([1, 0], []), null);
    assert.deepEqual(matcher.bestInEachPhoto([1, 0], []), []);
  });

  it("finds the most similar face in each photo, in photo order", () => {
    const seen = matcher.bestInEachPhoto([1, 0], [
      { photoNo: 2, faceNo: 0, print: [1, 1] },
      { photoNo: 0, faceNo: 0, print: [0, 1] },
      { photoNo: 0, faceNo: 5, print: [1, 0.2] },
      { photoNo: 2, faceNo: 3, print: [1, 0] },
    ]);
    assert.deepEqual(
      seen.map((face) => [face.photoNo, face.faceNo]),
      [
        [0, 5],
        [2, 3],
      ],
    );
  });

  it("scores a print of zeros as 0, and does not divide by zero", () => {
    assert.equal(matcher.best([0, 0], [{ photoNo: 0, faceNo: 0, print: [1, 0] }])?.score, 0);
  });
});

describe("AttendanceRules", () => {
  const rules = new AttendanceRules();

  it("TC-018 checks the hash before the score, and counts the threshold itself as a match", () => {
    assert.equal(rules.decide(false, 0.99, MATCH_THRESHOLD), "review");
    assert.equal(rules.decide(true, 0.3599, MATCH_THRESHOLD), "not_found");
    assert.equal(rules.decide(true, MATCH_THRESHOLD, MATCH_THRESHOLD), "matched");
  });
});

describe("ClassFaceCache", () => {
  const FACES = [{ photoNo: 0, faceNo: 0, print: [1] }];

  it("TC-100 returns the faces during the hour and nothing after it", () => {
    let now = 1_000;
    const cache = new ClassFaceCache(() => now);
    cache.put("L", FACES, new Date(2_000));
    assert.deepEqual(cache.get("L"), FACES);
    now = 2_000;
    assert.equal(cache.get("L"), undefined);
  });

  it("drops finished rounds when a new round is added", () => {
    let now = 1_000;
    const cache = new ClassFaceCache(() => now);
    cache.put("old", FACES, new Date(2_000));
    now = 3_000;
    cache.put("new", FACES, new Date(9_000));
    now = 1_500;
    assert.equal(cache.get("old"), undefined);
    assert.deepEqual(cache.get("new"), FACES);
  });
});
