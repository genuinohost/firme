package app.genuino.firme;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Al reiniciar el movil, Android se olvida de todas las alarmas programadas.
 *
 * Como la cola queda guardada al programarla, aqui se rehace sin necesidad de
 * que el usuario abra la app: si se reinicia el movil a medianoche, la alarma
 * de las tres sigue en pie.
 */
public class ReceptorArranque extends BroadcastReceiver {

    @Override
    public void onReceive(Context contexto, Intent intencion) {
        String accion = intencion.getAction();
        if (accion == null) return;
        // Algunos fabricantes mandan el suyo propio en vez del estandar.
        boolean esArranque = Intent.ACTION_BOOT_COMPLETED.equals(accion)
                || "android.intent.action.QUICKBOOT_POWERON".equals(accion)
                || "android.intent.action.MY_PACKAGE_REPLACED".equals(accion);
        if (!esArranque) return;

        AlarmaExacta.crearCanal(contexto);

        // La lista de dos semanas sobrevivio al reinicio en disco; de ahi se
        // vuelven a armar las proximas sin que nadie tenga que abrir la app.
        AlarmaExacta.armarLasProximas(contexto);
        // El trabajo periodico es persistente, pero reponerlo al arrancar no
        // cuesta nada y cubre el caso de que el sistema lo hubiera tirado.
        TrabajoRearmar.asegurar(contexto);
    }
}
