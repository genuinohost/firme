/**
 * Que las reglas de Firestore hagan lo que dicen que hacen.
 *
 * ── Por qué esto existe ───────────────────────────────────────────────────
 *
 * `firestore.rules` es **lo único** que separa el WhatsApp, el perfil y las
 * notas de la gente de cualquiera con una conexión a internet. La app cliente
 * se puede desmontar en una tarde; las reglas no.
 *
 * Y hasta el 18 de septiembre de 2026 **nadie las había comprobado nunca**. Se
 * escribían, se desplegaban —«rules file compiled successfully»— y se daba por
 * bueno. Pero que compilen sólo dice que están bien escritas, no que digan lo
 * correcto: una regla que por error deja leer el teléfono de otro compila
 * igual de bien que la que no lo deja.
 *
 * Esto arranca el emulador de Firestore, carga las reglas de verdad y hace las
 * preguntas incómodas en nombre de un extraño.
 *
 *   npm run revisar-reglas
 *
 * No toca producción: el emulador arranca vacío y se apaga al acabar.
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const PUERTO = 8199;

let fallos = 0;
let pasadas = 0;

/** Una comprobación con nombre. El nombre es lo que se lee cuando falla. */
async function debe(nombre, promesa) {
  try {
    await promesa;
    pasadas++;
    console.log("  ok   " + nombre);
  } catch (e) {
    fallos++;
    console.log("FALLA  " + nombre);
    console.log("       " + (e?.message ?? e));
  }
}

const entorno = await initializeTestEnvironment({
  projectId: "genuino-pruebas",
  firestore: {
    rules: readFileSync("firestore.rules", "utf8"),
    host: "127.0.0.1",
    port: PUERTO,
  },
});

await entorno.clearFirestore();

// Tres personas y un moderador. `ana` y `beto` son amigos aceptados; `curioso`
// no es amigo de nadie.
const ana = entorno.authenticatedContext("ana").firestore();
const beto = entorno.authenticatedContext("beto").firestore();
const curioso = entorno.authenticatedContext("curioso").firestore();
const moderador = entorno.authenticatedContext("mod").firestore();
const nadie = entorno.unauthenticatedContext().firestore();

const perfil = (nombre, usuario) => ({
  uid: usuario,
  nombre,
  usuario,
  busca: nombre.toLowerCase(),
  muestraRachas: true,
  racha: 3,
  diasEnPie: 10,
  cumplidos: 40,
});

// Los datos de partida se siembran **saltándose las reglas**: sembrar es
// preparar el escenario, no lo que se está probando.
await entorno.withSecurityRulesDisabled(async (libre) => {
  const bd = libre.firestore();
  await setDoc(doc(bd, "usuarios", "ana"), perfil("Ana", "ana"));
  await setDoc(doc(bd, "usuarios", "beto"), perfil("Beto", "beto"));
  await setDoc(doc(bd, "usuarios", "curioso"), perfil("Curioso", "curioso"));
  await setDoc(doc(bd, "usuarios", "ana", "privado", "contacto"), {
    whatsapp: "+58 412 000 0000",
  });
  // Ana y Beto se aceptaron. Curioso sólo mandó una solicitud, sin respuesta.
  await setDoc(doc(bd, "usuarios", "ana", "amigos", "beto"), { estado: "aceptada" });
  await setDoc(doc(bd, "usuarios", "ana", "amigos", "curioso"), { estado: "recibida" });
  await setDoc(doc(bd, "notas", "n-de-ana"), {
    uid: "ana",
    nombre: "Ana",
    usuario: "ana",
    texto: "Hoy me costó, pero Dios sostuvo.",
    momento: Date.now(),
  });
  await setDoc(doc(bd, "frases", "ana.abc123"), {
    uid: "ana",
    nombre: "Ana",
    usuario: "ana",
    texto: "Esfuérzate y sé valiente.",
    fuente: "Josué 1:9",
    cuando: Date.now(),
  });
  await setDoc(doc(bd, "moderadores", "mod"), { desde: Date.now() });
  await setDoc(doc(bd, "denuncias", "d1"), { nota: "n-de-ana", de: "beto", motivo: "x" });
  await setDoc(doc(bd, "usuarios", "ana", "bloqueados", "curioso"), { cuando: 1 });
});

