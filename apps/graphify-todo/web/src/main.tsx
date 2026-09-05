import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import { TodoApp } from "./widget/TodoApp";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(
  <StrictMode>
    <TodoApp />
  </StrictMode>,
);

