/**
 * Qué pasó con cada móvil al llamar a la comunidad. Lógica pura, sin nube ni
 * Android: se prueba en `scripts/revisar-llamada.ts`.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 *
 * Alex, 28-09-2026, probando con dos amigos: «no suena la llamada a mis
 * amigos». El botón decía «Llamando a 2. Les está sonando ahora mismo», y
 * ese 2 era la lista de Firestore, no los móviles que sonaron: Google acepta
 * un aviso a un tema aunque no le llegue a nadie. No había forma de saber a
 * cuál no le llegó ni por qué.
 *
 * Desde la 6.27 el portero llama móvil por móvil y dice qué contestó Google con
 * cada uno; y cada móvil que suena devuelve un «me sonó» con cómo está (avisos,
 * pantalla, batería, No molestar). Aquí se junta todo en una fila por persona,
 * escrita para quien llama: qué le pasó y, si hace falta, qué tiene que tocar.
 */

/** Lo que el portero dice que pasó al mandar el aviso a cada uno. */
export type ResultadoLlamada = {
  uid: string;
  nombre: string;
  estado: "enviado" | "sin-token" | "no-registrado" | "fallo" | "solo-tema";
};

/** Cómo estaba el móvil al sonar, según él mismo. Todo opcional: viene de fuera. */
export type EstadoDelMovil = {
  sono?: boolean;
  repetida?: boolean;
  avisos?: boolean;
  canal?: boolean;
  pantalla?: boolean;
  bateria?: boolean;
  ahorro?: boolean;
  cajon?: string;
  noMolestar?: string;
  volumen?: number;
  fabricante?: string;
  modelo?: string;
  android?: string;
  version?: string;
};

/** Un «me sonó» que llegó al móvil de quien llama. */
export type Acuse = {
  llamada: string;
  para: string;
  /** Milisegundos desde que salió la llamada hasta que el portero recibió el acuse. */
  tarda: number;
  estado: EstadoDelMovil;
  en: number;
};

export type FilaDeLlamada = {
  uid: string;
  nombre: string;
  /** Para el icono y el orden. */
  como: "sono" | "frenado" | "esperando" | "sin-respuesta" | "sin-confirmar" | "app-vieja" | "no-esta" | "fallo";
  /** Qué pasó, en una frase. */
  texto: string;
  /** Lo que su móvil tiene mal, si le sonó con algo mal. */
  pegas: string[];
};

/** Cuánto se espera el «me sonó» antes de decir que no llegó. */
export const ESPERA_ACUSE_MS = 60_000;

/** Lo que tiene mal un móvil al que le sonó, dicho para quien llama. */
export function pegasDelMovil(e: EstadoDelMovil): string[] {
  const pegas: string[] = [];
  if (e.noMolestar === "SILENCIO TOTAL") pegas.push("tiene «No molestar» en silencio total: su móvil calla hasta las alarmas");
  if (e.avisos === false || e.canal === false) pegas.push("tiene los avisos de Genuino apagados: puede sonar sin que vea nada en la pantalla");
  if (e.pantalla === false) pegas.push("no se le enciende la pantalla: le falta «pantalla completa»");
  if (e.cajon === "RESTRINGIDA" || e.cajon === "NUNCA") pegas.push("Android tiene la app restringida en segundo plano");
  if (e.ahorro === true) pegas.push("tiene el ahorro de energía puesto");
  const xiaomi = /xiaomi|redmi|poco/i.test(e.fabricante ?? "");
  if (e.bateria === false && xiaomi) pegas.push("su Xiaomi no tiene Genuino fuera del ahorro de batería: con la app cerrada puede no llegarle");
  return pegas;
}

/**
 * Una fila por persona, con lo que dijo el portero y los acuses que llegaron.
 *
 * `conVuelta`: si la llamada pidió acuses. No los pide si el móvil de quien
 * llama no dio su token de avisos, o si al servidor le falta la clave; y
 * entonces decir «no contestó» de todos sería mentir.
 *
 * `tema`: si salió el aviso general (null: no hizo falta). A quien Google no
 * encontró por su token todavía le puede llegar por ahí.
 */
