import { Lock } from "lucide-react";
import { useState } from "react";
import { ICON } from "../ui/Icon.tsx";
import { ResultsChart } from "./ResultsChart.tsx";
import type { AnswerRow, Survey } from "./SurveyApi.ts";
import type { Answers } from "./questions.ts";

/** A quick poll in the forum: the options, the live chart and, for the teacher, who answered. */
export function PollCard({
  survey,
  counts,
  myAnswer,
  isTeacher,
  whoAnswered,
  compact = false,
  onChoose,
  onClose,
}: {
  survey: Survey;
  counts: number[];
  myAnswer: Answers | undefined;
  isTeacher: boolean;
  whoAnswered: AnswerRow[];
  compact?: boolean;
  onChoose: (option: number) => Promise<void>;
  onClose: () => Promise<void>;
}) {
  const [problem, setProblem] = useState("");
  const question = survey.questions[0]!;
  const options = question.options ?? [];
  const mine = myAnswer?.q1 as number | undefined;
  const open = survey.status === "open";
  const mayChoose = !isTeacher && open && (mine === undefined || survey.allowChange);

  async function choose(option: number) {
    setProblem("");
    try {
      await onChoose(option);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "התשובה לא נשמרה.");
    }
  }

  if (compact) {
    return (
      <p className="card poll-line" data-survey={survey.id}>
        סקר: {question.text} · {counts.reduce((sum, count) => sum + (count ?? 0), 0)} תשובות{open ? "" : " · סגור"}
      </p>
    );
  }

  return (
    <article className="card framed stack" data-survey={survey.id} aria-label={`סקר: ${question.text}`}>
      <b>סקר: {question.text}</b>
      {mayChoose && (
        <div className="choices" role="group" aria-label="אפשרויות הסקר">
          {options.map((option, index) => (
            <button key={index} className={mine === index ? "option chosen" : "option"} aria-pressed={mine === index} onClick={() => void choose(index)}>
              {option}
            </button>
          ))}
        </div>
      )}
      {mine !== undefined && <span className="muted">בחרת: {options[mine]}</span>}
      <ResultsChart options={options} counts={counts} />
      {!open && <span className="muted">הסקר סגור</span>}
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      {isTeacher && whoAnswered.length > 0 && (
        <details>
          <summary>מי ענה</summary>
          <ul className="plain">
            {whoAnswered.map((row) => (
              <li key={row.studentId}>
                {row.name}: {options[row.value.q1 as number]}
              </li>
            ))}
          </ul>
        </details>
      )}
      {isTeacher && open && (
        <button className="secondary small" onClick={() => void onClose()}>
          <Lock {...ICON} />
          סגירת הסקר
        </button>
      )}
    </article>
  );
}
