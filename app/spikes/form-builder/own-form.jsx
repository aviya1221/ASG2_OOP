/**
 * Spike F6: our own form builder and answer window, for the four question types of REQ-61.
 * It is here to measure how much code the need really takes.
 */
import { useState } from "react";

export const QUESTION_TYPES = { single: "בחירה יחידה", multiple: "בחירה מרובה", scale: "דירוג בסולם", text: "טקסט חופשי" };
const SCALE = [1, 2, 3, 4, 5];
const hasOptions = (type) => type === "single" || type === "multiple";

export const newQuestion = (id, type) => ({ id, type, title: "", options: hasOptions(type) ? ["", ""] : [] });

/** The questions that still have no answer. */
export function missingAnswers(form, answers) {
  return form.questions.filter((q) => {
    const answer = answers[q.id];
    return answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0);
  });
}

export function FormBuilder({ onPublish }) {
  const [questions, setQuestions] = useState([]);
  const change = (id, patch) => setQuestions((all) => all.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  return (
    <section dir="rtl">
      {questions.map((q) => (
        <fieldset key={q.id}>
          <legend>{QUESTION_TYPES[q.type]}</legend>
          <input aria-label="השאלה" value={q.title} onChange={(e) => change(q.id, { title: e.target.value })} />
          {q.options.map((option, i) => (
            <input
              key={i}
              aria-label={`אפשרות ${i + 1}`}
              value={option}
              onChange={(e) => change(q.id, { options: q.options.map((o, k) => (k === i ? e.target.value : o)) })}
            />
          ))}
          {hasOptions(q.type) && <button onClick={() => change(q.id, { options: [...q.options, ""] })}>הוספת אפשרות</button>}
          <button onClick={() => setQuestions((all) => all.filter((x) => x.id !== q.id))}>מחיקה</button>
        </fieldset>
      ))}
      {Object.entries(QUESTION_TYPES).map(([type, label]) => (
        <button key={type} onClick={() => setQuestions((all) => [...all, newQuestion(crypto.randomUUID(), type)])}>{label}</button>
      ))}
      <button disabled={questions.length === 0} onClick={() => onPublish({ questions })}>פרסום</button>
    </section>
  );
}

function Question({ question: q, value, onChange }) {
  if (q.type === "text") return <textarea aria-label={q.title} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "scale") {
    return SCALE.map((n) => (
      <label key={n}><input type="radio" name={q.id} checked={value === n} onChange={() => onChange(n)} />{n}</label>
    ));
  }
  if (q.type === "single") {
    return q.options.map((o) => (
      <label key={o}><input type="radio" name={q.id} checked={value === o} onChange={() => onChange(o)} />{o}</label>
    ));
  }
  const chosen = value ?? [];
  return q.options.map((o) => (
    <label key={o}>
      <input type="checkbox" checked={chosen.includes(o)} onChange={() => onChange(chosen.includes(o) ? chosen.filter((x) => x !== o) : [...chosen, o])} />
      {o}
    </label>
  ));
}

export function FormWindow({ form, onSubmit, initialAnswers = {} }) {
  const [answers, setAnswers] = useState(initialAnswers);
  const missing = missingAnswers(form, answers);
  return (
    <dialog open dir="rtl">
      {form.questions.map((q) => (
        <fieldset key={q.id}>
          <legend>{q.title}</legend>
          <Question question={q} value={answers[q.id]} onChange={(value) => setAnswers({ ...answers, [q.id]: value })} />
        </fieldset>
      ))}
      <button disabled={missing.length > 0} onClick={() => onSubmit(answers)}>שליחה</button>
    </dialog>
  );
}
