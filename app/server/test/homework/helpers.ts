import type { ReviewGuide, SectionMark } from "../../src/homework/types.ts";

/** A made-up PDF: the server only checks that the file starts like one. */
export const PDF_BYTES = new TextEncoder().encode("%PDF-1.4 made-up homework");

/** A guide with the given questions, each listing the ids of its sections. */
export function guideOf(questions: Record<string, string[]>): ReviewGuide {
  return {
    questions: Object.entries(questions).map(([id, sections]) => ({
      id,
      title: `שאלה ${id.slice(1)}`,
      sections: sections.map((sectionId) => ({
        id: sectionId,
        asked: "מה הסעיף מבקש",
        requirements: ["להראות את הדרך"],
        expected: "התוצאה הנכונה",
        score_bands: "90-100 מלא, 1-39 חלקי מאוד",
        giving_away: "לכתוב את התוצאה",
      })),
    })),
    system_prompt: "הנחיות לבודק של המטלה הזאת",
  };
}

/** The mark of one section, with feedback only when it was answered. */
export function mark(id: string, score: number, answered: boolean = score > 0): SectionMark {
  return {
    id,
    evidence: answered ? "ציטוט מהפתרון" : "",
    answered,
    score,
    meets: answered ? "הדרך מוסברת" : "",
    missing: answered ? "חסר נימוק לשלב האחרון" : "",
    direction: answered ? "לבדוק מה המכנה" : "",
  };
}

/** The model's answer for these marks. */
export function answerOf(marks: SectionMark[]): { sections: SectionMark[] } {
  return { sections: marks };
}