const nota = (uid, extra = {}) => ({
  uid,
  nombre: "Quien sea",
  usuario: uid,
  texto: "Un testimonio.",
  momento: Date.now(),
  ...extra,
});

console.log("\nLAS REGLAS DE FIRESTORE, preguntadas en nombre de un extraño\n");

// ------------------------------------------------- el teléfono, que es lo más serio
console.log("El WhatsApp");
await debe(
  "un desconocido con cuenta NO lee el WhatsApp de otro",
  assertFails(getDoc(doc(curioso, "usuarios/ana/privado/contacto"))),
);
await debe(
  "quien sólo mandó una solicitud sin aceptar NO lo lee",
  // `curioso` está en la lista de Ana, pero en estado «recibida», no «aceptada».
  assertFails(getDoc(doc(curioso, "usuarios/ana/privado/contacto"))),
);
await debe(
  "un amigo YA ACEPTADO sí lo lee",
  assertSucceeds(getDoc(doc(beto, "usuarios/ana/privado/contacto"))),
);
await debe(
  "sin haber entrado NO se lee",
  assertFails(getDoc(doc(nadie, "usuarios/ana/privado/contacto"))),
);
await debe(
  "nadie escribe el WhatsApp de otro",
  assertFails(setDoc(doc(beto, "usuarios/ana/privado/contacto"), { whatsapp: "+1" })),
);

// ------------------------------------------------- el respaldo de la rutina
//
// La copia existe para que cambiar de telefono no cueste la racha. Lo que estas
// preguntas defienden es que **no se haya convertido en una fuga del diario**:
// la lista de campos de la regla es la promesa, y aqui se comprueba que muerde.
console.log("\nEl respaldo");

const copia = (extra = {}) => ({
  version: 1,
  planes: [],
  planesRegistros: {},
  rutina: [{ id: "b1", hora: "05:30", nombre: "Levantarse" }],
  tareas: [],
  registros: { "2026-09-24|b1": { estado: "cumplido", momento: 1 } },
  motivos: [],
  ajustes: { nombre: "Ana" },
  guardado: 1,
  ...extra,
});

await debe(
  "cada uno guarda su propia copia",
  assertSucceeds(setDoc(doc(ana, "usuarios/ana/respaldo/rutina"), copia())),
);
await debe(
  "y la lee",
  assertSucceeds(getDoc(doc(ana, "usuarios/ana/respaldo/rutina"))),
);
await debe(
  "un amigo YA ACEPTADO no la lee - esto no es el WhatsApp",
  assertFails(getDoc(doc(beto, "usuarios/ana/respaldo/rutina"))),
);
await debe(
  "un desconocido con cuenta no la lee",
  assertFails(getDoc(doc(curioso, "usuarios/ana/respaldo/rutina"))),
);
await debe(
  "sin haber entrado no se lee",
  assertFails(getDoc(doc(nadie, "usuarios/ana/respaldo/rutina"))),
);
await debe(
  "nadie escribe en la copia de otro",
  assertFails(setDoc(doc(beto, "usuarios/ana/respaldo/rutina"), copia())),
);
await debe(
  "EL DIARIO NO CABE en la copia, ni mandandolo a proposito",
  assertFails(
    setDoc(
      doc(ana, "usuarios/ana/respaldo/rutina"),
      copia({ notas: [{ id: "n1", texto: "Lo que escribi a las tres" }] }),
    ),
  ),
);
await debe(
  "tampoco cabe ningun campo que nadie haya pensado",
  assertFails(setDoc(doc(ana, "usuarios/ana/respaldo/rutina"), copia({ loQueSea: "x" }))),
);
await debe(
  "una copia sin fecha no vale: sin ella no se puede decir de cuando es",
  assertFails(
    setDoc(doc(ana, "usuarios/ana/respaldo/rutina"), { ...copia(), guardado: "ayer" }),
  ),
);

// ----------------------------------------------------------------- las salas
//
// El devocional en voz. Aqui no viaja audio: Firestore solo guarda quien esta
// dentro y quien tiene la palabra. Lo que se defiende es la regla de la que
// depende el permiso de audio de verdad.
console.log("LAS SALAS");

const SALA = "sala-de-ana";
const dentroDe = (uid, extra = {}) => ({
  nombre: "Quien sea",
  usuario: uid,
  entro: 1,
  mano: false,
  palabra: false,
  ...extra,
});

