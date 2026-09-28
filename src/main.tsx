import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/estilos.css";
import { registerSW } from "virtual:pwa-register";
import { seguirElDedo } from "@/logica/resorte";

// El service worker sirve la app sin conexión y muestra las notificaciones.
registerSW({ immediate: true });

// Que cada botón sepa dónde lo tocaron, para iluminarse justo ahí.
seguirElDedo();

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
