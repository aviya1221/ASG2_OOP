import { LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { ICON, IconButton } from "../ui/Icon.tsx";
import { samePlace, useTasks } from "./BackgroundTasks.tsx";

const SHOW_MS = 10_000;

/** The sign in the top bar while actions run, with a list of them (UI decision 18). */
export function TaskIndicator() {
  const { tasks } = useTasks();
  const [open, setOpen] = useState(false);
  const running = tasks.filter((task) => task.status === "running");

  useEffect(() => {
    if (running.length === 0) setOpen(false);
  }, [running.length]);

  if (running.length === 0) return null;
  return (
    <div className="task-indicator">
      <button type="button" className="task-chip" aria-expanded={open} onClick={() => setOpen(!open)}>
        <LoaderCircle {...ICON} className="spin" />
        <span>{running.length === 1 ? "פעולה ברקע" : `${running.length} פעולות ברקע`}</span>
      </button>
      {open && (
        <ul className="task-list plain" aria-label="פעולות ברקע">
          {running.map((task) => (
            <li key={task.id}>
              <Link to={task.link} onClick={() => setOpen(false)}>
                {task.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A short message when an action ends, unless the user is already on the page that shows its result. */
export function TaskMessages() {
  const { tasks, dismiss } = useTasks();
  const { pathname } = useLocation();
  const ended = tasks.filter((task) => task.status !== "running" && !task.seen);
  const shown = ended.filter((task) => !samePlace(pathname, task.link));

  useEffect(() => {
    for (const task of ended) if (samePlace(pathname, task.link)) dismiss(task.id);
  }, [ended, pathname, dismiss]);

  const shownIds = shown.map((task) => task.id).join(",");
  useEffect(() => {
    if (!shownIds) return;
    const timer = setTimeout(() => shownIds.split(",").forEach((id) => dismiss(Number(id))), SHOW_MS);
    return () => clearTimeout(timer);
  }, [shownIds, dismiss]);

  if (shown.length === 0) return null;
  return (
    <div className="task-messages" role="status">
      {shown.map((task) => (
        <p key={task.id} className={task.status === "failed" ? "task-message failed" : "task-message"}>
          <span>{task.status === "failed" ? task.failText : task.doneText}</span>
          <Link to={task.link} onClick={() => dismiss(task.id)}>
            מעבר
          </Link>
          <IconButton icon={X} label="סגירת ההודעה" onClick={() => dismiss(task.id)} />
        </p>
      ))}
    </div>
  );
}
