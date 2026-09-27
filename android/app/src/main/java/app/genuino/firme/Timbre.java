package app.genuino.firme;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Apuntarse a la comunidad de voz, y atender la llamada cuando suena.
 *
 * <p><b>Apuntarse es cosa del propio movil.</b> Cada telefono se suscribe el
 * solo al tema {@code devocional} de Firebase. No hay servidor que guarde
 * quien esta apuntado ni lista de tokens: cuando Alex llama, el Worker manda un
 * mensaje al tema y Google lo reparte. Salirse es darse de baja del tema, y
 * desde ese momento ese movil no vuelve a sonar. Voluntario de verdad.
 *
 * <p>La lista de miembros que se ve en la app vive en Firestore aparte
 * ({@code comunidad/miembros}) y la lleva la web. Aqui solo esta lo que la web
 * no puede hacer: hablar con Firebase Messaging y leer lo que dejo
 * {@link ServicioAvisos}.
 */
@CapacitorPlugin(name = "Timbre")
public class Timbre extends Plugin {

    static final String TEMA = "devocional";

    @PluginMethod
    public void unirse(PluginCall llamada) {
        FirebaseMessaging.getInstance().subscribeToTopic(TEMA).addOnCompleteListener(t -> {
            if (t.isSuccessful()) llamada.resolve();
            else llamada.reject("no-se-pudo-apuntar", t.getException());
        });
    }

    @PluginMethod
    public void salirse(PluginCall llamada) {
        FirebaseMessaging.getInstance().unsubscribeFromTopic(TEMA).addOnCompleteListener(t -> {
            if (t.isSuccessful()) llamada.resolve();
            else llamada.reject("no-se-pudo-salir", t.getException());
        });
    }

    /**
     * La llamada que dejo {@link ServicioAvisos}, si hay. No se borra al leerla:
     * se borra al atenderla o al rechazarla, para que si la web se reinicia a
     * medias la llamada siga ahi.
     */
    @PluginMethod
    public void llamadaPendiente(PluginCall llamada) {
        JSObject r = new JSObject();
        try {
            SharedPreferences prefs =
                    getContext().getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE);
            String crudo = prefs.getString(ServicioAvisos.CLAVE_LLAMADA, null);
            if (crudo == null) {
                r.put("hay", false);
                llamada.resolve(r);
                return;
            }
            org.json.JSONObject j = new org.json.JSONObject(crudo);
            r.put("hay", true);
            r.put("canal", j.optString("canal"));
            r.put("nombre", j.optString("nombre", "Devocional"));
            r.put("quien", j.optString("quien", ""));
            r.put("cuando", j.optLong("cuando", 0));
            r.put("sono", j.optBoolean("sono", false));
            llamada.resolve(r);
        } catch (Exception e) {
            r.put("hay", false);
            llamada.resolve(r);
        }
    }

    /**
     * Atender o rechazar: se calla el timbre y se olvida la llamada. Es lo
     * mismo en los dos casos — la diferencia (entrar o no) la decide la web.
     */
    @PluginMethod
    public void atendida(PluginCall llamada) {
        try {
            getContext().getSharedPreferences(AlarmaExacta.PREFS, Context.MODE_PRIVATE)
                    .edit().remove(ServicioAvisos.CLAVE_LLAMADA).apply();
        } catch (Exception ignorada) { }
        try {
            Intent callar = new Intent(getContext(), ServicioAlarma.class);
            callar.setAction(ServicioAlarma.ACCION_PARAR);
            getContext().startService(callar);
        } catch (Exception ignorada) {
            // Si no habia servicio sonando, no hay nada que callar.
        }
        llamada.resolve();
    }
}
