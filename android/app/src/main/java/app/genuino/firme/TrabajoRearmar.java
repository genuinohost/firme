package app.genuino.firme;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

/**
 * Repone las alarmas cada pocas horas, sin depender de nada.
 *
 * <p><b>Por que existe.</b> Hasta el 24-09-2026 la cola se rearmaba en tres
 * momentos: al programar desde la app, al arrancar el movil, y **cada vez que
 * sonaba una alarma**. Los tres dependen de algo que puede fallar, y el tercero
 * depende justo de lo que se rompe: si una alarma no suena, nadie rearma las
 * siguientes.
 *
 * <p>Paso de verdad. El 23-09 a las 16:30 no sono una, y detras se cayeron doce
 * seguidas hasta el dia siguiente. El movil tenia todos los permisos en regla
 * —alarmas exactas, fuera del ahorro de energia, exento del cajon de reposo— y
 * aun asi el sistema no desperto a la app. En MIUI, EMUI y ColorOS eso pasa: la
 * capa del fabricante congela la aplicacion y Android deja de entregarle nada
 * hasta que alguien la abre a mano.
 *
 * <p><b>Que hace esto.</b> Un trabajo del sistema que se ejecuta cada seis horas
 * y vuelve a armar la cola entera. `JobScheduler` no es la app: es un servicio
 * de Android, y el sistema lo despierta aunque la aplicacion lleve dias sin
 * abrirse. `setPersisted(true)` hace que sobreviva a los reinicios.
 *
 * <p>No sustituye a nada: se suma. Rearmar algo que ya estaba armado no cuesta
 * nada, porque el mismo PendingIntent sustituye al anterior.
 *
 * <p><b>Lo que esto NO arregla.</b> Si el fabricante ha congelado la app del
 * todo, tampoco corren sus trabajos. Para esas alarmas —las que de verdad no
 * pueden fallar— sigue estando la copia al reloj del propio movil, que es del
 * sistema y no la mata ninguna capa.
 */
public class TrabajoRearmar extends JobService {

    /** Identificador del trabajo. Si se cambia, el antiguo queda huerfano. */
    private static final int ID = 7723;

    /** Cada seis horas. Android puede retrasarlo, nunca adelantarlo. */
    private static final long CADA_MS = 6 * 60 * 60 * 1000L;

    /**
     * Deja el trabajo puesto. Llamarlo varias veces no duplica nada: el mismo
     * identificador sustituye al anterior.
     */
    static void asegurar(Context contexto) {
        JobScheduler gestor = contexto.getSystemService(JobScheduler.class);
        if (gestor == null) return;

        JobInfo trabajo = new JobInfo.Builder(ID, new ComponentName(contexto, TrabajoRearmar.class))
                .setPeriodic(CADA_MS)
                // Sobrevive a apagar y encender el movil.
                .setPersisted(true)
                // Sin condiciones: no hace falta red, ni carga, ni nada. Solo
                // tiene que escribir en AlarmManager.
                .setRequiresCharging(false)
                .setRequiresDeviceIdle(false)
                .build();
        try {
            gestor.schedule(trabajo);
        } catch (Exception ignorada) {
            // Si el sistema lo rechaza, quedan las otras dos redes.
        }
    }

    @Override
    public boolean onStartJob(JobParameters parametros) {
        // Es trabajo de milisegundos: escribir unas cuantas alarmas. No hace
        // falta hilo aparte, y devolver false le dice al sistema que ya esta.
        try {
            AlarmaExacta.armarLasProximas(getApplicationContext());
        } catch (Exception ignorada) {
            // Una cola ilegible se rehara cuando se abra la app.
        }
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters parametros) {
        // No hay nada a medias que reanudar: la proxima pasada rearma igual.
        return false;
    }
}
