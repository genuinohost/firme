package app.genuino.firme;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle estadoGuardado) {
        // El plugin del despertador se registra antes de que arranque la web.
        registerPlugin(AlarmaExacta.class);
        super.onCreate(estadoGuardado);
    }
}
