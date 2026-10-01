package app.genuino.firme;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Mantiene la sala viva mientras se mira otra cosa.
 *
 * <p><b>Por que existe.</b> Desde Android 14 el sistema <b>corta el microfono</b>
 * a una aplicacion que pasa a segundo plano si no hay un servicio en primer
 * plano de tipo {@code microphone}. Sin esto, un devocional de cuarenta y cinco
 * minutos se muere en cuanto alguien sale de la app un segundo a mirar una
 * notificacion — y se muere <b>en silencio</b>, que es la peor forma.
 *
 * <p>No toca el audio: de la voz se encarga Agora. Esto solo le dice al sistema
 * «esta persona esta en una reunion, no la congeles», y pone el aviso que la ley
 * de Android exige para eso.
 *
 * <p><b>El aviso es util, no un tramite.</b> Dice en que sala esta y se toca para
 * volver, porque quien sale de la app a mirar algo necesita justo eso para
 * regresar. Un aviso que solo dice «en curso» es un aviso que se aprende a
 * ignorar.
 */
public class ServicioSala extends Service {

    private static final String CANAL = "sala-de-voz-firme";
    private static final int ID_AVISO = 8801;

    /** Como se llama la sala, para poder decirlo en el aviso. */
    private static final String EXTRA_NOMBRE = "nombre";

    /** Si el servicio puede declararse «de microfono»: solo con el permiso concedido. */
    private static final String EXTRA_MICRO = "conMicrofono";

    static void arrancar(Context contexto, String nombre, boolean conMicrofono) {
        Intent i = new Intent(contexto, ServicioSala.class);
        i.putExtra(EXTRA_NOMBRE, nombre);
        i.putExtra(EXTRA_MICRO, conMicrofono);
        // `startForegroundService` obliga a llamar a startForeground en cinco
        // segundos o el sistema mata el proceso. Se hace en onStartCommand, lo
        // primero.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            contexto.startForegroundService(i);
        } else {
            contexto.startService(i);
        }
    }

    static void parar(Context contexto) {
        contexto.stopService(new Intent(contexto, ServicioSala.class));
    }

    @Override
    public int onStartCommand(Intent intencion, int banderas, int id) {
        String nombre = intencion != null ? intencion.getStringExtra(EXTRA_NOMBRE) : null;
        if (nombre == null || nombre.isEmpty()) nombre = "Una sala";
        // Sin permiso de microfono, un servicio de tipo microfono revienta en
        // Android 14 (SecurityException). Quien solo escucha va como
        // reproduccion, que es lo que hace.
        boolean conMicrofono = intencion != null && intencion.getBooleanExtra(EXTRA_MICRO, false);

        crearCanal();

        Intent volver = new Intent(this, MainActivity.class);
        volver.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent alToque = PendingIntent.getActivity(
                this, 0, volver, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification aviso = new NotificationCompat.Builder(this, CANAL)
                .setContentTitle(nombre)
                .setContentText("Estás en la sala. Toca para volver.")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentIntent(alToque)
                // No se puede descartar: si se descarta, el sistema entiende que
                // ya no hay reunion y vuelve a congelar el microfono.
                .setOngoing(true)
                .setShowWhen(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                ServiceCompat.startForeground(
                        this, ID_AVISO, aviso,
                        conMicrofono
                                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                                : ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } catch (Exception e) {
                // Android 14 no deja subir a tipo microfono con la app en
                // segundo plano: pasa cuando el anfitrion suelta los
                // microfonos y alguien escucha con la pantalla apagada. Sin
                // esto, la excepcion cerraba la app en pleno devocional. Se
                // sigue como reproduccion (se oye todo); el microfono se sube
                // al volver a la app (Sala.handleOnResume). Y hay que llamar a
                // startForeground igualmente, o el sistema la cierra a los 5 s.
                try {
                    ServiceCompat.startForeground(
                            this, ID_AVISO, aviso, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } catch (Exception otra) {
                    stopSelf();
                    return START_NOT_STICKY;
                }
            }
        } else {
            startForeground(ID_AVISO, aviso);
        }

        // No se reinicia solo: si el sistema mata el proceso, la sala ya no
        // existe y resucitar un servicio de microfono sin sala seria peor.
        return START_NOT_STICKY;
    }

    private void crearCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager gestor = getSystemService(NotificationManager.class);
        if (gestor == null || gestor.getNotificationChannel(CANAL) != null) return;
        // Importancia baja a proposito: este aviso tiene que estar, no sonar.
        // Lo que suena es la voz de los hermanos.
        NotificationChannel canal = new NotificationChannel(
                CANAL, "En una sala de voz", NotificationManager.IMPORTANCE_LOW);
        canal.setDescription("Mientras estas en un devocional o en una llamada.");
        canal.setShowBadge(false);
        canal.setSound(null, null);
        gestor.createNotificationChannel(canal);
    }

    @Override
    public IBinder onBind(Intent intencion) {
        return null;
    }
}
