/**
 * Oracion-por-disciplina — mensaje devocional para Instagram y TikTok. Es una oración: música de piano, no la del trailer.
 *
 * NO es publicidad de la app. Plantilla: el proyecto de Filipenses 4:13.
 * Los planos son el plan base del planificador (`planificar.mjs`); el jurado
 * los sustituye cuando entrega.
 */
export default {
  nombre: "Oracion-por-disciplina",
  sinApp: true,
  fuente: { archivo: "C:/Windows/Fonts/ariblk.ttf", anchos: "anchos-ariblk.json", tamano: 66 },
  central: ".trabajo/central.mp4",
  palabras: ".trabajo/palabras-grande.json",
  voz: { desde: 0.0, dur: 71.3 },
  cara: { cx: 0.605, cy: 0.431, cabeza: 0.109 },
  // Pasos cortos y sólo entre vecinos: lo que Alex aceptó tras la v3 de Filipenses.
  encuadres: {
    abierto: { zoom: 1.15, nitidez: 0.5 },
    medio: { zoom: 1.30, nitidez: 0.7 },
    cerca: { zoom: 1.44, nitidez: 0.9 },
  },
  planos: [
    { hasta: 2.94, enc: "cerca", deriva: 0.04 }, // Hey, acompáñame a hacer esta oración porque tú y
    { hasta: 5.42, enc: "medio", deriva: -0.04 }, // yo necesitamos ser disciplinados
    { hasta: 7.62, enc: "abierto", deriva: 0.04 }, // y fortalecidos por nuestro perfectísimo Dios.
    { hasta: 10.78, enc: "medio", deriva: -0.04 }, // Te damos gracias, Padre, porque tu amor es inagotable y
    { hasta: 14.12, enc: "abierto", deriva: 0.04 }, // desde ese amor que nunca se agota suplicamos tu ayuda,
    { hasta: 17.28, enc: "medio", deriva: -0.04 }, // tu fortaleza, que tu Espíritu Santo nos ponga cada día
    { hasta: 20.54, enc: "cerca", deriva: 0.04 }, // el querer como el hacer de buscarte primeramente,
    { hasta: 22.48, enc: "medio", deriva: -0.04 }, // de obedecerte en todo tiempo,
    { hasta: 24.58, enc: "abierto", deriva: 0.04 }, // de amar al prójimo como a nosotros mismos.
    { hasta: 27.42, enc: "medio", deriva: -0.04 }, // Que cada día sigamos dando la buena batalla
    { hasta: 30.44, enc: "cerca", deriva: 0.05 }, // de la fe para que tú te glorifiques a través de nuestro…
    { hasta: 33.68, enc: "medio", deriva: -0.04 }, // y que en todo tiempo se pueda sentir la presencia
    { hasta: 36.56, enc: "cerca", deriva: 0.05 }, // de tu Espíritu Santo con el fruto que es verdad,
    { hasta: 39.38, enc: "medio", deriva: -0.04 }, // amor, dignidad, templanza, dominio propio,
    { hasta: 41.76, enc: "cerca", deriva: 0.05 }, // fe, mansedumbre y todo lo que
    { hasta: 44.12, enc: "medio", deriva: -0.04 }, // tú has establecido para que todo el mundo vea que
    { hasta: 47.40, enc: "abierto", deriva: 0.04 }, // no hay nada mejor que obedecerte hoy y siempre.
    { hasta: 49.40, enc: "medio", deriva: -0.04 }, // Ayúdanos, Padre, disciplínanos,
    { hasta: 52.48, enc: "abierto", deriva: 0.04 }, // pon en nosotros un corazón siempre entendido,
    { hasta: 54.58, enc: "medio", deriva: -0.04 }, // lleno de tu verdad y tu palabra.
    { hasta: 57.22, enc: "abierto", deriva: 0.04 }, // Para que tu nombre sea exaltado y que en todo
    { hasta: 60.54, enc: "medio", deriva: -0.04 }, // tiempo nos parezcamos a nuestro Señor Jesucristo, nuest…
    { hasta: 62.86, enc: "cerca", deriva: 0.05 }, // Te lo pedimos con fe y de corazón en el nombre,
    { hasta: 66.20, enc: "medio", deriva: -0.04 }, // sobre todo nombre, el nombre de nuestro Señor Jesucristo.
    { hasta: 68.80, enc: "cerca", deriva: 0.05 }, // Amén. Si tú crees que Dios escuchó esta oración,
    { hasta: 71.30, enc: "medio", deriva: -0.04 }, // escribe un gran amén.
  ],
  // No cita ninguna referencia: sin tarjeta.
  doradas: /(?<![A-ZÁÉÍÓÚÑ])(PADRE|ESPÍRITU|JESUCRISTO|YESHUA|AMÉN|FE|VERDAD|DISCIPLÍNANOS)(?![A-ZÁÉÍÓÚÑ])/,
  arreglos: [
    // Nada que corregir en la transcripción del modelo grande.
  ],
  musica: {
    archivo: "../musica/1-piano-emotivo.mp3",
    golpes: "../musica/1-piano-emotivo-golpes.txt",
    volumen: 1.2, ratio: 5, umbral: 0.022, // punto de partida; comprobar.mjs dirá
  },
  cierre: {
    // Él mismo pide «escribe un gran amén»: el cierre lo repite en grande.
    dur: 4.8,
    lineas: [
      { texto: "Escribe un gran", fuente: "cita", color: "blanco", tamano: 62, y: 0.34 },
      { texto: "AMÉN", fuente: "fuerte", color: "oro", tamano: 170, y: 0.395 },
      { texto: "@GenuinoLove", fuente: "fuerte", color: "tenue", tamano: 54, y: 0.56 },
    ],
  },
};
