import React from "react";
import ForgeReconciler from "@forge/react";
import { App } from "./App";

/**
 * UI Kit entry point. `manifest.yml` resources point at this file; the Forge
 * deploy bundler builds it. No app-side build tooling (no Vite, no webpack).
 */
ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
