/**
 * Trabajo-que-desplaza — mensaje devocional para Instagram y TikTok. Exhortación con Mateo 6:33.
 *
 * NO es publicidad de la app. Plantilla: el proyecto de Filipenses 4:13.
 * Los planos son del editor «ritmo» del jurado (el único que entregó antes
 * de que se agotara la cuota): 27 planos, 2,5 s de media.
 */
export default {
  nombre: "Trabajo-que-desplaza",
  sinApp: true,
  fuente: { archivo: "C:/Windows/Fonts/ariblk.ttf", anchos: "anchos-ariblk.json", tamano: 66 },
  central: ".trabajo/central.mp4",
  palabras: ".trabajo/palabras-grande.json",
  voz: { desde: 0.0, dur: 67.4 },
  cara: { cx: 0.443, cy: 0.33, cabeza: 0.12 },
  // Pasos cortos y sólo entre vecinos: lo que Alex aceptó tras la v3 de Filipenses.
  encuadres: {
    abierto: { zoom: 1.15, nitidez: 0.5 },
    medio: { zoom: 1.30, nitidez: 0.7 },
    cerca: { zoom: 1.44, nitidez: 0.9 },
  },
  planos: [
    { hasta: 1.86, enc: "cerca", zoom: 1.6, deriva: 0.05 }, // Gancho: «Estoy estresado,» con las manos en la cabeza. Arranca en cerc
    { hasta: 3.86, enc: "medio", deriva: -0.04 }, // «¿sí? Y eso es lo que pasa»: en 2,3 s abre los brazos de par en par; e
    { hasta: 5.98, enc: "abierto", deriva: 0.04 }, // «justamente cuando por el trabajo»: se inclina a coger la carpeta marr
    { hasta: 7.72, enc: "medio", deriva: -0.04 }, // «desplazas», la palabra del título estirada 1,7 s mientras sostiene y 
    { hasta: 10.20, enc: "cerca", deriva: 0.05 }, // «al único Dios verdadero, pero cuando Dios»: primer nombre de Dios en 
    { hasta: 12.60, enc: "medio", deriva: -0.04 }, // «te da su sabiduría a través de tu»: señala con el índice al hablar de
    { hasta: 14.42, enc: "abierto", deriva: 0.03 }, // «espíritu más humilde,»: aquí Alex se ha acercado físicamente a la len
    { hasta: 17.74, enc: "medio", deriva: -0.04 }, // «ante su voluntad, el trabajo no es que lo dejas,»: la aclaración; se 
    { hasta: 19.62, enc: "cerca", deriva: 0.05 }, // «pero sí te desplazas»: el giro de la frase y otra vez el verbo del tí
    { hasta: 22.42, enc: "medio", deriva: -0.04 }, // «por lo más importante que es la palabra»: empieza a levantar la Bibli
    // Entre 23 y 25 s la cara ya está cortada EN EL ORIGINAL (se inclina a la
    // cámara con la Biblia): aquí no se acerca, se enseña el cuadro entero.
    { hasta: 25.08, enc: "abierto", zoom: 1.0, deriva: 0.03 }, // «bendita de nuestro Padre Celestial.»: la Biblia pegada a la mejilla y
    { hasta: 27.56, enc: "medio", deriva: -0.04 }, // «Así que las tantas horas»: baja el libro y se recoloca en la silla; e
    { hasta: 29.66, enc: "abierto", deriva: 0.04 }, // «que dedicas al trabajo,»: respiro tras el pico de «Padre Celestial», 
    { hasta: 32.36, enc: "medio", deriva: -0.04 }, // «dedícala primeramente a nuestro Dios Todopoderoso.»: el mandato, arra
    { hasta: 35.30, enc: "cerca", deriva: 0.05 }, // «No olvides que dice su palabra en Mateo 6:33,»: la cita se anuncia en
    { hasta: 38.00, enc: "medio", deriva: -0.04 }, // «busca primeramente el reino de Dios»: la primera mitad del versículo.
    { hasta: 41.06, enc: "abierto", deriva: 0.03 }, // «y todo lo demás viene por añadidura.»: la promesa, con sonrisa y el c
    { hasta: 43.50, enc: "medio", deriva: -0.04 }, // «¿Necesitas paz? Busca de Dios primeramente.»: primera pregunta retóri
    { hasta: 46.28, enc: "cerca", deriva: 0.05 }, // «¿Necesitas dinero? Busca de Dios primeramente.»: segunda pregunta, la
    { hasta: 48.90, enc: "medio", deriva: -0.04 }, // «¿Necesitas alimento, vestimenta, salud?»: tercera pregunta, ahora en 
    { hasta: 51.30, enc: "abierto", deriva: 0.04 }, // «Lo que sea, solamente Dios»: en 51 s abre los dos brazos con la Bibli
    { hasta: 54.26, enc: "medio", deriva: -0.04 }, // «te lo puede dar. Así que ya sabes, no puedes...»: remate de la promes
    { hasta: 56.94, enc: "cerca", deriva: 0.05 }, // «No puedes servir a dos señores, porque terminarás»: Mateo 6:24, el se
    { hasta: 59.46, enc: "medio", deriva: -0.04 }, // «desplazando a uno y amando más al otro.»: la consecuencia, con la Bib
    { hasta: 61.72, enc: "cerca", deriva: 0.05 }, // «Decide siempre amar más a nuestro»: la exhortación, mirando hacia arr
    { hasta: 64.36, enc: "medio", deriva: -0.04 }, // «perfectísimo Dios, porque Él lo es todo.»: abre el brazo hacia un lad
    { hasta: 67.40, enc: "cerca", deriva: 0.05 }, // Silencio de 1,2 s y «Alabado sea nuestro Padre.»: en el silencio baja 
  ],
  // Reina-Valera 1909, tal cual. Entra cuando nombra la cita y sale con «añadidura».
  tarjeta: {
    desde: 32.36, hasta: 41.06, tamano: 44, y: 0.05,
    lineas: ["Mas buscad primeramente el reino de Dios", "y su justicia, y todas estas cosas", "os serán añadidas."],
    cita: "MATEO 6:33",
  },
  doradas: /(?<![A-ZÁÉÍÓÚÑ])(DIOS|PADRE|MATEO|PRIMERAMENTE|REINO|PAZ|PALABRA|ALABADO|CELESTIAL|TODOPODEROSO)(?![A-ZÁÉÍÓÚÑ])/,
  arreglos: [
    { mal: ["6", ".33,"], bien: ["6:33,", ""] },
    // Whisper oyó «a Dios, señores». Es Mateo 6:24: «a dos señores» — la frase
    // sigue «desplazando a uno y amando más al otro». Confirmar con Alex.
    { mal: ["Dios,", "señores,"], bien: ["dos", "señores,"] },
  ],
  musica: {
    archivo: "../musica/2-trailer-inspirador.mp3",
    golpes: "../musica/2-trailer-inspirador-golpes.txt",
    volumen: 0.95, ratio: 6, umbral: 0.02,
    // El único tramo apretado está en 52,5 s («Así que ya sabes, no puedes…»),
    // donde baja la voz. Se baja la música ahí y no en todo el vídeo: barrido
    // con medir-audio.py, ningún agachado global llegaba a 8 dB sin enterrarla.
    bajadas: [{ desde: 51.0, hasta: 54.8, factor: 0.45 }],
  },
  cierre: {
    dur: 4.6,
    lineas: [
      { texto: "@GenuinoLove", fuente: "fuerte", color: "oro", tamano: 104, y: 0.415 },
      { texto: "Sígueme para más", fuente: "cita", color: "blanco", tamano: 58, y: 0.51 },
    ],
  },
};
