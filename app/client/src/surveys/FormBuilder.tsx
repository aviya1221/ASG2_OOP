import { useState } from "react";
import { cleanQuestions, hasOptions, newQuestion, QUESTION_TYPES, questionProblems, type Question, type QuestionType } from "./questions.ts";

/** Builds a form of the four question types (REQ-60, REQ-61), from the form builder spike (ADR-7). */
export function FormBuilder({
  onSave,
  onClose,
}: {
  onSave: (questions: Question[], allowChange: boolean, publish: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allowChange, setAllowChange] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const change = (id: string, patch: Partial<Question>) => setQuestions((all) => all.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  async function save(publish: boolean) {
    const found = questionProblems(questions);
    setProblems(found);
    if (found.length > 0) return;
    try {
      await onSave(cleanQuestions(questions), allowChange, publish);
    } catch (error) {
      setProblems([error instanceof Error ? error.message : "השמירה נכשלה."]);
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="טופס חדש">
      <div className="overlay-body stack">
        <div className="row-between">
          <h2>טופס חדש</h2>
          <button className="framed small" onClick={onClose}>
            ביטול
          </button>
        </div>
        {questions.map((question, index) => (
          <fieldset key={question.id} className="stack">
            <legend>
              שאלה {index + 1}: {QUESTION_TYPES[question.type]}
            </legend>
            <label className="field">
              <span>נוסח השאלה</span>
              <input value={question.text} onChange={(e) => change(question.id, { text: e.target.value })} aria-label={`נוסח שאלה ${index + 1}`} />
            </label>
            {(question.options ?? []).map((option, i) => (
              <label key={i} className="field">
                <span>אפשרות {i + 1}</span>
                <input
                  value={option}
                  aria-label={`שאלה ${index + 1} אפשרות ${i + 1}`}
                  onChange={(e) => change(question.id, { options: (question.options ?? []).map((o, k) => (k === i ? e.target.value : o)) })}
                />
              </label>
            ))}
            {hasOptions(question.type) && (
              <button className="link" onClick={() => change(question.id, { options: [...(question.options ?? []), ""] })}>
                הוספת אפשרות
              </button>
            )}
            {question.type === "rating" && <span className="muted">סולם מ־1 עד {question.scale}</span>}
            <button className="link" onClick={() => setQuestions((all) => all.filter((q) => q.id !== question.id))}>
              מחיקת השאלה
            </button>
          </fieldset>
        ))}
        <div className="chips">
          {(Object.entries(QUESTION_TYPES) as [QuestionType, string][]).map(([type, label]) => (
            <button key={type} className="framed small" onClick={() => setQuestions((all) => [...all, newQuestion(`q${all.length + 1}-${Date.now()}`, type)])}>
              + {label}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={allowChange} onChange={(e) => setAllowChange(e.target.checked)} />
          לאפשר לשנות תשובה
        </label>
        {problems.length > 0 && (
          <ul className="problem plain" role="alert">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <div className="actions">
          <button className="framed small" onClick={() => void save(false)}>
            שמירה כטיוטה
          </button>
          <button className="primary small" onClick={() => void save(true)}>
            פרסום בפורום
          </button>
        </div>
      </div>
    </div>
  );
}
