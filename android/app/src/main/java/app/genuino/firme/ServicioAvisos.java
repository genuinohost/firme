package app.genuino.firme;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Lo que pasa cuando llega «te llaman al devocional» con la app cerrada.
 *
 * <p><b>Por que existe.</b> Alex, el 27-09-2026: «VITAL que yo pueda hacer que
 * le suene la llamada a los que voluntariamente estan dentro del grupo de voz».
 * Con la app cerrada, lo unico que Google deja despertar es esto: un servicio
 * que recibe el aviso. El resto —que suene, que encienda la pantalla— no se
 * inventa aqui: se le pasa a {@link ServicioAlarma}, que es la maquinaria que ya
 * aguanta MIUI a las cuatro de la madrugada.
 *
 * <p><b>Por que el aviso es de datos y no una notificacion.</b> Si el Worker
 * mandara una notificacion normal, Android la pintaria el solo como un avisito
 * mudo en la bandeja y este metodo ni se ejecutaria con la app cerrada. Un
 * mensaje de datos con prioridad alta si llega aqui, y aqui se decide que hacer
 * con el.
 *
 * <p><b>Lo que se guarda.</b> La llamada pendiente, en el mismo sitio que el
 * resto del despertador, para que la web la encuentre al abrirse — el
 * FirebaseMessagingService no puede hablar con la web directamente, y la app
 * puede tardar segundos en arrancar desde la pantalla de la alarma.
 */
public class ServicioAvisos extends FirebaseMessagingService {

    /** Identificador fijo de la alarma de llamada. Fuera del rango de la rutina. */
    public static final int ID_LLAMADA = 700900;

    /** Clave de la llamada pendiente en las preferencias del despertador. */
    public static final String CLAVE_LLAMADA = "llamadaPendiente";

    /**
     * Una llamada de hace mas de esto ya no es una llamada. Si el movil estuvo
     * apagado y el aviso llega tarde, no se hace sonar nada: se guardaria una
     * llamada a una sala que probablemente ya cerro.
     */
    private static final long VALE_MS = 10 * 60 * 1000L;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage mensaje) {
        Map<String, String> datos = mensaje.getData();
        if (!"llamada".equals(datos.get("tipo"))) return;

        String canal = datos.get("canal");
        if (canal == null || canal.isEmpty()) return;
        String nombre = textoDe(datos.get("nombre"), "Devocional");
        String quien = textoDe(datos.get("quien"), "");

        long enviado = mensaje.getSentTime();
        if (enviado > 0 && System.currentTimeMillis() - enviado > VALE_MS) {
            // Llego tarde. Se apunta, por si la web quiere decirlo, pero no suena.
            guardarPendiente(this, canal, nombre, quien, false);
            return;
        }

        guardarPendiente(this, canal, nombre, quien, true);

        // Y que suene, con lo que ya sabe sonar.
        Intent sonar = new Intent(this, ServicioAlarma.class);
        sonar.setAction(ServicioAlarma.ACCION_SONAR);
        sonar.putExtra("id", ID_LLAMADA);
        sonar.putExtra("titulo", nombre);
        sonar.putExtra("cuerpo", "Te llaman al devocional. Toca para entrar.");
        sonar.putExtra("idSuceso", "sala:" + canal);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(sonar);
            } else {
                startService(sonar);
            }
        } catch (Exception e) {
            // Si el sistema no deja arrancar el servicio desde aqui, queda la
            // llamada pendiente: la web la ensena al abrir. Peor que sonar,
            // mejor que nada.
        }
    }

    static void guardarPendiente(
            Context contexto, String canal, String nombre, String quien, boolean sono) {
        try {
            org.json.JSONObject j = new org.json.JSONObject();
            j.put("canal", canal);
            j.put("nombre", nombre);
            j.put("quien", quien);
            j.put("cuando", System.currentTimeMillis());
            j.put("sono", sono);
            SharedPreferences prefs =
                    contexto.getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE);
            prefs.edit().putString(CLAVE_LLAMADA, j.toString()).apply();
        } catch (Exception ignorada) {
            // Sin sitio donde apuntarla, la web no la vera; el sonido sigue.
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        // No hace falta guardar el token: no se llama a nadie por token, sino
        // al tema, y las suscripciones a temas sobreviven al cambio de token.
    }

    private static String textoDe(String valor, String pordefecto) {
        return valor == null || valor.isEmpty() ? pordefecto : valor;
    }
}
