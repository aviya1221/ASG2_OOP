import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "../accounts/session.tsx";

export type TaskKind = "homework-publish" | "homework-check" | "summary-upload" | "class-photo" | "class-send" | "face-register";

/** What a long action is, where its result shows, and what to say when it ends (UI decision 18, NFR-13). */
export interface TaskInfo {
  kind: TaskKind;
  /** One action of a kind per key, for example the lesson of a homework being published. */
  key: string;
  /** The lesson (or page) whose screen shows the result, so that screen reloads when the action ends. */
  scope: string;
  label: string;
  doneText: string;
  failText: string;
  link: string;
  /** True when closing the page would stop the action, for example while a file is sent, so the page asks first. */
  stopsOnClose?: boolean;
}

export interface Task extends TaskInfo {
  id: number;
  status: "running" | "done" | "failed";
  result?: unknown;
  error?: unknown;
  /** False until the user has seen the message about the end of the action. */
  seen: boolean;
}

interface TaskStore {
  tasks: Task[];
  start: (info: TaskInfo, work: () => Promise<unknown>) => void;
  dismiss: (id: number) => void;
  clear: (kind: TaskKind, scope: string) => void;
}

const TaskContext = createContext<TaskStore | null>(null);

/** Keeps every long action outside the screens, so moving to another page does not lose it. */
export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const nextId = useRef(1);
  const session = useSession();
  const signedOut = session.status === "signed-out";

  useEffect(() => {
    if (signedOut) setTasks([]);
  }, [signedOut]);

  const start = useCallback((info: TaskInfo, work: () => Promise<unknown>) => {
    const id = nextId.current++;
    // A new action replaces the earlier one of the same kind and key, which has ended.
    setTasks((all) => [...all.filter((task) => task.kind !== info.kind || task.key !== info.key), { ...info, id, status: "running", seen: false }]);
    const update = (patch: Partial<Task>) => setTasks((all) => all.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    work().then(
      (result) => update({ status: "done", result }),
      (error: unknown) => update({ status: "failed", error }),
    );
  }, []);

  const dismiss = useCallback((id: number) => setTasks((all) => all.map((task) => (task.id === id ? { ...task, seen: true } : task))), []);
  const clear = useCallback((kind: TaskKind, scope: string) => setTasks((all) => all.filter((task) => task.kind !== kind || task.scope !== scope)), []);

  const wouldStop = tasks.some((task) => task.stopsOnClose && task.status === "running");
  useEffect(() => {
    if (!wouldStop) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [wouldStop]);

  const store = useMemo(() => ({ tasks, start, dismiss, clear }), [tasks, start, dismiss, clear]);
  return <TaskContext.Provider value={store}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskStore {
  const store = useContext(TaskContext);
  if (!store) throw new Error("useTasks needs a BackgroundTasksProvider");
  return store;
}

/** The latest action of a kind and key, if there is one. */
export function useTask(kind: TaskKind, key: string): Task | undefined {
  return useTasks().tasks.find((task) => task.kind === kind && task.key === key);
}

/** Changes whenever an action of this scope ends, so a screen can reload what it shows. */
export function useEndedCount(scope: string): number {
  return useTasks().tasks.filter((task) => task.scope === scope && task.status !== "running").length;
}

/** The lesson page shows the attendance tab when the address names no tab. */
export function samePlace(pathname: string, link: string): boolean {
  const plain = (path: string) => path.replace(/\/$/, "").replace(/^(\/lessons\/[^/]+)\/attendance$/, "$1");
  return plain(pathname) === plain(link);
}
