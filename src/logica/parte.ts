import { estadoDespertador, type EstadoDespertador } from "./despertador";
import { nombreInstalado, versionInstalada } from "./actualizacion";

/**
 * El parte del despertador: todo lo que el móvil sabe de sus propias alarmas,
 * en un texto que se pueda copiar y pegar.
 *
 * Cuando una alarma de madrugada no suena, preguntar «¿tienes los permisos
 * bien?» no sirve de nada: lo que mata las alarmas casi nunca es un permiso.
 * Es el cajón de reposo, la restricción de segundo plano, o un ajuste del
 * fabricante que no aparece en ninguna lista de Android.
 *
 * Esto convierte un «no sonó» en datos, y un ciclo de un día por suposición en
 * una sola respuesta.
 */

const hora = (ms: number) => {
  const f = new Date(ms);
  const dd = String(f.getDate()).padStart(2, "0");
  const mm = String(f.getMonth() + 1).padStart(2, "0");
  const hh = String(f.getHours()).padStart(2, "0");
  const mi = String(f.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
};

type Apunte = {
  id: number;
  prevista: number;
  real: number;
  /** ¿Arrancó el servicio que repica? */
  servicio?: boolean;
  /** ¿Hubo ruido de verdad? Es la única pregunta que importa. */
  sono?: boolean;
  confirmado?: boolean;
  ultimoRecurso?: boolean;
  reintento?: boolean;
  sinPrimerPlano?: string;
  volumen?: number;
  noMolestar?: string;
  /** Una alarma que no llegó a dispararse: no tiene hora real. */
  noLlego?: boolean;
  titulo?: string;
};
type EnCola = { id: number; cuando: number; titulo: string };

export function redactarParte(e: EstadoDespertador): string {
  const l: string[] = [];
  const si = (v: boolean) => (v ? "SÍ" : "NO ←");

  l.push("── PARTE DEL DESPERTADOR ──");
  l.push(`Genuino ${nombreInstalado()} (${versionInstalada()})`);
  l.push(`${e.fabricante} ${e.modelo} · Android ${e.android} (API ${e.sdk})`);
  l.push(`Ahora: ${hora(Date.now())}`);
  l.push("");

  l.push("PERMISOS Y ESTADO");
  l.push(`  Alarmas exactas: ${si(e.puedeExactas)}`);
  l.push(`  Fuera del ahorro de batería: ${si(e.exentaDeBateria)}`);
  l.push(`  Avisos permitidos: ${si(e.avisosActivos && e.canalActivo)}`);
  l.push(`  Acceso a No molestar: ${si(e.accesoNoMolestar)}`);
  l.push(`  Puede encender la pantalla: ${si(e.puedePantallaCompleta)}`);
  // En silencio total Android calla tambien el flujo de alarma: ninguna app
  // del mundo suena con eso puesto, y hay que decirlo con todas las letras.
  l.push(
    `  No molestar: ${e.filtroNoMolestar}` +
      (e.filtroNoMolestar === "SILENCIO TOTAL" ? " ← ninguna alarma puede sonar" : ""),
  );
  // «NUNCA» y «RESTRINGIDA» son las dos malas: con cualquiera de las dos el
  // sistema le retira a la app el derecho a despertarse.
  const cajonMalo = e.cajon === "RESTRINGIDA" || e.cajon === "NUNCA";
  l.push(`  Cajón de reposo: ${e.cajon}${cajonMalo ? " ← el sistema nos tiene apartados" : ""}`);
  l.push(`  Restringida en segundo plano: ${e.restringidaEnSegundoPlano ? "SÍ ←" : "no"}`);
  l.push(`  Ahorro de energía activo: ${e.ahorroDeEnergia ? "SÍ ←" : "no"}`);
  l.push(
    `  Volumen de alarma: ${e.volumenAlarma}/${e.volumenAlarmaMaximo}` +
      (e.volumenAlarma === 0 ? " ←" : ""),
  );
  l.push("");

  l.push("ALARMAS");
  l.push(`  En la lista: ${e.enCola}`);
  // Se dice cuántas se entregan de una vez. Ver «24 armadas de 141» parece un
  // fallo y no lo es: las demás se arman solas según van sonando, y la lista
  // entera vive en disco para poder rehacerla tras reiniciar.
  const tope = Math.min(e.enCola, e.ventana || e.enCola);
  l.push(
    `  Armadas con Android: ${e.confirmadas} de ${tope}` +
      (e.ventana && e.enCola > e.ventana ? ` (se arman de ${e.ventana} en ${e.ventana})` : "") +
      (e.confirmadas < tope ? " ←" : ""),
  );
  l.push(`  Nuestra próxima: ${e.proxima ? hora(e.proxima) : "ninguna ←"}`);
  l.push(
    `  La siguiente del sistema, sea de quien sea: ${
      e.proximaDelSistema ? hora(e.proximaDelSistema) : "ninguna ←"
    }`,
  );
  /*
    Cuándo avisar de que no coinciden — y esto importa más de lo que parece.

    `getNextAlarmClock()` devuelve la siguiente alarma **de cualquier app**. Si
    el usuario tiene puesto su despertador del móvil a las 9:30 y la nuestra es
    a las 16:30, que no coincidan es lo normal y no significa nada.

    El parte del 17-09 gritaba «el sistema no tiene puesta la nuestra» justo en
    ese caso. Un diagnóstico que grita cuando no pasa nada se deja de leer, y
    entonces no sirve el día que sí pasa.

    Lo que sí es un problema: que el sistema no tenga ninguna, o que la suya
    caiga **después** de la nuestra — porque entonces la nuestra no está.
  */
  if (e.proxima && !e.proximaDelSistema) {
    l.push("  ⚠ El sistema no tiene NINGUNA alarma puesta. Nos las tiró.");
  } else if (e.proxima && e.proximaDelSistema > e.proxima) {
    l.push("  ⚠ La nuestra debería sonar antes y el sistema no la tiene.");
  }

  try {
    const cola = (JSON.parse(e.cola) as EnCola[])
      .filter((a) => a.cuando > Date.now())
      .sort((a, b) => a.cuando - b.cuando)
      .slice(0, 6);
    if (cola.length > 0) {
      l.push("  Las siguientes:");
      for (const a of cola) l.push(`    ${hora(a.cuando)}  ${a.titulo}`);
    }
  } catch {
    l.push("  (lista ilegible)");
  }
  l.push("");

  l.push("LO QUE SONÓ DE VERDAD (últimos disparos)");
  try {
    const diario = (JSON.parse(e.diario) as Apunte[]).slice(-12);
    if (diario.length === 0) {
      l.push("  Ninguno. Ninguna alarma ha llegado a dispararse. ←");
    } else {
      for (const d of diario) {
        const desfase = d.prevista && d.real ? Math.round((d.real - d.prevista) / 1000) : null;
        // El veredicto va delante, porque es lo único que de verdad se pregunta.
        // Tres estados, y hay que distinguirlos porque son tres problemas
        // distintos: la que no llegó (el sistema no despertó a la app), la que
        // llegó y salió muda (el ruido falló), y la que sonó.
        const veredicto = d.noLlego
          ? "NO LLEGÓ ←"
          : d.sono === undefined
            ? "·"
            : d.sono
              ? "SONÓ"
              : "MUDA ←";
        const notas: string[] = [];
        if (d.servicio === false) notas.push("el servicio no arrancó");
        if (d.sinPrimerPlano) notas.push("sin primer plano");
        if (d.reintento) notas.push("hubo que reintentar");
        if (d.ultimoRecurso) notas.push("sonó por el último recurso");
        if (d.confirmado === false) notas.push("se apagó solo");
        if (typeof d.volumen === "number" && d.volumen >= 0) notas.push(`volumen ${d.volumen}%`);
        if (d.noMolestar && d.noMolestar !== "todo pasa") notas.push(d.noMolestar);
        if (d.noLlego) {
          l.push(
            `  ${veredicto}  ${hora(d.prevista)}` +
              (d.titulo ? `  ${d.titulo}` : "") +
              "  — el sistema no despertó a la app",
          );
        } else {
          l.push(
            `  ${veredicto}  ${hora(d.real)}` +
              (desfase !== null ? `  (prevista ${hora(d.prevista)}, ${desfase}s)` : "") +
              (notas.length > 0 ? `  — ${notas.join(", ")}` : ""),
          );
        }
      }
    }
  } catch {
    l.push("  (diario ilegible)");
  }

  if (e.ultimoFallo) {
    const [cuando, ...resto] = e.ultimoFallo.split("|");
    l.push("");
    l.push(`ÚLTIMO TROPIEZO AL SONAR: ${hora(Number(cuando))} ${resto.join("|")}`);
  }

  l.push("──────────────────────────");
  return l.join("\n");
}

export async function parteDelDespertador(): Promise<string | null> {
  const e = await estadoDespertador();
  return e ? redactarParte(e) : null;
}

/**
 * Lo que hay que tocar en cada marca, que Android no expone y ninguna app puede
 * cambiar por su cuenta.
 *
 * Xiaomi, Samsung, Huawei, Oppo y compañía matan aplicaciones con criterios
 * propios y llaman a la misma cosa de cinco formas distintas. Decirle a alguien
 * «revisa los ajustes de batería» no le sirve; decirle dónde tocar, sí.
 */
export function consejoDelFabricante(fabricante: string): string | null {
  const m = fabricante.toLowerCase();

  if (m.includes("xiaomi") || m.includes("redmi") || m.includes("poco")) {
    return "Ajustes → Aplicaciones → Genuino: activa «Inicio automático», y en «Ahorro de batería» ponlo en «Sin restricciones». En Recientes, mantén pulsada la app y ponle el candado.";
  }
  if (m.includes("samsung")) {
    return "Ajustes → Batería → Límites de uso en segundo plano: saca a Genuino de «Aplicaciones en suspensión» y de «Aplicaciones en suspensión profunda». Desactiva también «Poner en suspensión apps no usadas».";
  }
  if (m.includes("huawei") || m.includes("honor")) {
    return "Ajustes → Batería → Inicio de aplicaciones: pon Genuino en «Gestión manual» y activa las tres opciones (inicio automático, inicio secundario y ejecución en segundo plano).";
  }
  if (m.includes("oppo") || m.includes("realme") || m.includes("oneplus")) {
    return "Ajustes → Batería → Uso de batería en segundo plano: pon Genuino en «No optimizar», y activa «Permitir inicio automático».";
  }
  if (m.includes("vivo") || m.includes("iqoo")) {
    return "Ajustes → Batería → Consumo elevado en segundo plano: permite Genuino, y actívalo en «Inicio automático».";
  }
  if (m.includes("infinix") || m.includes("tecno") || m.includes("itel")) {
    return "Ajustes → Batería → Protección de batería: saca a Genuino. En el gestor del teléfono, actívalo en «Inicio automático» y ponle el candado en Recientes.";
  }
  return null;
}
