import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/estilos.css";
import { registerSW } from "virtual:pwa-register";

// El service worker sirve la app sin conexión y muestra las notificaciones.
registerSW({ immediate: true });

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
