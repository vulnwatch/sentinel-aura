// Zod's configuration comes first, before any module uses a schema.
import "./zod";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { createQueryClient } from "./query-client";
import { createAppRouter } from "./router";
import { followThemePreference } from "./theme";

followThemePreference();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing the #root element");
}

createRoot(container).render(
  <StrictMode>
    <App router={createAppRouter()} queryClient={createQueryClient()} />
  </StrictMode>,
);
