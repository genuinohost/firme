package app.genuino.firme;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Alarmas de despertador de verdad.
 *
 * Aqui se programa. El ruido lo hace {@link ServicioAlarma}; el aviso de que
 * llego la hora lo recoge {@link ReceptorAlarma}.
 *
 *  - `setAlarmClock()` es la unica forma de programar que Android respeta por
 *    encima de Doze y del ahorro de bateria. Ademas enseña el icono del reloj
 *    en la barra de estado, que es la señal de que esta puesta de verdad.
 *  - El canal de respaldo lleva sonido de alarma, por si el servicio no puede
 *    arrancar en algun movil raro.
 *  - El diagnostico pregunta **al sistema**, no a nuestras propias notas: es la
 *    diferencia entre saber y suponer.
 */
@CapacitorPlugin(name = "AlarmaExacta")
public class AlarmaExacta extends Plugin {

    /** Canal de respaldo, con sonido. Solo se usa si el servicio no arranca. */
    public static final String CANAL = "despertador-firme";

    /** Donde se guarda la cola, para poder rehacerla tras reiniciar el movil. */
    public static final String PREFS = "firme.alarmas";
    public static final String CLAVE_COLA = "cola";
    /** Apuntes de cada disparo, para detectar las que no sonaron. */
    public static final String CLAVE_DIARIO = "diario";
    public static final String CLAVE_ULTIMO_FALLO = "ultimoFallo";

    /** Margen para no reprogramar algo que acaba de sonar. */
    private static final long MARGEN_MS = 2000;

    /**
     * Cuantas alarmas se le entregan a Android de una vez.
     *
     * La cola entera son dos semanas —unas 140 con una rutina completa— y
     * registrarlas todas de golpe es pedirle al sistema algo que ningun
     * despertador de verdad le pide. `setAlarmClock` es la alarma mas cara que
     * existe: sale en la barra de estado y el sistema la protege de Doze.
     *
     * Asi que se registran solo las proximas, y **cada vez que una suena se
     * vuelven a armar las siguientes** desde la lista guardada. La cola de dos
     * semanas sigue existiendo en disco: sirve para rearmar sin abrir la app y
     * para rehacerla despues de reiniciar.
     */
    private static final int VENTANA = 24;

    @Override
    public void load() {
        crearCanal(getContext());
    }

    /**
     * El canal de respaldo. Manda sobre el sonido y no se puede cambiar una vez
     * creado: si hay que tocar algo de aqui, hay que estrenar identificador.
     */
    static void crearCanal(Context contexto) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager gestor = contexto.getSystemService(NotificationManager.class);
        if (gestor == null) return;

        NotificationChannel canal = new NotificationChannel(
                CANAL,
                "Despertador",
                NotificationManager.IMPORTANCE_HIGH
        );
        canal.setDescription("Las alarmas de la rutina. Suenan aunque el movil este en silencio.");

        AudioAttributes atributos = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        Uri tono = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (tono == null) tono = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        canal.setSound(tono, atributos);

