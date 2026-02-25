
import { createRoot } from "react-dom/client";
import App from "../client/src/App";
import "./index.css";
import { ToastProvider } from "../client/src/components/ui/ToastProvider";

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
