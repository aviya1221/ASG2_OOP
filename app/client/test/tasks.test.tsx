import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { BackgroundTasksProvider, samePlace, useEndedCount, useTask, useTasks, type TaskInfo } from "../src/tasks/BackgroundTasks.tsx";
import { TaskMessages } from "../src/tasks/TaskNotices.tsx";

vi.mock("../src/lib/supabase.ts", () => ({ supabase: {} }));

const INFO: TaskInfo = {
  kind: "homework-publish",
  key: "L1",
  scope: "L1",
  label: "פרסום המטלה",
  doneText: "המטלה פורסמה.",
  failText: "הפרסום נכשל.",
  link: "/lessons/L1/homework",
  stopsOnClose: true,
};

function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** Stands for a screen such as the homework tab: it starts the action and shows its state. */
function Screen({ work }: { work: () => Promise<string> }) {
  const { start } = useTasks();
  const task = useTask("homework-publish", "L1");
  const ended = useEndedCount("L1");
  return (
    <div>
      <button onClick={() => start(INFO, work)}>התחלה</button>
      <p>מצב: {task?.status ?? "אין"}</p>
      <p>הסתיימו: {ended}</p>
    </div>
  );
}

function App({ work, at = "/lessons/L1/forum" }: { work: () => Promise<string>; at?: string }) {
  const [shown, setShown] = useState(true);
  return (
    <MemoryRouter initialEntries={[at]}>
      <BackgroundTasksProvider>
        <button onClick={() => setShown(!shown)}>מעבר עמוד</button>
        {shown && <Screen work={work} />}
        <TaskMessages />
      </BackgroundTasksProvider>
    </MemoryRouter>
  );
}

describe("BackgroundTasks", () => {
  it("TC-119 an action goes on when the user leaves its screen, and its result shows on return", async () => {
    const user = userEvent.setup();
    const work = deferred();
    render(<App work={() => work.promise} />);

    await user.click(screen.getByRole("button", { name: "התחלה" }));
    expect(screen.getByText("מצב: running")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "מעבר עמוד" }));
    expect(screen.queryByText(/מצב:/)).toBeNull();
    await act(async () => work.resolve("ok"));

    expect(screen.getByRole("status")).toHaveTextContent("המטלה פורסמה.");
    await user.click(screen.getByRole("button", { name: "מעבר עמוד" }));
    expect(screen.getByText("מצב: done")).toBeVisible();
    expect(screen.getByText("הסתיימו: 1")).toBeVisible();
  });

  it("TC-119 keeps a failure until the next try, and says so when the user is elsewhere", async () => {
    const user = userEvent.setup();
    const work = deferred();
    render(<App work={() => work.promise} />);

    await user.click(screen.getByRole("button", { name: "התחלה" }));
    await act(async () => work.reject(new Error("no")));
    expect(screen.getByText("מצב: failed")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("הפרסום נכשל.");
  });

  it("TC-119 asks before closing the page while an action would stop", async () => {
    const user = userEvent.setup();
    const work = deferred();
    render(<App work={() => work.promise} />);
    const closing = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(closing()).toBe(false);
    await user.click(screen.getByRole("button", { name: "התחלה" }));
    expect(closing()).toBe(true);
    await act(async () => work.resolve("ok"));
    expect(closing()).toBe(false);
  });

  it("does not show the end message on the page that shows the result", async () => {
    const user = userEvent.setup();
    const work = deferred();
    render(<App work={() => work.promise} at="/lessons/L1/homework" />);

    await user.click(screen.getByRole("button", { name: "התחלה" }));
    await act(async () => work.resolve("ok"));
    expect(screen.getByText("מצב: done")).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("samePlace", () => {
  it("counts a lesson address with no tab as the attendance tab", () => {
    expect(samePlace("/lessons/L1", "/lessons/L1/attendance")).toBe(true);
    expect(samePlace("/lessons/L1/forum", "/lessons/L1/homework")).toBe(false);
    expect(samePlace("/face/", "/face")).toBe(true);
  });
});
