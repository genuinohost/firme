/**
 * Hasta-cuando — mensaje devocional para Instagram y TikTok. Tres «¿hasta cuándo?» y una oración; Mateo 6:20.
 *
 * NO es publicidad de la app. Plantilla: el proyecto de Filipenses 4:13.
 * Los planos son el plan base del planificador (`planificar.mjs`); el jurado
 * los sustituye cuando entrega.
 */
export default {
  nombre: "Hasta-cuando",
  sinApp: true,
  fuente: { archivo: "C:/Windows/Fonts/ariblk.ttf", anchos: "anchos-ariblk.json", tamano: 66 },
  central: ".trabajo/central.mp4",
  palabras: ".trabajo/palabras-grande.json",
  voz: { desde: 0.0, dur: 70.5 },
  cara: { cx: 0.595, cy: 0.476, cabeza: 0.101 },
  // Pasos cortos y sólo entre vecinos: lo que Alex aceptó tras la v3 de Filipenses.
  encuadres: {
    abierto: { zoom: 1.15, nitidez: 0.5 },
    medio: { zoom: 1.30, nitidez: 0.7 },
    cerca: { zoom: 1.44, nitidez: 0.9 },
  },
  planos: [
    { hasta: 3.38, enc: "cerca", deriva: 0.05 }, // ¿Hasta cuándo? ¿Hasta cuándo te seguirás
    { hasta: 6.66, enc: "medio", deriva: -0.04 }, // distrayendo con las tantas vanidades de este mundo?
    { hasta: 10.26, enc: "cerca", deriva: 0.05 }, // ¿Hasta cuándo vas a seguir desplazando al único Dios ve…
    { hasta: 12.20, enc: "medio", deriva: -0.04 }, // al que te ama tanto, tanto, tanto,
    { hasta: 14.52, enc: "abierto", deriva: 0.04 }, // que día a día está tocando la puerta
    { hasta: 16.76, enc: "medio", deriva: -0.04 }, // de tu corazón para bendecirte,
    { hasta: 19.24, enc: "abierto", deriva: 0.04 }, // para ayudarte, para guiarte, para llenarte de
    { hasta: 22.02, enc: "medio", deriva: -0.04 }, // su sagrado e inigualable Espíritu Santo?
    { hasta: 25.24, enc: "cerca", deriva: 0.05 }, // ¿Hasta cuándo seguirás decidiendo por lo
    { hasta: 27.80, enc: "medio", deriva: -0.04 }, // temporal en lugar de lo eterno?
    { hasta: 30.22, enc: "cerca", deriva: 0.05 }, // Claramente nuestro Señor Jesucristo dijo que nosotros
    { hasta: 33.06, enc: "medio", deriva: -0.04 }, // debemos hacer tesoros en el cielo,
    { hasta: 35.74, enc: "abierto", deriva: 0.04 }, // donde no entra el ladrón, donde no cae la colilla,
    { hasta: 38.82, enc: "medio", deriva: -0.04 }, // ni nada se corrompe. Por eso yo hoy te animo,
    { hasta: 42.40, enc: "cerca", deriva: 0.05 }, // acompáñame en esta oración para que el Padre te bendiga…
    { hasta: 44.82, enc: "medio", deriva: -0.04 }, // Padre, te suplico que nos uses para tu gloria,
    { hasta: 47.54, enc: "abierto", deriva: 0.04 }, // que mantengas nuestra mirada, nuestro pensamiento,
    { hasta: 50.48, enc: "medio", deriva: -0.04 }, // nuestras emociones y todo nuestro ser en ti,
    { hasta: 53.74, enc: "cerca", deriva: 0.04 }, // que se haga tu voluntad y jamás se haga la nuestra.
    { hasta: 55.38, enc: "medio", deriva: -0.04 }, // Ten misericordia de nosotros,
    { hasta: 58.38, enc: "cerca", deriva: 0.05 }, // guíanos y úsanos eternamente para tu gloria.
    { hasta: 62.10, enc: "medio", deriva: -0.04 }, // Te lo pedimos en el sagrado y bendito nombre de nuestro…
    { hasta: 64.34, enc: "cerca", deriva: 0.05 }, // nuestro Yeshua. Amén.
    { hasta: 68.18, enc: "medio", deriva: -0.04 }, // Si tú crees que Dios te ayudará a tomar buenas decision…
    { hasta: 70.50, enc: "cerca", deriva: 0.05 }, // escribe un gran amén.
  ],
  // Reina-Valera 1909, tal cual. Entra en «tesoros en el cielo» y sale en «corrompe».
  tarjeta: {
    desde: 29.8, hasta: 36.4, tamano: 44, y: 0.10,
    lineas: ["Mas haceos tesoros en el cielo,", "donde ni polilla ni orín corrompe,", "y donde ladrones no minan ni hurtan."],
    cita: "MATEO 6:20",
  },
  doradas: /(?<![A-ZÁÉÍÓÚÑ])(DIOS|ESPÍRITU|JESUCRISTO|YESHUA|AMÉN|ETERNO|GLORIA|CIELO|PADRE)(?![A-ZÁÉÍÓÚÑ])/,
  arreglos: [
    // Whisper oyó «colilla». Es Mateo 6:20: «polilla».
    { mal: ["colilla,"], bien: ["polilla,"] },
  ],
  musica: {
    archivo: "../musica/2-trailer-inspirador.mp3",
    golpes: "../musica/2-trailer-inspirador-golpes.txt",
    volumen: 1.05, ratio: 6, umbral: 0.02, // con 0,95 la media quedaba a 28,3 dB: no se oía
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
