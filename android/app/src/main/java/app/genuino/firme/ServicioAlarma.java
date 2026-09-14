package app.genuino.firme;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * El que hace ruido.
 *
 * Hasta la version 3.3 la alarma no reproducia nada: se limitaba a publicar una
 * notificacion y confiaba en que Android tocase el tono del canal. Eso falla de
 * madrugada por tres motivos, y los tres importan:
 *
 *  1. Una notificacion suena una vez y tres segundos. No repica, y a nadie
 *     dormido lo levanta un pitido de tres segundos.
 *  2. Con No molestar puesto —y a las tres de la manana lo esta— el sistema
 *     silencia la notificacion. `setBypassDnd` no sirve de nada sin el acceso a
 *     la directiva de notificaciones, que la app nunca pidio.
 *  3. Si el canal quedo mal creado alguna vez, no hay segunda oportunidad: los
 *     canales de Android no se pueden modificar despues.
 *
 * Aqui se hace lo que hacen los despertadores de verdad: reproducir el audio
 * nosotros, por el flujo de alarma (STREAM_ALARM). Ese flujo no pasa por el
 * filtro de notificaciones —No molestar deja pasar las alarmas por definicion—
 * y suena en bucle hasta que alguien lo para.
 *
 * Tres redes por debajo, por orden: el tono de alarma del movil, el de llamada,
 * y un tono generado por el propio sistema. Para quedarse muda tendrian que
 * fallar las tres.
 */
public class ServicioAlarma extends Service {

    public static final String ACCION_SONAR = "app.genuino.firme.SONAR";
    public static final String ACCION_PARAR = "app.genuino.firme.PARAR";

    /** Canal mudo: aqui el sonido lo pone el servicio, no la notificacion. */
    public static final String CANAL_SERVICIO = "despertador-firme-servicio";

    private static final int ID_AVISO = 424242;

    /** Cuanto repica como mucho, si nadie la para. */
    private static final long TOPE_MS = 5 * 60 * 1000L;

    /**
     * Suelo del volumen de alarma, en tanto por ciento del maximo.
     *
     * Con el volumen de alarma a cero no suena nada por bien que este todo lo
     * demas, y es un despiste facilisimo de cometer. Un despertador que se deja
     * silenciar por accidente no es un despertador.
     */
    private static final int SUELO_VOLUMEN = 70;

    /** Lo consulta la app para no tocar su propio tono encima del nuestro. */
    public static volatile boolean SONANDO = false;

    private MediaPlayer reproductor;
    private ToneGenerator generador;
    private Vibrator vibrador;
    private PowerManager.WakeLock enganche;
    private final Handler mano = new Handler(Looper.getMainLooper());
    private Runnable corte;
    private Runnable repique;
    private boolean sonando = false;

