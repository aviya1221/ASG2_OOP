import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { SessionProvider } from "./accounts/session.tsx";
import { App } from "./App.tsx";
import { BackgroundTasksProvider } from "./tasks/BackgroundTasks.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <BackgroundTasksProvider>
          <App />
        </BackgroundTasksProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