await debe(
  "quien modera abre una sala",
  assertSucceeds(
    setDoc(doc(moderador, "salas", SALA), {
      nombre: "Devocional de la manana",
      anfitrion: "mod",
      abierta: true,
      desde: 1,
      tipo: "devocional",
    }),
  ),
);
await debe(
  "QUIEN NO MODERA NO ABRE SALAS - cada minuto de voz lo paga Alex",
  assertFails(
    setDoc(doc(ana, "salas", "sala-de-ana"), {
      nombre: "La mia",
      anfitrion: "ana",
      abierta: true,
      desde: 1,
      tipo: "devocional",
    }),
  ),
);
await debe(
  "ni a nombre de otro",
  assertFails(
    setDoc(doc(beto, "salas", "sala-robada"), {
      nombre: "La del moderador",
      anfitrion: "mod",
      abierta: true,
      desde: 1,
      tipo: "devocional",
    }),
  ),
);
await debe(
  "nadie se queda con la sala de otro cambiando el anfitrion",
  assertFails(
    updateDoc(doc(beto, "salas", SALA), { anfitrion: "beto" }),
  ),
);
await debe(
  "un hermano entra en la sala, en silencio",
  assertSucceeds(setDoc(doc(beto, `salas/${SALA}/dentro/beto`), dentroDe("beto"))),
);
await debe(
  "nadie entra a nombre de otro",
  assertFails(setDoc(doc(curioso, `salas/${SALA}/dentro/beto`), dentroDe("beto"))),
);
await debe(
  "NADIE ENTRA YA CON LA PALABRA",
  assertFails(
    setDoc(doc(curioso, `salas/${SALA}/dentro/curioso`), dentroDe("curioso", { palabra: true })),
  ),
);
await debe(
  "levantar la mano si se puede: es lo propio",
  assertSucceeds(updateDoc(doc(beto, `salas/${SALA}/dentro/beto`), { mano: true })),
);
await debe(
  "NADIE SE DA LA PALABRA A SI MISMO - de esto depende el audio",
  assertFails(updateDoc(doc(beto, `salas/${SALA}/dentro/beto`), { palabra: true })),
);
await debe(
  "el anfitrion SI da la palabra",
  assertSucceeds(updateDoc(doc(moderador, `salas/${SALA}/dentro/beto`), { palabra: true })),
);
await debe(
  "y la quita",
  assertSucceeds(updateDoc(doc(moderador, `salas/${SALA}/dentro/beto`), { palabra: false })),
);
await debe(
  "nadie silencia a un tercero",
  assertFails(updateDoc(doc(curioso, `salas/${SALA}/dentro/beto`), { palabra: false })),
);
await debe(
  "todos ven quien esta dentro: es una reunion, no una sala a oscuras",
  assertSucceeds(getDocs(collection(curioso, `salas/${SALA}/dentro`))),
);
await debe(
  "sin cuenta no se ve nada de la sala",
  assertFails(getDoc(doc(nadie, "salas", SALA))),
);
await debe(
  "cualquiera se sale cuando quiere",
  assertSucceeds(deleteDoc(doc(beto, `salas/${SALA}/dentro/beto`))),
);
await debe(
  "solo el anfitrion expulsa",
  assertFails(setDoc(doc(beto, `salas/${SALA}/expulsados/curioso`), { cuando: 1 })),
);
await debe(
  "el anfitrion expulsa",
  assertSucceeds(setDoc(doc(moderador, `salas/${SALA}/expulsados/curioso`), { cuando: 1 })),
);
await debe(
  "un expulsado NO vuelve a entrar",
  assertFails(setDoc(doc(curioso, `salas/${SALA}/dentro/curioso`), dentroDe("curioso"))),
);