export function filasDeLlamada(
  resultados: ResultadoLlamada[],
  acuses: Map<string, Acuse>,
  msDesdeLaLlamada: number,
  conVuelta: boolean,
  tema: boolean | null = null,
): FilaDeLlamada[] {
  const filas = resultados.map((r): FilaDeLlamada => {
    const base = { uid: r.uid, nombre: r.nombre || "Sin nombre", pegas: [] as string[] };
    const acuse = acuses.get(r.uid);
    // Un acuse manda sobre lo que dijera Google: si el móvil contestó, le llegó.
    if (acuse) {
      const segundos = Math.max(1, Math.round(acuse.tarda / 1000));
      if (acuse.estado.sono === false) {
        return {
          ...base,
          como: "frenado",
          texto: `Le llegó (a los ${segundos} s), pero su móvil frenó el timbre y lo intenta como alarma`,
          pegas: pegasDelMovil(acuse.estado),
        };
      }
      return { ...base, como: "sono", texto: `Le sonó (a los ${segundos} s)`, pegas: pegasDelMovil(acuse.estado) };
    }
    switch (r.estado) {
      case "sin-token":
        return {
          ...base,
          como: "app-vieja",
          texto: "Tiene la app sin actualizar (o no la ha abierto desde que actualizó): le llega por el camino de antes, sin confirmar",
        };
      case "no-registrado":
        return {
          ...base,
          como: "no-esta",
          // Sin «le llega por el aviso general»: las tres causas son justo
          // las de una instalación que aún no se apuntó al tema.
          texto:
            "Google no reconoce el móvil que tenía apuntado: reinstaló, borró datos o cambió de teléfono. Que abra Genuino para renovarlo",
        };
      case "fallo":
        // Si el aviso general salió, le llega por ahí: pedir que se vuelva a
        // llamar haría sonar otra vez a todos los demás.
        return tema === true
          ? { ...base, como: "sin-confirmar", texto: "Google no aceptó su aviso directo: le llega por el aviso general, sin confirmar" }
          : { ...base, como: "fallo", texto: "Google no aceptó el aviso ahora mismo. Vuelve a llamar en un momento" };
      case "solo-tema":
        return { ...base, como: "sin-confirmar", texto: "Le llega por el aviso general, sin confirmar (la comunidad es muy grande)" };
      case "enviado":
      default:
        if (!conVuelta) {
          return { ...base, como: "sin-confirmar", texto: "Enviado. Esta vez sin confirmación" };
        }
        if (msDesdeLaLlamada < ESPERA_ACUSE_MS) return { ...base, como: "esperando", texto: "Esperando a que su móvil conteste…" };
        return {
          ...base,
          como: "sin-respuesta",
          texto:
            "No contestó en un minuto: móvil apagado o sin datos, o un Xiaomi que no deja despertar a la app cerrada. Que toque «Probar mi timbre» en Juntos",
        };
    }
  });
  // Primero lo que hay que mirar; lo que sonó bien, al final.
  const orden: Record<FilaDeLlamada["como"], number> = {
    "sin-respuesta": 0,
    "no-esta": 1,
    fallo: 2,
    frenado: 3,
    "app-vieja": 4,
    esperando: 5,
    "sin-confirmar": 6,
    sono: 7,
  };
  return filas.sort(
    (a, b) =>
      orden[a.como] - orden[b.como] ||
      Number(b.pegas.length > 0) - Number(a.pegas.length > 0) ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
}

/** «Sonó en 3 de 5», y lo que falta, en una línea. */
export function resumenDeLlamada(filas: FilaDeLlamada[]): string {
  if (filas.length === 0) return "No hay nadie más en la comunidad a quien llamar.";
  const cuenta = (c: FilaDeLlamada["como"]) => filas.filter((f) => f.como === c).length;
  const sono = cuenta("sono") + cuenta("frenado");
  // Los que no pueden confirmar (app vieja, sin vuelta) no cuentan en el «de»:
  // «Sonó en 0 de 12» cuando a los doce les llegó por el camino de antes es la
  // misma cifra engañosa que empezó todo. (Revisión de la 6.27.)
  const noPueden = cuenta("app-vieja") + cuenta("sin-confirmar");
  const pueden = filas.length - noPueden;
  const partes = [pueden > 0 ? `Sonó en ${sono} de ${pueden}` : `Llamada enviada a ${filas.length}, sin confirmación`];
  if (cuenta("esperando")) partes.push(`esperando ${cuenta("esperando")}`);
  if (cuenta("sin-respuesta")) partes.push(`${cuenta("sin-respuesta")} sin contestar`);
  if (cuenta("app-vieja")) partes.push(`${cuenta("app-vieja")} con la app vieja`);
  if (cuenta("no-esta")) partes.push(`${cuenta("no-esta")} sin móvil registrado`);
  // Si nadie puede confirmar, el titular ya lo dice: no se repite.
  if (cuenta("sin-confirmar") && pueden > 0) partes.push(`${cuenta("sin-confirmar")} sin confirmar`);
  if (cuenta("fallo")) partes.push(`${cuenta("fallo")} con fallo de Google`);
  return partes.join(" · ") + ".";
}