    @Override
    public IBinder onBind(Intent intencion) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intencion, int banderas, int idArranque) {
        String accion = intencion == null ? null : intencion.getAction();

        if (ACCION_PARAR.equals(accion)) {
            parar();
            return START_NOT_STICKY;
        }

        int id = intencion == null ? 1 : intencion.getIntExtra("id", 1);
        String titulo = textoDe(intencion, "titulo", "Firme");
        String cuerpo = textoDe(intencion, "cuerpo", "Es la hora.");
        String idSuceso = textoDe(intencion, "idSuceso", "");

        // Lo primero de todo, antes que el audio: Android mata el servicio si no
        // se pone en primer plano en cinco segundos.
        arrancarEnPrimerPlano(id, titulo, cuerpo, idSuceso);

        if (!sonando) {
            sonando = true;
            SONANDO = true;
            sujetarElMovilDespierto();
            subirElVolumenDeAlarma();
            empezarASonar();
            empezarAVibrar();

            corte = this::parar;
            mano.postDelayed(corte, TOPE_MS);
        }

        return START_STICKY;
    }

    private static String textoDe(Intent intencion, String clave, String pordefecto) {
        if (intencion == null) return pordefecto;
        String v = intencion.getStringExtra(clave);
        return v == null || v.isEmpty() ? pordefecto : v;
    }

    // --------------------------------------------------------------- pantalla

    private void arrancarEnPrimerPlano(int id, String titulo, String cuerpo, String idSuceso) {
        crearCanalMudo();

        Intent abrir = new Intent(this, MainActivity.class);
        abrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        abrir.putExtra("alarma", true);
        abrir.putExtra("idSuceso", idSuceso);
        abrir.setData(Uri.parse("firme://alarma/" + id));
        PendingIntent entrar = PendingIntent.getActivity(
                this, id, abrir,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent callar = new Intent(this, ServicioAlarma.class);
        callar.setAction(ACCION_PARAR);
        PendingIntent pararla = PendingIntent.getService(
                this, 1, callar,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification aviso = new NotificationCompat.Builder(this, CANAL_SERVICIO)
                .setSmallIcon(R.drawable.ic_stat_firme)
                .setColor(0xFFC9A227)
                .setContentTitle(titulo)
                .setContentText(cuerpo)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(cuerpo))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setSilent(true) // el sonido lo pone el reproductor, no esto
                .setContentIntent(entrar)
                .setFullScreenIntent(entrar, true)
                .addAction(0, "Parar", pararla)
                .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(
                        this, ID_AVISO, aviso,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(ID_AVISO, aviso);
            }
        } catch (Exception e) {
            // Si el sistema no deja el primer plano, al menos que se vea.
            NotificationManager gestor = getSystemService(NotificationManager.class);
            if (gestor != null) gestor.notify(ID_AVISO, aviso);
        }
    }

    private void crearCanalMudo() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager gestor = getSystemService(NotificationManager.class);
        if (gestor == null) return;

        NotificationChannel canal = new NotificationChannel(
                CANAL_SERVICIO, "Alarma sonando", NotificationManager.IMPORTANCE_HIGH);
        canal.setDescription("La alarma mientras repica. El sonido lo pone la propia app.");
        canal.setSound(null, null); // mudo a proposito: el audio va por el servicio
        canal.enableVibration(false);
        canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        canal.setBypassDnd(true);
        gestor.createNotificationChannel(canal);
    }

    private void sujetarElMovilDespierto() {
        try {
            PowerManager energia = getSystemService(PowerManager.class);
            if (energia == null) return;
            enganche = energia.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "firme:sonando");
            enganche.setReferenceCounted(false);
            enganche.acquire(TOPE_MS + 10_000);
        } catch (Exception ignorada) {
            // Sin el enganche, el servicio en primer plano ya sostiene el proceso.
        }
    }

    // ----------------------------------------------------------------- sonido

    /**
     * El volumen de alarma a cero deja muda la mejor de las alarmas. Se sube a
     * un nivel audible, y solo si estaba por debajo: a quien lo tenga alto no se
     * le toca nada.
     */
    private void subirElVolumenDeAlarma() {
        try {
            AudioManager audio = getSystemService(AudioManager.class);
            if (audio == null) return;
            int maximo = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int ahora = audio.getStreamVolume(AudioManager.STREAM_ALARM);
            int suelo = Math.max(1, (maximo * SUELO_VOLUMEN) / 100);
            if (ahora < suelo) {
                audio.setStreamVolume(AudioManager.STREAM_ALARM, suelo, 0);
            }
        } catch (Exception ignorada) {
            // Con No molestar y sin permiso de directiva esto lanza; el tono
            // suena igual, porque va por el flujo de alarma.
        }
    }

    /** Primera red: el tono de alarma del movil, en bucle. */
    private void empezarASonar() {
        Uri tono = tonoDeAlarma();
        if (tono != null) {
            try {
                reproductor = new MediaPlayer();
                reproductor.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                reproductor.setDataSource(this, tono);
                reproductor.setLooping(true);
                reproductor.setVolume(1f, 1f);
                reproductor.prepare();
                reproductor.start();
                return;
            } catch (Exception e) {
                soltarReproductor();
            }
        }
        tonoDeEmergencia();
    }

    private Uri tonoDeAlarma() {
        Uri[] candidatos = {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                Settings.System.DEFAULT_ALARM_ALERT_URI,
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
        };
        for (Uri u : candidatos) {
            if (u != null) return u;
        }
        return null;
    }

    /**
     * Ultima red. Si no hay ni un tono utilizable en el movil —pasa cuando el
     * usuario pone «ninguno» como tono de alarma— lo genera el sistema. Feo,
     * pero suena, y sonar es lo unico que aqui no se negocia.
     */
    private void tonoDeEmergencia() {
        try {
            generador = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            repique = new Runnable() {
                @Override
                public void run() {
                    try {
                        if (generador != null) {
                            generador.startTone(ToneGenerator.TONE_CDMA_HIGH_L, 900);
                        }
                    } catch (Exception ignorada) {
                        // se reintenta en el siguiente repique
                    }
                    mano.postDelayed(this, 1200);
                }
            };
            mano.post(repique);
        } catch (Exception ignorada) {
            // No queda mas que la vibracion.
        }
    }

    private void empezarAVibrar() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = getSystemService(VibratorManager.class);
                vibrador = vm == null ? null : vm.getDefaultVibrator();
            } else {
                vibrador = getSystemService(Vibrator.class);
            }
            if (vibrador == null || !vibrador.hasVibrator()) return;

            long[] patron = {0, 700, 400, 700, 400, 1000, 600};
            AudioAttributes comoAlarma = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            vibrador.vibrate(VibrationEffect.createWaveform(patron, 0), comoAlarma);
        } catch (Exception ignorada) {
            // Sin vibracion queda el sonido, que es lo principal.
        }
    }

    // -------------------------------------------------------------------- fin

    /** Lo llama la app cuando el usuario atiende la alarma. */
    public static void callar(Context contexto) {
        try {
            Intent parar = new Intent(contexto, ServicioAlarma.class);
            parar.setAction(ACCION_PARAR);
            contexto.startService(parar);
        } catch (Exception ignorada) {
            // Si el servicio ya no existe, no hay nada que parar.
        }
    }

    private void parar() {
        sonando = false;
        SONANDO = false;
        if (corte != null) mano.removeCallbacks(corte);
        if (repique != null) mano.removeCallbacks(repique);

        soltarReproductor();
        if (generador != null) {
            try {
                generador.release();
            } catch (Exception ignorada) { }
            generador = null;
        }
        if (vibrador != null) {
            try {
                vibrador.cancel();
            } catch (Exception ignorada) { }
            vibrador = null;
        }
        if (enganche != null && enganche.isHeld()) {
            try {
                enganche.release();
            } catch (Exception ignorada) { }
        }
        enganche = null;

        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void soltarReproductor() {
        if (reproductor == null) return;
        try {
            if (reproductor.isPlaying()) reproductor.stop();
        } catch (Exception ignorada) { }
        try {
            reproductor.release();
        } catch (Exception ignorada) { }
        reproductor = null;
    }

    @Override
    public void onDestroy() {
        parar();
        super.onDestroy();
    }
}
