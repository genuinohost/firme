/**
 * «Debes ser fructífero» — grabado el 30 de marzo de 2026 en una avenida de
 * Caracas, montado el 21 de septiembre.
 *
 * Es el primero con el estilo medido de los dos vídeos que mandó Alex
 * (`scripts/video/estilos/`): salto de encuadre POR CORTE y sin deriva,
 * rótulos de pocas palabras sin caja y sin dorado, B-roll en bloques de
 * cuatro a seis segundos —no insertos de uno—, apertura a pantalla partida
 * con el titular quieto, y cierre sobre su cara en vez de pantalla negra.
 *
 * Medido antes de tocar nada:
 *   la cara ocupa el 16,3 % del alto (en Filipenses era el 12 %) y está en
 *   y=0,25, con mucho asfalto muerto debajo: al encuadrar se gana tamaño y
 *   se quita el suelo.
 *   la voz va 5,5 dB por encima del tráfico (ver `limpiar-audio.py`).
 */
export default {
  nombre: "Debes-ser-fructifero",
  sinApp: true,

  fuente: { archivo: "C:/Windows/Fonts/ariblk.ttf", anchos: "anchos-ariblk.json", tamano: 62 },
  central: ".trabajo/central.mp4",
  palabras: ".trabajo/palabras-original.json",

  // La voz va con la LIMPIEZA SUAVE (DeepFilterNet con tope de 20 dB), que
  // eligió Alex de oído el 21-09-2026 entre tres versiones de diez segundos.
  // Medida: el tráfico baja unos 15 dB y las 200 palabras siguen ahí. La
  // transcripción se hizo sobre el ORIGINAL, que es el que mejor entiende
  // Whisper, y los tiempos valen igual porque DeepFilterNet compensa su
  // propio retardo (`-D`); sin eso los rótulos irían unos milisegundos tarde.
  //
  // Y las dos palabras de `arreglos` las confirmó él: «contando» y
  // «desampara». Ya no son suposiciones mías.
  // La voz entera; la última palabra acaba en 65,16.
  voz: { desde: 0.0, dur: 65.8 },

  // De `encuadrar.py` sobre 70 fotogramas: la cabeza ocupa el 16,3 %.
  cara: { cx: 0.531, cy: 0.253, cabeza: 0.163 },

  // SIN `pl=1` en el colorbalance. Lo tenían los cinco vídeos anteriores y
  // rompía dos cosas: el letrero verde de la avenida se llenaba de manchas
  // grises, y la frente y el pómulo de Alex salían con parches blancos. Lo
  // vio él. Ningún número lo decía.
  // Medido con `color.py --frio=1`: el clip venía muy neutro (sol de
  // mediodía), así que la corrección es mínima y sólo añade el punto de frío
  // que le gusta y un poco de contraste.
  color: "colorcorrect=rl=0.004:rh=0.012:bl=-0.004:bh=-0.012,colorbalance=bs=0.03:bm=0.02:bh=0.02:rs=-0.02,curves=all='0/0 0.25/0.27 0.5/0.54 0.75/0.78 1/1',vibrance=intensity=0.04",

  // El estilo de los referentes: pocas palabras, más arriba, sin caja negra
  // y sin ninguna palabra en dorado. El dorado se reserva para el titular.
  // Altura 0,695 y no 0,60 como los referentes: ellos graban en estudio con
  // la cara alta en el cuadro, y aquí Alex ocupa el 23 % del alto con la
  // barbilla más baja. A 0,60 el comprobador midió el rótulo ENCIMA de su
  // cara en 11 muestras, que es la regla número uno del skill. A 0,695 queda
  // sobre el pecho y sigue lejos de los botones de Instagram.
  rotulos: { maxPalabras: 4, anchoIdeal: 560, maxAncho: 900, maxDur: 2.0, altura: 0.695, caja: false },

  // El B-roll no lleva la corrección de su piel —lo dejaba turbio—, sólo un
  // punto de contraste para que no se note el salto con sus planos.
  colorBroll: "curves=all='0/0 0.25/0.26 0.75/0.77 1/1',vibrance=intensity=0.05",

  // La apertura: él arriba, el árbol al atardecer abajo, y el titular
  // apoyado en la costura. Cuatro segundos quietos: es el gancho entero.
  // El titular es promesa suya, sacada de lo que dice en el segundo 48.
  apertura: {
    hasta: 4.06,
    // El árbol al atardecer, con la corrección de color puesta, salía naranja
    // fosforito y peleaba con la mitad de arriba. Los rayos entre los árboles
    // son oscuros y fríos: sostienen el titular en vez de gritarle.
    abajo: "../broll/fructifero/rayos-bosque.mp4",
    desdeAbajo: 2.0,
    reparto: 0.66,
    titular: ["NO TE CANSES", "EN SU TIEMPO", "VERÁS EL FRUTO"],
    colores: ["blanco", "blanco", "oro"],
    tamano: 64,
    velo: 0.2,
  },

  // Tres tamaños suyos y uno para el B-roll. El de B-roll va centrado en el
  // cuadro (cx/cy a 0,5): sin eso el motor lo encuadraría en la cara de Alex,
  // que en un plano de un árbol no está.
  encuadres: {
    abierto: { zoom: 1.22, nitidez: 0.5 },
    medio: { zoom: 1.38, nitidez: 0.7 },
    cerca: { zoom: 1.50, nitidez: 0.9 },
    broll: { zoom: 1.06, nitidez: 0.4, cx: 0.5, cy: 0.5 },
  },

  // Deriva 0 en TODOS: se salta por corte y dentro del plano la imagen está
  // quieta. Es lo que hacen los tres referentes medidos, y es la respuesta a
  // «los acercamientos son MUY BRUSCOS»: lo brusco era el movimiento.
  planos: [
    { hasta: 4.06, enc: "medio", deriva: 0 },    // PANTALLA PARTIDA · «El Todopoderoso nos capacitó»
    { hasta: 6.94, enc: "cerca", deriva: 0 },    // «lo que más anhela es que seamos fructíferos»
    { hasta: 8.40, enc: "broll", deriva: 0, broll: "../broll/fructifero/naranjas.mp4", desdeBroll: 0.6 },
    { hasta: 11.10, enc: "medio", deriva: 0 },   // «que no nos cansemos de glorificar su nombre»
    { hasta: 12.56, enc: "broll", deriva: 0, broll: "../broll/fructifero/naranjas.mp4", desdeBroll: 5.2 },
    { hasta: 14.70, enc: "cerca", deriva: 0 },   // «El Padre, que cada día»
    { hasta: 16.96, enc: "abierto", deriva: 0 }, // «siga contando con tu vida»
    { hasta: 19.88, enc: "medio", deriva: 0 },   // «que todo el mundo se entere»
    { hasta: 22.24, enc: "medio", deriva: 0 },   // «un único camino…»: aquí se acerca él a la cámara
    { hasta: 24.90, enc: "abierto", deriva: 0 }, // «que se llama Jesucristo»: su cara, no una imagen
    { hasta: 26.40, enc: "cerca", deriva: 0 },   // «Que todos puedan sentir»
    { hasta: 27.90, enc: "broll", deriva: 0, broll: "../broll/fructifero/rayos-bosque.mp4", desdeBroll: 4.6 },
    { hasta: 29.40, enc: "medio", deriva: 0 },   // «como la sal de la tierra»
    { hasta: 30.90, enc: "broll", deriva: 0, broll: "../broll/fructifero/rayos-bosque.mp4", desdeBroll: 14.0 },
    { hasta: 33.58, enc: "cerca", deriva: 0 },   // «y que por amor a su nombre»
    { hasta: 36.28, enc: "medio", deriva: 0 },   // «no nos detenemos»
    { hasta: 39.04, enc: "cerca", deriva: 0 },   // «la buena batalla de la fe»
    { hasta: 41.30, enc: "medio", deriva: 0 },   // «para la gloria de Dios»
    { hasta: 42.90, enc: "broll", deriva: 0, broll: "../broll/fructifero/silueta-sol.mp4", desdeBroll: 2.4 },
    { hasta: 45.60, enc: "cerca", deriva: 0 },   // «Así que hoy te animo, no te detengas»
    { hasta: 49.00, enc: "medio", deriva: 0 },   // «no te canses de hacer la voluntad de Dios»
    { hasta: 50.40, enc: "broll", deriva: 0, broll: "../broll/fructifero/brote.mp4", desdeBroll: 1.2 },
    { hasta: 53.20, enc: "cerca", deriva: 0 },   // «verás el fruto de extrema bendición»
    { hasta: 54.70, enc: "broll", deriva: 0, broll: "../broll/fructifero/abuelo-bebe.mp4", desdeBroll: 1.8 },
    { hasta: 56.90, enc: "medio", deriva: 0 },   // «Alabado sea nuestro Padre»
    { hasta: 58.76, enc: "abierto", deriva: 0 }, // «que nunca nos desampara»
    { hasta: 61.04, enc: "cerca", deriva: 0 },   // «Amén. Si tú crees»
    { hasta: 63.38, enc: "medio", deriva: 0 },   // «te envió para buenas obras»
    { hasta: 65.80, enc: "cerca", deriva: 0 },   // «escribe un gran amén»
  ],

  // Dos palabras que Whisper oyó mal y se corrigen POR CONTEXTO, no por oído:
  // las dos hay que confirmarlas con Alex antes de publicar.
  //   «siga juntando con tu vida»   -> «siga CONTANDO con tu vida» (0,56 de
  //      confianza, la más baja del vídeo; «juntando con» no se dice)
  //   «que nunca nos desaparezca»   -> «que nunca nos DESAMPARA» (0,73)
  arreglos: [
    { mal: ["juntando"], bien: ["contando"] },
    { mal: ["desaparezca."], bien: ["desampara."] },
  ],

  // Un solo destello, en la frase que manda el vídeo entero.
  destellos: [{ t: 41.30, color: "white", fuerza: 0.22 }],

  // Elegida entre las tres medidas: 112 ppm, plana al principio y fuerte
  // desde el segundo 30, que es justo donde el texto se pone a exhortar.
  musica: {
    archivo: "../musica/2-trailer-inspirador.mp3",
    golpes: "../musica/2-trailer-inspirador-golpes.txt",
    desde: 0,
    // Medido sobre la v1: la música quedó 32 dB por debajo de la voz, o sea
    // no se oía. La voz de la calle trae ruido constante y el agachado la
    // tenía siempre pisada. Más volumen, menos agachado y umbral más alto.
    // Dos barridos. Con la voz SUCIA hacía falta 1,9 y ratio 3 para que se
    // oyera algo (el ruido de la calle mantenía el agachado pisado). Con la
    // voz limpia las pausas quedan mudas y esa misma música se colaba en los
    // huecos: la voz llegó a ir 0,3 dB por encima. Limpiar la voz cambia la
    // mezcla entera, no sólo la voz.
    volumen: 1.05,
    umbral: 0.035,
    ratio: 5,
  },

  // Sin pantalla negra: las dos líneas van encima de sus últimos segundos.
  cierre: {
    sobreLaCara: true,
    dur: 2.6,
    lineas: [
      { texto: "@GenuinoLove", y: 0.80, tamano: 56, color: "oro" },
      { texto: "Sígueme para más", y: 0.86, tamano: 32, fuente: "cita", color: "tenue" },
    ],
  },
};
