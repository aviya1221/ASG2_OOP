import type { Decision } from "./types.ts";

/** The first two rules of REQ-13. A match then goes to the database, which decides present or conflict. */
export class AttendanceRules {
  decide(hashFits: boolean, score: number, threshold: number): Decision {
    if (!hashFits) return "review";
    return score < threshold ? "not_found" : "matched";
  }
}
