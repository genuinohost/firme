/* global self, clients */
/**
 * Añadidos al service worker que genera Workbox.
 *
 * Se encarga de dos cosas: que al tocar una notificación se abra la app (y no
 * una pestaña nueva encima de la que ya estaba), y de recibir los avisos push
 * si algún día se conecta un servidor que los empuje.
 */

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const abiertas = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const ventana of abiertas) {
        if ("focus" in ventana) {
          await ventana.focus();
          ventana.postMessage({
            tipo: "avisoTocado",
            clave: evento.notification.data?.clave ?? null,
          });
          return;
        }
      }
      await clients.openWindow("/");
    })(),
  );
});

/**
 * Web Push. Hoy no hay servidor que lo use, pero el service worker ya sabe
 * qué hacer con un mensaje cuando lo haya: así no hace falta reinstalar la app
 * para activarlo.
 */
self.addEventListener("push", (evento) => {
  let contenido = {};
  try {
    contenido = evento.data ? evento.data.json() : {};
  } catch {
    contenido = { titulo: "Firme", cuerpo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    self.registration.showNotification(contenido.titulo || "Firme", {
      body: contenido.cuerpo || "Es la hora.",
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      tag: contenido.clave || "firme",
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 500],
      data: { clave: contenido.clave ?? null },
    }),
  );
});
