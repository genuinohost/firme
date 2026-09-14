package app.genuino.firme;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Lo que ocurre cuando llega la hora.
 *
 * Android despierta este receptor aunque la app lleve horas cerrada. Desde aqui
 * se levanta la pantalla y se lanza un aviso de los que no se pueden ignorar:
 * categoria de alarma, prioridad maxima y pantalla completa, que con el movil
 * bloqueado abre la app en vez de dejar el aviso en la bandeja.
 */
public class ReceptorAlarma extends BroadcastReceiver {

    @Override
    public void onReceive(Context contexto, Intent intencion) {
        int id = intencion.getIntExtra("id", 1);
        String titulo = intencion.getStringExtra("titulo");
        String cuerpo = intencion.getStringExtra("cuerpo");
        String idSuceso = intencion.getStringExtra("idSuceso");
        if (titulo == null) titulo = "Firme";
        if (cuerpo == null) cuerpo = "Es la hora.";

        encenderPantalla(contexto);
        AlarmaExacta.crearCanal(contexto);

        // Al tocar el aviso —o al abrirse solo con el movil bloqueado— se entra
        // en la app, que enseña su propia pantalla de alarma y suena en bucle.
        Intent abrir = new Intent(contexto, MainActivity.class);
        abrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        abrir.putExtra("alarma", true);
        abrir.putExtra("idSuceso", idSuceso);
        abrir.setData(Uri.parse("firme://alarma/" + id));

        PendingIntent entrar = PendingIntent.getActivity(
                contexto,
                id,
                abrir,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder aviso = new NotificationCompat.Builder(contexto, AlarmaExacta.CANAL)
                .setSmallIcon(R.drawable.ic_stat_firme)
                .setColor(0xFFC9A227)
                .setContentTitle(titulo)
                .setContentText(cuerpo)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(cuerpo))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                // Categoria de alarma: es lo que la distingue de un aviso
                // cualquiera y lo que hace que No molestar la deje pasar.
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOngoing(false)
                .setContentIntent(entrar)
                // Con la pantalla bloqueada, esto abre la app directamente.
                .setFullScreenIntent(entrar, true);

        NotificationManager gestor =
                (NotificationManager) contexto.getSystemService(Context.NOTIFICATION_SERVICE);
        if (gestor != null) {
            gestor.notify(id, aviso.build());
        }
    }

    /**
     * Enciende la pantalla unos segundos. Sin esto, el aviso a pantalla completa
     * puede quedarse esperando a que alguien toque el movil.
     */
    private void encenderPantalla(Context contexto) {
        try {
            PowerManager energia = (PowerManager) contexto.getSystemService(Context.POWER_SERVICE);
            if (energia == null) return;
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock despertador = energia.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK
                            | PowerManager.ACQUIRE_CAUSES_WAKEUP
                            | PowerManager.ON_AFTER_RELEASE,
                    "firme:alarma"
            );
            despertador.acquire(10_000);
        } catch (Exception ignorada) {
            // Si el fabricante no lo permite, queda el aviso igualmente.
        }
    }
}
