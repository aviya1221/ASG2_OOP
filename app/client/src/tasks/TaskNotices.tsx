import { X } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { ICON, IconButton } from "../ui/Icon.tsx";
import { samePlace, useTasks } from "./BackgroundTasks.tsx";

const SHOW_MS = 10_000;

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