// ------------------------------------------------------------------ el muro
console.log("\nEl muro");
await debe(
  "sin cuenta SÍ se lee el muro, que es lo que pidió Alex",
  assertSucceeds(getDocs(collection(nadie, "notas"))),
);
await debe(
  "sin cuenta NO se publica",
  assertFails(setDoc(doc(nadie, "notas", "intruso"), nota("quien-sea"))),
);
await debe(
  "no se publica firmando con el uid de otro",
  assertFails(setDoc(doc(beto, "notas", "suplantada"), nota("ana"))),
);
await debe(
  "cada uno sí publica lo suyo",
  assertSucceeds(setDoc(doc(beto, "notas", "n-de-beto"), nota("beto"))),
);
await debe(
  "NO se puede colar el plan del que viene la nota",
  // Es la fuga que más importa: decir de qué plan sale una nota cuenta la
  // batalla de quien la escribió aunque su texto no la cuente.
  assertFails(setDoc(doc(beto, "notas", "con-plan"), nota("beto", { plan: "ojos" }))),
);
await debe(
  "NO se puede colar cómo acabó el día",
  assertFails(setDoc(doc(beto, "notas", "con-estado"), nota("beto", { estado: "fallado" }))),
);
await debe(
  "una nota vacía no pasa",
  assertFails(setDoc(doc(beto, "notas", "vacia"), nota("beto", { texto: "" }))),
);
await debe(
  "un texto larguísimo no pasa",
  assertFails(setDoc(doc(beto, "notas", "enorme"), nota("beto", { texto: "x".repeat(2001) }))),
);
await debe(
  "nadie edita la nota de otro",
  assertFails(updateDoc(doc(curioso, "notas", "n-de-ana"), { texto: "otra cosa" })),
);
await debe(
  "nadie borra la nota de otro",
  assertFails(deleteDoc(doc(curioso, "notas", "n-de-ana"))),
);
await debe(
  "quien modera SÍ puede retirar una nota ajena",
  // Sin esto, Google Play no deja publicar la app.
  assertSucceeds(deleteDoc(doc(moderador, "notas", "n-de-ana"))),
);

// --------------------------------------------------------- frases favoritas
console.log("\nLas frases favoritas");
const frase = (uid, extra = {}) => ({
  uid,
  nombre: "Quien sea",
  usuario: uid,
  texto: "Esfuérzate y sé valiente.",
  cuando: Date.now(),
  ...extra,
});
await debe(
  "sin cuenta se leen las frases de un perfil",
  assertSucceeds(getDocs(collection(nadie, "frases"))),
);
await debe(
  "cada uno publica las suyas",
  assertSucceeds(setDoc(doc(beto, "frases", "beto.abc123"), frase("beto"))),
);
await debe(
  "DOS personas pueden publicar la MISMA frase",
  // El id de una frase es la huella de su texto: si la clave fuera sólo eso,
  // el segundo chocaría con el documento del primero. Por eso lleva el uid
  // delante, y esto lo comprueba.
  assertSucceeds(setDoc(doc(curioso, "frases", "curioso.abc123"), frase("curioso"))),
);
await debe(
  "una frase con cita también pasa",
  assertSucceeds(
    setDoc(doc(beto, "frases", "beto.def456"), frase("beto", { fuente: "Josué 1:9" })),
  ),
);
await debe(
  "no se publica una frase firmando con el uid de otro",
  assertFails(setDoc(doc(beto, "frases", "beto.zzz"), frase("ana"))),
);
await debe(
  "nadie borra la frase de otro",
  assertFails(deleteDoc(doc(curioso, "frases", "ana.abc123"))),
);
await debe(
  "no se cuela un campo de más en una frase",
  assertFails(setDoc(doc(beto, "frases", "beto.extra"), frase("beto", { plan: "ojos" }))),
);
await debe(
  "quien modera puede retirar una frase ajena",
  assertSucceeds(deleteDoc(doc(moderador, "frases", "ana.abc123"))),
);

// --------------------------------------------------------- avisos de fallos
console.log("\nLos avisos de fallos");
const aviso = (extra = {}) => ({
  texto: "Toqué el nombre de un hermano y no se abrió nada.",
  parte: "Genuino 6.7",
  cuando: Date.now(),
  ...extra,
});
await debe(
  "SIN CUENTA se puede avisar de un fallo",
  // Es la comprobación que justifica toda la decisión: quien no puede entrar
  // es justo quien más necesita poder contarlo.
  assertSucceeds(setDoc(doc(nadie, "fallos", "f1"), aviso())),
);
await debe(
  "una captura se puede adjuntar",
  assertSucceeds(setDoc(doc(nadie, "fallos", "f1", "capturas", "0"), { imagen: "data:image/jpeg;base64,xx" })),
);
await debe(
  "un aviso vacío no pasa",
  assertFails(setDoc(doc(nadie, "fallos", "f2"), aviso({ texto: "" }))),
);
await debe(
  "no se cuela un campo de más en un aviso",
  assertFails(setDoc(doc(nadie, "fallos", "f3"), aviso({ uid: "ana" }))),
);
await debe(
  "nadie lee los avisos de fallos",
  assertFails(getDoc(doc(beto, "fallos", "f1"))),
);
await debe(
  "nadie lee las capturas de nadie",
  assertFails(getDocs(collection(beto, "fallos/f1/capturas"))),
);

