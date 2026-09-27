package app.genuino.firme;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Pasarle la app a alguien, el archivo mismo.
 *
 * <p><b>Por que existe.</b> Alex, el 27-09-2026: «quiero instalar la APK en el
 * cel de mi mama pero no veo la opcion de compartir la aplicacion desde la app.
 * Eso es mientras tenemos la aplicacion en Play Store».
 *
 * <p>Y mientras no este en Play, mandar un enlace es la peor de las dos
 * opciones: la otra persona tiene que bajar treinta megas por su conexion, y
 * ese mismo dia Alex habia grabado como una descarga se quedaba en negro. El
 * archivo, en cambio, ya esta en este movil: Android guarda el APK instalado y
 * lo deja leer. Se copia a la cache y se manda por WhatsApp, Bluetooth o
 * Compartir cercano — sin que nadie descargue nada.
 *
 * <p><b>Por que se copia y no se manda el original.</b> El APK instalado vive
 * en una carpeta del sistema que ninguna otra app puede leer. El FileProvider
 * de Capacitor solo da acceso a lo que hay en la cache de esta app, asi que
 * hay que llevarlo alli primero. Son treinta megas: tarda un segundo.
 *
 * <p>Esto sobra el dia que la app este en Google Play. Ese dia se cambia por
 * compartir el enlace de la ficha, que es lo que hace todo el mundo.
 */
@CapacitorPlugin(name = "PasarApp")
public class PasarApp extends Plugin {

    @PluginMethod
    public void compartirApk(PluginCall llamada) {
        Context contexto = getContext();
        try {
            PackageInfo info = contexto.getPackageManager()
                    .getPackageInfo(contexto.getPackageName(), 0);
            String version = info.versionName == null ? "" : info.versionName;

            // Una carpeta propia dentro de la cache, y siempre el mismo nombre:
            // asi no se acumulan copias de cada version.
            File carpeta = new File(contexto.getCacheDir(), "pasar");
            if (!carpeta.exists() && !carpeta.mkdirs()) {
                llamada.reject("no-se-pudo-crear-la-carpeta");
                return;
            }
            File copia = new File(carpeta, "Genuino-" + version + ".apk");
            copiar(new File(contexto.getApplicationInfo().sourceDir), copia);

            Uri uri = FileProvider.getUriForFile(
                    contexto, contexto.getPackageName() + ".fileprovider", copia);

            Intent enviar = new Intent(Intent.ACTION_SEND);
            enviar.setType("application/vnd.android.package-archive");
            enviar.putExtra(Intent.EXTRA_STREAM, uri);
            enviar.putExtra(Intent.EXTRA_SUBJECT, "Genuino " + version);
            enviar.putExtra(Intent.EXTRA_TEXT,
                    "Te paso Genuino. Toca el archivo para instalarla; si el movil "
                            + "pregunta, permite instalar desde esta app.");
            enviar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent selector = Intent.createChooser(enviar, "Pasar Genuino a…");
            selector.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(selector);

            JSObject r = new JSObject();
            r.put("version", version);
            r.put("bytes", copia.length());
            llamada.resolve(r);
        } catch (Exception e) {
            llamada.reject("no-se-pudo-compartir", e);
        }
    }

    private static void copiar(File de, File a) throws Exception {
        try (InputStream entrada = new FileInputStream(de);
             OutputStream salida = new FileOutputStream(a)) {
            byte[] trozo = new byte[64 * 1024];
            int leidos;
            while ((leidos = entrada.read(trozo)) > 0) salida.write(trozo, 0, leidos);
        }
    }
}
