/**
 * Los países, todos.
 *
 * Antes eran **32 escritos a mano**, elegidos pensando en quién iba a usar la
 * app. José, el primer amigo que la probó, dijo lo obvio: **no salen todos**.
 * Y tenía razón — una lista recortada está bien hasta que alguien de un país
 * que no está abre la app y descubre que para esta app su país no existe.
 *
 * Ahora salen los **249 códigos de la norma ISO 3166-1**, y el nombre lo pone
 * el propio sistema con `Intl.DisplayNames`: así están en español, bien
 * escritos y con sus tildes, sin tener que mantener una lista de nombres que
 * envejece cada vez que un país cambia.
 *
 * La bandera **se calcula**, no se guarda. Cada letra del código se convierte
 * en su «indicador regional», y el emoji sale solo: `VE` → 🇻🇪. Doscientos
 * cuarenta y nueve emojis escritos a mano serían doscientas cuarenta y nueve
 * ocasiones de equivocarse.
 */

/** Los de habla hispana primero. No es favoritismo: es de donde viene la gente. */
const PRIMERO = [
  "VE", "CO", "MX", "ES", "AR", "PE", "CL", "EC", "US",
  "PA", "DO", "GT", "CR", "BO", "HN", "SV", "NI", "PY", "UY", "CU", "PR",
];

/** Los 249 códigos de la ISO 3166-1 alfa-2. */
const CODIGOS = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS",
  "BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN",
  "CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE",
  "EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF",
  "GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM",
  "HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM",
  "JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC",
  "LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK",
  "ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA",
  "NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG",
  "PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS",
  "ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO",
  "TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE","VG","VI",
  "VN","VU","WF","WS","YE","YT","ZA","ZM","ZW",
];

export type Pais = { codigo: string; nombre: string; bandera: string };

/**
 * La bandera, a partir del código.
 *
 * Cada letra se cambia por su «indicador regional» —la A es U+1F1E6— y las dos
 * juntas las dibuja el sistema como una bandera.
 */
function banderaDe(codigo: string): string {
  return String.fromCodePoint(
    ...[...codigo.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * El nombre en español, según el sistema.
 *
 * Si el móvil es viejo y no trae `Intl.DisplayNames`, se queda el código. Feo,
 * pero elegible — que es lo que importa: peor sería no poder seleccionar tu
 * país.
 */
function nombresEnEspanol(): (codigo: string) => string {
  try {
    const nombres = new Intl.DisplayNames(["es"], { type: "region" });
    return (codigo) => nombres.of(codigo) ?? codigo;
  } catch {
    return (codigo) => codigo;
  }
}

function construir(): Pais[] {
  const nombreDe = nombresEnEspanol();
  const hecho = (codigo: string): Pais => ({
    codigo,
    nombre: nombreDe(codigo),
    bandera: banderaDe(codigo),
  });

  const primeros = PRIMERO.filter((c) => CODIGOS.includes(c)).map(hecho);
  const resto = CODIGOS.filter((c) => !PRIMERO.includes(c))
    .map(hecho)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return [...primeros, ...resto];
}

export const PAISES: Pais[] = construir();

/** Los de arriba de la lista, para poder separarlos visualmente. */
export const CUANTOS_PRIMERO = PRIMERO.length;

export function paisDe(nombre?: string): Pais | null {
  if (!nombre) return null;
  return PAISES.find((p) => p.nombre === nombre) ?? null;
}
