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
    public static final String ACCION_POSPONER = "app.genuino.firme.POSPONER";

    /**
     * Cuanto se pospone. Diez minutos, que es lo que pidio Alex.
     *
     * Ni cinco —no da tiempo a nada— ni quince —ya es volverse a dormir—. Y
     * sobre todo: **se puede posponer las veces que haga falta**, porque la
     * alarma pospuesta vuelve con sus dos botones intactos.
     */
    private static final int POSPONER_POR_DEFECTO = 10;

    /**
     * Los minutos que eligio el usuario en Ajustes.
     *
     * Se leen de disco y no de la parte web: el boton vive en una notificacion,
     * y cuando suena a las tres de la madrugada la app lleva horas cerrada. Una
     * cifra escrita a fuego aqui seria una segunda fuente de verdad, y las dos
     * acabarian diciendo cosas distintas.
     */
    private int minutosDePosponer() {
        try {
            return getSharedPreferences(AlarmaExacta.PREFS, MODE_PRIVATE)
                    .getInt(AlarmaExacta.CLAVE_POSPONER, POSPONER_POR_DEFECTO);
        } catch (Exception e) {
            return POSPONER_POR_DEFECTO;
        }
    }

    /**
     * Desplazamiento de los identificadores de las pospuestas.
     *
     * Una alarma pospuesta NO puede reutilizar el id de la original: la cola
     * usa 1..N y pisarlo se llevaria por delante otra alarma de la rutina.
     */
    private static final int ID_POSPUESTA = 700000;

    /** Canal mudo: aqui el sonido lo pone el servicio, no la notificacion. */
    public static final String CANAL_SERVICIO = "despertador-firme-servicio";

    private static final int ID_AVISO = 424242;

    /** Cuanto repica como mucho, si nadie la para. */
    private static final long TOPE_MS = 5 * 60 * 1000L;

    /** Cada cuanto el aviso vuelve a la cabeza de la bandeja. */
    private static final long RECORDAR_CADA_MS = 15 * 1000L;

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

    /**
     * Vuelve a publicar el aviso cada pocos segundos mientras suena.
     *
     * <p><b>Por que.</b> Alex, el 27-09-2026: «me dicen que la notificacion de
     * parar la alarma a veces se pierde entre otras notificaciones, y se hace
     * dificil parar la alarma».
     *
     * <p>Android no deja decir «este aviso va primero». Lo que si hace es
     * ordenar por lo mas reciente dentro de la misma importancia, asi que
     * volver a publicarlo lo devuelve arriba del todo — y de paso vuelve a
     * asomar flotante, que es la otra mitad de lo que pidio.
     *
     * <p>Que reaparezca cada poco seria molesto en cualquier otro aviso. Aqui
     * no: hay una alarma sonando y lo unico que falta es el boton de pararla.
     */
    private Runnable recordatorio;

    /** Lo ultimo que se publico, para poder republicarlo tal cual. */
    private Notification ultimoAviso;

    /** El suceso que esta sonando. Si empieza por «sala:», es una llamada. */
    private String idSucesoActual;

    private boolean esLlamadaActual() {
        return idSucesoActual != null && idSucesoActual.startsWith("sala:");
    }

    @Override
    public IBinder onBind(Intent intencion) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intencion, int banderas, int idArranque) {
        /*
          Sin intent no hay nada que hacer. Con START_STICKY, si el sistema
          mataba el proceso mientras sonaba, resucitaba el servicio con intent
          nulo y repicaba cinco minutos una alarma fantasma «Firme / Es la
          hora.», sin Responder ni Rechazar y sin saber a que sala ir.
        */
        if (intencion == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String accion = intencion.getAction();

        if (ACCION_PARAR.equals(accion)) {
            // Solo AQUI se olvida la llamada: este intent llega del boton
            // Rechazar de la notificacion o de Timbre.atendida(). Que el tope
            // la calle a los cinco minutos, o que el sistema destruya el
            // servicio, no es rechazarla: la web tiene que seguir ofreciendo
            // «Entrar» hasta sus diez minutos.
            olvidarLlamadaSiLoEs();
            parar();
            return START_NOT_STICKY;
        }

        if (ACCION_POSPONER.equals(accion)) {
            posponer(intencion);
            return START_NOT_STICKY;
        }

        int id = intencion.getIntExtra("id", 1);
        String titulo = textoDe(intencion, "titulo", "Firme");
        String cuerpo = textoDe(intencion, "cuerpo", "Es la hora.");
        String idSuceso = textoDe(intencion, "idSuceso", "");
        boolean nuevaEsLlamada = idSuceso.startsWith("sala:");

        /*
          La llamada y la alarma de la rutina comparten servicio y aviso. Si se
          cruzan —el bloque «devocional» de la rutina salta a las 5:00 y Alex
          llama diez segundos despues—, manda la llamada: es la que lleva a la
          sala. Una alarma que llega encima de una llamada no la pisa; una
          llamada que llega encima de una alarma se queda con el aviso Y con el
          tono, que pasa al de llamada.
        */
        if (sonando && esLlamadaActual() && !nuevaEsLlamada) {
            if (corte != null) mano.removeCallbacks(corte);
            corte = this::parar;
            mano.postDelayed(corte, TOPE_MS);
            return START_NOT_STICKY;
        }
        boolean cambiaAllamada = sonando && !esLlamadaActual() && nuevaEsLlamada;
        idSucesoActual = idSuceso;

        // Lo primero de todo, antes que el audio: Android mata el servicio si no
        // se pone en primer plano en cinco segundos.
        arrancarEnPrimerPlano(id, titulo, cuerpo, idSuceso);

        if (cambiaAllamada) {
            // El tono de alarma que ya sonaba se cambia por el de llamada.
            if (repique != null) mano.removeCallbacks(repique);
            if (generador != null) {
                try { generador.release(); } catch (Exception ignorada) { }
                generador = null;
            }
            soltarReproductor();
            SONANDO = empezarASonar();
            mano.postDelayed(this::confirmarQueSuena, 1200);
        }

        if (!sonando) {
            sonando = true;
            sujetarElMovilDespierto();
            subirElVolumenDeAlarma();

            // SONANDO se pone **despues** de comprobar que hay ruido, no antes.
            // Es la bandera que mira el receptor para decidir si hace falta su
            // ultimo recurso: ponerla por adelantado era prometerle silencio
            // disfrazado de exito, que es como se perdio la alarma de las tres.
            SONANDO = empezarASonar();
            empezarAVibrar();

            // Y una segunda mirada un segundo despues: un MediaPlayer puede
            // arrancar y morirse solo, sin lanzar nada.
            mano.postDelayed(this::confirmarQueSuena, 1200);

            corte = this::parar;
            mano.postDelayed(corte, TOPE_MS);
            empezarARecordar();
        } else {
            /*
              Ya estaba sonando y ha llegado OTRA alarma.

              El corte de cinco minutos se puso cuando empezo la primera, asi
              que la segunda heredaba lo que quedara de aquel: si llega en el
              minuto cuatro y medio, se corta a los treinta segundos. Eso es
              justo lo que Alex describio el 27-09-2026 como «se traba, se
              queda en esa alarma y no avanza a la otra».

              La segunda merece sus cinco minutos enteros, como cualquiera.
            */
            if (corte != null) mano.removeCallbacks(corte);
            corte = this::parar;
            mano.postDelayed(corte, TOPE_MS);
            AlarmaExacta.anotarEnElUltimoDisparo(this, "encimaDeOtra", true);
        }

        // No se reinicia solo (ver arriba): una alarma que el sistema mato se
        // vuelve a disparar por el receptor, con sus datos, no de memoria.
        return START_NOT_STICKY;
    }

    /** Olvidar la llamada pendiente, si lo que suena es una llamada. */
    private void olvidarLlamadaSiLoEs() {
        if (!esLlamadaActual()) return;
        try {
            getSharedPreferences(AlarmaExacta.PREFS, MODE_PRIVATE)
                    .edit().remove(ServicioAvisos.CLAVE_LLAMADA).apply();
        } catch (Exception ignorada) { }
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

        NotificationCompat.Builder constructor = new NotificationCompat.Builder(this, CANAL_SERVICIO)
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
                /*
                  Sin setSilent(true), a proposito. Una notificacion «silenciosa»
                  Android la manda a la seccion de abajo de la bandeja, plegada,
                  y NUNCA la asoma arriba (heads-up). Por eso la llamada —que
                  va con estilo de llamada y Android la sube a la fuerza— se
                  veia, y la alarma no. Alex, 28-09-2026: «no se encontraba
                  entre las notificaciones y no salia como algo prioritario».

                  El canal ya es mudo y sin vibracion, asi que esto ASOMA sin
                  sonar: el sonido lo pone el reproductor. Y con alertar cada
                  vez, la republicacion de cada quince segundos la vuelve a
                  asomar mientras repique.
                */
                .setDefaults(0)
                .setOnlyAlertOnce(false)
                // Coloreado y a pantalla completa: las dos cosas que hacen que
                // no se confunda con los demas avisos de la bandeja.
                .setColorized(true)
                .setContentIntent(entrar)
                .setFullScreenIntent(entrar, true);

        /*
          Los botones cambian si esto es una llamada y no una alarma.

          El 27-09-2026 a Joseito le sono «te llaman al devocional» con la app
          cerrada —funciono— y la notificacion le ofrecia «Parar» y «Posponer
          10 min». Posponer una llamada no significa nada: dentro de diez
          minutos el devocional va por la mitad. Una llamada se coge o no se
          coge. Y «Parar» suena a apagar una alarma; aqui lo que se para es
          decir que no.
        */
        boolean esLlamada = idSuceso != null && idSuceso.startsWith("sala:");
        if (esLlamada) {
            /*
              Estilo de LLAMADA ENTRANTE, el mismo que usa el telefono.

              Joseito, 27-09-2026: «me estaba sonando el telefono, pero en
              ningun lado me aparecia una notificacion ni nada visible. Tuve
              que buscar a mano entre las notificaciones que era lo que
              sonaba». Una notificacion normal se entierra; una de tipo
              llamada Android la pone arriba del todo, grande, con Responder y
              Rechazar, y no se puede quitar de un manotazo. Es lo que la
              gente reconoce como «me estan llamando».
            */
            androidx.core.app.Person quien = new androidx.core.app.Person.Builder()
                    .setName(titulo)
                    .setImportant(true)
                    .build();
            constructor.setStyle(NotificationCompat.CallStyle.forIncomingCall(quien, pararla, entrar))
                    .setCategory(NotificationCompat.CATEGORY_CALL);
        } else {
            constructor.addAction(0, "Parar", pararla)
                    .addAction(0, "Posponer " + minutosDePosponer() + " min",
                            posponerla(id, titulo, cuerpo, idSuceso));
        }
        Notification aviso = constructor.build();

        ultimoAviso = aviso;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(
                        this, ID_AVISO, aviso,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(ID_AVISO, aviso);
            }
        } catch (Exception e) {
            // Si el sistema no deja el primer plano, al menos que se vea —y que
            // quede escrito, porque es una de las formas en que una alarma se
            // queda muda sin que nadie pueda explicar despues por que.
            NotificationManager gestor = getSystemService(NotificationManager.class);
            if (gestor != null) gestor.notify(ID_AVISO, aviso);
            AlarmaExacta.anotarEnElUltimoDisparo(this, "sinPrimerPlano", e.getMessage());
        }
    }

    /**
     * Cada quince segundos, el aviso vuelve arriba.
     *
     * <p>Quince y no menos: mas a menudo parpadearia sin darle tiempo a nadie a
     * tocarlo. Mas y vuelve a enterrarse bajo lo que llegue.
     *
     * <p>Se publica con {@code notify} y no con {@code startForeground}: el
     * servicio ya esta en primer plano y volver a arrancarlo no hace falta.
     */
    private void empezarARecordar() {
        if (recordatorio != null) mano.removeCallbacks(recordatorio);
        recordatorio = new Runnable() {
            @Override
            public void run() {
                if (!sonando || ultimoAviso == null) return;
                try {
                    NotificationManager gestor = getSystemService(NotificationManager.class);
                    if (gestor != null) gestor.notify(ID_AVISO, ultimoAviso);
                } catch (Exception ignorada) {
                    // Que no se pueda republicar no debe parar el ruido.
                }
                mano.postDelayed(this, RECORDAR_CADA_MS);
            }
        };
        mano.postDelayed(recordatorio, RECORDAR_CADA_MS);
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

    /**
     * Primera red: el tono de alarma del movil, en bucle.
     *
     * Devuelve si quedo sonando. Antes no devolvia nada y nadie comprobaba el
     * resultado: la alarma se daba por buena por el mero hecho de haberlo
     * intentado.
     */
    private boolean empezarASonar() {
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
                if (reproductor.isPlaying()) return true;
                soltarReproductor();
            } catch (Exception e) {
                soltarReproductor();
            }
        }
        return tonoDeEmergencia();
    }

    /**
     * La segunda mirada, un segundo despues de arrancar.
     *
     * Un MediaPlayer puede pararse solo —se le quita el foco, el sistema le
     * corta el flujo— y no lanza nada al hacerlo. Si eso pasa, se baja al tono
     * de emergencia, que lo genera el propio sistema y no depende de ficheros.
     */
    private void confirmarQueSuena() {
        if (!sonando) return;
        boolean suena = false;
        try {
            suena = reproductor != null && reproductor.isPlaying();
        } catch (Exception ignorada) {
            // Un reproductor en mal estado cuenta como que no suena.
        }
        if (!suena && generador == null) {
            soltarReproductor();
            suena = tonoDeEmergencia();
        } else if (generador != null) {
            suena = true;
        }
        SONANDO = suena;
        AlarmaExacta.anotarEnElUltimoDisparo(this, "confirmado", suena);
    }

    private Uri tonoDeAlarma() {
        // Para una llamada, primero el tono de LLAMADA del movil. Joseito,
        // 27-09-2026: «suena como una alarma y no como una llamada de un
        // grupo». Sigue yendo por el flujo de alarma —que No molestar deja
        // pasar y que suena aunque el movil este en silencio—, pero con el
        // sonido que la gente reconoce como «me estan llamando».
        Uri[] candidatos = esLlamadaActual()
                ? new Uri[] {
                        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                        Settings.System.DEFAULT_RINGTONE_URI,
                        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                }
                : new Uri[] {
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
    private boolean tonoDeEmergencia() {
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
            return true;
        } catch (Exception ignorada) {
            // No queda mas que la vibracion.
            return false;
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

    /**
     * El boton de posponer, para la notificacion.
     *
     * Lleva consigo el titulo y el cuerpo porque la alarma pospuesta tiene que
     * volver **siendo la misma**: con su nombre y su porque. Una alarma que
     * vuelve diciendo «Genuino» a secas no le dice a nadie a que se levanta.
     */
    private PendingIntent posponerla(int id, String titulo, String cuerpo, String idSuceso) {
        Intent luego = new Intent(this, ServicioAlarma.class);
        luego.setAction(ACCION_POSPONER);
        luego.putExtra("id", id);
        luego.putExtra("titulo", titulo);
        luego.putExtra("cuerpo", cuerpo);
        luego.putExtra("idSuceso", idSuceso);
        return PendingIntent.getService(
                this, 2, luego,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Callar ahora y volver dentro de los minutos que eligio el usuario.
     *
     * Se programa con la misma maquinaria que las de verdad —{@code
     * setAlarmClock} por medio de {@link AlarmaExacta}— y no con un temporizador
     * nuestro: un temporizador dentro del proceso muere en cuanto el sistema
     * mate la app, que es exactamente lo que pasa de madrugada. Una posposicion
     * que no sobrevive al reposo es una posposicion que no existe.
     */
    private void posponer(Intent intencion) {
        int id = intencion == null ? 1 : intencion.getIntExtra("id", 1);
        String titulo = textoDe(intencion, "titulo", "Genuino");
        String cuerpo = textoDe(intencion, "cuerpo", "Es la hora.");
        String idSuceso = textoDe(intencion, "idSuceso", "");

        long cuando = System.currentTimeMillis() + minutosDePosponer() * 60_000L;
        try {
            AlarmaExacta.programarUna(
                    getApplicationContext(),
                    ID_POSPUESTA + (id % 1000),
                    cuando,
                    titulo,
                    cuerpo + "  (pospuesta)",
                    idSuceso);
        } catch (Exception ignorada) {
            // Si no se pudo reprogramar, al menos se calla; volver a sonar sin
            // parar seria peor que no posponer.
        }
        parar();
    }

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
        // La llamada pendiente NO se borra aqui: parar() corre tambien por el
        // tope de cinco minutos y al destruirse el servicio, y ninguna de las
        // dos es rechazarla. Se borra solo en ACCION_PARAR (olvidarLlamadaSiLoEs).
        // Si el receptor llego a sonar por su cuenta, tambien se calla aqui.
        ReceptorAlarma.callarUltimoRecurso();
        if (corte != null) mano.removeCallbacks(corte);
        if (repique != null) mano.removeCallbacks(repique);
        if (recordatorio != null) mano.removeCallbacks(recordatorio);
        recordatorio = null;

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
