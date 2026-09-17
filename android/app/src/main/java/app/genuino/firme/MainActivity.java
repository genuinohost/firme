package app.genuino.firme;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle estadoGuardado) {
        // Los plugins propios se registran antes de que arranque la web.
        registerPlugin(AlarmaExacta.class);
        registerPlugin(Dictado.class);
        registerPlugin(Navegador.class);
        super.onCreate(estadoGuardado);
    }
}