// ---------------------------------------------------------------- denuncias
console.log("\nLas denuncias");
await debe(
  "se puede denunciar a nombre propio",
  assertSucceeds(
    setDoc(doc(beto, "denuncias", "d2"), { nota: "n-de-ana", de: "beto", motivo: "spam" }),
  ),
);
await debe(
  "no se puede denunciar firmando con el nombre de otro",
  assertFails(
    setDoc(doc(beto, "denuncias", "d3"), { nota: "n-de-ana", de: "ana", motivo: "spam" }),
  ),
);
await debe(
  "nadie lee las denuncias, ni las suyas",
  assertFails(getDoc(doc(beto, "denuncias", "d1"))),
);
await debe("nadie borra una denuncia", assertFails(deleteDoc(doc(beto, "denuncias", "d1"))));

// ---------------------------------------------------------------- bloqueados
console.log("\nLos bloqueados");
await debe(
  "cada uno lee su propia lista",
  assertSucceeds(getDocs(collection(ana, "usuarios/ana/bloqueados"))),
);
await debe(
  "nadie ve a quién bloqueó otro — ni el bloqueado",
  assertFails(getDocs(collection(curioso, "usuarios/ana/bloqueados"))),
);

// ------------------------------------------------------------------ perfiles
console.log("\nEl perfil y el nombre de usuario");
await debe(
  "un perfil lo lee cualquiera que haya entrado, para poder buscar",
  assertSucceeds(getDoc(doc(curioso, "usuarios", "ana"))),
);
await debe(
  "sin haber entrado NO se lee un perfil",
  assertFails(getDoc(doc(nadie, "usuarios", "ana"))),
);
await debe(
  "nadie escribe el perfil de otro",
  assertFails(setDoc(doc(beto, "usuarios", "ana"), perfil("Ana Falsa", "ana"))),
);
await debe(
  "una foto demasiado grande no pasa",
  assertFails(
    setDoc(doc(beto, "usuarios", "beto"), { ...perfil("Beto", "beto"), foto: "x".repeat(60001) }),
  ),
);
await debe(
  "una racha inventada de millones no pasa",
  assertFails(
    setDoc(doc(beto, "usuarios", "beto"), { ...perfil("Beto", "beto"), racha: 999999999 }),
  ),
);
await debe(
  "no se puede reservar un nombre de usuario apuntando a otro",
  assertFails(setDoc(doc(beto, "handles", "librecito"), { uid: "ana" })),
);

// --------------------------------------------------------- lo que no existe
console.log("\nLo que no tiene sitio aquí");
await debe(
  "el diario NO tiene colección, y no se puede inventar",
  assertFails(setDoc(doc(ana, "diarios", "ana"), { texto: "mi diario entero" })),
);
await debe(
  "los repasos tampoco",
  assertFails(setDoc(doc(ana, "repasos", "ana"), { cayo: true })),
);
await debe(
  "nadie se hace moderador a sí mismo",
  assertFails(setDoc(doc(curioso, "moderadores", "curioso"), { desde: 1 })),
);
await debe(
  "quien modera puede comprobar que lo es",
  // Sin esto la app no sabe si enseñar el botón de retirar, y el permiso
  // queda escrito en el servidor sin manera de usarlo.
  assertSucceeds(getDoc(doc(moderador, "moderadores", "mod"))),
);
await debe(
  "nadie puede mirar si OTRO modera",
  assertFails(getDoc(doc(curioso, "moderadores", "mod"))),
);
await debe(
  "nadie puede sacar la lista de moderadores",
  assertFails(getDocs(collection(curioso, "moderadores"))),
);

await entorno.cleanup();

console.log(
  fallos === 0
    ? `\n${pasadas} comprobaciones, sin problemas.\n`
    : `\n${fallos} de ${fallos + pasadas} comprobaciones FALLARON.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
