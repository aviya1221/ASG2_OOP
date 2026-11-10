export type QuestionType = "single" | "multiple" | "rating" | "text";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  scale?: number;
}

export type AnswerValue = number | number[] | string;
export type Answers = Record<string, AnswerValue>;

export const QUESTION_TYPES: Record<QuestionType, string> = {
  single: "בחירה יחידה",
  multiple: "בחירה מרובה",
  rating: "דירוג בסולם",
  text: "טקסט חופשי",
};

export const RATING_SCALE = 5;

export function hasOptions(type: QuestionType): boolean {
  return type === "single" || type === "multiple";
}

export function newQuestion(id: string, type: QuestionType): Question {
  if (hasOptions(type)) return { id, type, text: "", options: ["", ""] };
  if (type === "rating") return { id, type, text: "", scale: RATING_SCALE };
  return { id, type, text: "" };
}

/** The questions that still have no answer (REQ-63). */
export function missingAnswers(questions: Question[], answers: Answers): Question[] {
  return questions.filter((question) => {
    const answer = answers[question.id];
    return answer === undefined || (typeof answer === "string" && answer.trim() === "") || (Array.isArray(answer) && answer.length === 0);
  });
}

/** What still has to be filled in before a question can be published. */
export function questionProblems(questions: Question[]): string[] {
  if (questions.length === 0) return ["אין עדיין שאלות."];
  const problems: string[] = [];
  questions.forEach((question, index) => {
    if (!question.text.trim()) problems.push(`לשאלה ${index + 1} חסר נוסח.`);
    if (hasOptions(question.type) && (question.options ?? []).filter((option) => option.trim()).length < 2) {
      problems.push(`לשאלה ${index + 1} צריך לפחות 2 אפשרויות.`);
    }
  });
  return problems;
}

/** Drops empty options, so the database receives only real ones. */
export function cleanQuestions(questions: Question[]): Question[] {
  return questions.map((question) =>
    hasOptions(question.type) ? { ...question, text: question.text.trim(), options: (question.options ?? []).map((o) => o.trim()).filter(Boolean) } : { ...question, text: question.text.trim() },
  );
}
