import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "@/App";
import "@/estilos.css";
import { registerSW } from "virtual:pwa-register";
import { seguirElDedo } from "@/logica/resorte";

/**
 * El service worker sirve la web sin conexión. **Sólo en la web.**
 *
 * Dentro del APK los archivos ya vienen en el paquete y las alarmas son
 * nativas: el service worker no aporta nada y sí estorbaba. Al instalar una
 * versión nueva, el service worker VIEJO seguía mandando en `https://localhost`
 * y servía su copia en caché: se veía la app anterior, con su intro, y a los
 * pocos segundos —al activarse el nuevo— la página se recargaba sola bajo los
 * dedos del usuario, con otra intro y lo que estuviera a medias perdido.
 * (Revisión de la 6.18.) Los que ya estaban instalados se dan de baja aquí.
 */
if (Capacitor.isNativePlatform()) {
  void navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
} else {
  registerSW({ immediate: true });
}

// Que cada botón sepa dónde lo tocaron, para iluminarse justo ahí.
seguirElDedo();

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
