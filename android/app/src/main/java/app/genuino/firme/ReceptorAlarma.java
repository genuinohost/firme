package app.genuino.firme;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

/**
 * Lo que ocurre cuando llega la hora.
 *
 * Android despierta este receptor aunque la app lleve dias cerrada, y aqui solo
 * hay que hacer dos cosas, en este orden:
 *
 *  1. **Arrancar el servicio que repica** (`ServicioAlarma`). Es el que
 *     reproduce el audio por el flujo de alarma y no se calla hasta que alguien
 *     lo para. Arrancarlo desde aqui esta permitido aunque el movil este
 *     dormido, porque la alarma se programo con `setAlarmClock` y la app tiene
 *     `USE_EXACT_ALARM`: eso exime de la restriccion de servicios en segundo
 *     plano.
 *
 *  2. Si eso falla —el fabricante lo prohibe, el sistema lo rechaza—, publicar
 *     la notificacion sonora de toda la vida. Es peor, pero es ruido, y el
 *     silencio no es una opcion.
 *
 * Ademas se deja anotado que la alarma sono. Sin ese apunte, un fallo de
 * madrugada es invisible: nadie puede distinguir «no sono» de «sono y no me
 * enteré», y lo que no se mide no se arregla.
 */
public class ReceptorAlarma extends BroadcastReceiver {

    @Override
    public void onReceive(Context contexto, Intent intencion) {
        int id = intencion.getIntExtra("id", 1);
        String titulo = intencion.getStringExtra("titulo");
        String cuerpo = intencion.getStringExtra("cuerpo");
        String idSuceso = intencion.getStringExtra("idSuceso");
        long prevista = intencion.getLongExtra("cuando", 0L);
        if (titulo == null) titulo = "Firme";
        if (cuerpo == null) cuerpo = "Es la hora.";

        anotarQueSono(contexto, id, prevista);

        // Rearmar las siguientes, aqui y ahora. Es lo que hace que la cadena se
        // sostenga sola: si el sistema hubiera tirado alguna, esto la repone sin
        // que nadie abra la app, y la cola nunca se agota aunque pasen semanas.
        AlarmaExacta.armarLasProximas(contexto);

        if (arrancarElServicio(contexto, id, titulo, cuerpo, idSuceso)) return;

        // Red de seguridad: la notificacion sonora de siempre.
        avisoDeRespaldo(contexto, id, titulo, cuerpo, idSuceso);
    }

    private boolean arrancarElServicio(
            Context contexto, int id, String titulo, String cuerpo, String idSuceso) {
        try {
            Intent sonar = new Intent(contexto, ServicioAlarma.class);
            sonar.setAction(ServicioAlarma.ACCION_SONAR);
            sonar.putExtra("id", id);
            sonar.putExtra("titulo", titulo);
            sonar.putExtra("cuerpo", cuerpo);
            sonar.putExtra("idSuceso", idSuceso);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                contexto.startForegroundService(sonar);
            } else {
                contexto.startService(sonar);
            }
            return true;
        } catch (Exception e) {
            anotarElFallo(contexto, e.getClass().getSimpleName() + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * El aviso de respaldo, por el canal que si lleva sonido. Solo se usa si el
     * servicio no pudo arrancar.
     */
    private void avisoDeRespaldo(
            Context contexto, int id, String titulo, String cuerpo, String idSuceso) {
        AlarmaExacta.crearCanal(contexto);

        Intent abrir = new Intent(contexto, MainActivity.class);
        abrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        abrir.putExtra("alarma", true);
        abrir.putExtra("idSuceso", idSuceso);
        abrir.setData(Uri.parse("firme://alarma/" + id));

        PendingIntent entrar = PendingIntent.getActivity(
                contexto, id, abrir,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification aviso = new NotificationCompat.Builder(contexto, AlarmaExacta.CANAL)
                .setSmallIcon(R.drawable.ic_stat_firme)
                .setColor(0xFFC9A227)
                .setContentTitle(titulo)
                .setContentText(cuerpo)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(cuerpo))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(entrar)
                .setFullScreenIntent(entrar, true)
                .build();

        NotificationManager gestor =
                (NotificationManager) contexto.getSystemService(Context.NOTIFICATION_SERVICE);
        if (gestor != null) gestor.notify(id, aviso);
    }

    // ------------------------------------------------------------- la bitacora

    /**
     * Deja constancia de cada disparo. La app lo lee al abrirse y lo compara con
     * lo que tenia que haber sonado, para poder decir en voz alta «esta alarma
     * no sono» en vez de dejarlo pasar.
     */
    private void anotarQueSono(Context contexto, int id, long prevista) {
        try {
            SharedPreferences prefs =
                    contexto.getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE);
            org.json.JSONArray diario =
                    new org.json.JSONArray(prefs.getString(AlarmaExacta.CLAVE_DIARIO, "[]"));

            org.json.JSONObject apunte = new org.json.JSONObject();
            apunte.put("id", id);
            apunte.put("prevista", prevista);
            apunte.put("real", System.currentTimeMillis());
            diario.put(apunte);

            // Solo interesan los ultimos dias; lo viejo se tira.
            org.json.JSONArray recorte = new org.json.JSONArray();
            int desde = Math.max(0, diario.length() - 120);
            for (int i = desde; i < diario.length(); i++) recorte.put(diario.get(i));

            prefs.edit().putString(AlarmaExacta.CLAVE_DIARIO, recorte.toString()).apply();
        } catch (Exception ignorada) {
            // Un diario que no se puede escribir no debe impedir que suene.
        }
    }

    private void anotarElFallo(Context contexto, String motivo) {
        try {
            contexto.getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(AlarmaExacta.CLAVE_ULTIMO_FALLO,
                            System.currentTimeMillis() + "|" + motivo)
                    .apply();
        } catch (Exception ignorada) { }
    }
}
