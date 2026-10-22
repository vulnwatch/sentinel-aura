// Zod's configuration comes first, before any module uses a schema.
import "./zod";
import "./styles.css";
import { QueryClient } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { createAppRouter } from "./router";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing the #root element");
}

createRoot(container).render(
  <StrictMode>
    <App router={createAppRouter()} queryClient={new QueryClient()} />
  </StrictMode>,
);
