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
// El dueño: modera como `mod`, y además nombra y quita moderadores.
const dueno = entorno.authenticatedContext("dueno").firestore();
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
  await setDoc(doc(bd, "moderadores", "dueno"), { dueno: true, correo: "d@x", desde: 1 });
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
// La ficha de la sala va con el nombre del PERFIL (las reglas lo comprueban):
// nadie puede aparecer en la sala con el nombre de otro.
const NOMBRES = { ana: "Ana", beto: "Beto", curioso: "Curioso" };
const dentroDe = (uid, extra = {}) => ({
  nombre: NOMBRES[uid] ?? "Quien sea",
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
// Una sala que su anfitrión olvidó abierta la cierra cualquier moderador —y
// sólo la cierra.
await debe(
  "quien no modera no cierra la sala de otro",
  assertFails(updateDoc(doc(beto, "salas", SALA), { abierta: false })),
);
await debe(
  "el dueño cierra una sala que otro dejó abierta",
  assertSucceeds(updateDoc(doc(dueno, "salas", SALA), { abierta: false })),
);
await debe(
  "pero sólo la cierra: ni la renombra ni la reabre",
  Promise.all([
    assertFails(updateDoc(doc(dueno, "salas", SALA), { abierta: false, nombre: "otra" })),
    assertFails(updateDoc(doc(dueno, "salas", SALA), { abierta: true })),
  ]),
);
await debe(
  "y el anfitrión sí la reabre",
  assertSucceeds(updateDoc(doc(moderador, "salas", SALA), { abierta: true })),
);
await debe(
  "el anfitrion pone los MICROFONOS LIBRES",
  assertSucceeds(updateDoc(doc(moderador, "salas", SALA), { micLibre: true })),
);
await debe(
  "nadie mas los pone: es una decision del anfitrion sobre todos",
  assertFails(updateDoc(doc(beto, "salas", SALA), { micLibre: true })),
);
await debe(
  "y un micLibre que no sea si/no no pasa",
  assertFails(updateDoc(doc(moderador, "salas", SALA), { micLibre: "si" })),
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
  "nadie entra con el nombre de otro",
  assertFails(
    setDoc(doc(curioso, `salas/${SALA}/dentro/curioso`), dentroDe("curioso", { nombre: "Ana" })),
  ),
);
await debe(
  "ni con una foto que no es la de su perfil",
  assertFails(
    setDoc(doc(curioso, `salas/${SALA}/dentro/curioso`), dentroDe("curioso", { foto: "otra" })),
  ),
);
await debe(
  "al levantar la mano no se cambia el nombre",
  assertFails(updateDoc(doc(beto, `salas/${SALA}/dentro/beto`), { mano: true, nombre: "Ana" })),
);
await debe(
  "el anfitrión sólo mueve la palabra, la mano y el silencio",
  assertFails(updateDoc(doc(moderador, `salas/${SALA}/dentro/beto`), { nombre: "Otro" })),
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
  "el expulsado lee lo suyo (el portero lo lee con su token)",
  assertSucceeds(getDoc(doc(curioso, `salas/${SALA}/expulsados/curioso`))),
);
await debe(
  "pero nadie saca la lista de expulsados, salvo el anfitrión",
  Promise.all([
    assertFails(getDocs(collection(beto, `salas/${SALA}/expulsados`))),
    assertSucceeds(getDocs(collection(moderador, `salas/${SALA}/expulsados`))),
  ]),
);
await debe(
  "un expulsado NO vuelve a entrar",
  assertFails(setDoc(doc(curioso, `salas/${SALA}/dentro/curioso`), dentroDe("curioso"))),
);


// ------------------------------------------------------- la comunidad de voz
console.log("\nLa comunidad de voz");

const miembro = (nombre, usuario) => ({ nombre, usuario, desde: 1 });

await debe(
  "cada uno se apunta a si mismo",
  assertSucceeds(setDoc(doc(beto, "comunidad/voz/miembros/beto"), miembro("Beto", "beto"))),
);
await debe(
  "nadie apunta a otro",
  assertFails(setDoc(doc(curioso, "comunidad/voz/miembros/beto"), miembro("Beto", "beto"))),
);
await debe(
  "cada uno ve si esta",
  assertSucceeds(getDoc(doc(beto, "comunidad/voz/miembros/beto"))),
);
await debe(
  "NADIE VE SI OTRO ESTA: quien esta en un grupo de oracion es cosa suya",
  assertFails(getDoc(doc(curioso, "comunidad/voz/miembros/beto"))),
);
await debe(
  "la lista entera solo la ve quien modera",
  assertSucceeds(getDocs(collection(moderador, "comunidad/voz/miembros"))),
);
await debe(
  "y quien no modera no puede listarla",
  assertFails(getDocs(collection(curioso, "comunidad/voz/miembros"))),
);
await debe(
  "no se cuelan campos: esto no es un perfil",
  assertFails(
    setDoc(doc(beto, "comunidad/voz/miembros/beto"), { ...miembro("Beto", "beto"), telefono: "x" }),
  ),
);
await debe(
  "salirse es un toque: cada uno se borra a si mismo",
  assertSucceeds(deleteDoc(doc(beto, "comunidad/voz/miembros/beto"))),
);
await debe(
  "y nadie saca a otro — ni quien modera, que para eso esta el tema",
  assertFails(deleteDoc(doc(moderador, "comunidad/voz/miembros/ana"))),
);

// ------------------------------- las tres lecturas de las que vive el portero
//
// El portero de las salas corre en Cloudflare y lee Firestore **con el token de
// la propia persona**, no con una cuenta de servicio: asi no hay ninguna
// credencial nuestra guardada alli, y no puede ver nada que ella no viera.
//
// El precio es que estas tres lecturas tienen que seguir permitidas. Si un dia
// alguien las cierra —por prudencia, que es como pasan estas cosas— el portero
// deja de poder comprobar nada y **nadie entra a ningun devocional**, sin que
// ninguna otra prueba se entere: las del Worker usan un Firestore de mentira.
//
// Por eso estan aqui, con este nombre.
console.log("\nLo que el portero necesita leer");

await debe(
  "EL PORTERO LEE LA SALA con el token de quien entra",
  assertSucceeds(getDoc(doc(beto, "salas", SALA))),
);
await debe(
  "EL PORTERO LEE SI ESTA EXPULSADO",
  assertSucceeds(getDoc(doc(beto, `salas/${SALA}/expulsados/beto`))),
);
await debe(
  "EL PORTERO LEE SU FICHA, que es donde dice si tiene la palabra",
  assertSucceeds(getDoc(doc(beto, `salas/${SALA}/dentro/beto`))),
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

// ── El dueño: nombra y quita; nadie lo toca a él ───────────────────────────
const nombramiento = (puestoPor = "dueno") => ({
  nombre: "Beto",
  usuario: "beto",
  puestoPor,
  desde: 1,
});
await debe(
  "el dueño ve la lista entera de moderadores",
  assertSucceeds(getDocs(collection(dueno, "moderadores"))),
);
await debe(
  "un moderador normal NO ve la lista",
  assertFails(getDocs(collection(moderador, "moderadores"))),
);
await debe(
  "el dueño nombra a un moderador desde la app",
  assertSucceeds(setDoc(doc(dueno, "moderadores", "beto"), nombramiento())),
);
await debe(
  "un moderador normal no nombra a nadie",
  assertFails(setDoc(doc(moderador, "moderadores", "ana"), nombramiento("mod"))),
);
await debe(
  "el dueño no puede crear otro dueño",
  assertFails(
    setDoc(doc(dueno, "moderadores", "ana"), { ...nombramiento(), dueno: true }),
  ),
);
await debe(
  "un nombramiento tiene que ir firmado por quien lo hace",
  assertFails(setDoc(doc(dueno, "moderadores", "ana"), nombramiento("otro"))),
);
await debe(
  "un nombramiento sin nombre no vale",
  assertFails(setDoc(doc(dueno, "moderadores", "ana"), { ...nombramiento(), nombre: "" })),
);
await debe(
  "nadie edita un moderador (ni para ascenderlo a dueño)",
  assertFails(updateDoc(doc(dueno, "moderadores", "mod"), { dueno: true })),
);
await debe(
  "un moderador no se asciende a sí mismo",
  assertFails(updateDoc(doc(moderador, "moderadores", "mod"), { dueno: true })),
);
await debe(
  "el dueño quita a un moderador",
  assertSucceeds(deleteDoc(doc(dueno, "moderadores", "beto"))),
);
await debe(
  "un moderador no quita a otro",
  assertFails(deleteDoc(doc(moderador, "moderadores", "dueno"))),
);
await debe(
  "al dueño no lo quita nadie, ni él mismo",
  assertFails(deleteDoc(doc(dueno, "moderadores", "dueno"))),
);
await debe(
  "un extraño no lee el documento del dueño",
  assertFails(getDoc(doc(curioso, "moderadores", "dueno"))),
);

// ── La campana, la asistencia y la racha en la sala ───────────────────────
await debe(
  "el anfitrión pone la campana",
  assertSucceeds(
    updateDoc(doc(moderador, "salas", SALA), { campana: { cuando: 1, activa: true } }),
  ),
);
await debe(
  "otro no toca la campana",
  assertFails(updateDoc(doc(ana, "salas", SALA), { campana: { cuando: 1, activa: false } })),
);
await debe(
  "la campana no admite campos de más",
  assertFails(
    updateDoc(doc(moderador, "salas", SALA), { campana: { cuando: 1, activa: true, x: 1 } }),
  ),
);
const asistencia = (extra = {}) => ({
  nombre: "Ana",
  usuario: "ana",
  dias: ["2026-09-27", "2026-09-28"],
  racha: 2,
  faltas: 0,
  ultimo: "2026-09-28",
  ...extra,
});
await debe(
  "cada uno apunta su asistencia",
  assertSucceeds(setDoc(doc(ana, "comunidad/voz/asistencia/ana"), asistencia())),
);
await debe(
  "nadie apunta la asistencia de otro",
  assertFails(setDoc(doc(curioso, "comunidad/voz/asistencia/ana"), asistencia())),
);
await debe(
  "una racha negativa no vale",
  assertFails(setDoc(doc(ana, "comunidad/voz/asistencia/ana"), asistencia({ racha: -1 }))),
);
await debe(
  "quien modera ve la lista de asistencia",
  assertSucceeds(getDocs(collection(moderador, "comunidad/voz/asistencia"))),
);
await debe(
  "un extraño no ve la lista de asistencia",
  assertFails(getDocs(collection(curioso, "comunidad/voz/asistencia"))),
);
await debe(
  "cada uno lee su asistencia; un extraño la de otro no",
  Promise.all([
    assertSucceeds(getDoc(doc(ana, "comunidad/voz/asistencia/ana"))),
    assertFails(getDoc(doc(curioso, "comunidad/voz/asistencia/ana"))),
  ]),
);
await debe(
  "al entrar a la sala se lleva la racha y las faltas",
  assertSucceeds(
    setDoc(doc(ana, `salas/${SALA}/dentro/ana`), {
      nombre: "Ana",
      usuario: "ana",
      entro: 1,
      mano: false,
      palabra: false,
      racha: 2,
      faltas: 0,
    }),
  ),
);
await debe(
  "el anfitrión silencia a alguien",
  assertSucceeds(updateDoc(doc(moderador, `salas/${SALA}/dentro/ana`), { silenciado: true })),
);
await debe(
  "el silenciado no se quita el silencio",
  assertFails(updateDoc(doc(ana, `salas/${SALA}/dentro/ana`), { silenciado: false })),
);
await debe(
  "el silenciado sí puede levantar la mano",
  assertSucceeds(updateDoc(doc(ana, `salas/${SALA}/dentro/ana`), { mano: true })),
);
await debe(
  "nadie entra ya silenciado por su cuenta (ni sin silencio se lo pone otro)",
  assertFails(
    setDoc(doc(curioso, `salas/${SALA}/dentro/curioso`), {
      nombre: "Curioso",
      usuario: "curioso",
      entro: 1,
      mano: false,
      palabra: false,
      silenciado: true,
    }),
  ),
);
await debe(
  "el anfitrión vacía la lista al terminar para todos",
  assertSucceeds(deleteDoc(doc(moderador, `salas/${SALA}/dentro/ana`))),
);
await debe(
  "una racha que no es número entero no entra en la sala",
  assertFails(
    setDoc(doc(beto, `salas/${SALA}/dentro/beto`), {
      nombre: "Beto",
      usuario: "beto",
      entro: 1,
      mano: false,
      palabra: false,
      racha: "muchas",
    }),
  ),
);
await debe(
  "una captura más grande que la que manda la app no pasa",
  assertFails(
    setDoc(doc(nadie, "fallos", "f-grande", "capturas", "1"), { imagen: "x".repeat(700_001) }),
  ),
);

// ── El devocional: el archivo, el orden de lectura y los turnos ────────────
console.log("\nEL DEVOCIONAL");
await entorno.withSecurityRulesDisabled(async (libre) => {
  const bd = libre.firestore();
  // Ana está en la comunidad; Curioso no.
  await setDoc(doc(bd, "comunidad/voz/miembros/ana"), { nombre: "Ana", usuario: "ana", desde: 1 });
  await setDoc(doc(bd, "devocionales/caminemos-2026/dias/271"), {
    dia: 271,
    tema: "¿Dónde estás guardando tesoros?",
    trozos: [{ tipo: "pasaje", ref: "Isaías 13:1-5", texto: "1 Profecía sobre Babilonia…" }],
  });
});
await debe(
  "la comunidad lee el devocional del día",
  assertSucceeds(getDoc(doc(ana, "devocionales/caminemos-2026/dias/271"))),
);
await debe(
  "quien modera también",
  assertSucceeds(getDoc(doc(moderador, "devocionales/caminemos-2026/dias/271"))),
);
await debe(
  "QUIEN NO ESTÁ EN LA COMUNIDAD NO LO LEE: lleva la Biblia con derechos, como el grupo",
  assertFails(getDoc(doc(curioso, "devocionales/caminemos-2026/dias/271"))),
);
const diaPegado = (extra = {}) => ({
  dia: 272,
  fecha: "2026-09-29",
  tema: "¿Una pregunta?",
  capitulos: ["Isaías 16"],
  trozos: [{ tipo: "pasaje", ref: "Isaías 16:1-5", texto: "1 …" }],
  subido: 1,
  ...extra,
});
await debe(
  "quien modera pega el devocional de un día desde la app",
  assertSucceeds(setDoc(doc(moderador, "devocionales/caminemos-2026/dias/272"), diaPegado())),
);
await debe(
  "y lo corrige, con «lo que aprendí hoy»",
  assertSucceeds(
    setDoc(doc(moderador, "devocionales/caminemos-2026/dias/272"), diaPegado({ aprendi: "Hoy aprendí…", subido: 2 })),
  ),
);
await debe(
  "un miembro no escribe el archivo",
  assertFails(setDoc(doc(ana, "devocionales/caminemos-2026/dias/273"), diaPegado({ dia: 273 }))),
);
await debe(
  "ni quien modera con una forma que no es la de un día",
  Promise.all([
    assertFails(setDoc(doc(moderador, "devocionales/caminemos-2026/dias/274"), diaPegado({ dia: 274, trozos: [] }))),
    assertFails(setDoc(doc(moderador, "devocionales/caminemos-2026/dias/275"), diaPegado())),
    assertFails(setDoc(doc(moderador, "devocionales/caminemos-2026/dias/276"), diaPegado({ dia: 276, x: 1 }))),
    assertFails(setDoc(doc(moderador, "devocionales/caminemos-2026/dias/277"), { dia: 277 })),
  ]),
);
await debe(
  "ni en otro plan",
  assertFails(setDoc(doc(moderador, "devocionales/otro-plan/dias/272"), diaPegado())),
);
await debe(
  "borrar un día, nadie desde la app",
  assertFails(deleteDoc(doc(moderador, "devocionales/caminemos-2026/dias/272"))),
);

const orden = (extra = {}) => ({
  lista: [
    { id: "e1", nombre: "Beto", uid: "beto" },
    { id: "e2", nombre: "Ana", uid: "ana" },
    { id: "e3", nombre: "Carla", uid: "carla" },
    { id: "e4", nombre: "Mod", uid: "mod" },
  ],
  ancla: { fecha: "2026-09-28", puesto: 0 },
  actualizado: 1,
  ...extra,
});
await debe(
  "quien modera pone el orden de lectura",
  assertSucceeds(setDoc(doc(moderador, "comunidad/voz/lectura/orden"), orden())),
);
await debe(
  "la comunidad lo lee; quien no está, no",
  Promise.all([
    assertSucceeds(getDoc(doc(ana, "comunidad/voz/lectura/orden"))),
    assertFails(getDoc(doc(curioso, "comunidad/voz/lectura/orden"))),
  ]),
);
await debe(
  "un miembro no cambia el orden",
  assertFails(setDoc(doc(ana, "comunidad/voz/lectura/orden"), orden())),
);
await debe(
  "un orden sin ancla del comentario no vale",
  assertFails(setDoc(doc(moderador, "comunidad/voz/lectura/orden"), { lista: [], actualizado: 1 })),
);

// Ana está dentro de la sala; Carla es de la comunidad y está en la lista,
// pero no ha entrado: así, lo único que falla es eso.
await entorno.withSecurityRulesDisabled(async (libre) => {
  await setDoc(doc(libre.firestore(), `salas/${SALA}/dentro/ana`), dentroDe("ana"));
  await setDoc(doc(libre.firestore(), "comunidad/voz/miembros/carla"), { nombre: "Carla", usuario: "carla", desde: 1 });
});

const lectura = (extra = {}) => ({
  plan: "caminemos-2026",
  dia: 271,
  trozo: 0,
  total: 4,
  puesto: 0,
  lector: "e1",
  lectorUid: "beto",
  desde: 1,
  ...extra,
});
await debe(
  "el anfitrión empieza la lectura por turnos",
  assertSucceeds(updateDoc(doc(moderador, "salas", SALA), { lectura: lectura() })),
);
await debe(
  "el que lee NO se lo pasa a quien no está en la sala (se quedaba atascada)",
  assertFails(
    updateDoc(doc(beto, "salas", SALA), {
      lectura: lectura({ trozo: 1, puesto: 2, lector: "e3", lectorUid: "carla" }),
    }),
  ),
);
await debe(
  "ni a alguien que no es el de ese puesto de la lista",
  Promise.all([
    assertFails(
      updateDoc(doc(beto, "salas", SALA), { lectura: lectura({ trozo: 1, puesto: 1, lector: "e2", lectorUid: "beto" }) }),
    ),
    assertFails(
      updateDoc(doc(beto, "salas", SALA), { lectura: lectura({ trozo: 1, puesto: 0, lector: "e2", lectorUid: "ana" }) }),
    ),
  ]),
);
await debe(
  "ni cambia el total ni el plan",
  Promise.all([
    assertFails(
      updateDoc(doc(beto, "salas", SALA), {
        lectura: lectura({ trozo: 1, total: 9, puesto: 1, lector: "e2", lectorUid: "ana" }),
      }),
    ),
    assertFails(
      updateDoc(doc(beto, "salas", SALA), {
        lectura: lectura({ trozo: 1, plan: "otro", puesto: 1, lector: "e2", lectorUid: "ana" }),
      }),
    ),
  ]),
);
await entorno.withSecurityRulesDisabled(async (libre) => {
  // Carla entra en la sala, pero se sale de la comunidad.
  await setDoc(doc(libre.firestore(), `salas/${SALA}/dentro/carla`), dentroDe("carla"));
  await deleteDoc(doc(libre.firestore(), "comunidad/voz/miembros/carla"));
});
await debe(
  "ni a quien está dentro pero ya no es de la comunidad (no vería el texto)",
  assertFails(
    updateDoc(doc(beto, "salas", SALA), {
      lectura: lectura({ trozo: 1, puesto: 2, lector: "e3", lectorUid: "carla" }),
    }),
  ),
);
await debe(
  "la lectura no pasa de su total, ni la pone así el anfitrión",
  assertFails(updateDoc(doc(moderador, "salas", SALA), { lectura: lectura({ trozo: 5, total: 4 }) })),
);
await debe(
  "un día con trozos que no son trozos no entra",
  Promise.all([
    assertFails(setDoc(doc(moderador, "devocionales/caminemos-2026/dias/278"), diaPegado({ dia: 278, trozos: [null] }))),
    assertFails(
      setDoc(doc(moderador, "devocionales/caminemos-2026/dias/279"), diaPegado({ dia: 279, trozos: [{ tipo: "pasaje" }, 5] })),
    ),
  ]),
);
await debe(
  "ni un orden con entradas que no son personas",
  assertFails(setDoc(doc(moderador, "comunidad/voz/lectura/orden"), orden({ lista: [null] }))),
);
await debe(
  "el que lee dice «terminé» y pasa al siguiente que está dentro",
  assertSucceeds(
    updateDoc(doc(beto, "salas", SALA), { lectura: lectura({ trozo: 1, puesto: 1, lector: "e2", lectorUid: "ana" }) }),
  ),
);
await debe(
  "pero ya no es su turno: no puede volver a pasar",
  assertFails(updateDoc(doc(beto, "salas", SALA), { lectura: lectura({ trozo: 2 }) })),
);
await debe(
  "la de turno no salta trozos ni cambia de día",
  Promise.all([
    assertFails(updateDoc(doc(ana, "salas", SALA), { lectura: lectura({ trozo: 5, lectorUid: "", lector: "" }) })),
    assertFails(updateDoc(doc(ana, "salas", SALA), { lectura: lectura({ dia: 272, trozo: 2, lectorUid: "", lector: "" }) })),
  ]),
);
await debe(
  "ni aprovecha para tocar otra cosa de la sala",
  assertFails(
    updateDoc(doc(ana, "salas", SALA), { nombre: "Otra", lectura: lectura({ trozo: 2, lectorUid: "", lector: "" }) }),
  ),
);
await debe(
  "sin nadie más que lea, lo deja sin lector (y reasigna el anfitrión)",
  assertSucceeds(
    updateDoc(doc(ana, "salas", SALA), { lectura: lectura({ trozo: 2, puesto: 1, lector: "", lectorUid: "" }) }),
  ),
);
await debe(
  "quien no lee no pasa el turno",
  assertFails(updateDoc(doc(curioso, "salas", SALA), { lectura: lectura({ trozo: 3, lector: "", lectorUid: "" }) })),
);
await debe(
  "una lectura con campos de más, o con un total imposible, no pasa",
  Promise.all([
    assertFails(updateDoc(doc(moderador, "salas", SALA), { lectura: { ...lectura(), x: 1 } })),
    assertFails(updateDoc(doc(moderador, "salas", SALA), { lectura: lectura({ total: 0 }) })),
  ]),
);
await entorno.withSecurityRulesDisabled(async (libre) => {
  // El anfitrión está dentro y en la lista, pero no apuntado a la comunidad.
  await setDoc(doc(libre.firestore(), `salas/${SALA}/dentro/mod`), dentroDe("mod"));
  await deleteDoc(doc(libre.firestore(), "comunidad/voz/miembros/mod"));
});
await debe(
  "al anfitrión SÍ se le puede pasar el turno aunque no esté apuntado: modera y lee el texto",
  (async () => {
    await assertSucceeds(
      updateDoc(doc(moderador, "salas", SALA), { lectura: lectura({ trozo: 0, puesto: 1, lector: "e2", lectorUid: "ana" }) }),
    );
    await assertSucceeds(
      updateDoc(doc(ana, "salas", SALA), { lectura: lectura({ trozo: 1, puesto: 3, lector: "e4", lectorUid: "mod" }) }),
    );
  })(),
);
await debe(
  "cada uno dice «hoy sólo escucho» 👂",
  assertSucceeds(updateDoc(doc(ana, `salas/${SALA}/dentro/ana`), { escucha: true })),
);
await debe(
  "pero no por otro",
  assertFails(updateDoc(doc(curioso, `salas/${SALA}/dentro/ana`), { escucha: false })),
);
await debe(
  "y al volver a entrar lo trae puesto: entrar con «sólo escucho» vale",
  (async () => {
    await assertSucceeds(deleteDoc(doc(ana, `salas/${SALA}/dentro/ana`)));
    await assertSucceeds(setDoc(doc(ana, `salas/${SALA}/dentro/ana`), dentroDe("ana", { escucha: true })));
  })(),
);

await entorno.cleanup();

console.log(
  fallos === 0
    ? `\n${pasadas} comprobaciones, sin problemas.\n`
    : `\n${fallos} de ${fallos + pasadas} comprobaciones FALLARON.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
