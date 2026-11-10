import { useState } from "react";
import { missingAnswers, type AnswerValue, type Answers, type Question } from "./questions.ts";

function QuestionInput({ question, value, onChange }: { question: Question; value: AnswerValue | undefined; onChange: (value: AnswerValue) => void }) {
  if (question.type === "text") {
    return <textarea aria-label={question.text} rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (question.type === "rating") {
    return (
      <div className="choices">
        {Array.from({ length: question.scale ?? 5 }, (_, i) => i + 1).map((n) => (
          <label key={n} className="choice">
            <input type="radio" name={question.id} checked={value === n} onChange={() => onChange(n)} />
            {n}
          </label>
        ))}
      </div>
    );
  }
  if (question.type === "single") {
    return (
      <div className="choices">
        {(question.options ?? []).map((option, index) => (
          <label key={index} className="choice">
            <input type="radio" name={question.id} checked={value === index} onChange={() => onChange(index)} />
            {option}
          </label>
        ))}
      </div>
    );
  }
  const chosen = (value as number[] | undefined) ?? [];
  return (
    <div className="choices">
      {(question.options ?? []).map((option, index) => (
        <label key={index} className="choice">
          <input
            type="checkbox"
            checked={chosen.includes(index)}
            onChange={() => onChange(chosen.includes(index) ? chosen.filter((x) => x !== index) : [...chosen, index].sort())}
          />
          {option}
        </label>
      ))}
    </div>
  );
}

/** A form in a window over the forum, so the student answers without leaving it (REQ-63). */
export function FormWindow({
  questions,
  initialAnswers = {},
  onSubmit,
  onClose,
}: {
  questions: Question[];
  initialAnswers?: Answers;
  onSubmit: (answers: Answers) => Promise<void>;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [marked, setMarked] = useState<string[]>([]);
  const [problem, setProblem] = useState("");

  async function submit() {
    const missing = missingAnswers(questions, answers);
    setMarked(missing.map((question) => question.id));
    if (missing.length > 0) {
      setProblem("יש שאלות שעוד לא נענו.");
      return;
    }
    try {
      await onSubmit(answers);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "התשובה לא נשמרה.");
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="טופס">
      <div className="overlay-body stack">
        <div className="row-between">
          <h2>טופס</h2>
          <button className="framed small" onClick={onClose}>
            סגירה
          </button>
        </div>
        {questions.map((question) => (
          <fieldset key={question.id} className={marked.includes(question.id) ? "stack missing" : "stack"} data-question={question.id}>
            <legend>{question.text}</legend>
            <QuestionInput question={question} value={answers[question.id]} onChange={(value) => setAnswers({ ...answers, [question.id]: value })} />
            {marked.includes(question.id) && <span className="problem">צריך לענות על השאלה הזאת.</span>}
          </fieldset>
        ))}
        {problem && (
          <p className="problem" role="alert">
            {problem}
          </p>
        )}
        <button className="primary" onClick={() => void submit()}>
          שליחת התשובות
        </button>
      </div>
    </div>
  );
}
