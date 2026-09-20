/**
 * Filipenses 4:13 — mensaje devocional para Instagram y TikTok.
 *
 * NO es publicidad de la app: aquí no hay capturas, ni tarjeta de la app, ni
 * llamada a descargar. Cierra con la marca de la comunidad y la invitación a
 * seguir. `sinApp` hace que `comprobar.mjs` falle si un rótulo la nombra.
 *
 * Todo lo que hay aquí sale de medir el clip (`encuadrar.py`, `musica.py`,
 * la transcripción con `large-v3`) o de decisiones de Alex (la palabra del
 * segundo 26, la música). Los planos son el plan del jurado de tres editores
 * —ritmo, sentido, emoción— sintetizado por un juez, 19-09-2026: 35 planos,
 * 2,2 s de media, sin repetir nunca encuadre ni signo de deriva.
 */
export default {
  nombre: "Filipenses-4-13",
  sinApp: true,

  // Elegida por Alex el 19-09-2026 entre cuatro renderizadas sobre un
  // fotograma real: Arial Black, la más gruesa. Es más ancha que Segoe, así
  // que baja el tamaño para que los mismos rótulos sigan cabiendo (897 px el
  // más ancho, medido con su tabla).
  fuente: { archivo: "C:/Windows/Fonts/ariblk.ttf", anchos: "anchos-ariblk.json", tamano: 66 },
  central: ".trabajo/central.mp4",
  palabras: ".trabajo/palabras-grande.json",

  // La voz empieza en el segundo 0 y la última palabra acaba en 76,34. Se
  // deja un respiro de un tercio de segundo antes del cierre. La cola del
  // clip (baja los brazos y sale por la izquierda) se descarta.
  voz: { desde: 0.0, dur: 76.7 },

  // Centro de reserva, medido con el detector de rostros sobre 60 fotogramas.
  // El motor usa la pista por plano (`.trabajo/cara.json`) si existe: Alex
  // entra caminando y está en x=0,50 hasta el segundo 17 y en 0,64 después.
  cara: { cx: 0.641, cy: 0.334, cabeza: 0.102 },

  // La cabeza ocupa el 10 % del alto. A 1,6 llega al 16 % y sigue nítida; a
  // partir de 1,75 se ablanda (comprobado con recortes a 1,55 / 1,75 / 2,0).
  // Por eso «cerca» parte de 1,52: con la deriva de ±0,08 nunca pasa de 1,6.
  // Alex, sobre la v3: «los acercamientos son MUY BRUSCOS». Dos causas: el
  // salto entre encuadres era grande (1,12 → 1,52 de un corte) y la deriva
  // rápida. Ahora los pasos son cortos, entre planos seguidos sólo se cambia
  // al encuadre VECINO (abierto↔medio, medio↔cerca, nunca abierto↔cerca) y la
  // deriva baja a la mitad.
  encuadres: {
    abierto: { zoom: 1.18, nitidez: 0.5 },
    medio: { zoom: 1.32, nitidez: 0.7 },
    cerca: { zoom: 1.46, nitidez: 0.9 },
  },

  // `hasta` es donde ACABA cada plano; el motor lo lleva al golpe más cercano
  // y luego al cuadro. Los comentarios son del juez.
  planos: [
    // El gancho lleva su propio zoom: Alex está aún lejos y entrando.
    { hasta: 1.56, enc: "cerca", zoom: 1.62, deriva: 0.03 }, // «Y tú, sí, tú,» con el dedo a cámara
    { hasta: 3.64, enc: "medio", deriva: -0.04 },   // «¿hasta cuándo seguirás dudando?»
    { hasta: 5.56, enc: "cerca", deriva: 0.04 },    // pregunta 2
    { hasta: 7.80, enc: "medio", deriva: -0.04 },   // «que el Padre ha dicho…»
    { hasta: 10.20, enc: "cerca", deriva: 0.04 },   // «imposible, para Él es posible?»
    { hasta: 12.52, enc: "medio", deriva: -0.04 },  // pregunta 3
    { hasta: 14.22, enc: "abierto", deriva: 0.04 }, // «Filipenses 4:13»: se abre para la tarjeta
    { hasta: 16.10, enc: "medio", deriva: -0.04 },  // «donde se te dice claramente»
    { hasta: 17.92, enc: "abierto", deriva: 0.04 }, // «todo lo puedes en»: entra la tarjeta
    { hasta: 19.74, enc: "medio", deriva: -0.04 },  // «Cristo que te fortalece?»
    { hasta: 21.02, enc: "cerca", deriva: 0.03 },   // «Eso sí,» + la pausa (antes iba el amanecer)
    { hasta: 23.38, enc: "medio", deriva: -0.04 },  // «mantente en Él, fortalécete en Él,»
    { hasta: 25.76, enc: "cerca", deriva: 0.04 },   // «llénate de Él, olvídate del mundo,»
    { hasta: 27.60, enc: "medio", deriva: -0.04 },  // «vacíate de las vanidades y»
    { hasta: 29.46, enc: "abierto", deriva: 0.04 }, // «procura cada día seguir»
    { hasta: 31.44, enc: "medio", deriva: -0.04 },  // «buscándole a Él primeramente.»
    { hasta: 33.82, enc: "cerca", deriva: 0.05 },   // EL GIRO «Ahí está la clave, ahí está el poder,»
    { hasta: 35.94, enc: "medio", deriva: -0.04 },  // «ahí está el Espíritu Santo»
    { hasta: 37.62, enc: "abierto", deriva: 0.04 }, // «manifestará con obras»
    { hasta: 39.74, enc: "medio", deriva: -0.04 },  // «sobrenaturales a través de tu vida»
    { hasta: 41.44, enc: "cerca", deriva: 0.04 },   // «y comprenderás que»
    { hasta: 44.62, enc: "medio", deriva: -0.03 },  // la condición entera, 3,2 s a propósito
    { hasta: 46.78, enc: "cerca", deriva: 0.05 },   // LA PROMESA «nada es imposible,»
    { hasta: 49.02, enc: "medio", deriva: -0.04 },  // «porque gracias a Cristo Jesús,» + pausa
    { hasta: 51.66, enc: "abierto", deriva: 0.04 }, // «nuestro Yeshua, ahora tenemos el poder»
    { hasta: 53.98, enc: "medio", deriva: -0.04 },  // «ilimitado del Espíritu Santo.»
    { hasta: 56.38, enc: "cerca", deriva: 0.04 },   // «Así que hoy te animo, sigue buscándole»
    { hasta: 58.44, enc: "medio", deriva: -0.04 },  // «con toda tu vida. Con toda tu mente…»
    { hasta: 61.80, enc: "abierto", deriva: 0.04 }, // cierre de la lista, brazos abriéndose
    { hasta: 63.24, enc: "medio", deriva: -0.03 },  // «cuando buscamos a Dios» (antes iba el amanecer)
    { hasta: 65.66, enc: "cerca", deriva: 0.04 },   // «con todo lo que Él nos ha dado,»: mirada al cielo
    { hasta: 68.44, enc: "medio", deriva: -0.04 },  // «con toda la vida entera…»: brazos anchos
    { hasta: 71.32, enc: "cerca", deriva: 0.04 },   // «no hay límites, todo lo podemos hacer»
    { hasta: 73.90, enc: "medio", deriva: -0.04 },  // «siempre para su gloria.»: dedo al cielo
    { hasta: 76.70, enc: "cerca", deriva: 0.04 },   // «Así que no te detengas.»: espejo del gancho
  ],

  // La cita entra en «todo» (16,10), justo cuando empieza a citar, y sale con
  // el corte al amanecer. Reina-Valera 1909, de dominio público: «puedo… me
  // fortalece», mientras Alex dice «puedes… te fortalece»; es normal.
  tarjeta: {
    desde: 16.1,
    hasta: 19.74,
    lineas: ["Todo lo puedo en Cristo", "que me fortalece."],
    cita: "FILIPENSES 4:13",
    tamano: 54,
    y: 0.13,
  },

  // Diez palabras, por palabra ENTERA: POSIBLE no enciende «imposible» y NADA
  // sólo enciende «nada es imposible». Más diluiría el dorado.
  doradas: /(?<![A-ZÁÉÍÓÚÑ])(FILIPENSES|POSIBLE|NADA|ESPÍRITU|CRISTO|YESHUA|ILIMITADO|LÍMITES|GLORIA|DETENGAS)(?![A-ZÁÉÍÓÚÑ])/,

  // Lo que Whisper escribió mal. Respeta el número de palabras: "" no se pinta.
  arreglos: [
    { mal: ["4", ".13,"], bien: ["4:13,", ""] },
    // Whisper oyó «cualidades». Alex confirmó el 19-09-2026: «vanidades».
    { mal: ["cualidades"], bien: ["vanidades"] },
  ],

  // Elegida por Alex el 19-09-2026 entre las tres medidas con `musica.py`:
  // 112 ppm, plana al principio y fuerte desde el segundo 30. Sus golpes se
  // apartan de una rejilla fija ~108 ms, por eso el motor corta sobre los
  // golpes detectados y no sobre `k × pulso`.
  // Barrido con `medir-audio.py` sobre la v1 (voz sobre música, media / peor /
  // tramos apretados): 1,5 y 4:1 → 20,4 / 5,0 / 8 ✗ · 1,1 y 4:1 → 23,1 / 7,7 / 1
  // · **1,1 y 6:1 → 26,1 / 10,0 / 0** ✓ · 0,9 y 6:1 → 27,8 / 11,8 / 0.
  musica: {
    archivo: "../musica/2-trailer-inspirador.mp3",
    golpes: "../musica/2-trailer-inspirador-golpes.txt",
    volumen: 1.1,
    ratio: 6,
    umbral: 0.02,
  },

  cierre: {
    dur: 4.6,
    lineas: [
      // Alex: «el GENUINO LOVE al final está duplicado». Se queda sólo el
      // usuario, que es lo que hay que escribir para encontrarle.
      { texto: "@GenuinoLove", fuente: "fuerte", color: "oro", tamano: 104, y: 0.415 },
      { texto: "Sígueme para más", fuente: "cita", color: "blanco", tamano: 58, y: 0.51 },
    ],
  },
};
