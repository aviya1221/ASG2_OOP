import { formatScore, MAX_CHECKS, questionLabel, sectionLabel, type Check } from "./scores.ts";

/** The report of a check, shown only to the student who asked for it (REQ-53, REQ-54). */
export function ReportView({ check }: { check: Check }) {
  const sections = check.report.sections;
  const unanswered = sections.filter((section) => !section.answered);
  return (
    <section className="stack report" aria-label="הדוח שלך">
      <h3>
        הדוח שלך: בדיקה {check.checkNumber} מתוך {MAX_CHECKS}
      </h3>
      {unanswered.length > 0 && (
        <p className="problem" role="note">
          סעיפים שלא נענו וקיבלו 0: {unanswered.map((section) => sectionLabel(section, sections)).join("; ")}.
        </p>
      )}
      <p className="big">ציון כולל: {check.overall}</p>
      <ul className="plain chips" aria-label="ציוני השאלות">
        {check.questionScores.map((question) => (
          <li key={question.id} className="chip framed">
            {questionLabel(question.question)}: {formatScore(question.score)}
          </li>
        ))}
      </ul>
      {sections.map((section) => (
        <article key={section.id} className="stack report-section" aria-label={sectionLabel(section, sections)}>
          <div className="row-between">
            <h4>{sectionLabel(section, sections)}</h4>
            <b>{section.answered ? `${section.score} מתוך 100` : "לא נענה: 0"}</b>
          </div>
          {section.answered && (
            <dl className="feedback">
              <dt>מה עומד בדרישות</dt>
              <dd>{section.meets}</dd>
              <dt>מה חסר</dt>
              <dd>{section.missing}</dd>
              <dt>כיוון לשיפור</dt>
              <dd>{section.direction}</dd>
            </dl>
          )}
        </article>
      ))}
    </section>
  );
}
