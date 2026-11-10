import { useState } from "react";
import { formatScore, questionLabel, sectionLabel, type ChartRow } from "./scores.ts";

/** "overall", "q:<question id>" or "s:<section id>". */
export type ChartFilter = string;

export interface Place {
  row: ChartRow;
  score: number;
  place: number;
}

function scoreOf(row: ChartRow, filter: ChartFilter): number {
  if (filter.startsWith("q:")) return row.questionScores.find((q) => q.id === filter.slice(2))?.score ?? 0;
  if (filter.startsWith("s:")) return row.sectionScores.find((s) => s.id === filter.slice(2))?.score ?? 0;
  return row.overall;
}

/** Highest score first. Equal scores share a place, and the next place skips: 1, 1, 3 (REQ-57). */
export function places(rows: ChartRow[], filter: ChartFilter): Place[] {
  const scored = rows.map((row) => ({ row, score: scoreOf(row, filter) })).sort((a, b) => b.score - a.score);
  return scored.map((item) => ({ ...item, place: 1 + scored.filter((other) => other.score > item.score).length }));
}

/** The overall score, every question, and the sections of questions that have more than one. */
export function filterOptions(rows: ChartRow[]): { value: ChartFilter; label: string }[] {
  const first = rows[0];
  if (!first) return [];
  const sections = first.sectionScores;
  return [
    { value: "overall", label: "ציון כולל" },
    ...first.questionScores.map((q) => ({ value: `q:${q.id}`, label: questionLabel(q.question) })),
    ...sections
      .filter((s) => sections.filter((other) => other.question === s.question).length > 1)
      .map((s) => ({ value: `s:${s.id}`, label: sectionLabel(s, sections) })),
  ];
}

/** Every checked student's latest score, with the viewer's own place marked. */
export function ClassChart({ rows }: { rows: ChartRow[] }) {
  const [filter, setFilter] = useState<ChartFilter>("overall");
  return (
    <section className="stack" aria-label="גרף הכיתה">
      <div className="row-between">
        <h3>גרף הכיתה</h3>
        <label className="field chart-filter">
          <span>לפי</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {filterOptions(rows).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol className="results plain">
        {places(rows, filter).map(({ row, score, place }, index) => (
          <li key={index} className={row.isMe ? "result-row me" : "result-row"} aria-current={row.isMe ? "true" : undefined}>
            <span className="row-between">
              <span>
                <span className="place">{place}.</span> {row.name}
                {row.isMe && <span className="me-note"> (המקום שלך)</span>}
              </span>
              <span className="count">{formatScore(score)}</span>
            </span>
            <span className="track">
              <span className="bar" style={{ width: `${score}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
