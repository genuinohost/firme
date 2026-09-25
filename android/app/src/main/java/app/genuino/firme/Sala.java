package app.genuino.firme;

import android.Manifest;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import io.agora.rtc2.ChannelMediaOptions;
import io.agora.rtc2.Constants;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.RtcEngineConfig;
import io.agora.rtc2.UserInfo;

/**
 * La sala de voz: el devocional de treinta y la llamada de dos.
 *
 * <p><b>Por que nativo y no el SDK de JavaScript.</b> Agora tiene uno de
 * JavaScript y seria lo comodo, porque esta app es una web dentro de un WebView.
 * Su propia documentacion dice que el soporte de audio en WebView <b>depende del
 * dispositivo</b>. Eso es exactamente el fallo que este proyecto lleva un mes
 * persiguiendo con las alarmas: funciona en el movil de quien lo programa y no en
 * el de un hermano, y no hay forma de saberlo hasta que alguien se queda fuera
 * del devocional. El detalle y las fuentes estan en
 * {@code docs/investigacion/salas-de-voz.md}.
 *
 * <p><b>Aqui no se decide quien habla.</b> Eso lo decide el token que firma la
 * Cloud Function, y Agora no le da el privilegio de publicar audio a un oyente.
 * Este plugin solo obedece: le pasan un token y si viene de oyente, no publica.
 * Es a proposito — si la decision viviera aqui, viviria dentro del APK de cada
 * uno, y un APK modificado se saltaria la moderacion del devocional.
 *
 * <p><b>Lo que manda a la web.</b> La lista de quien esta dentro sale de
 * Firestore, no de aqui: ahi estan los nombres y las fotos. De Agora solo hace
 * falta una cosa que Firestore no puede saber — <b>quien esta hablando ahora
 * mismo</b>— y los avisos de que algo se rompio.
 */
@CapacitorPlugin(
        name = "Sala",
        permissions = {
                @Permission(alias = "microfono", strings = {Manifest.permission.RECORD_AUDIO})
        }
)
public class Sala extends Plugin {

    private RtcEngine motor;

    /** El canal en el que estamos, o null. Sirve para no entrar dos veces. */
    private String canalActual;

    /** Como se llama la sala, solo para el aviso del servicio. */
    private String nombreActual;

    /** La llamada que espera a que se conceda el microfono. */
    private PluginCall esperandoPermiso;

    // ------------------------------------------------------------------ avisos

    private final IRtcEngineEventHandler manejador = new IRtcEngineEventHandler() {

        @Override
        public void onJoinChannelSuccess(String canal, int uid, int tardo) {
            JSObject d = new JSObject();
            d.put("canal", canal);
            d.put("uid", uid);
            notifyListeners("entrado", d);
        }

        /**
         * Quien esta hablando ahora mismo.
         *
         * <p>Es lo unico que Firestore no puede saber, y lo que hace que una
         * sala de treinta se entienda: sin ver quien habla, treinta nombres en
         * una lista son treinta desconocidos.
         *
         * <p>Agora da el uid numerico. Nosotros entramos con la cuenta en texto
         * —el uid de Firebase—, asi que hay que traducir; si la traduccion
         * todavia no ha llegado se manda el numero y la web lo ignora, que es
         * mejor que enseñar a la persona equivocada hablando.
         */
        @Override
        public void onAudioVolumeIndication(AudioVolumeInfo[] quienes, int total) {
            if (quienes == null) return;
            JSArray lista = new JSArray();
            for (AudioVolumeInfo q : quienes) {
                JSObject uno = new JSObject();
                // uid 0 es uno mismo. Se manda igual: verse hablando es la forma
                // de saber que el microfono esta abierto de verdad.
                uno.put("yo", q.uid == 0);
                uno.put("volumen", q.volume);
                String cuenta = cuentaDe(q.uid);
                if (cuenta != null) uno.put("cuenta", cuenta);
                lista.put(uno);
            }
            JSObject d = new JSObject();
            d.put("quienes", lista);
            d.put("total", total);
            notifyListeners("hablando", d);
        }

        @Override
        public void onUserJoined(int uid, int tardo) {
            JSObject d = new JSObject();
            String cuenta = cuentaDe(uid);
            if (cuenta != null) d.put("cuenta", cuenta);
            d.put("uid", uid);
            notifyListeners("alguienEntro", d);
        }

        @Override
        public void onUserOffline(int uid, int motivo) {
            JSObject d = new JSObject();
            String cuenta = cuentaDe(uid);
            if (cuenta != null) d.put("cuenta", cuenta);
            d.put("uid", uid);
            notifyListeners("alguienSalio", d);
        }

        /** La traduccion de uid numerico a cuenta llega por aqui. */
        @Override
        public void onUserInfoUpdated(int uid, UserInfo info) {
            if (info == null || info.userAccount == null) return;
            JSObject d = new JSObject();
            d.put("uid", uid);
            d.put("cuenta", info.userAccount);
            notifyListeners("seSupoQuienEs", d);
        }

        /**
         * El token caduca en treinta segundos.
         *
         * <p>Hay que avisar a la web para que pida otro. Si no se renueva, a
         * alguien se le corta la voz a mitad del devocional sin motivo visible.
         */
        @Override
        public void onTokenPrivilegeWillExpire(String token) {
            notifyListeners("tokenPorCaducar", new JSObject());
        }

        @Override
        public void onRequestToken() {
            // Ya caduco. Es lo mismo pero con prisa.
            notifyListeners("tokenPorCaducar", new JSObject());
        }

        @Override
        public void onError(int codigo) {
            JSObject d = new JSObject();
            d.put("codigo", codigo);
            notifyListeners("problema", d);
        }

        @Override
        public void onConnectionStateChanged(int estado, int motivo) {
            JSObject d = new JSObject();
            d.put("estado", estado);
            d.put("motivo", motivo);
            // La web decide si esto merece decirse. Aqui no se interpreta: una
            // reconexion de dos segundos no es un fallo y no hay que asustar.
            notifyListeners("estadoDeRed", d);
        }
    };

