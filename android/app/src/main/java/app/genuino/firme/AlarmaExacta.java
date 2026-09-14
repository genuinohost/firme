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
 * El plugin de notificaciones de Capacitor programa avisos normales, y un aviso
 * normal lo silencia el modo No molestar. Para un bloque de oración a las tres
 * de la madrugada eso no sirve.
 *
 * Aquí se usa lo que usan los despertadores:
 *
 *  - `setAlarmClock()`, la unica forma de programar que Android respeta por
 *    encima de Doze y del ahorro de bateria. Ademas enseña el icono del reloj
 *    en la barra de estado.
 *  - Un canal cuyo sonido va por el **canal de audio de alarma**, que el modo
 *    No molestar no silencia.
 *  - Un aviso a pantalla completa, que con el movil bloqueado abre la app
 *    directamente en vez de quedarse en la bandeja.
 */
@CapacitorPlugin(name = "AlarmaExacta")
public class AlarmaExacta extends Plugin {

    /** Canal propio, aparte del de los avisos corrientes. */
    public static final String CANAL = "despertador-firme";

    /** Donde se guarda la cola, para poder rehacerla tras reiniciar el movil. */
    public static final String PREFS = "firme.alarmas";
    private static final String CLAVE_COLA = "cola";

    /** Margen para no reprogramar algo que acaba de sonar. */
    private static final long MARGEN_MS = 2000;

    @Override
    public void load() {
        crearCanal(getContext());
    }

    /**
     * El canal manda sobre el sonido, y no se puede cambiar una vez creado: si
     * hay que tocar algo de aqui, hay que estrenar identificador.
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

        // La pieza clave: marcar el sonido como alarma. El modo No molestar
        // silencia las notificaciones, pero deja pasar las alarmas.
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

        int puestas = 0;
        JSONArray guardadas = new JSONArray();
        long ahora = System.currentTimeMillis();

        try {
            for (int i = 0; i < entrada.length(); i++) {
                JSONObject alarma = entrada.getJSONObject(i);
                long cuando = alarma.getLong("cuando");
                if (cuando <= ahora + MARGEN_MS) continue;

                int id = i + 1;
                programarUna(
                        contexto,
                        id,
                        cuando,
                        alarma.optString("titulo", "Firme"),
                        alarma.optString("cuerpo", "Es la hora."),
                        alarma.optString("idSuceso", "")
                );

                JSONObject copia = new JSONObject(alarma.toString());
                copia.put("id", id);
                guardadas.put(copia);
                puestas++;
            }
        } catch (Exception e) {
            llamada.reject("No se pudieron programar: " + e.getMessage());
            return;
        }

        // Se deja constancia para poder rehacerlas cuando el movil se reinicie.
        SharedPreferences prefs = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(CLAVE_COLA, guardadas.toString()).apply();

        JSObject respuesta = new JSObject();
        respuesta.put("programadas", puestas);
        llamada.resolve(respuesta);
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
        intencion.putExtra("id", id);
        intencion.putExtra("titulo", titulo);
        intencion.putExtra("cuerpo", cuerpo);
        intencion.putExtra("idSuceso", idSuceso);
        // Sin datos distintos, Android reutilizaria el mismo PendingIntent para
        // todas y solo quedaria viva la ultima.
        intencion.setData(Uri.parse("firme://alarma/" + id));

        PendingIntent pendiente = PendingIntent.getBroadcast(
                contexto,
                id,
                intencion,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Lo que el usuario ve al tocar el icono del reloj de la barra.
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
                Intent intencion = new Intent(contexto, ReceptorAlarma.class);
                intencion.setAction("app.genuino.firme.ALARMA");
                intencion.setData(Uri.parse("firme://alarma/" + id));
                PendingIntent pendiente = PendingIntent.getBroadcast(
                        contexto,
                        id,
                        intencion,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                if (gestor != null) gestor.cancel(pendiente);
            }
        } catch (Exception ignorada) {
            // Una cola ilegible no debe impedir programar la nueva.
        }
        prefs.edit().remove(CLAVE_COLA).apply();
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

        // El volumen de alarma en cero deja muda la alarma aunque todo lo demas
        // este bien, y es un despiste facil de cometer.
        android.media.AudioManager audio =
                (android.media.AudioManager) contexto.getSystemService(Context.AUDIO_SERVICE);
        int volumen = audio == null ? -1 : audio.getStreamVolume(android.media.AudioManager.STREAM_ALARM);
        int volumenMaximo = audio == null ? -1 : audio.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);

        respuesta.put("enCola", enCola);
        respuesta.put("proxima", proxima);
        respuesta.put("puedeExactas", puedeExactas);
        respuesta.put("volumenAlarma", volumen);
        respuesta.put("volumenAlarmaMaximo", volumenMaximo);
        llamada.resolve(respuesta);
    }

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

    /** Abre el ajuste del sistema donde se conceden las alarmas exactas. */
    @PluginMethod
    public void pedirPermisoExactas(PluginCall llamada) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intencion = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intencion.setData(Uri.parse("package:" + getContext().getPackageName()));
            intencion.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intencion);
        }
        llamada.resolve();
    }

    /** Abre los ajustes de la app, donde estan bateria y No molestar. */
    @PluginMethod
    public void abrirAjustesDeLaApp(PluginCall llamada) {
        Intent intencion = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intencion.setData(Uri.parse("package:" + getContext().getPackageName()));
        intencion.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intencion);
        llamada.resolve();
    }
}
