/** The answers of a poll as bars, one per option (REQ-35). */
export function ResultsChart({ options, counts }: { options: string[]; counts: number[] }) {
  const total = counts.reduce((sum, count) => sum + (count ?? 0), 0);
  return (
    <ul className="results plain" aria-label="תוצאות הסקר">
      {options.map((option, index) => {
        const count = counts[index] ?? 0;
        const percent = total === 0 ? 0 : Math.round((count / total) * 100);
        return (
          <li key={index} className="result-row" data-option={index}>
            <span className="row-between">
              <span>{option}</span>
              <span className="count">{count}</span>
            </span>
            <span className="track">
              <span className="bar" style={{ width: `${percent}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
