import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { PresenterWindow } from "./present/PresenterWindow";
import { inTauri } from "./lib/env";
import { useLocale } from "./lib/i18n";
import "./lib/embeddedFonts";
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

// Remount the whole tree when the locale changes so every t() re-evaluates.
function Root() {
  const locale = useLocale();
  return isPresenterWindow() ? <PresenterWindow key={locale} /> : <App key={locale} />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
