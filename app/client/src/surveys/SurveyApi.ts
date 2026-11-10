import { supabase } from "../lib/supabase.ts";
import type { Answers, Question } from "./questions.ts";

export type SurveyKind = "poll" | "form";
export type SurveyStatus = "draft" | "open" | "closed";

export interface Survey {
  id: string;
  lessonId: string;
  kind: SurveyKind;
  status: SurveyStatus;
  allowChange: boolean;
  questions: Question[];
  shownAt: Date;
}

export interface AnswerRow {
  studentId: string;
  name: string;
  value: Answers;
}

interface SurveyRow {
  id: string;
  lesson_id: string;
  kind: SurveyKind;
  status: SurveyStatus;
  allow_change: boolean;
  questions: Question[];
  created_at: string;
  published_at: string | null;
}

function toSurvey(row: SurveyRow): Survey {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    kind: row.kind,
    status: row.status,
    allowChange: row.allow_change,
    questions: row.questions,
    shownAt: new Date(row.published_at ?? row.created_at),
  };
}

const PUBLISH_ERRORS: Record<string, string> = {
  "new row violates row-level security policy": "אפשר לפרסם סקר רק במהלך השיעור.",
};

export class SurveyError extends Error {}

function fail(message: string): never {
  const known = Object.entries(PUBLISH_ERRORS).find(([text]) => message.includes(text));
  throw new SurveyError(known ? known[1] : "הפעולה לא הצליחה.");
}

/** The calls of polls and forms to the database (docs/07-EDD/polls-and-forms.md). */
export const SurveyApi = {
  async loadSurveys(lessonId: string): Promise<Survey[]> {
    const { data } = await supabase.from("surveys").select("*").eq("lesson_id", lessonId).order("created_at");
    return ((data ?? []) as SurveyRow[]).map(toSurvey);
  },

  async publishPoll(lessonId: string, question: Question, allowChange: boolean): Promise<void> {
    const { error } = await supabase.from("surveys").insert({ lesson_id: lessonId, kind: "poll", status: "open", allow_change: allowChange, questions: [question] });
    if (error) fail(error.message);
  },

  async saveForm(lessonId: string, questions: Question[], allowChange: boolean, publish: boolean): Promise<void> {
    const { error } = await supabase
      .from("surveys")
      .insert({ lesson_id: lessonId, kind: "form", status: publish ? "open" : "draft", allow_change: allowChange, questions });
    if (error) fail(error.message);
  },

  async publishForm(surveyId: string): Promise<void> {
    const { error } = await supabase.from("surveys").update({ status: "open" }).eq("id", surveyId);
    if (error) fail(error.message);
  },

  async close(surveyId: string): Promise<void> {
    const { error } = await supabase.from("surveys").update({ status: "closed" }).eq("id", surveyId);
    if (error) fail(error.message);
  },

  /** Adds the student's answer, or replaces it when the teacher allowed a change. */
  async answer(survey: Survey, studentId: string, value: Answers, replace: boolean): Promise<void> {
    const { error } = replace
      ? await supabase.from("answers").update({ value }).eq("survey_id", survey.id).eq("student_id", studentId)
      : await supabase.from("answers").insert({ survey_id: survey.id, student_id: studentId, value });
    if (error) throw new SurveyError(survey.status === "open" ? "התשובה לא נשמרה." : "הסקר כבר סגור.");
  },

  async myAnswers(lessonSurveyIds: string[], studentId: string): Promise<Map<string, Answers>> {
    if (lessonSurveyIds.length === 0) return new Map();
    const { data } = await supabase.from("answers").select("survey_id, value").eq("student_id", studentId).in("survey_id", lessonSurveyIds);
    return new Map((data ?? []).map((row) => [row.survey_id as string, row.value as Answers]));
  },

  async totals(surveyIds: string[]): Promise<Map<string, number[]>> {
    if (surveyIds.length === 0) return new Map();
    const { data } = await supabase.from("poll_totals").select("survey_id, option_no, count").in("survey_id", surveyIds);
    const totals = new Map<string, number[]>();
    for (const row of data ?? []) {
      const counts = totals.get(row.survey_id) ?? [];
      counts[row.option_no] = row.count;
      totals.set(row.survey_id, counts);
    }
    return totals;
  },

  /** For the teacher: every answer with who gave it (REQ-36, REQ-67). */
  async loadAnswers(surveyId: string): Promise<AnswerRow[]> {
    const { data } = await supabase.from("answers").select("student_id, value, people(name)").eq("survey_id", surveyId).order("answered_at");
    return (data ?? []).map((row) => ({
      studentId: row.student_id as string,
      name: (row.people as unknown as { name: string } | null)?.name ?? (row.student_id as string),
      value: row.value as Answers,
    }));
  },

  watch(lessonId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`surveys-${lessonId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "surveys", filter: `lesson_id=eq.${lessonId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_totals" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "answers" }, onChange)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") onChange();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
