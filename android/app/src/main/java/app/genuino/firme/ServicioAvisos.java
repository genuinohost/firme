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
        String tipo = datos.get("tipo");

        // «A Pepa le sonó»: el acuse que el portero reenvía a quien llamó. No
        // suena ni pinta nada; se apunta y, si la app esta abierta, se avisa.
        if ("sono".equals(tipo)) {
            apuntarAcuse(this, datos);
            return;
        }
        if (!"llamada".equals(tipo)) return;

        String canal = datos.get("canal");
        if (canal == null || canal.isEmpty()) return;
        boolean prueba = "1".equals(datos.get("prueba"));
        String nombre = textoDe(datos.get("nombre"), prueba ? "Prueba del timbre" : "Devocional");
        String quien = textoDe(datos.get("quien"), "");
        String llamada = textoDe(datos.get("llamada"), "");

        /*
          Desde la 6.27 la misma llamada llega DOS veces a este movil: por su
          token y por el tema (el tema sigue para las apps viejas). Se reconoce
          por `llamada` y suena una sola vez. Pero la segunda puede traer la
          vuelta —la del token—, y esa si se contesta: si no, quien llama veria
          «no confirmo» de un movil que sono.
        */
        boolean repetida = !llamada.isEmpty() && yaLlego(this, llamada);
        boolean sono = repetida ? sonoAntes(this, llamada) : hacerSonar(canal, nombre, quien, prueba);
        if (!repetida && !llamada.isEmpty()) apuntarLlamada(this, llamada, sono);

        /*
          La vuelta se contesta una vez por (llamada, para): dos cuentas en el
          mismo movil (un telefono compartido) reciben dos avisos con dos
          vueltas, y las dos filas tienen que salir «le sono».
        */
        String vuelta = datos.get("vuelta");
        String donde = datos.get("sono");
        String contestadaPor = llamada + "|" + textoDe(datos.get("para"), "");
        if (vuelta != null && !vuelta.isEmpty() && donde != null && donde.startsWith("https://")
                && !llamada.isEmpty() && !yaContestada(this, contestadaPor)) {
            if (contestar(donde, vuelta, estadoDelMovil(sono, repetida))) marcarContestada(this, contestadaPor);
        }
    }

    /**
     * Hacer sonar la llamada. Devuelve si arranco el timbre de verdad (true) o
     * si hubo que pasarla al camino de las alarmas (false).
     */
    private boolean hacerSonar(String canal, String nombre, String quien, boolean prueba) {

        /*
          Aqui habia una comprobacion «si el aviso tiene mas de diez minutos,
          no suena». Restaba la hora del servidor de Google de la hora del
          movil, asi que lo que media era el desajuste del reloj, no el
          retraso: un Xiaomi con la hora puesta a mano doce minutos adelante
          NO SONABA NUNCA. El Worker ya manda el aviso con ttl de 600 s y es
          FCM quien descarta los tardios; aqui, en la duda, se suena.
        */
        guardarPendiente(this, canal, nombre, quien, true);

        // Y que suene, con lo que ya sabe sonar.
        boolean sonoDeVerdad = true;
        Intent sonar = new Intent(this, ServicioAlarma.class);
        sonar.setAction(ServicioAlarma.ACCION_SONAR);
        sonar.putExtra("id", ID_LLAMADA);
        sonar.putExtra("titulo", nombre);
        String cuerpo = prueba
                ? "Si oyes esto, tu móvil sonará cuando llamen al devocional. Ya puedes colgar."
                : "Te llaman al devocional. Toca para entrar.";
        sonar.putExtra("cuerpo", cuerpo);
        sonar.putExtra("idSuceso", "sala:" + canal);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(sonar);
            } else {
                startService(sonar);
            }
        } catch (Exception e) {
            sonoDeVerdad = false;
            /*
              Android 12+ solo deja arrancar el servicio desde aqui si el aviso
              llego con prioridad alta de verdad. Cuando la rebaja —cajon
              «restringido», cuota gastada, MIUI—, lanza. En vez de tragarlo y
              dejar el movil mudo, la llamada se pasa al camino de las alarmas:
              una alarma exacta para ya mismo, que si tiene permiso para
              arrancar el servicio y trae lo que aqui falta (reintento,
              respaldo, ultimo recurso y el apunte en el diario). Y se vuelve a
              guardar la pendiente con «no sono» hasta que suene por ahi.
            */
            guardarPendiente(this, canal, nombre, quien, false);
            try {
                AlarmaExacta.programarUna(
                        getApplicationContext(),
                        ID_LLAMADA,
                        System.currentTimeMillis(),
                        nombre,
                        cuerpo,
                        "sala:" + canal);
            } catch (Exception ignorada) {
                // Sin alarma tampoco: queda la llamada pendiente para la web.
            }
        }

        // Y si la app esta abierta, que la web lo sepa ya: sin esto, con la
        // app delante el movil repicaba y en pantalla no salia nada.
        Timbre.avisar(canal, nombre);
        return sonoDeVerdad;
    }

    // ── Las llamadas que ya llegaron ──────────────────────────────────────
    //
    // En las preferencias del despertador, con commit() y no apply(): los dos
    // avisos de la misma llamada llegan uno detras de otro, y el segundo tiene
    // que ver lo que dejo el primero. FirebaseMessagingService los atiende de
    // uno en uno, asi que no hay carrera. Se guardan media hora.

    private static final String CLAVE_LLEGADAS = "timbre.llegadas";
    private static final long LLEGADAS_MS = 30 * 60 * 1000L;

    private static org.json.JSONObject llegadas(Context contexto) {
        try {
            String crudo = contexto.getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE)
                    .getString(CLAVE_LLEGADAS, "{}");
            org.json.JSONObject todas = new org.json.JSONObject(crudo);
            org.json.JSONObject vivas = new org.json.JSONObject();
            long ahora = System.currentTimeMillis();
            java.util.Iterator<String> ids = todas.keys();
            while (ids.hasNext()) {
                String id = ids.next();
                org.json.JSONObject l = todas.optJSONObject(id);
                if (l != null && ahora - l.optLong("en", 0) < LLEGADAS_MS) vivas.put(id, l);
            }
            return vivas;
        } catch (Exception e) {
            return new org.json.JSONObject();
        }
    }

    private static void guardarLlegadas(Context contexto, org.json.JSONObject todas) {
        try {
            contexto.getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE)
                    .edit().putString(CLAVE_LLEGADAS, todas.toString()).commit();
        } catch (Exception ignorada) { }
    }

    static boolean yaLlego(Context contexto, String llamada) {
        return llegadas(contexto).has(llamada);
    }

    static boolean sonoAntes(Context contexto, String llamada) {
        org.json.JSONObject l = llegadas(contexto).optJSONObject(llamada);
        return l != null && l.optBoolean("sono", false);
    }

    static void apuntarLlamada(Context contexto, String llamada, boolean sono) {
        try {
            org.json.JSONObject todas = llegadas(contexto);
            org.json.JSONObject l = new org.json.JSONObject();
            l.put("en", System.currentTimeMillis());
            l.put("sono", sono);
            todas.put(llamada, l);
            guardarLlegadas(contexto, todas);
        } catch (Exception ignorada) { }
    }

    /** `clave` es «llamada|para»: se apunta aparte de la llegada, con su propia hora. */
    static boolean yaContestada(Context contexto, String clave) {
        org.json.JSONObject l = llegadas(contexto).optJSONObject("contestada:" + clave);
        return l != null;
    }

    static void marcarContestada(Context contexto, String clave) {
        try {
            org.json.JSONObject todas = llegadas(contexto);
            org.json.JSONObject l = new org.json.JSONObject();
            l.put("en", System.currentTimeMillis());
            todas.put("contestada:" + clave, l);
            guardarLlegadas(contexto, todas);
        } catch (Exception ignorada) { }
    }

    // ── «Me sono» ─────────────────────────────────────────────────────────

    /**
     * Como esta este movil, para que quien llama sepa por que no se vio o no
     * se oyo sin tener el telefono delante. Lo mismo que ensena el parte del
     * despertador, y nada personal: ni nombre ni numero ni cuenta.
     */
    private org.json.JSONObject estadoDelMovil(boolean sono, boolean repetida) {
        org.json.JSONObject e = new org.json.JSONObject();
        try {
            e.put("sono", sono);
            e.put("repetida", repetida);
            e.put("avisos", AlarmaExacta.avisosActivos(this));
            e.put("canal", AlarmaExacta.canalActivo(this));
            e.put("pantalla", AlarmaExacta.puedePantallaCompleta(this));
            e.put("bateria", AlarmaExacta.exentaDeBateria(this));
            e.put("ahorro", AlarmaExacta.ahorroDeEnergia(this));
            e.put("cajon", AlarmaExacta.cajonDeReposo(this));
            e.put("noMolestar", AlarmaExacta.filtroNoMolestar(this));
            e.put("volumen", AlarmaExacta.volumenDeAlarma(this));
            e.put("fabricante", Build.MANUFACTURER);
            e.put("modelo", Build.MODEL);
            e.put("android", Build.VERSION.RELEASE);
            try {
                e.put("version", getPackageManager().getPackageInfo(getPackageName(), 0).versionName);
            } catch (Exception sinVersion) { }
        } catch (Exception ignorada) { }
        return e;
    }

    /**
     * Devolver la vuelta al portero. Se hace aqui, en el hilo del aviso (no es
     * el principal), con plazos cortos: Android da unos veinte segundos a este
     * metodo y el timbre ya esta sonando por su lado.
     */
    private static boolean contestar(String donde, String vuelta, org.json.JSONObject estado) {
        java.net.HttpURLConnection c = null;
        try {
            org.json.JSONObject cuerpo = new org.json.JSONObject();
            cuerpo.put("vuelta", vuelta);
            cuerpo.put("estado", estado);
            byte[] bytes = cuerpo.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            c = (java.net.HttpURLConnection) new java.net.URL(donde).openConnection();
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setFixedLengthStreamingMode(bytes.length);
            try (java.io.OutputStream salida = c.getOutputStream()) {
                salida.write(bytes);
            }
            int codigo = c.getResponseCode();
            // 400/410: vuelta mala o caducada; reintentar no la arregla.
            return codigo == 200 || codigo == 400 || codigo == 410;
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    // ── Los acuses que le llegan a quien llamo ─────────────────────────────

    static final String CLAVE_ACUSES = "timbre.acuses";

    /** Se guardan los ultimos, para la web al abrirse, y se le avisa si esta. */
    static void apuntarAcuse(Context contexto, Map<String, String> datos) {
        try {
            org.json.JSONObject a = new org.json.JSONObject();
            a.put("llamada", textoDe(datos.get("llamada"), ""));
            a.put("para", textoDe(datos.get("para"), ""));
            a.put("tarda", Long.parseLong(textoDe(datos.get("tarda"), "0")));
            a.put("estado", new org.json.JSONObject(textoDe(datos.get("estado"), "{}")));
            a.put("en", System.currentTimeMillis());
            SharedPreferences prefs = contexto.getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE);
            org.json.JSONArray lista = new org.json.JSONArray(prefs.getString(CLAVE_ACUSES, "[]"));
            // Un reenvio del mismo (llamada, para) REEMPLAZA al anterior: si se
            // añadiera, alguien repitiendo su acuse sacaria de la lista los de
            // los demas. (Revision de la 6.27.)
            // Y uno que SONO no lo sustituye uno frenado de otro aparato suyo.
            java.util.List<Object> quedan = new java.util.ArrayList<>();
            boolean frenado = !a.optJSONObject("estado").optBoolean("sono", true);
            for (int i = 0; i < lista.length(); i++) {
                org.json.JSONObject o = lista.optJSONObject(i);
                if (o != null && a.optString("llamada").equals(o.optString("llamada"))
                        && a.optString("para").equals(o.optString("para"))) {
                    org.json.JSONObject suEstado = o.optJSONObject("estado");
                    boolean elSono = suEstado == null || suEstado.optBoolean("sono", true);
                    if (frenado && elSono) return;
                    continue;
                }
                quedan.add(lista.get(i));
            }
            org.json.JSONArray nueva = new org.json.JSONArray();
            // Los ultimos 80: una llamada a toda la comunidad cabe de sobra.
            for (int i = Math.max(0, quedan.size() - 79); i < quedan.size(); i++) nueva.put(quedan.get(i));
            nueva.put(a);
            prefs.edit().putString(CLAVE_ACUSES, nueva.toString()).commit();
            Timbre.avisarAcuse(a.toString());
        } catch (Exception ignorada) {
            // Un acuse que no se entiende no se apunta; la llamada no depende de el.
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
        // Desde la 6.27 se llama tambien por token. Aqui no hay sesion de
        // Firebase para guardarlo en la ficha: si la app esta abierta, se le
        // avisa a la web, que lo guarda (reapuntarmeSiEstoyDentro); si no, lo
        // hace al abrirse o al volver a primer plano.
        Timbre.avisarTokenNuevo();
    }

    private static String textoDe(String valor, String pordefecto) {
        return valor == null || valor.isEmpty() ? pordefecto : valor;
    }
}