    /** La cuenta de texto de un uid numerico, si Agora ya la sabe. */
    private String cuentaDe(int uid) {
        if (motor == null || uid == 0) return null;
        try {
            UserInfo info = new UserInfo();
            motor.getUserInfoByUid(uid, info);
            return info.userAccount != null && !info.userAccount.isEmpty() ? info.userAccount : null;
        } catch (Exception ignorada) {
            return null;
        }
    }

    // ------------------------------------------------------------------ metodos

    /** Si este movil puede entrar en una sala. */
    @PluginMethod
    public void disponible(PluginCall llamada) {
        JSObject r = new JSObject();
        r.put("hay", true);
        r.put("microfono", getPermissionState("microfono") == PermissionState.GRANTED);
        llamada.resolve(r);
    }

    /**
     * Entrar.
     *
     * <p>El permiso del microfono se pide <b>aqui</b>, al entrar, y no al arrancar
     * la app: pedir el microfono antes de que se entienda para que es la forma
     * mas rapida de que te lo nieguen para siempre. Es la misma regla que sigue
     * {@link Dictado}.
     */
    @PluginMethod
    public void entrar(PluginCall llamada) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) {
            esperandoPermiso = llamada;
            llamada.setKeepAlive(true);
            requestPermissionForAlias("microfono", llamada, "traselPermiso");
            return;
        }
        entrarDeVerdad(llamada);
    }

    @PermissionCallback
    private void traselPermiso(PluginCall llamada) {
        PluginCall guardada = esperandoPermiso != null ? esperandoPermiso : llamada;
        esperandoPermiso = null;
        if (getPermissionState("microfono") != PermissionState.GRANTED) {
            // Sin microfono se puede escuchar, pero no es lo que se pidio. Se
            // dice claro para que la web pueda ofrecer entrar solo a escuchar.
            guardada.reject("sin-microfono");
            return;
        }
        entrarDeVerdad(guardada);
    }

    private void entrarDeVerdad(PluginCall llamada) {
        String appId = llamada.getString("appId");
        String canal = llamada.getString("canal");
        String token = llamada.getString("token");
        String cuenta = llamada.getString("cuenta");
        boolean habla = Boolean.TRUE.equals(llamada.getBoolean("habla", false));
        String nombre = llamada.getString("nombre", "Una sala");

        if (appId == null || canal == null || token == null || cuenta == null) {
            llamada.reject("faltan-datos");
            return;
        }

        try {
            if (motor == null) {
                RtcEngineConfig cfg = new RtcEngineConfig();
                cfg.mContext = getContext();
                cfg.mAppId = appId;
                // Emision en directo y no «comunicacion»: es el perfil que
                // distingue entre quien habla y quien escucha, y sin esa
                // distincion un devocional de treinta no se puede moderar.
                cfg.mChannelProfile = Constants.CHANNEL_PROFILE_LIVE_BROADCASTING;
                cfg.mEventHandler = manejador;
                motor = RtcEngine.create(cfg);
                // Voz, nada de video. Ni se pide la camara.
                motor.enableAudio();
                motor.disableVideo();
                // Perfil de voz hablada y escenario de sala: es lo que activa la
                // cancelacion de eco y el control de ganancia que hacen que
                // treinta personas en altavoz no se acoplen.
                motor.setAudioProfile(
                        Constants.AUDIO_PROFILE_SPEECH_STANDARD,
                        Constants.AUDIO_SCENARIO_CHATROOM);
                // Cada 400 ms, quien habla. Mas a menudo no se nota y gasta
                // bateria; menos y el indicador va a tirones.
                motor.enableAudioVolumeIndication(400, 3, true);
            }

            ChannelMediaOptions op = new ChannelMediaOptions();
            op.channelProfile = Constants.CHANNEL_PROFILE_LIVE_BROADCASTING;
            op.clientRoleType = habla
                    ? Constants.CLIENT_ROLE_BROADCASTER
                    : Constants.CLIENT_ROLE_AUDIENCE;
            op.autoSubscribeAudio = true;
            op.publishMicrophoneTrack = habla;

            int r = motor.joinChannelWithUserAccount(token, canal, cuenta, op);
            if (r != 0) {
                llamada.reject("no-se-pudo-entrar:" + r);
                return;
            }

            canalActual = canal;
            nombreActual = nombre;
            // Y el servicio, para que salir de la app no saque de la sala.
            ServicioSala.arrancar(getContext(), nombre);

            JSObject ok = new JSObject();
            ok.put("habla", habla);
            llamada.resolve(ok);
        } catch (Exception e) {
            llamada.reject("fallo-al-entrar", e);
        }
    }

    /** Salir. Se puede llamar de más: salir de donde no estas no es un error. */
    @PluginMethod
    public void salir(PluginCall llamada) {
        try {
            if (motor != null) motor.leaveChannel();
        } catch (Exception ignorada) {
            // Da igual por que fallo: lo que importa es que se suelte todo.
        }
        canalActual = null;
        nombreActual = null;
        ServicioSala.parar(getContext());
        llamada.resolve();
    }

    /** Abrir o cerrar el propio microfono. */
    @PluginMethod
    public void micro(PluginCall llamada) {
        if (motor == null) {
            llamada.reject("no-estas-dentro");
            return;
        }
        boolean abierto = Boolean.TRUE.equals(llamada.getBoolean("abierto", true));
        // `muteLocalAudioStream(true)` deja de mandar voz pero sigue dentro, que
        // es lo que se quiere al silenciarse: no perder el sitio.
        motor.muteLocalAudioStream(!abierto);
        llamada.resolve();
    }

    /**
     * Cambiar de oyente a quien habla, o al contrario.
     *
     * <p>Hace falta el token nuevo: el rol va firmado dentro, asi que cambiar de
     * papel sin cambiar de token no cambia nada. Es justamente lo que hace que la
     * moderacion no se pueda saltar desde el cliente.
     */
    @PluginMethod
    public void rol(PluginCall llamada) {
        if (motor == null) {
            llamada.reject("no-estas-dentro");
            return;
        }
        String token = llamada.getString("token");
        boolean habla = Boolean.TRUE.equals(llamada.getBoolean("habla", false));
        if (token == null) {
            llamada.reject("falta-el-token");
            return;
        }
        try {
            motor.renewToken(token);
            ChannelMediaOptions op = new ChannelMediaOptions();
            op.clientRoleType = habla
                    ? Constants.CLIENT_ROLE_BROADCASTER
                    : Constants.CLIENT_ROLE_AUDIENCE;
            op.publishMicrophoneTrack = habla;
            motor.updateChannelMediaOptions(op);
            llamada.resolve();
        } catch (Exception e) {
            llamada.reject("no-se-pudo-cambiar-el-rol", e);
        }
    }

    /** Renovar el token sin cambiar de papel. */
    @PluginMethod
    public void renovar(PluginCall llamada) {
        String token = llamada.getString("token");
        if (motor == null || token == null) {
            llamada.reject("no-estas-dentro");
            return;
        }
        motor.renewToken(token);
        llamada.resolve();
    }

    /**
     * Altavoz o auricular.
     *
     * <p>En un devocional el altavoz es lo normal —se escucha mientras se lee el
     * pasaje en la pantalla—, y en una llamada de dos, el auricular.
     */
    @PluginMethod
    public void altavoz(PluginCall llamada) {
        if (motor == null) {
            llamada.reject("no-estas-dentro");
            return;
        }
        boolean puesto = Boolean.TRUE.equals(llamada.getBoolean("puesto", true));
        motor.setDefaultAudioRoutetoSpeakerphone(puesto);
        motor.setEnableSpeakerphone(puesto);
        llamada.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        // Que no se quede un motor vivo con el microfono cogido si la actividad
        // muere. Ha pasado ya con otras cosas de este proyecto.
        try {
            if (motor != null) {
                motor.leaveChannel();
                RtcEngine.destroy();
            }
        } catch (Exception ignorada) {
            // Nada que hacer aqui; el proceso se esta yendo.
        }
        motor = null;
        canalActual = null;
        ServicioSala.parar(getContext());
        super.handleOnDestroy();
    }
}