        canal.enableVibration(true);
        canal.setVibrationPattern(new long[]{0, 500, 250, 500, 250, 800});
        canal.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        canal.setBypassDnd(true); // solo surte efecto si el usuario da el acceso
        gestor.createNotificationChannel(canal);
    }

    // ------------------------------------------------------------- programar

    /**
     * Recibe la lista entera de alarmas y la deja programada, borrando lo que
     * hubiera antes. Se llama al abrir la app y cada vez que cambia la rutina.
     */
    @PluginMethod
    public void programar(PluginCall llamada) {
        JSArray entrada = llamada.getArray("alarmas");
        if (entrada == null) {
            llamada.reject("Faltan las alarmas");
            return;
        }

        Context contexto = getContext();
        cancelarTodas(contexto);

        JSONArray guardadas = new JSONArray();
        long ahora = System.currentTimeMillis();

        try {
            for (int i = 0; i < entrada.length(); i++) {
                JSONObject alarma = entrada.getJSONObject(i);
                long cuando = alarma.getLong("cuando");
                if (cuando <= ahora + MARGEN_MS) continue;

                JSONObject copia = new JSONObject(alarma.toString());
                copia.put("id", i + 1);
                guardadas.put(copia);
            }
        } catch (Exception e) {
            llamada.reject("No se pudieron programar: " + e.getMessage());
            return;
        }

        // Primero se guarda la cola entera, y despues se arman las proximas.
        // En ese orden: si armar fallase a medias, la lista sigue en disco y el
        // rearmado de la siguiente alarma lo recupera solo.
        SharedPreferences prefs = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(CLAVE_COLA, guardadas.toString()).apply();

        int puestas = armarLasProximas(contexto);

        JSObject respuesta = new JSObject();
        respuesta.put("programadas", puestas);
        respuesta.put("enLista", guardadas.length());
        respuesta.put("confirmadas", cuantasTieneElSistema(contexto));
        llamada.resolve(respuesta);
    }

    /**
     * Arma con Android las proximas {@link #VENTANA} alarmas de la lista.
     *
     * Se llama al programar, **cada vez que una alarma suena** y al arrancar el
     * movil. Volver a armar una que ya estaba puesta no cuesta nada: el mismo
     * PendingIntent sustituye a la anterior. Y si el sistema hubiera tirado
     * alguna, esto la repone sin que nadie tenga que abrir la app.
     */
    static int armarLasProximas(Context contexto) {
        SharedPreferences prefs = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long ahora = System.currentTimeMillis();
        int puestas = 0;

        try {
            JSONArray cola = new JSONArray(prefs.getString(CLAVE_COLA, "[]"));
            for (int i = 0; i < cola.length() && puestas < VENTANA; i++) {
                JSONObject alarma = cola.getJSONObject(i);
                long cuando = alarma.optLong("cuando", 0);
                if (cuando <= ahora + MARGEN_MS) continue;

                programarUna(
                        contexto,
                        alarma.optInt("id", i + 1),
                        cuando,
                        alarma.optString("titulo", "Genuino"),
                        alarma.optString("cuerpo", "Es la hora."),
                        alarma.optString("idSuceso", "")
                );
                puestas++;
            }
        } catch (Exception ignorada) {
            // Una cola ilegible se rehara cuando se abra la app.
        }
        return puestas;
    }

    static PendingIntent intencionDe(Context contexto, int id, boolean crear) {
        Intent intencion = new Intent(contexto, ReceptorAlarma.class);
        intencion.setAction("app.genuino.firme.ALARMA");
        // Sin datos distintos, Android reutilizaria el mismo PendingIntent para
        // todas y solo quedaria viva la ultima.
        intencion.setData(Uri.parse("firme://alarma/" + id));

        int banderas = PendingIntent.FLAG_IMMUTABLE
                | (crear ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(contexto, id, intencion, banderas);
    }

    static void programarUna(
            Context contexto,
            int id,
            long cuando,
            String titulo,
            String cuerpo,
            String idSuceso
    ) {
        AlarmManager gestor = (AlarmManager) contexto.getSystemService(Context.ALARM_SERVICE);
        if (gestor == null) return;

        Intent intencion = new Intent(contexto, ReceptorAlarma.class);
        intencion.setAction("app.genuino.firme.ALARMA");
        intencion.setData(Uri.parse("firme://alarma/" + id));
        intencion.putExtra("id", id);
        intencion.putExtra("titulo", titulo);
        intencion.putExtra("cuerpo", cuerpo);
        intencion.putExtra("idSuceso", idSuceso);
        intencion.putExtra("cuando", cuando);

        PendingIntent pendiente = PendingIntent.getBroadcast(
                contexto,
                id,
                intencion,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent abrir = new Intent(contexto, MainActivity.class);
        PendingIntent mostrar = PendingIntent.getActivity(
                contexto,
                id,
                abrir,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // setAlarmClock es la unica que Android no retrasa nunca: ni en Doze,
        // ni con el ahorro de bateria, ni con la app parada.
        gestor.setAlarmClock(new AlarmManager.AlarmClockInfo(cuando, mostrar), pendiente);
    }

    static void cancelarTodas(Context contexto) {
        AlarmManager gestor = (AlarmManager) contexto.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences prefs = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String crudo = prefs.getString(CLAVE_COLA, "[]");

        try {
            JSONArray cola = new JSONArray(crudo);
            for (int i = 0; i < cola.length(); i++) {
                int id = cola.getJSONObject(i).optInt("id", i + 1);
                PendingIntent pendiente = intencionDe(contexto, id, true);
                if (gestor != null && pendiente != null) gestor.cancel(pendiente);
            }
        } catch (Exception ignorada) {
            // Una cola ilegible no debe impedir programar la nueva.
        }
        prefs.edit().remove(CLAVE_COLA).apply();
    }

    // ----------------------------------------------------------- diagnostico

    /**
     * Cuantas alarmas tiene **el sistema**, no cuantas creemos nosotros.
     *
     * Un `PendingIntent` con `FLAG_NO_CREATE` devuelve null si no existe. Es la
     * unica forma honrada de saber si una alarma sigue en pie: hasta ahora el
     * diagnostico leia nuestras propias notas y por eso salia verde aunque el
     * sistema las hubiera tirado todas.
     */
    private static int cuantasTieneElSistema(Context contexto) {
        int vivas = 0;
        try {
            SharedPreferences prefs = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray cola = new JSONArray(prefs.getString(CLAVE_COLA, "[]"));
            long ahora = System.currentTimeMillis();
            for (int i = 0; i < cola.length(); i++) {
                JSONObject a = cola.getJSONObject(i);
                if (a.optLong("cuando", 0) <= ahora) continue;
                if (intencionDe(contexto, a.optInt("id", i + 1), false) != null) vivas++;
            }
        } catch (Exception ignorada) {
            return 0;
        }
        return vivas;
    }

    /**
     * Las que tenian que haber sonado y no sonaron.
     *
     * Se compara la cola guardada con el diario de disparos reales: lo que ya
     * paso de hora y no tiene apunte, no sono. Hay que llamarlo **antes** de
     * reprogramar, porque programar borra la cola.
     *
     * Esto es lo que convierte un fallo mudo en un fallo que se ve. Sin ello,
     * una alarma perdida de madrugada no deja rastro en ninguna parte.
     */
    @PluginMethod
    public void revisarPerdidas(PluginCall llamada) {
        Context contexto = getContext();
        SharedPreferences prefs = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray perdidas = new JSONArray();

        try {
            JSONArray cola = new JSONArray(prefs.getString(CLAVE_COLA, "[]"));
            JSONArray diario = new JSONArray(prefs.getString(CLAVE_DIARIO, "[]"));
            long ahora = System.currentTimeMillis();

            for (int i = 0; i < cola.length(); i++) {
                JSONObject a = cola.getJSONObject(i);
                long cuando = a.optLong("cuando", 0);
                // Un minuto de margen: lo que acaba de vencer aun puede sonar.
                if (cuando <= 0 || cuando > ahora - 60_000) continue;

                boolean sono = false;
                for (int j = 0; j < diario.length(); j++) {
                    JSONObject d = diario.getJSONObject(j);
                    if (d.optLong("prevista", -1) == cuando) {
                        sono = true;
                        break;
                    }
                }
                if (sono) continue;

                JSONObject fallo = new JSONObject();
                fallo.put("cuando", cuando);
                fallo.put("titulo", a.optString("titulo", "Firme"));
                perdidas.put(fallo);
            }
        } catch (Exception ignorada) {
            // Sin datos legibles no se puede afirmar que faltara ninguna.
        }

        JSObject respuesta = new JSObject();
        respuesta.put("perdidas", perdidas.toString());
        llamada.resolve(respuesta);
    }

    /** Lo que hay programado ahora mismo, para la pantalla de comprobacion. */
    @PluginMethod
    public void estado(PluginCall llamada) {
        Context contexto = getContext();
        SharedPreferences prefs = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject respuesta = new JSObject();

        int enCola = 0;
        long proxima = 0;
        try {
            JSONArray cola = new JSONArray(prefs.getString(CLAVE_COLA, "[]"));
            long ahora = System.currentTimeMillis();
            for (int i = 0; i < cola.length(); i++) {
                long cuando = cola.getJSONObject(i).optLong("cuando", 0);
                if (cuando <= ahora) continue;
                enCola++;
                if (proxima == 0 || cuando < proxima) proxima = cuando;
            }
        } catch (Exception ignorada) {
            // Se responde con la cola vacia.
        }

        AlarmManager gestor = (AlarmManager) contexto.getSystemService(Context.ALARM_SERVICE);
        boolean puedeExactas = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && gestor != null) {
            puedeExactas = gestor.canScheduleExactAlarms();
        }

        // La que el sistema tiene por siguiente, sea de quien sea. Si esta es la
        // nuestra, el icono del reloj de la barra esta puesto por nosotros.
        long proximaDelSistema = 0;
        if (gestor != null) {
            AlarmManager.AlarmClockInfo siguiente = gestor.getNextAlarmClock();
            if (siguiente != null) proximaDelSistema = siguiente.getTriggerTime();
        }

        android.media.AudioManager audio =
                (android.media.AudioManager) contexto.getSystemService(Context.AUDIO_SERVICE);
        int volumen = audio == null ? -1 : audio.getStreamVolume(android.media.AudioManager.STREAM_ALARM);
        int volumenMaximo = audio == null ? -1 : audio.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);

        respuesta.put("enCola", enCola);
        respuesta.put("confirmadas", cuantasTieneElSistema(contexto));
        respuesta.put("proxima", proxima);
        respuesta.put("proximaDelSistema", proximaDelSistema);
        respuesta.put("puedeExactas", puedeExactas);
        respuesta.put("volumenAlarma", volumen);
        respuesta.put("volumenAlarmaMaximo", volumenMaximo);
        respuesta.put("exentaDeBateria", exentaDeBateria(contexto));
        respuesta.put("accesoNoMolestar", accesoNoMolestar(contexto));
        respuesta.put("avisosActivos", avisosActivos(contexto));
        respuesta.put("canalActivo", canalActivo(contexto));
        respuesta.put("sonandoAhora", ServicioAlarma.SONANDO);
        respuesta.put("ultimoFallo", prefs.getString(CLAVE_ULTIMO_FALLO, ""));
        respuesta.put("diario", prefs.getString(CLAVE_DIARIO, "[]"));
        respuesta.put("cola", prefs.getString(CLAVE_COLA, "[]"));

        // Quien es el movil. Los fabricantes chinos y Samsung matan apps por su
        // cuenta, con ajustes propios que no salen en la lista de permisos de
        // Android, y cada marca lo llama de una forma distinta.
        respuesta.put("fabricante", Build.MANUFACTURER);
        respuesta.put("modelo", Build.MODEL);
        respuesta.put("android", Build.VERSION.RELEASE);
        respuesta.put("sdk", Build.VERSION.SDK_INT);
        respuesta.put("cajon", cajonDeReposo(contexto));
        respuesta.put("restringidaEnSegundoPlano", restringidaEnSegundoPlano(contexto));
        respuesta.put("ahorroDeEnergia", ahorroDeEnergia(contexto));
        respuesta.put("filtroNoMolestar", filtroNoMolestar(contexto));
        llamada.resolve(respuesta);
    }

    /**
     * Si el ahorro de energia esta puesto.
     *
     * El modo ultra de algunos fabricantes —Xiaomi entre ellos— **cierra las
     * aplicaciones de terceros y el sistema les retira las alarmas**. Ninguna
     * app puede evitarlo desde dentro: esta hecho justo para eso, y el unico
     * despertador que sobrevive es el del propio telefono, porque es del
     * sistema.
     *
     * Lo unico honrado que se puede hacer es **decirlo en voz alta** en vez de
     * quedarse callado y fallar de madrugada.
     */
    private static boolean ahorroDeEnergia(Context contexto) {
        try {
            PowerManager energia = contexto.getSystemService(PowerManager.class);
            return energia != null && energia.isPowerSaveMode();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * En que cajon de reposo nos tiene el sistema.
     *
     * Android va degradando las apps que no se usan: activa, trabajadora, rara,
     * y al final **restringida**, que es donde las alarmas empiezan a caerse. Es
     * una de las pocas formas de saber, sin adivinar, que el sistema nos tiene
     * apartados. No hace falta permiso para preguntar por uno mismo.
     */
    private static String cajonDeReposo(Context contexto) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return "no aplica";
        try {
            android.app.usage.UsageStatsManager uso =
                    contexto.getSystemService(android.app.usage.UsageStatsManager.class);
            if (uso == null) return "desconocido";
            switch (uso.getAppStandbyBucket()) {
                case 10: return "activa";
                case 20: return "trabajadora";
                case 30: return "frecuente";
                case 40: return "rara";
                case 45: return "RESTRINGIDA";
                default: return "desconocido";
            }
        } catch (Exception e) {
            return "desconocido";
        }
    }

    /**
     * Si el usuario o el fabricante marcaron «restringir actividad en segundo
     * plano». Con eso puesto, el sistema puede tirar las alarmas aunque todos
     * los permisos esten concedidos — y es justo lo que nadie mira.
     */
    private static boolean restringidaEnSegundoPlano(Context contexto) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false;
        try {
            android.app.ActivityManager am =
                    contexto.getSystemService(android.app.ActivityManager.class);
            return am != null && am.isBackgroundRestricted();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Anade un dato al ultimo apunte del diario.
     *
     * El receptor escribe el apunte cuando llega la hora; el servicio vuelve
     * despues a decir si de verdad hubo ruido. Sin esa segunda mitad, el diario
     * solo sabe que Android nos desperto, que es justo lo que ya no bastaba:
     * la alarma del 16 de septiembre dejo notificacion y no sono, y el diario
     * la daba por buena.
     */
    static void anotarEnElUltimoDisparo(Context contexto, String clave, Object valor) {
        try {
            SharedPreferences prefs = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray diario = new JSONArray(prefs.getString(CLAVE_DIARIO, "[]"));
            if (diario.length() == 0) return;
            JSONObject ultimo = diario.getJSONObject(diario.length() - 1);
            ultimo.put(clave, valor);
            prefs.edit().putString(CLAVE_DIARIO, diario.toString()).apply();
        } catch (Exception ignorada) {
            // Un diario que no se deja escribir no debe impedir que suene.
        }
    }

    /**
     * Como esta puesto No molestar, en palabras.
     *
     * Importa una cosa por encima de todo: en **silencio total** el sistema
     * calla tambien el flujo de alarma, y entonces no hay app capaz de sonar.
     * Es la unica causa de silencio que no tiene arreglo desde dentro, asi que
     * lo minimo es saber nombrarla en vez de seguir buscando fantasmas.
     */
    static String filtroNoMolestar(Context contexto) {
        try {
            NotificationManager gestor = contexto.getSystemService(NotificationManager.class);
            if (gestor == null) return "desconocido";
            switch (gestor.getCurrentInterruptionFilter()) {
                case NotificationManager.INTERRUPTION_FILTER_ALL: return "todo pasa";
                case NotificationManager.INTERRUPTION_FILTER_PRIORITY: return "prioridad";
                case NotificationManager.INTERRUPTION_FILTER_ALARMS: return "solo alarmas";
                case NotificationManager.INTERRUPTION_FILTER_NONE: return "SILENCIO TOTAL";
                default: return "desconocido";
            }
        } catch (Exception e) {
            return "desconocido";
        }
    }

    /** El volumen del flujo de alarma, en tanto por ciento. -1 si no se sabe. */
    static int volumenDeAlarma(Context contexto) {
        try {
            android.media.AudioManager audio =
                    (android.media.AudioManager) contexto.getSystemService(Context.AUDIO_SERVICE);
            if (audio == null) return -1;
            int maximo = audio.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);
            if (maximo <= 0) return -1;
            return (audio.getStreamVolume(android.media.AudioManager.STREAM_ALARM) * 100) / maximo;
        } catch (Exception e) {
            return -1;
        }
    }

    private static boolean exentaDeBateria(Context contexto) {
        try {
            PowerManager energia = contexto.getSystemService(PowerManager.class);
            return energia != null
                    && energia.isIgnoringBatteryOptimizations(contexto.getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean accesoNoMolestar(Context contexto) {
        try {
            NotificationManager gestor = contexto.getSystemService(NotificationManager.class);
            return gestor != null && gestor.isNotificationPolicyAccessGranted();
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean avisosActivos(Context contexto) {
        try {
            return androidx.core.app.NotificationManagerCompat.from(contexto)
                    .areNotificationsEnabled();
        } catch (Exception e) {
            return false;
        }
    }

    /** Un canal apagado a mano deja el respaldo mudo sin que nadie se entere. */
    private static boolean canalActivo(Context contexto) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        try {
            NotificationManager gestor = contexto.getSystemService(NotificationManager.class);
            if (gestor == null) return false;
            NotificationChannel canal = gestor.getNotificationChannel(CANAL);
            return canal == null || canal.getImportance() != NotificationManager.IMPORTANCE_NONE;
        } catch (Exception e) {
            return false;
        }
    }

    // ---------------------------------------------------------------- pruebas

    /** Una prueba dentro de unos segundos, por la misma via que las de verdad. */
    @PluginMethod
    public void probar(PluginCall llamada) {
        int segundos = llamada.getInt("segundos", 60);
        long cuando = System.currentTimeMillis() + segundos * 1000L;
        programarUna(
                getContext(),
                999000,
                cuando,
                "Prueba del despertador",
                "Si oyes esto con el movil bloqueado, las alarmas funcionan.",
                "prueba"
        );
        JSObject respuesta = new JSObject();
        respuesta.put("cuando", cuando);
        llamada.resolve(respuesta);
    }

    /** Hace sonar el servicio ya mismo, sin esperar. Prueba del ruido en si. */
    @PluginMethod
    public void sonarYa(PluginCall llamada) {
        Context contexto = getContext();
        Intent sonar = new Intent(contexto, ServicioAlarma.class);
        sonar.setAction(ServicioAlarma.ACCION_SONAR);
        sonar.putExtra("id", 999001);
        sonar.putExtra("titulo", "Prueba en voz alta");
        sonar.putExtra("cuerpo", "Asi suena la alarma. Pulsa para pararla.");
        sonar.putExtra("idSuceso", "prueba");
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                contexto.startForegroundService(sonar);
            } else {
                contexto.startService(sonar);
            }
            llamada.resolve();
        } catch (Exception e) {
            llamada.reject("No arranco el servicio: " + e.getMessage());
        }
    }

    /** Callar la alarma que esta repicando. */
    @PluginMethod
    public void parar(PluginCall llamada) {
        ServicioAlarma.callar(getContext());
        llamada.resolve();
    }

    // -------------------------------------------------------------- permisos

    /** Abre el ajuste del sistema donde se conceden las alarmas exactas. */
    @PluginMethod
    public void pedirPermisoExactas(PluginCall llamada) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            abrir(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    .setData(Uri.parse("package:" + getContext().getPackageName())));
        }
        llamada.resolve();
    }

    /**
     * Pide quedar fuera del ahorro de bateria.
     *
     * Es el ajuste que mas alarmas mata en los moviles baratos: el sistema
     * congela la app y sus alarmas se quedan esperando. El permiso ya estaba
     * declarado, pero nunca se pedia.
     */
    @PluginMethod
    public void pedirExencionBateria(PluginCall llamada) {
        Context contexto = getContext();
        if (exentaDeBateria(contexto)) {
            llamada.resolve();
            return;
        }
        try {
            abrir(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:" + contexto.getPackageName())));
        } catch (Exception e) {
            // Algunos fabricantes lo bloquean: queda la lista general.
            abrir(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
        llamada.resolve();
    }

    /**
     * Pide el acceso a la directiva de notificaciones. Sin el, `setBypassDnd`
     * no hace nada y el respaldo se queda mudo con No molestar puesto.
     */
    @PluginMethod
    public void pedirAccesoNoMolestar(PluginCall llamada) {
        abrir(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
        llamada.resolve();
    }

    /** Abre los ajustes de la app, donde estan bateria y No molestar. */
    @PluginMethod
    public void abrirAjustesDeLaApp(PluginCall llamada) {
        abrir(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                .setData(Uri.parse("package:" + getContext().getPackageName())));
        llamada.resolve();
    }

    private void abrir(Intent intencion) {
        try {
            intencion.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intencion);
        } catch (Exception ignorada) {
            // Si el sistema lo rechaza no hay nada que hacer desde aqui.
        }
    }
}
