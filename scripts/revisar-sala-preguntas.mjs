/**
 * El portero de las salas, probado entero y de verdad.
 *
 * ── Qué prueba esto que no probaba lo de antes ────────────────────────────
 *
 * `functions/revisar-permiso.mjs` prueba las dos decisiones sueltas —quién habla
 * y si el nombre del canal vale— con funciones puras y sin nada alrededor. Eso
 * está bien y no basta: entre esas funciones y la persona que quiere entrar hay
 * una Cloud Function, unas reglas de Firestore, una sesión y tres lecturas.
 *
 * Esto levanta los tres emuladores —autenticación, Firestore y funciones—, crea
 * gente de verdad con su sesión de verdad, y **llama a la puerta**. Lo que se
 * comprueba es lo que va a pasarle a un hermano el día del devocional:
 *
 *   - que un expulsado no entre,
 *   - que una sala cerrada no deje pasar a nadie,
 *   - que quien no tiene la palabra reciba un token de **oyente**,
 *   - y que el anfitrión no tenga que pedirle permiso a nadie.
 *
 *   npm run revisar-sala
 *
 * **No toca producción ni hace falta cuenta de Agora.** Los emuladores arrancan
 * vacíos, el App ID y el certificado de `functions/.env.local` son inventados, y
 * firmar un token es matemática local: no se consulta a ningún servidor.
 */
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const PROYECTO = "genuino-pruebas";

let fallos = 0;
let pasadas = 0;

/** Una comprobación con nombre. El nombre es lo que se lee cuando falla. */
async function debe(nombre, hacer) {
  try {
    await hacer();
    pasadas++;
    console.log("  ok   " + nombre);
  } catch (e) {
    fallos++;
    console.log("FALLA  " + nombre);
    console.log("       " + (e?.message ?? e));
  }
}

/**
 * Lo contrario: tiene que fallar, y **por el motivo que esperamos**.
 *
 * Lo segundo importa tanto como lo primero. Una prueba que sólo comprueba que
 * algo falló pasa en verde el día que falla por una razón equivocada — y aquí la
 * razón equivocada sería, por ejemplo, que la sala no existe cuando lo que
 * queríamos ver es que a un expulsado se le niega la entrada.
 *
 * Se mira el **código** (`functions/not-found`) y no el texto: el texto está
 * escrito para una persona y va a cambiar cuando se lea mejor. Atar una prueba a
 * una frase es atarla a la redacción.
 */
async function debeNegarse(nombre, codigoEsperado, hacer) {
  try {
    await hacer();
    fallos++;
    console.log("FALLA  " + nombre);
    console.log("       dejó pasar, y no debía");
  } catch (e) {
    const codigo = String(e?.code ?? "");
    const mensaje = String(e?.message ?? e);
    // Las de Firestore no traen `code` de función, así que también vale el texto.
    const acierta =
      codigo.includes(codigoEsperado) || mensaje.toLowerCase().includes(codigoEsperado);
    if (!acierta) {
      fallos++;
      console.log("FALLA  " + nombre);
      console.log(`       se negó, pero por otra cosa: «${codigo || mensaje}»`);
      return;
    }
    pasadas++;
    console.log("  ok   " + nombre);
  }
}

const app = initializeApp({ projectId: PROYECTO, apiKey: "da-igual-en-el-emulador" });
const auth = getAuth(app);
const bd = getFirestore(app);
const funciones = getFunctions(app, "us-central1");

connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(bd, "127.0.0.1", 8199);
connectFunctionsEmulator(funciones, "127.0.0.1", 5011);

const portero = httpsCallable(funciones, "permisoDeSala");

/** Crea a alguien y deja su sesión abierta. Devuelve su uid. */
async function entrarComo(correo) {
  try {
    await createUserWithEmailAndPassword(auth, correo, "unaClaveCualquiera");
  } catch {
    await signInWithEmailAndPassword(auth, correo, "unaClaveCualquiera");
  }
  return auth.currentUser.uid;
}

