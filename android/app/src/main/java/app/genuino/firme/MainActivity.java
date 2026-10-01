package app.genuino.firme;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    /** Lo que mandan los botones del recuadro flotante. Solo lo oye esta app. */
    static final String ACCION_FLOTANTE = "app.genuino.firme.FLOTANTE";

    private BroadcastReceiver receptorFlotante;

    @Override
    public void onCreate(Bundle estadoGuardado) {
        // Los plugins propios se registran antes de que arranque la web.
        registerPlugin(AlarmaExacta.class);
        registerPlugin(Dictado.class);
        registerPlugin(Navegador.class);
        registerPlugin(Sala.class);
        registerPlugin(PasarApp.class);
        registerPlugin(Timbre.class);
        super.onCreate(estadoGuardado);

        // Una actividad nueva trae una web nueva que todavia no esta en
        // ninguna sala: nada de ventanita hasta que ella lo diga. Y se empuja
        // a Android, que en una recreacion conserva los parametros viejos.
        Sala.olvidarFlotante();
        actualizarFlotante();
        // Y si nace ya dentro de la ventanita (se recreó encogida: cambiar el
        // tamaño de letra con la sala abierta), se cierra: la sala murió con la
        // actividad vieja y la nueva pintaría la app entera en el recuadro.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode()) {
            new android.os.Handler(android.os.Looper.getMainLooper()).post(this::cerrarVentanita);
        }

        receptorFlotante = new BroadcastReceiver() {
            @Override
            public void onReceive(Context contexto, Intent intencion) {
                String accion = intencion.getStringExtra("accion");
                Sala.accionFlotante(accion);
                // Colgar desde la ventanita: que se vaya con la sala. Un
                // momento despues, para que la web termine de salir antes.
                if ("salir".equals(accion)) {
                    new android.os.Handler(android.os.Looper.getMainLooper())
                            .postDelayed(MainActivity.this::cerrarVentanita, 800);
                }
            }
        };
        ContextCompat.registerReceiver(
                this, receptorFlotante, new IntentFilter(ACCION_FLOTANTE), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    public void onDestroy() {
        try {
            if (receptorFlotante != null) unregisterReceiver(receptorFlotante);
        } catch (Exception ignorada) { }
        super.onDestroy();
    }

    // ── El recuadro flotante (6.27) ───────────────────────────────────────
    //
    // Alex, 28-09-2026: «cuando una llamada este activa, tengamos la opcion de
    // poder salir de la aplicacion, y que quede un recuadro flotante con la
    // posibilidad de abrir y cerrar el microfono. Al estilo de Google Meet».
    //
    // Es lo que hace Meet: «imagen en imagen». Al salir de la app estando en
    // una sala, la app entera se encoge a una ventanita que flota encima de lo
    // demas, con los botones abajo (microfono o mano, y colgar). No hace falta
    // el permiso de «mostrar sobre otras apps», que en Xiaomi hay que buscar a
    // mano: esto es de Android desde la 8. La web, al saberse en la ventanita,
    // pinta solo quien habla y como esta tu microfono (PantallaSala).

    private boolean hayImagenEnImagen() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    /** Se llama cuando la sala cambia algo que se ve en la ventanita. */
    void actualizarFlotante() {
        if (!hayImagenEnImagen()) return;
        try {
            setPictureInPictureParams(parametros());
        } catch (Exception ignorada) {
            // Con la imagen en imagen apagada en los ajustes, lanza: no pasa nada.
        }
    }

    private PictureInPictureParams parametros() {
        PictureInPictureParams.Builder b = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(3, 4))
                .setActions(acciones());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Desde Android 12, al ir al inicio se encoge sola y con la
            // animacion buena. Solo mientras hay sala: fuera de ella, salir de
            // la app es salir.
            b.setAutoEnterEnabled(Sala.flotanteActivo);
            // No es video: que no intente redimensionar el contenido a saltos.
            b.setSeamlessResizeEnabled(false);
        }
        return b.build();
    }

    private List<RemoteAction> acciones() {
        List<RemoteAction> lista = new ArrayList<>();
        if (!Sala.flotanteActivo) return lista;
        if (Sala.flotanteHabla) {
            boolean abierto = Sala.flotanteMicro;
            RemoteAction micro = accion(
                    abierto ? R.drawable.ic_pip_micro : R.drawable.ic_pip_micro_cerrado,
                    abierto ? "Silenciar" : "Abrir micro",
                    "micro", 1);
            // Si el anfitrion te lo cerro, se ve cerrado y no se puede abrir.
            micro.setEnabled(!Sala.flotanteSilenciado);
            lista.add(micro);
        } else {
            lista.add(accion(R.drawable.ic_pip_mano,
                    Sala.flotanteMano ? "Bajar la mano" : "Pedir la palabra", "mano", 2));
        }
        lista.add(accion(R.drawable.ic_pip_colgar, "Salir", "salir", 3));
        return lista;
    }

    private RemoteAction accion(int icono, String titulo, String que, int codigo) {
        Intent intencion = new Intent(ACCION_FLOTANTE).setPackage(getPackageName()).putExtra("accion", que);
        PendingIntent pendiente = PendingIntent.getBroadcast(
                this, codigo, intencion, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new RemoteAction(Icon.createWithResource(this, icono), titulo, titulo, pendiente);
    }

    /**
     * Antes de Android 12 no hay «encogerse sola»: se hace aqui, cuando la
     * persona sale de la app con el boton de inicio o el gesto.
     */
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (!Sala.flotanteActivo || !hayImagenEnImagen() || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return;
        // El dialogo del permiso del microfono tambien «sale» de la app.
        if (System.currentTimeMillis() < Sala.pidiendoPermisoHasta) return;
        try {
            enterPictureInPictureMode(parametros());
        } catch (Exception ignorada) {
            // Apagada en los ajustes de la app: se sale como siempre y la sala
            // sigue sonando con su aviso fijo.
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean enVentanita, Configuration nueva) {
        super.onPictureInPictureModeChanged(enVentanita, nueva);
        Sala.avisarVentanita(enVentanita);
    }

    /** Tras colgar desde la ventanita, que se vaya con la sala. */
    void cerrarVentanita() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode()) {
            try {
                moveTaskToBack(false);
            } catch (Exception ignorada) { }
        }
    }
}
