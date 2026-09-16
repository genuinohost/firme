package app.genuino.firme;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * Dictar en voz alta.
 *
 * Alex: «necesito poder crear tareas y comentarios en mi diario con voz. Hay
 * veces donde no puedo escribir». No es comodidad: esta app se usa a las tres
 * de la madrugada, medio dormido y con una mano. Una nota que hay que teclear
 * en esas condiciones es una nota que no se escribe, y el diario vale justo por
 * lo que se anota cuando aprieta.
 *
 * <p><b>Por qué un plugin propio y no el de la comunidad.</b> Hay uno hecho,
 * pero es una dependencia mas que puede chocar con Capacitor 8 y el SDK 36 —y
 * que habria que ir actualizando— para algo que son cien lineas de
 * {@link SpeechRecognizer}. Ademas asi el idioma, los resultados parciales y el
 * comportamiento son los que queremos, no los que vengan de serie.
 *
 * <p><b>Dos detalles que no son negociables.</b> {@link SpeechRecognizer} sólo
 * se puede tocar desde el hilo principal —desde otro no lanza nada, simplemente
 * no hace nada— y el permiso del micrófono se pide <b>al tocar el botón</b>, no
 * al arrancar la app: pedir permisos antes de que se entienda para qué es la
 * forma más rápida de que te los nieguen para siempre.
 */
@CapacitorPlugin(
        name = "Dictado",
        permissions = {
                @Permission(alias = "microfono", strings = {Manifest.permission.RECORD_AUDIO})
        }
)
public class Dictado extends Plugin {

    private SpeechRecognizer oyente;
    private final Handler principal = new Handler(Looper.getMainLooper());
    private boolean escuchando = false;

    /** Si este movil sabe transcribir. Algunos salen de fabrica sin el motor. */
    @PluginMethod
    public void disponible(PluginCall llamada) {
        JSObject r = new JSObject();
        boolean hay = false;
        try {
            hay = SpeechRecognizer.isRecognitionAvailable(getContext());
        } catch (Exception ignorada) {
            // Un movil que no sabe responder a esto tampoco sabe transcribir.
        }
        r.put("disponible", hay);
        llamada.resolve(r);
    }

    @PluginMethod
    public void empezar(PluginCall llamada) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) {
            requestPermissionForAlias("microfono", llamada, "trasElPermiso");
            return;
        }
        arrancar(llamada);
    }

    @PermissionCallback
    private void trasElPermiso(PluginCall llamada) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) {
            llamada.reject("sin-permiso");
            return;
        }
        arrancar(llamada);
    }

    private void arrancar(PluginCall llamada) {
        final String idioma = llamada.getString("idioma", "es-ES");

        principal.post(() -> {
            try {
                soltar();

                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                    llamada.reject("sin-motor");
                    return;
                }

                oyente = SpeechRecognizer.createSpeechRecognizer(getContext());
                oyente.setRecognitionListener(new Escucha());

                Intent intencion = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intencion.putExtra(
                        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intencion.putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma);
                intencion.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intencion.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                // Sin esto el motor corta al primer silencio, y quien dicta una
                // nota se para a pensar a mitad de frase.
                intencion.putExtra(
                        RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
                intencion.putExtra(
                        RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
                        2500L);

                oyente.startListening(intencion);
                escuchando = true;
                llamada.resolve();
            } catch (Exception e) {
                llamada.reject("no-arranco: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void parar(PluginCall llamada) {
        principal.post(() -> {
            try {
                if (oyente != null && escuchando) oyente.stopListening();
            } catch (Exception ignorada) {
                // Parar algo que ya no escucha no es un problema.
            }
            llamada.resolve();
        });
    }

    @PluginMethod
    public void cancelar(PluginCall llamada) {
        principal.post(() -> {
            soltar();
            llamada.resolve();
        });
    }

    private void soltar() {
        escuchando = false;
        if (oyente == null) return;
        try {
            oyente.cancel();
        } catch (Exception ignorada) { }
        try {
            oyente.destroy();
        } catch (Exception ignorada) { }
        oyente = null;
    }

    @Override
    protected void handleOnDestroy() {
        principal.post(this::soltar);
        super.handleOnDestroy();
    }

    private void avisar(String suceso, JSObject datos) {
        try {
            notifyListeners(suceso, datos);
        } catch (Exception ignorada) {
            // Si la vista ya no esta, no hay a quien avisar.
        }
    }

    /** Lo que va diciendo el motor mientras se habla y cuando termina. */
    private class Escucha implements RecognitionListener {

        @Override
        public void onReadyForSpeech(Bundle params) {
            avisar("listo", new JSObject());
        }

        @Override
        public void onBeginningOfSpeech() { }

        /**
         * El nivel de voz, para que el boton lata al ritmo de quien habla.
         *
         * Llega en decibelios, de -2 a 10 mas o menos. Se normaliza aqui y no
         * en la pantalla: es cosa del motor, no del diseño.
         */
        @Override
        public void onRmsChanged(float rms) {
            JSObject d = new JSObject();
            float nivel = Math.max(0f, Math.min(1f, (rms + 2f) / 12f));
            d.put("nivel", nivel);
            avisar("nivel", d);
        }

        @Override
        public void onBufferReceived(byte[] buffer) { }

        @Override
        public void onEndOfSpeech() {
            escuchando = false;
        }

        @Override
        public void onError(int codigo) {
            escuchando = false;
            JSObject d = new JSObject();
            d.put("codigo", codigo);
            d.put("motivo", motivoDe(codigo));
            avisar("error", d);
        }

        @Override
        public void onResults(Bundle resultados) {
            escuchando = false;
            JSObject d = new JSObject();
            d.put("texto", primeroDe(resultados));
            avisar("texto", d);
        }

        @Override
        public void onPartialResults(Bundle resultados) {
            JSObject d = new JSObject();
            d.put("texto", primeroDe(resultados));
            avisar("parcial", d);
        }

        @Override
        public void onEvent(int tipo, Bundle params) { }

        private String primeroDe(Bundle resultados) {
            try {
                ArrayList<String> lista =
                        resultados.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (lista != null && !lista.isEmpty()) return lista.get(0);
            } catch (Exception ignorada) {
                // Un resultado ilegible cuenta como que no se entendio nada.
            }
            return "";
        }
    }

    /**
     * El motivo, en palabras que se puedan enseñar.
     *
     * «Error 7» no le dice nada a nadie; «no te oí» sí, y ademas dice qué
     * hacer. Un mensaje que no se entiende es tan inútil como no dar ninguno.
     */
    private static String motivoDe(int codigo) {
        switch (codigo) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "No se pudo usar el micrófono.";
            case SpeechRecognizer.ERROR_CLIENT:
                return "El dictado se cerró solo.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Falta el permiso del micrófono.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "Sin conexión. El dictado la necesita en este móvil.";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "No te entendí. Prueba otra vez.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "Espera un segundo y vuelve a intentarlo.";
            case SpeechRecognizer.ERROR_SERVER:
                return "El servicio de voz falló.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No te oí. Acércate y habla otra vez.";
            default:
                return "No se pudo dictar.";
        }
    }
}
