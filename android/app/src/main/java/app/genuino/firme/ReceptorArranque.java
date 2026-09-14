package app.genuino.firme;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Al reiniciar el movil, Android se olvida de todas las alarmas programadas.
 *
 * Como la cola queda guardada al programarla, aqui se rehace sin necesidad de
 * que el usuario abra la app: si se reinicia el movil a medianoche, la alarma
 * de las tres sigue en pie.
 */
public class ReceptorArranque extends BroadcastReceiver {

    @Override
    public void onReceive(Context contexto, Intent intencion) {
        String accion = intencion.getAction();
        if (accion == null) return;
        // Algunos fabricantes mandan el suyo propio en vez del estandar.
        boolean esArranque = Intent.ACTION_BOOT_COMPLETED.equals(accion)
                || "android.intent.action.QUICKBOOT_POWERON".equals(accion)
                || "android.intent.action.MY_PACKAGE_REPLACED".equals(accion);
        if (!esArranque) return;

        AlarmaExacta.crearCanal(contexto);

        SharedPreferences prefs = contexto.getSharedPreferences(
                AlarmaExacta.PREFS, Context.MODE_PRIVATE);
        String crudo = prefs.getString("cola", "[]");
        long ahora = System.currentTimeMillis();

        try {
            JSONArray cola = new JSONArray(crudo);
            for (int i = 0; i < cola.length(); i++) {
                JSONObject alarma = cola.getJSONObject(i);
                long cuando = alarma.optLong("cuando", 0);
                if (cuando <= ahora) continue; // las que ya pasaron, se dejan ir

                AlarmaExacta.programarUna(
                        contexto,
                        alarma.optInt("id", i + 1),
                        cuando,
                        alarma.optString("titulo", "Firme"),
                        alarma.optString("cuerpo", "Es la hora."),
                        alarma.optString("idSuceso", "")
                );
            }
        } catch (Exception ignorada) {
            // Si la cola esta ilegible, se rehara cuando se abra la app.
        }
    }
}
