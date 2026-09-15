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

type Apunte = { id: number; prevista: number; real: number };
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
  l.push(`  Cajón de reposo: ${e.cajon}${e.cajon === "RESTRINGIDA" ? " ←" : ""}`);
  l.push(`  Restringida en segundo plano: ${e.restringidaEnSegundoPlano ? "SÍ ←" : "no"}`);
  l.push(`  Ahorro de energía activo: ${e.ahorroDeEnergia ? "SÍ ←" : "no"}`);
  l.push(
    `  Volumen de alarma: ${e.volumenAlarma}/${e.volumenAlarmaMaximo}` +
      (e.volumenAlarma === 0 ? " ←" : ""),
  );
  l.push("");

  l.push("ALARMAS");
  l.push(`  En la lista: ${e.enCola}`);
  l.push(`  Armadas con Android: ${e.confirmadas}`);
  l.push(`  Nuestra próxima: ${e.proxima ? hora(e.proxima) : "ninguna ←"}`);
  // Si el sistema dice otra hora, alguien nos tiró las alarmas: esa es la
  // comprobación de verdad, porque la da Android y no nosotros.
  l.push(
    `  La que el sistema tiene por siguiente: ${
      e.proximaDelSistema ? hora(e.proximaDelSistema) : "ninguna ←"
    }`,
  );
  if (e.proxima && e.proximaDelSistema && e.proxima !== e.proximaDelSistema) {
    l.push("  ⚠ No coinciden: el sistema no tiene puesta la nuestra.");
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
        const desfase = d.prevista ? Math.round((d.real - d.prevista) / 1000) : null;
        l.push(
          `  ${hora(d.real)}` +
            (desfase !== null ? `  (prevista ${hora(d.prevista)}, ${desfase}s)` : ""),
        );
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
