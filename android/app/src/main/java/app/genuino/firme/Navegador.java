package app.genuino.firme;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Abrir un enlace fuera de la app.
 *
 * <p><b>Por qué existe esto.</b> Hasta la 4.6 los enlaces se abrian con
 * {@code window.open(url, "_blank")}, y dentro de la app <b>eso no hacia
 * absolutamente nada</b>. No fallaba con un error: devolvia null en silencio,
 * que es la peor forma de romperse. Android solo atiende {@code window.open} si
 * el WebView tiene {@code setSupportMultipleWindows(true)} y un
 * {@code onCreateWindow} que lo recoja, y Capacitor no pone ninguno de los dos.
 *
 * <p>Se llevo por delante tres cosas a la vez, y ninguna dejo rastro:
 *
 * <ul>
 *   <li>La descarga del instalador desde el aviso de version nueva — por eso
 *       Alex no podia actualizar «desde la misma aplicacion», que es justo lo
 *       que habia pedido.
 *   <li>El mismo boton en Ajustes.
 *   <li><b>Todos los enlaces de «Juntos»</b>: los grupos de WhatsApp y
 *       Telegram y las redes. Aunque se hubieran puesto las direcciones buenas,
 *       no habrian abierto ninguna.
 * </ul>
 *
 * <p>Aqui se hace lo que hace todo el mundo: un {@code ACTION_VIEW} y que
 * Android decida quien lo atiende. El navegador se encarga de descargar, y un
 * enlace de WhatsApp lo recoge WhatsApp. Ademas <b>se dice si se pudo o no</b>,
 * en vez de dar por hecho que si: eso es lo que permite enseñar el enlace a
 * mano cuando no hay nada que lo abra.
 */
@CapacitorPlugin(name = "Navegador")
public class Navegador extends Plugin {

    @PluginMethod
    public void abrir(PluginCall llamada) {
        String url = llamada.getString("url");
        JSObject respuesta = new JSObject();

        if (url == null || url.trim().isEmpty()) {
            llamada.reject("sin-url");
            return;
        }

        try {
            Intent intencion = new Intent(Intent.ACTION_VIEW, Uri.parse(url.trim()));
            intencion.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intencion);
            respuesta.put("abierto", true);
            llamada.resolve(respuesta);
        } catch (ActivityNotFoundException e) {
            // No hay nada instalado que sepa abrir esto. Pasa con enlaces de
            // apps que el usuario no tiene.
            respuesta.put("abierto", false);
            respuesta.put("motivo", "sin-app");
            llamada.resolve(respuesta);
        } catch (Exception e) {
            respuesta.put("abierto", false);
            respuesta.put("motivo", e.getMessage());
            llamada.resolve(respuesta);
        }
    }
}
