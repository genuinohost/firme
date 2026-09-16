package app.genuino.firme;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Lo que ocurre cuando llega la hora.
 *
 * Android despierta este receptor aunque la app lleve dias cerrada. Lo que pasa
 * a partir de aqui esta escrito para que el silencio sea imposible, porque el
 * silencio es el unico fallo que aqui no se puede permitir.
 *
 * <p>El orden importa, y cada paso esta donde esta por un motivo:
 *
 * <ol>
 *   <li><b>Sujetar el movil despierto.</b> AlarmManager solo garantiza que el
 *       procesador esta en pie mientras dura {@code onReceive}. Arrancar un
 *       servicio es asincrono: sin enganche, el movil puede volver a dormirse
 *       entre que se pide y que el servicio existe.
 *   <li><b>Arrancar el servicio que repica</b>, y hacerlo <i>ya</i>, en el
 *       mismo hilo. La exencion que permite arrancar un servicio en primer
 *       plano desde el fondo se concede por venir de una alarma exacta, y es
 *       mas limpia cuanto antes se use.
 *   <li><b>Comprobar que de verdad esta sonando.</b> Esta es la pieza que
 *       faltaba. Hasta la 4.1 bastaba con que arrancar el servicio no lanzara
 *       una excepcion para darlo por bueno — y el 16 de septiembre la alarma de
 *       las tres dejo su notificacion y no sono. Ahora, si a los tres segundos
 *       no hay ruido, se reintenta y, si sigue sin haberlo, suena aqui mismo.
 *   <li><b>Rearmar las siguientes</b>, que es lo que sostiene la cadena sin que
 *       nadie abra la app.
 * </ol>
 *
 * Todo queda apuntado en el diario. Un fallo de madrugada que no deja rastro no
 * se arregla nunca: solo se discute.
 */
public class ReceptorAlarma extends BroadcastReceiver {

    /** Cuanto se espera al servicio antes de dar por hecho que no suena. */
    private static final long ESPERA_MS = 3000;

    /** Tope del ruido de ultimo recurso, si hay que llegar hasta ahi. */
    private static final long TOPE_ULTIMO_RECURSO_MS = 5 * 60 * 1000L;

    /** El de ultimo recurso vive fuera de toda instancia: el receptor muere. */
    private static MediaPlayer ultimoRecurso;

    @Override
    public void onReceive(Context contexto, Intent intencion) {
        final int id = intencion.getIntExtra("id", 1);
        final String titulo = textoDe(intencion.getStringExtra("titulo"), "Genuino");
        final String cuerpo = textoDe(intencion.getStringExtra("cuerpo"), "Es la hora.");
        final String idSuceso = intencion.getStringExtra("idSuceso");
        final long prevista = intencion.getLongExtra("cuando", 0L);

        final Context app = contexto.getApplicationContext();

        // 1. El enganche, antes que nada.
        final PowerManager.WakeLock enganche = engancheDe(app);

        anotarQueSono(app, id, prevista);

        // 2. El servicio, ya, en este mismo hilo.
        final boolean arranco = arrancarElServicio(app, id, titulo, cuerpo, idSuceso);
        AlarmaExacta.anotarEnElUltimoDisparo(app, "servicio", arranco);

        // 3. El resto en segundo plano, sin soltar el turno del receptor.
        final PendingResult resultado = goAsync();
        new Thread(() -> {
            try {
                // Rearmar la cola: si el sistema hubiera tirado alguna, esto la
                // repone sin que nadie tenga que abrir la app.
                try {
                    AlarmaExacta.armarLasProximas(app);
                } catch (Exception e) {
                    anotarElFallo(app, "rearmar: " + e.getMessage());
                }

                if (!hayRuido(app, arranco, id, titulo, cuerpo, idSuceso)) {
                    avisoDeRespaldo(app, id, titulo, cuerpo, idSuceso);
                    ruidoDeUltimoRecurso(app);
                }
            } finally {
                try {
                    resultado.finish();
                } catch (Exception ignorada) { }
                soltar(enganche);
            }
        }, "firme-alarma").start();
    }

    private static String textoDe(String valor, String pordefecto) {
        return valor == null || valor.isEmpty() ? pordefecto : valor;
    }