console.log("\nEL PORTERO DE LAS SALAS, llamando a la puerta de verdad\n");

/**
 * Escribe saltandose las reglas, como haria la consola de Firebase.
 *
 * El emulador de Firestore acepta `Authorization: Bearer owner` y entonces no
 * aplica `firestore.rules`. Hace falta para una sola cosa: dar de alta a alguien
 * en `moderadores/{uid}`, que **desde la app no se puede escribir a proposito** —
 * si se pudiera, cualquiera se haria moderador.
 *
 * Se hace por REST y no con firebase-admin para no traer otra dependencia a la
 * raiz del proyecto por tres lineas.
 */
async function comoDueno(ruta, campos) {
  const url =
    `http://127.0.0.1:8199/v1/projects/${PROYECTO}/databases/(default)/documents/${ruta}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: campos }),
  });
  if (!r.ok) throw new Error(`no se pudo escribir ${ruta}: ${r.status} ${await r.text()}`);
}

// ── Ana abre un devocional ────────────────────────────────────────────────
const ana = await entrarComo("ana@genuino.prueba");
const SALA = "devocional-de-la-manana";

// Abrir salas es cosa de quien modera: cada minuto de voz lo paga Alex. En la
// vida real esto se da de alta desde la consola; aqui, saltandose las reglas
// igual que hace la consola.
await comoDueno(`moderadores/${ana}`, { desde: { integerValue: "1" } });

await setDoc(doc(bd, "salas", SALA), {
  nombre: "Devocional de la mañana",
  anfitrion: ana,
  abierta: true,
  desde: Date.now(),
  tipo: "devocional",
});

console.log("Quién puede abrir una sala");
await debeNegarse(
  "QUIEN NO MODERA NO ABRE SALAS - cada minuto de voz lo paga Alex",
  "permission",
  async () => {
    const otro = await entrarComo("colado@genuino.prueba");
    await setDoc(doc(bd, "salas", "sala-del-colado"), {
      nombre: "La mía",
      anfitrion: otro,
      abierta: true,
      desde: Date.now(),
      tipo: "devocional",
    });
  },
);

// La pregunta de arriba dejó la sesión abierta con otra persona, y sin esto las
// siguientes corren a nombre del colado. Lo encontró la propia prueba: al
// anfitrión le salía token de oyente, que era verdad — no era el anfitrión.
await entrarComo("ana@genuino.prueba");

console.log("\nEl anfitrión");
await debe("el anfitrión entra y HABLA sin pedirle permiso a nadie", async () => {
  const r = await portero({ canal: SALA });
  if (r.data.habla !== true) throw new Error("le salió token de oyente");
  if (r.data.esAnfitrion !== true) throw new Error("no se reconoció como anfitrión");
  if (!r.data.token || !r.data.token.startsWith("007")) throw new Error("token raro");
  if (r.data.cuenta !== ana) throw new Error("la cuenta del token no es la suya");
});

// ── Beto entra al devocional ──────────────────────────────────────────────
const beto = await entrarComo("beto@genuino.prueba");

console.log("\nQuien llega a escuchar");
await debe("entra, y le sale token de OYENTE", async () => {
  const r = await portero({ canal: SALA });
  if (r.data.habla !== false) throw new Error("le dieron la palabra sin pedirla");
  if (r.data.esAnfitrion !== false) throw new Error("se creyó el anfitrión");
});

/**
 * Y aquí está lo que de verdad se defiende.
 *
 * Beto se apunta en la lista poniéndose `palabra: true`. Las reglas de Firestore
 * no se lo permiten —hay una prueba con ese nombre en `revisar-reglas.mjs`— pero
 * esto comprueba la otra mitad: que **aunque lo consiguiera**, el portero mira
 * el documento que hay en la base, no lo que diga nadie.
 */
await debeNegarse(
  "NO SE PUEDE ENTRAR CON LA PALABRA PUESTA A MANO",
  "permission",
  async () => {
    await setDoc(doc(bd, "salas", SALA, "dentro", beto), {
      nombre: "Beto",
      usuario: "beto",
      entro: Date.now(),
      mano: false,
      palabra: true,
    });
  },
);

await debe("se apunta en silencio, como debe ser", async () => {
  await setDoc(doc(bd, "salas", SALA, "dentro", beto), {
    nombre: "Beto",
    usuario: "beto",
    entro: Date.now(),
    mano: false,
    palabra: false,
  });
});

// ── Ana le da la palabra ──────────────────────────────────────────────────
await entrarComo("ana@genuino.prueba");
await debe("el anfitrión le da la palabra", async () => {
  await setDoc(
    doc(bd, "salas", SALA, "dentro", beto),
    { nombre: "Beto", usuario: "beto", entro: Date.now(), mano: false, palabra: true },
    { merge: true },
  );
});

await entrarComo("beto@genuino.prueba");
await debe("y AHORA sí le sale token de quien habla", async () => {
  const r = await portero({ canal: SALA });
  if (r.data.habla !== true) throw new Error("siguió siendo oyente después de darle la palabra");
});

// ── Lo que no puede pasar ─────────────────────────────────────────────────
console.log("\nLo que no puede pasar");

await debeNegarse("una sala que no existe", "not-found", () =>
  portero({ canal: "esta-sala-no-existe" }),
);
await debeNegarse("un nombre con espacios", "invalid-argument", () =>
  portero({ canal: "sala de ana" }),
);
await debeNegarse("sin canal", "invalid-argument", () => portero({}));

await entrarComo("ana@genuino.prueba");
await setDoc(
  doc(bd, "salas", SALA),
  { nombre: "Devocional de la mañana", anfitrion: ana, abierta: false, desde: 1, tipo: "devocional" },
  { merge: true },
);
await entrarComo("beto@genuino.prueba");
await debeNegarse("una sala CERRADA no deja pasar a nadie", "failed-precondition", () =>
  portero({ canal: SALA }),
);

// Se reabre para lo que queda.
await entrarComo("ana@genuino.prueba");
await setDoc(
  doc(bd, "salas", SALA),
  { nombre: "Devocional de la mañana", anfitrion: ana, abierta: true, desde: 1, tipo: "devocional" },
  { merge: true },
);

// El expulsado. Es la prueba que más importa de esta tanda: si esto falla,
// sacar a alguien de una sala no sirve de nada, porque vuelve a entrar.
const curioso = await entrarComo("curioso@genuino.prueba");
await entrarComo("ana@genuino.prueba");
await setDoc(doc(bd, "salas", SALA, "expulsados", curioso), { cuando: Date.now() });
await entrarComo("curioso@genuino.prueba");
await debeNegarse("UN EXPULSADO NO VUELVE A ENTRAR", "permission-denied", () =>
  portero({ canal: SALA }),
);

// Y sin sesión, nada.
await signOut(auth);
await debeNegarse("sin haber entrado con tu cuenta, no hay puerta", "unauthenticated", () =>
  portero({ canal: SALA }),
);

// ── Una llamada de dos: no hay nada que moderar ───────────────────────────
console.log("\nLa llamada de dos");
await entrarComo("ana@genuino.prueba");
await setDoc(doc(bd, "salas", "llamada-ana-beto"), {
  nombre: "Ana y Beto",
  anfitrion: ana,
  abierta: true,
  desde: Date.now(),
  tipo: "llamada",
});
await entrarComo("beto@genuino.prueba");
await debe("el que recibe la llamada habla desde el principio", async () => {
  const r = await portero({ canal: "llamada-ana-beto" });
  if (r.data.habla !== true) throw new Error("le salió token de oyente en una llamada");
  if (r.data.esAnfitrion !== false) throw new Error("se creyó el anfitrión");
});

console.log(
  "\n" +
    (fallos === 0
      ? `${pasadas} comprobaciones, sin problemas.`
      : `${fallos} FALLOS de ${pasadas + fallos}.`) +
    "\n",
);
process.exit(fallos === 0 ? 0 : 1);
