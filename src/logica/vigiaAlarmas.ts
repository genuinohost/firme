import { estadoDespertador, hayDespertador } from "./despertador";
import { puedoModerar } from "./muro";
import { nube } from "./nube";
import { redactarParte } from "./parte";

/**
 * Si una alarma no sonó, que el parte llegue solo.
 *
 * Alex, 1-10-2026: «revisa por qué no suenan las alarmas», y en ese momento no
 * podía mandar el parte. Sin el parte no se sabe nada: si el sistema no
 * despertó a la app (NO LLEGÓ), si sonó sin ruido (MUDA), con qué volumen, con
 * qué No molestar, qué versión. Así que la app lo manda ella en cuanto ve en
 * el diario del despertador una alarma que falló, y se lee con
 * `node scripts/fallos.mjs` sin que nadie tenga que tocar nada.
 *
 * Una vez por fallo (se recuerda el último ya avisado), sólo los de los dos
 * últimos días y, por ahora, sólo en los móviles de quien modera: es un envío
 * automático y el parte lleva los nombres de la rutina; para los demás sigue
 * siendo un botón («Avisar de un fallo»).
 */

type Apunte = { prevista?: number; real?: number; sono?: boolean; noLlego?: boolean; titulo?: string; volumen?: number };

const CLAVE = "genuino.fallosAvisados";

function horaCorta(ms: number): string {
  const f = new Date(ms);
  return `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")} ${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

export async function avisarSiFallaronAlarmas(): Promise<void> {
  if (!hayDespertador()) return;
  try {
    if (!(await puedoModerar())) return;
    const e = await estadoDespertador();
    if (!e) return;
    const diario = JSON.parse(e.diario || "[]") as Apunte[];
    let desde = 0;
    try {
      desde = Number(localStorage.getItem(CLAVE) ?? 0) || 0;
    } catch {
      // Sin almacenamiento se avisa igual; como mucho, dos veces.
    }
    desde = Math.max(desde, Date.now() - 2 * 86_400_000);
    const malas = diario.filter((d) => (d.noLlego || d.sono === false) && (d.prevista ?? d.real ?? 0) > desde);
    if (malas.length === 0) return;

    const texto =
      `Automático: ${malas.length === 1 ? "una alarma no sonó" : `${malas.length} alarmas no sonaron`}. ` +
      malas
        .map((d) => `${horaCorta(d.prevista ?? d.real ?? 0)} ${d.noLlego ? "NO LLEGÓ (el sistema no despertó a la app)" : "MUDA (llegó sin ruido)"}`)
        .join("; ");
    const { bd } = await nube();
    const { addDoc, collection } = await import("firebase/firestore");
    await addDoc(collection(bd, "fallos"), {
      texto: texto.slice(0, 2000),
      parte: redactarParte(e).slice(0, 4000),
      cuando: Date.now(),
    });
    const ultima = Math.max(...malas.map((d) => d.prevista ?? d.real ?? 0));
    try {
      localStorage.setItem(CLAVE, String(ultima));
    } catch {
      // Ver arriba.
    }
  } catch {
    // Sin red o sin cuenta: se intenta la próxima vez que se abra la app.
  }
}
