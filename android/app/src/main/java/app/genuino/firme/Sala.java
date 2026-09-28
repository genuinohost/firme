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

    /** Si ahora se publica voz: para subir el servicio a microfono al volver a la app. */
    private boolean hablaAhora = false;

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
            // 0 salio, 1 se le cayo la red, 2 paso a oyente (en directo, dejar
            // de publicar tambien avisa de salida, pero sigue dentro).
            d.put("motivo", motivo);
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
        boolean habla = Boolean.TRUE.equals(llamada.getBoolean("habla", false));
        // El microfono se pide solo a quien va a HABLAR. Para escuchar no hace
        // falta (Agora entra como oyente sin publicar nada), y pedirselo a un
        // oyente era la forma de que lo negara dos veces y se quedara fuera
        // del devocional para siempre con un mensaje que hablaba de hablar.
        if (!habla || tieneMicrofono()) {
            entrarDeVerdad(llamada);
            return;
        }
        esperandoPermiso = llamada;
        llamada.setKeepAlive(true);
        requestPermissionForAlias("microfono", llamada, "traselPermiso");
    }

    private boolean tieneMicrofono() {
        return getPermissionState("microfono") == PermissionState.GRANTED;
    }

    @PermissionCallback
    private void traselPermiso(PluginCall llamada) {
        PluginCall guardada = esperandoPermiso != null ? esperandoPermiso : llamada;
        esperandoPermiso = null;
        if (!tieneMicrofono()) {
            // Sin microfono se entra igual, a escuchar. La web se entera por
            // `microfono: false` y lo dice, con el boton a los ajustes.
            guardada.getData().put("habla", false);
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

            // El motor es el mismo de la sala anterior: un silencio puesto alli
            // (la visita del anfitrion a un subgrupo) se arrastraba. Cada entrada
            // empieza de cero y la web decide despues.
            motor.muteLocalAudioStream(false);
            int r = motor.joinChannelWithUserAccount(token, canal, cuenta, op);
            if (r != 0) {
                llamada.reject("no-se-pudo-entrar:" + r);
                return;
            }

            canalActual = canal;
            nombreActual = nombre;
            hablaAhora = habla;
            // Y el servicio, para que salir de la app no saque de la sala. De
            // tipo microfono solo si hay permiso: sin el, Android 14 lo mata.
            // Si Android no deja arrancarlo (se bloqueo el movil justo al
            // cambiar de sala, a un subgrupo), ya se esta dentro del canal: no
            // es un fallo de la entrada. Se arranca al volver a la app.
            try {
                ServicioSala.arrancar(getContext(), nombre, habla && tieneMicrofono());
            } catch (Exception ignorado) {
                // handleOnResume
            }

            JSObject ok = new JSObject();
            ok.put("habla", habla);
            ok.put("microfono", tieneMicrofono());
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
        hablaAhora = false;
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
     * <p>Para HABLAR hace falta el token nuevo: el privilegio de publicar va
     * firmado dentro (y Agora lo hace cumplir si el proyecto tiene activada la
     * autenticacion de coanfitrion; ver docs/investigacion/salas-de-voz.md).
     * Para CALLARSE no: bajar a oyente es una decision local y no debe esperar
     * a nadie — un microfono que sigue abierto porque fallo la red es peor que
     * un token que llega tarde.
     *
     * <p>Y si para hablar falta el permiso del microfono, se pide aqui: es el
     * momento en que la persona levanto la mano y el anfitrion le dio la
     * palabra, cuando entiende para que se le pide.
     */
    @PluginMethod
    public void rol(PluginCall llamada) {
        if (motor == null) {
            llamada.reject("no-estas-dentro");
            return;
        }
        String token = llamada.getString("token");
        boolean habla = Boolean.TRUE.equals(llamada.getBoolean("habla", false));
        if (habla && token == null) {
            llamada.reject("falta-el-token");
            return;
        }
        if (habla && !tieneMicrofono()) {
            esperandoRol = llamada;
            llamada.setKeepAlive(true);
            requestPermissionForAlias("microfono", llamada, "traselPermisoParaHablar");
            return;
        }
        aplicarRol(llamada, token, habla);
    }

    private PluginCall esperandoRol;

    @PermissionCallback
    private void traselPermisoParaHablar(PluginCall llamada) {
        PluginCall guardada = esperandoRol != null ? esperandoRol : llamada;
        esperandoRol = null;
        if (!tieneMicrofono()) {
            guardada.reject("sin-microfono");
            return;
        }
        aplicarRol(guardada, guardada.getString("token"), true);
    }

    private void aplicarRol(PluginCall llamada, String token, boolean habla) {
        try {
            if (token != null) motor.renewToken(token);
            ChannelMediaOptions op = new ChannelMediaOptions();
            op.clientRoleType = habla
                    ? Constants.CLIENT_ROLE_BROADCASTER
                    : Constants.CLIENT_ROLE_AUDIENCE;
            op.publishMicrophoneTrack = habla;
            motor.updateChannelMediaOptions(op);
            hablaAhora = habla;
            // Al pasar a hablar, el servicio sube a tipo microfono (ya con
            // permiso); al callarse se queda como esta, que no estorba. Si
            // Android no lo deja (app en segundo plano), el papel ya cambio:
            // no es un fallo del cambio de papel, y se reintenta al volver.
            if (habla && nombreActual != null) {
                try {
                    ServicioSala.arrancar(getContext(), nombreActual, tieneMicrofono());
                } catch (Exception ignorado) {
                    // Se sube en handleOnResume.
                }
            }
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
    protected void handleOnResume() {
        super.handleOnResume();
        // Con la app delante, Android ya deja el servicio de tipo microfono.
        // Hace falta si se paso a hablar con la pantalla apagada: el servicio se
        // quedo como reproduccion y, en Android 14, el microfono grabaria
        // silencio hasta subirlo.
        // Y si el servicio no llego a arrancar (movil bloqueado al entrar), se
        // arranca ahora: sin el, salir de la app sacaria de la sala.
        if (motor != null && nombreActual != null) {
            try {
                ServicioSala.arrancar(getContext(), nombreActual, hablaAhora && tieneMicrofono());
            } catch (Exception ignorado) {
                // Sigue como estaba; se oye todo igual.
            }
        }
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