    /**
     * Espera a que el servicio diga que suena, y si no lo dice lo reintenta.
     *
     * Devuelve si al final hay ruido. Se apunta en el diario el veredicto y el
     * contexto —volumen de alarma y No molestar—, que es lo que permite decir a
     * la manana siguiente por que no sono, en vez de suponerlo.
     */
    private boolean hayRuido(
            Context contexto, boolean arranco, int id,
            String titulo, String cuerpo, String idSuceso) {

        boolean suena = esperarASonar(ESPERA_MS);

        if (!suena) {
            // Un segundo intento: en algunos moviles el primer arranque se cae
            // sin avisar cuando el sistema esta saliendo de reposo profundo.
            arrancarElServicio(contexto, id, titulo, cuerpo, idSuceso);
            suena = esperarASonar(ESPERA_MS);
            AlarmaExacta.anotarEnElUltimoDisparo(contexto, "reintento", true);
        }

        AlarmaExacta.anotarEnElUltimoDisparo(contexto, "sono", suena);
        AlarmaExacta.anotarEnElUltimoDisparo(
                contexto, "volumen", AlarmaExacta.volumenDeAlarma(contexto));
        AlarmaExacta.anotarEnElUltimoDisparo(
                contexto, "noMolestar", AlarmaExacta.filtroNoMolestar(contexto));

        if (!suena) {
            anotarElFallo(contexto, arranco
                    ? "el servicio arranco pero no sono"
                    : "el servicio no pudo arrancar");
        }
        return suena;
    }

    private static boolean esperarASonar(long tope) {
        long limite = System.currentTimeMillis() + tope;
        while (System.currentTimeMillis() < limite) {
            if (ServicioAlarma.SONANDO) return true;
            try {
                Thread.sleep(150);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return ServicioAlarma.SONANDO;
            }
        }
        return ServicioAlarma.SONANDO;
    }

    private PowerManager.WakeLock engancheDe(Context contexto) {
        try {
            PowerManager energia = contexto.getSystemService(PowerManager.class);
            if (energia == null) return null;
            PowerManager.WakeLock enganche =
                    energia.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "firme:alarma");
            enganche.setReferenceCounted(false);
            enganche.acquire(30_000);
            return enganche;
        } catch (Exception e) {
            // Sin enganche se sigue: el servicio en primer plano tambien sujeta.
            return null;
        }
    }

    private static void soltar(PowerManager.WakeLock enganche) {
        try {
            if (enganche != null && enganche.isHeld()) enganche.release();
        } catch (Exception ignorada) { }
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

    // -------------------------------------------------------- ultimo recurso

    /**
     * Sonar desde aqui mismo, sin servicio de por medio.
     *
     * Es peor que el servicio: este proceso puede morir en cualquier momento y
     * dejar la alarma a medias. Pero medio minuto de tono de alarma levanta a
     * alguien, y el silencio no. Va por el flujo de alarma, que es el unico que
     * No molestar deja pasar por definicion.
     */
    private static synchronized void ruidoDeUltimoRecurso(Context contexto) {
        try {
            if (ServicioAlarma.SONANDO) return;
            callarUltimoRecurso();

            subirElVolumen(contexto);

            Uri tono = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (tono == null) tono = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (tono == null) return;

            MediaPlayer reproductor = new MediaPlayer();
            reproductor.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            reproductor.setDataSource(contexto, tono);
            reproductor.setLooping(true);
            reproductor.setVolume(1f, 1f);
            reproductor.prepare();
            reproductor.start();
            ultimoRecurso = reproductor;

            AlarmaExacta.anotarEnElUltimoDisparo(contexto, "ultimoRecurso", true);

            // Y un tope, para no dejarlo repicando el resto de la manana.
            new android.os.Handler(android.os.Looper.getMainLooper())
                    .postDelayed(ReceptorAlarma::callarUltimoRecurso, TOPE_ULTIMO_RECURSO_MS);
        } catch (Exception e) {
            anotarElFallo(contexto, "ultimo recurso: " + e.getMessage());
        }
    }

    /** Lo llama la app cuando el usuario atiende la alarma. */
    public static synchronized void callarUltimoRecurso() {
        if (ultimoRecurso == null) return;
        try {
            if (ultimoRecurso.isPlaying()) ultimoRecurso.stop();
        } catch (Exception ignorada) { }
        try {
            ultimoRecurso.release();
        } catch (Exception ignorada) { }
        ultimoRecurso = null;
    }

    private static void subirElVolumen(Context contexto) {
        try {
            AudioManager audio =
                    (AudioManager) contexto.getSystemService(Context.AUDIO_SERVICE);
            if (audio == null) return;
            int maximo = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int suelo = Math.max(1, (maximo * 70) / 100);
            if (audio.getStreamVolume(AudioManager.STREAM_ALARM) < suelo) {
                audio.setStreamVolume(AudioManager.STREAM_ALARM, suelo, 0);
            }
        } catch (Exception ignorada) {
            // Con No molestar y sin acceso a la directiva esto lanza.
        }
    }

    /**
     * El aviso de respaldo, por el canal que si lleva sonido. Es lo que queda
     * en la bandeja aunque el ruido se pare: la constancia de que la hora paso.
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

    private static void anotarElFallo(Context contexto, String motivo) {
        try {
            contexto.getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(AlarmaExacta.CLAVE_ULTIMO_FALLO,
                            System.currentTimeMillis() + "|" + motivo)
                    .apply();
        } catch (Exception ignorada) { }
    }
}
