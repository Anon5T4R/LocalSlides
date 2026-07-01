import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { PresenterWindow } from "./present/PresenterWindow";
import { inTauri } from "./lib/env";
import "./App.css";

// The presenter window (Onda 11.1) loads the very same index.html but under
// the "presenter" window label — getCurrentWindow() is synchronous, so this
// branch can happen before the first render with no async dance.
function isPresenterWindow(): boolean {
  if (!inTauri()) return false;
  try {
    return getCurrentWindow().label === "presenter";
  } catch {
    return false;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isPresenterWindow() ? <PresenterWindow /> : <App />}
  </React.StrictMode>,
);
