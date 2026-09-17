import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Abrir un enlace fuera de la app.
 *
 * Hasta la 4.6 esto se hacía con `window.open(url, "_blank")` y **dentro de la
 * app no hacía absolutamente nada**. No daba error: devolvía `null` en
 * silencio, que es la peor forma de romperse — nadie puede depurar lo que no se
 * queja. Android solo atiende `window.open` si el WebView lleva
 * `setSupportMultipleWindows(true)` y un `onCreateWindow`, y Capacitor no pone
 * ninguno de los dos.
 *
 * Se llevó por delante tres cosas a la vez:
 *
 * 1. **La descarga del instalador** desde el aviso de versión nueva. Alex:
 *    «espero poder actualizar la app desde la aplicación» — y no podía.
 * 2. El mismo botón en Ajustes.
 * 3. **Todos los enlaces de «Juntos»**: los grupos de WhatsApp y Telegram y las
 *    redes. Aunque se hubieran puesto las direcciones buenas, no habría abierto
 *    ninguna.
 *
 * Ahora lo hace un `ACTION_VIEW` nativo y decide Android quién lo atiende: el
 * navegador descarga, y un enlace de WhatsApp lo recoge WhatsApp.
 */

type PluginNavegador = {
  abrir(opciones: { url: string }): Promise<{ abierto: boolean; motivo?: string }>;
};

const Navegador = registerPlugin<PluginNavegador>("Navegador");

/**
 * Devuelve si se pudo abrir.
 *
 * **Hay que mirar lo que devuelve.** Dar por hecho que se abrió es exactamente
 * el error que estuvo un mes escondido aquí: quien toca un enlace y no ve nada
 * concluye que la app está rota, y de ahí no se vuelve.
 */
export async function abrirEnlace(url: string): Promise<boolean> {
  if (!url) return false;

  if (Capacitor.isNativePlatform()) {
    try {
      return (await Navegador.abrir({ url })).abierto;
    } catch {
      return false;
    }
  }

  // En el navegador, `window.open` sí funciona — salvo que lo tape un bloqueador
  // de ventanas emergentes, y entonces también devuelve null. Se comprueba.
  try {
    const v = window.open(url, "_blank", "noopener,noreferrer");
    return v !== null;
  } catch {
    return false;
  }
}
