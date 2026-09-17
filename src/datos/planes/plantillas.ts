import type { PlantillaPlan } from "./tipos";

/**
 * Los planes que la app ofrece de partida.
 *
 * Cada uno trae su propósito y su versículo: sin eso es una lista de tareas con
 * otro nombre. El tono es de aliento, nunca de acusación — quien abre esto ya
 * sabe dónde falla; lo que necesita es que alguien lo levante.
 *
 * Versículos en Reina-Valera 1909 (dominio público).
 */
export const PLANTILLAS: PlantillaPlan[] = [
  {
    plantilla: "madrugar",
    nombre: "Madrugar para orar",
    emoji: "🌄",
    categoria: "fe",
    resumen:
      "La primera hora del día, con Él. Antes del ruido, antes del teléfono, antes de todo.",
    proposito:
      "El día lo gana quien lo empieza de rodillas. Buscarlo antes de que despierte el mundo no es un mérito: es poner lo primero en su sitio, y que todo lo demás se acomode detrás.",
    versiculo:
      "Levantándose muy de mañana, siendo aún muy oscuro, salió y se fué á un lugar desierto, y allí oraba.",
    cita: "Marcos 1:35",
    horasSugeridas: [
      { etiqueta: "3:00 — la vigilia", hora: "03:00" },
      { etiqueta: "5:00 — antes del alba", hora: "05:00" },
      { etiqueta: "6:00 — al amanecer", hora: "06:00" },
    ],
    compromisos: [
      {
        clase: "bloque",
        nombre: "Oración de la madrugada",
        hora: "05:00",
        duracionMin: 45,
        dias: [0, 1, 2, 3, 4, 5, 6],
        timbre: "campana",
        avisoPrevioMin: 0,
        porque: "Antes de hablar con nadie, hablar con Dios.",
      },
    ],
    puntos: [],
  },

  {
    plantilla: "santidad",
    nombre: "Andar en santidad",
    emoji: "🕊️",
    categoria: "fe",
    resumen:
      "Un examen al acostarte. No para acusarte: para que nada se quede escondido.",
    proposito:
      "La santidad no se gana de una vez, se guarda cada día. Repasar la jornada delante de Él no es castigarte: es cerrar el día limpio y empezar el siguiente sin arrastrar nada. Donde haya fallo, hay perdón esperando.",
    versiculo:
      "Seguid la paz con todos, y la santidad, sin la cual nadie verá al Señor.",
    cita: "Hebreos 12:14",
    compromisos: [],
    puntos: [
      {
        texto: "Cuidé mi lengua: no murmuré ni llevé chismes",
        versiculo:
          "Ninguna palabra corrompida salga de vuestra boca, sino la que sea buena para edificación.",
        cita: "Efesios 4:29",
      },
      {
        texto: "Aparté la mirada a tiempo y no alimenté la lujuria",
        versiculo: "Hice pacto con mis ojos: ¿cómo pues había yo de pensar en virgen?",
        cita: "Job 31:1",
      },
      {
        texto: "Guardé mi cuerpo en pureza, lejos de toda fornicación",
        versiculo:
          "Pues la voluntad de Dios es vuestra santificación: que os apartéis de fornicación.",
        cita: "1 Tesalonicenses 4:3",
      },
      {
        texto: "Guardé limpio mi corazón, no solo mis actos",
        versiculo: "Bienaventurados los de limpio corazón: porque ellos verán á Dios.",
        cita: "Mateo 5:8",
      },
      {
        texto: "No cedí a la ira ni busqué contienda",
        versiculo:
          "Toda amargura, y enojo, é ira, y voces, y maledicencia sea quitada de vosotros.",
        cita: "Efesios 4:31",
      },
      {
        texto: "No hubo envidia ni celos en mi corazón",
        versiculo:
          "Donde hay celos y contención, allí hay perturbación y toda obra perversa.",
        cita: "Santiago 3:16",
      },
      {
        texto: "Fui sobrio: dominé mi cuerpo y mis apetitos",
        versiculo: "Antes hiero mi cuerpo, y lo pongo en servidumbre.",
        cita: "1 Corintios 9:27",
      },
      {
        texto: "Dije la verdad, sin engaño ni exageración",
        versiculo: "Desechada la mentira, hablad verdad cada uno con su prójimo.",
        cita: "Efesios 4:25",
      },
    ],
    horaExamen: "21:30",
    timbreExamen: "campana",
    // Una sola pregunta: la santidad no se mide en porcentajes.
    modoExamen: "unSoloCheck",
    // Y una caída llevada a Dios no rompe la racha.
    admiteRestauracion: true,
  },

  {
    plantilla: "lectura",
    nombre: "Lectura bíblica",
    emoji: "📖",
    categoria: "fe",
    resumen: "Un rato en la Palabra cada día. Sin prisa y sin saltarse días.",
    proposito:
      "No se trata de leer mucho, sino de no dejar de leer. Un capítulo entendido y guardado vale más que diez pasados por encima. Lo que metes cada día en el corazón es lo que sale cuando aprieta.",
    versiculo:
      "De día y de noche meditarás en él, para que guardes y hagas conforme á todo lo que en él está escrito.",
    cita: "Josué 1:8",
    horasSugeridas: [
      { etiqueta: "Al levantarte", hora: "06:00" },
      { etiqueta: "A mediodía", hora: "13:00" },
      { etiqueta: "Antes de dormir", hora: "21:00" },
    ],
    compromisos: [
      {
        clase: "bloque",
        nombre: "Lectura de la Palabra",
        hora: "06:00",
        duracionMin: 30,
        dias: [0, 1, 2, 3, 4, 5, 6],
        timbre: "campana",
        avisoPrevioMin: 0,
        porque: "Lo que leas hoy es lo que te sostendrá mañana.",
      },
    ],
    puntos: [],
  },

  {
    plantilla: "trabajo",
    nombre: "Trabajo para su gloria",
    emoji: "🛠️",
    categoria: "trabajo",
    resumen:
      "Trabajar con excelencia sin que el trabajo ocupe el lugar de Dios.",
    proposito:
      "El trabajo no es un estorbo para la fe ni un ídolo que la desplace: es la herramienta con la que sostienes tu casa, bendices a otros y respaldas la obra. Trabaja como para Él, y no dejes que te robe lo que solo Él merece.",
    versiculo:
      "Y todo lo que hagáis, hacedlo de ánimo, como al Señor, y no á los hombres.",
    cita: "Colosenses 3:23",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Trabajo profundo",
        hora: "08:30",
        duracionMin: 120,
        dias: [1, 2, 3, 4, 5],
        timbre: "pulso",
        avisoPrevioMin: 5,
        porque: "Aquí se sostiene la casa y se respalda la obra.",
      },
    ],
    puntos: [
      {
        texto: "Trabajé con honradez, sin atajos que deshonren su nombre",
        versiculo: "El peso falso abominación es á Jehová: mas la pesa cabal le agrada.",
        cita: "Proverbios 11:1",
      },
      {
        texto: "El trabajo no me robó el tiempo de Dios ni el de mi casa",
        versiculo:
          "Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.",
        cita: "Mateo 6:33",
      },
      {
        texto: "Traté bien a quien trabajó conmigo",
        versiculo:
          "Amos, haced lo que es justo y derecho con vuestros siervos, sabiendo que también vosotros tenéis amo en los cielos.",
        cita: "Colosenses 4:1",
      },
    ],
    horaExamen: "21:00",
    timbreExamen: "pulso",
  },

  {
    plantilla: "devocional",
    nombre: "Devocional diario",
    emoji: "🕯️",
    categoria: "fe",
    resumen: "Un tiempo a solas con Él, sin agenda y sin reloj mirando.",
    proposito:
      "No es lo mismo trabajar para Dios que estar con Dios. Este rato no produce nada visible, y por eso es el primero que se cae. Guárdalo: es de donde sale todo lo demás.",
    versiculo:
      "Estad en mí, y yo en vosotros. Como el pámpano no puede llevar fruto de sí mismo, si no estuviere en la vid.",
    cita: "Juan 15:4",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Devocional",
        hora: "05:45",
        duracionMin: 30,
        dias: [0, 1, 2, 3, 4, 5, 6],
        timbre: "campana",
        avisoPrevioMin: 0,
        porque: "Este rato a solas es el que sostiene todo lo demás.",
      },
    ],
    puntos: [],
  },

  {
    plantilla: "familia",
    nombre: "Sacerdote de mi casa",
    emoji: "🏡",
    categoria: "familia",
    resumen:
      "Presencia de verdad con los tuyos, y el altar familiar que nadie más va a levantar.",
    proposito:
      "Nadie va a pastorear tu casa por ti. De poco sirve ganar fuera lo que pierdes dentro. Los que viven contigo no necesitan tu éxito: necesitan tu presencia, y necesitan verte guiarlos delante de Dios.",
    versiculo: "Yo y mi casa serviremos á Jehová.",
    cita: "Josué 24:15",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Tiempo con la familia",
        hora: "19:00",
        duracionMin: 90,
        dias: [0, 1, 2, 3, 4, 5, 6],
        timbre: "campana",
        avisoPrevioMin: 10,
        porque: "Por ellos es todo esto. Que lo noten.",
      },
    ],
    puntos: [
      {
        texto: "Estuve presente de verdad, sin el teléfono en la mano",
        versiculo: "Mejor es un bocado seco, y en paz, que la casa de contienda llena de víctimas.",
        cita: "Proverbios 17:1",
      },
      {
        texto: "Hablé con mis hijos de las cosas de Dios",
        versiculo:
          "Y las repetirás á tus hijos, y hablarás de ellas estando en tu casa, y andando por el camino.",
        cita: "Deuteronomio 6:7",
      },
    ],
    horaExamen: "21:45",
    timbreExamen: "campana",
  },

  {
    plantilla: "dominio",
    nombre: "Dominio propio",
    emoji: "💪",
    categoria: "cuerpo",
    resumen: "El cuerpo como siervo y no como amo: ejercicio, comida y descanso.",
    proposito:
      "Tu cuerpo no es tuyo, es prestado, y es el único que tendrás para servir. Lo que hoy le niegas por disciplina te lo devolverá mañana en fuerza. No lo obedezcas: gobiérnalo.",
    versiculo:
      "¿O ignoráis que vuestro cuerpo es templo del Espíritu Santo, el cual está en vosotros?",
    cita: "1 Corintios 6:19",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Ejercicio",
        hora: "06:30",
        duracionMin: 45,
        dias: [1, 2, 3, 4, 5, 6],
        timbre: "diana",
        avisoPrevioMin: 5,
        porque: "Un cuerpo fuerte sostiene todo lo demás.",
      },
    ],
    puntos: [
      {
        texto: "Comí con medida, sin darle al cuerpo lo que pedía de más",
        versiculo: "Porque el bebedor y el comilón empobrecerán.",
        cita: "Proverbios 23:21",
      },
      {
        texto: "Me acosté a la hora que decidí, no a la que me arrastró la noche",
        versiculo: "En paz me acostaré, y asimismo dormiré.",
        cita: "Salmos 4:8",
      },
    ],
    horaExamen: "22:00",
    timbreExamen: "pulso",
  },

  {
    plantilla: "gratitud",
    nombre: "Cuenta sus beneficios",
    emoji: "🙌",
    categoria: "fe",
    resumen: "Nombrar cada noche lo que Él hizo. La queja no sobrevive a esto.",
    proposito:
      "La memoria corta es la raíz de la queja. Un hombre que cuenta lo que recibió deja de pelearse con lo que le falta. Esto no cambia tus circunstancias: te cambia a ti dentro de ellas.",
    versiculo: "Bendice, alma mía, á Jehová, y no olvides ninguno de sus beneficios.",
    cita: "Salmos 103:2",
    compromisos: [],
    puntos: [
      {
        texto: "Nombré delante de Él tres cosas por las que dar gracias",
        versiculo:
          "Dad gracias en todo; porque esta es la voluntad de Dios para con vosotros en Cristo Jesús.",
        cita: "1 Tesalonicenses 5:18",
      },
      {
        texto: "No pasé el día quejándome de lo que no tengo",
        versiculo: "Haced todo sin murmuraciones, y contiendas.",
        cita: "Filipenses 2:14",
      },
    ],
    horaExamen: "21:30",
    timbreExamen: "campana",
  },

  {
    plantilla: "servicio",
    nombre: "Hacer bien cada día",
    emoji: "🤲",
    categoria: "familia",
    resumen: "Buscar cada día a alguien a quien servir, sin que se entere nadie más.",
    proposito:
      "La fe que no se toca no se ve. No hace falta algo grande: una llamada, una ayuda, un billete que no te sobra. Busca a quien lo necesite antes de que el día se te acabe.",
    versiculo:
      "No detengas el bien de sus dueños, cuando tuvieres poder para hacerlo.",
    cita: "Proverbios 3:27",
    compromisos: [],
    puntos: [
      {
        texto: "Hice bien a alguien hoy, sin buscar que se notara",
        versiculo:
          "Mira que no hagas vuestra justicia delante de los hombres, para ser vistos de ellos.",
        cita: "Mateo 6:1",
      },
      {
        texto: "Animé a un hermano que lo necesitaba",
        versiculo: "Consolaos los unos á los otros, y edificaos los unos á los otros.",
        cita: "1 Tesalonicenses 5:11",
      },
    ],
    horaExamen: "21:00",
    timbreExamen: "campana",
  },

  {
    plantilla: "estudio",
    nombre: "Estudio y formación",
    emoji: "🎓",
    categoria: "mente",
    resumen: "Prepararte para servir mejor. Un rato fijo de estudio cada día.",
    proposito:
      "Dios usa manos dispuestas, pero también cabezas preparadas. Estudiar no es vanidad cuando lo que aprendes vuelve en servicio. Ponte a punto para lo que Él quiera confiarte.",
    versiculo:
      "Procura con diligencia presentarte á Dios aprobado, como obrero que no tiene de qué avergonzarse.",
    cita: "2 Timoteo 2:15",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Estudio",
        hora: "20:00",
        duracionMin: 60,
        dias: [1, 2, 3, 4, 5],
        timbre: "pulso",
        avisoPrevioMin: 5,
        porque: "Prepararme hoy es poder servir mejor mañana.",
      },
    ],
    puntos: [],
  },

  {
    plantilla: "testimonio",
    nombre: "Testimonio y evangelismo",
    emoji: "🔦",
    categoria: "fe",
    resumen: "Que tu vida hable, y que tu boca no calle cuando toque.",
    proposito:
      "No hace falta predicar en la calle todos los días, pero sí que quien te trate note algo distinto. Y cuando pregunten, tener la respuesta lista y darla con mansedumbre.",
    versiculo:
      "Así alumbre vuestra luz delante de los hombres, para que vean vuestras obras buenas.",
    cita: "Mateo 5:16",
    compromisos: [],
    puntos: [
      {
        texto: "Mi manera de tratar a la gente habló bien de Él",
        versiculo: "Por sus frutos los conoceréis.",
        cita: "Mateo 7:20",
      },
      {
        texto: "No me callé por vergüenza cuando debía hablar",
        versiculo: "Porque no me avergüenzo del evangelio: porque es potencia de Dios para salud.",
        cita: "Romanos 1:16",
      },
    ],
    horaExamen: "21:15",
    timbreExamen: "campana",
  },

  {
    plantilla: "ayuno",
    nombre: "Ayuno y oración",
    emoji: "🍃",
    categoria: "fe",
    resumen: "Días señalados para apartarte, con aviso la víspera.",
    proposito:
      "Hay cosas que solo se mueven así. Ayunar no es hacer huelga de hambre: es cambiar el apetito del cuerpo por hambre de Él durante unas horas. Elige los días y cúmplelos.",
    versiculo:
      "Cuando ayunáis, no seáis como los hipócritas, austeros; unge tu cabeza y lava tu rostro.",
    cita: "Mateo 6:16-17",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Día de ayuno",
        hora: "06:00",
        duracionMin: 30,
        dias: [3],
        timbre: "campana",
        avisoPrevioMin: 0,
        porque: "Hoy el hambre me recuerda de quién dependo.",
      },
    ],
    puntos: [],
  },

  {
    plantilla: "descanso",
    nombre: "Guardar el descanso",
    emoji: "🌙",
    categoria: "descanso",
    resumen: "Un día apartado, y apagar a tiempo el resto de la semana.",
    proposito:
      "El que no para no confía: cree que todo depende de él. Descansar es un acto de fe, una manera de decir que el mundo sigue girando sin tus manos porque nunca dependió de ellas.",
    versiculo: "Acuérdate del día del reposo, para santificarlo.",
    cita: "Éxodo 20:8",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Apagar pantallas",
        hora: "22:00",
        duracionMin: 15,
        dias: [0, 1, 2, 3, 4, 5, 6],
        timbre: "campana",
        avisoPrevioMin: 0,
        porque: "El día de mañana empieza esta noche.",
      },
    ],
    puntos: [],
  },

  {
    plantilla: "generosidad",
    nombre: "Generosidad y ofrenda",
    emoji: "🎁",
    categoria: "trabajo",
    resumen: "Dar con orden y con alegría, no con lo que sobra.",
    proposito:
      "Lo que retienes con miedo se pudre; lo que sueltas con fe vuelve multiplicado. Decide de antemano lo que vas a dar, para que no lo decida tu ánimo del momento.",
    versiculo:
      "Cada uno como propuso en su corazón: no con tristeza, ó por necesidad; porque Dios ama el dador alegre.",
    cita: "2 Corintios 9:7",
    compromisos: [],
    puntos: [
      {
        texto: "Di lo que me propuse dar, sin regatear conmigo mismo",
        versiculo: "Hay quienes reparten, y les es añadido más.",
        cita: "Proverbios 11:24",
      },
    ],
    horaExamen: "21:00",
    timbreExamen: "campana",
  },

  {
    plantilla: "intercesion",
    nombre: "Interceder por nombre",
    emoji: "🙏",
    categoria: "fe",
    resumen: "Orar por personas concretas, con su nombre, todos los días.",
    proposito:
      "Orar «por todos» no es orar por nadie. Interceder es ponerse en medio con nombres puestos: tu casa, el hermano que flaquea, el que te hizo mal. Lo que más cambia a un hombre no es lo que pide para sí, sino lo que carga por otro.",
    versiculo:
      "Confesaos vuestras faltas unos á otros, y rogad los unos por los otros, para que seáis sanos.",
    cita: "Santiago 5:16",
    horasSugeridas: [
      { etiqueta: "5:00 — con la madrugada", hora: "05:00" },
      { etiqueta: "12:00 — a mediodía", hora: "12:00" },
      { etiqueta: "21:00 — antes de dormir", hora: "21:00" },
    ],
    compromisos: [
      {
        clase: "bloque",
        nombre: "Interceder por los míos",
        hora: "21:00",
        duracionMin: 20,
        dias: [0, 1, 2, 3, 4, 5, 6],
        timbre: "campana",
        avisoPrevioMin: 0,
        porque: "Hay nombres que sólo tú vas a llevar hoy delante de Dios.",
      },
    ],
    puntos: [
      {
        texto: "Oré por mi casa, uno por uno y por su nombre",
        versiculo: "Yo y mi casa serviremos á Jehová.",
        cita: "Josué 24:15",
      },
      {
        texto: "Oré por alguien que está lejos o pasando necesidad",
        versiculo: "Sobrellevad los unos las cargas de los otros.",
        cita: "Gálatas 6:2",
      },
      {
        texto: "Oré por alguien que me hizo mal, sin rencor",
        versiculo: "Orad por los que os ultrajan y os persiguen.",
        cita: "Mateo 5:44",
      },
    ],
    horaExamen: "21:30",
    timbreExamen: "campana",
  },

  {
    plantilla: "ojos",
    nombre: "Guardar los ojos",
    emoji: "👁️",
    categoria: "fe",
    resumen:
      "La batalla del teléfono y de la mirada. La que nadie ve, y la que decide el resto.",
    proposito:
      "Nadie cae de golpe: cae en lo que mira cuando está solo. Es la pelea más callada que hay y la que más hombres está tumbando. Y aquí una caída confesada no te aparta, porque lo que rompe la comunión no es tropezar: es quedarse en el suelo.",
    versiculo: "Hice pacto con mis ojos: ¿cómo pues había yo de pensar en virgen?",
    cita: "Job 31:1",
    compromisos: [],
    puntos: [
      {
        texto: "Aparté la mirada a tiempo, sin negociar conmigo mismo",
        versiculo: "Aparta mis ojos, que no vean la vanidad; avívame en tu camino.",
        cita: "Salmos 119:37",
      },
      {
        texto: "No busqué a solas lo que me avergonzaría enseñar",
        versiculo: "No pondré delante de mis ojos cosa injusta.",
        cita: "Salmos 101:3",
      },
      {
        texto: "El teléfono estuvo en su sitio: no me llevó él a mí",
        versiculo: "Todo me es lícito, mas yo no me meteré debajo de potestad de nada.",
        cita: "1 Corintios 6:12",
      },
      {
        texto: "Cuando vino la tentación, corrí en vez de razonar",
        versiculo: "Huid la fornicación.",
        cita: "1 Corintios 6:18",
      },
    ],
    horaExamen: "22:00",
    timbreExamen: "campana",
    // Una sola pregunta, como en santidad: esto no se mide en porcentajes.
    modoExamen: "unSoloCheck",
    // Y una caída llevada a Dios no rompe la racha. Aquí importa más que en
    // ningún otro plan: quien cae en esto ya llega cargando vergüenza, y una
    // racha que se pone a cero por ser sincero enseña justo lo contrario de lo
    // que hay que enseñar — enseña a esconderlo.
    admiteRestauracion: true,
  },

  {
    plantilla: "memorizar",
    nombre: "Grabar la Palabra",
    emoji: "📗",
    categoria: "mente",
    resumen: "Un versículo por semana, repasado cada día hasta que sea tuyo.",
    proposito:
      "Lo que sabes de memoria es lo único que vas a tener cuando no puedas abrir el libro: en la madrugada, en la prueba, en la tentación. Leer alimenta; memorizar arma.",
    versiculo: "En mi corazón he guardado tus dichos, para no pecar contra ti.",
    cita: "Salmos 119:11",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Repasar el versículo de la semana",
        hora: "07:00",
        duracionMin: 10,
        dias: [0, 1, 2, 3, 4, 5, 6],
        timbre: "pulso",
        avisoPrevioMin: 0,
        porque: "Diez minutos hoy, y lo tendrás dentro el resto de tu vida.",
      },
    ],
    puntos: [
      {
        texto: "Repetí el versículo de esta semana sin mirarlo",
        versiculo: "Este libro de la ley nunca se apartará de tu boca.",
        cita: "Josué 1:8",
      },
      {
        texto: "Lo usé hoy: para mí, o para alguien que lo necesitaba",
        versiculo: "La palabra de Cristo more en vosotros en abundancia.",
        cita: "Colosenses 3:16",
      },
    ],
    horaExamen: "21:30",
    timbreExamen: "pulso",
  },

  {
    plantilla: "esposa",
    nombre: "Honrar a mi esposa",
    emoji: "💍",
    categoria: "familia",
    resumen: "Lo que se cuida cada día no hay que rescatarlo después.",
    proposito:
      "Un matrimonio no se rompe de golpe: se enfría en los detalles que se dejaron de hacer. Esto no es romanticismo, es obediencia — y tu oración depende de ello más de lo que parece.",
    versiculo:
      "Vosotros maridos, habitad con ellas según ciencia, dando honor á la mujer, para que vuestras oraciones no sean impedidas.",
    cita: "1 Pedro 3:7",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Orar juntos",
        hora: "21:00",
        duracionMin: 15,
        dias: [0, 1, 2, 3, 4, 5, 6],
        timbre: "campana",
        avisoPrevioMin: 5,
        porque: "El matrimonio que ora junto no se deshace en silencio.",
      },
    ],
    puntos: [
      {
        texto: "La escuché de verdad, sin el teléfono en la mano",
        versiculo: "Todo hombre sea pronto para oir, tardío para hablar.",
        cita: "Santiago 1:19",
      },
      {
        texto: "Le hablé con dulzura, aunque estuviera cansado",
        versiculo: "Maridos, amad á vuestras mujeres, y no seáis desapacibles con ellas.",
        cita: "Colosenses 3:19",
      },
      {
        texto: "Hice algo por ella que nadie más vio",
        versiculo: "El amor es sufrido, es benigno; no busca lo suyo.",
        cita: "1 Corintios 13:4",
      },
      {
        texto: "No dejé el día cerrado en enojo",
        versiculo: "No se ponga el sol sobre vuestro enojo.",
        cita: "Efesios 4:26",
      },
    ],
    horaExamen: "22:00",
    timbreExamen: "campana",
  },

  {
    plantilla: "perdonar",
    nombre: "Perdonar de corazón",
    emoji: "🕊️",
    categoria: "fe",
    resumen: "Soltar lo que llevas cargando. Pesa más de lo que crees.",
    proposito:
      "El rencor se guarda creyendo que castiga al otro, y al final sólo te pudre a ti. Perdonar no es decir que no dolió: es soltarlo de tus manos y dejarlo en las de Dios, que sabe juzgar mejor que tú.",
    versiculo:
      "Antes sed los unos con los otros benignos, misericordiosos, perdonándoos los unos á los otros, como también Dios os perdonó en Cristo.",
    cita: "Efesios 4:32",
    compromisos: [],
    puntos: [
      {
        texto: "No alimenté el recuerdo de lo que me hicieron",
        versiculo: "No os venguéis vosotros mismos, amados míos.",
        cita: "Romanos 12:19",
      },
      {
        texto: "Hablé bien —o callé— de quien me hizo daño",
        versiculo: "No seas vencido de lo malo; mas vence con el bien el mal.",
        cita: "Romanos 12:21",
      },
      {
        texto: "Pedí perdón donde yo fui el que falló",
        versiculo: "Ve, reconcíliate primero con tu hermano.",
        cita: "Mateo 5:24",
      },
    ],
    horaExamen: "21:30",
    timbreExamen: "pulso",
    // Perdonar no se consigue de una vez, y esta racha no puede castigar al que
    // un día vuelve a sentir el golpe. Se cae, y se vuelve a soltar.
    admiteRestauracion: true,
  },

  {
    plantilla: "dinero",
    nombre: "Poner orden en el dinero",
    emoji: "🧾",
    categoria: "trabajo",
    resumen: "Cuentas claras, deudas pagadas y nada debiéndole a nadie.",
    proposito:
      "El dinero desordenado roba paz, roba sueño y roba testimonio. Administrar lo poco con fidelidad no es tacañería: es lo que Dios mira antes de confiar lo mucho.",
    versiculo: "El que es fiel en lo muy poco, también en lo más es fiel.",
    cita: "Lucas 16:10",
    compromisos: [
      {
        clase: "bloque",
        nombre: "Repasar las cuentas",
        hora: "20:00",
        duracionMin: 15,
        dias: [0],
        timbre: "pulso",
        avisoPrevioMin: 0,
        porque: "Quince minutos a la semana valen más que preocuparse siete días.",
      },
    ],
    puntos: [
      {
        texto: "Apunté lo que gasté, sin maquillarlo",
        versiculo: "Considera atentamente el aspecto de tus ovejas.",
        cita: "Proverbios 27:23",
      },
      {
        texto: "Cumplí lo que prometí pagar",
        versiculo: "No debáis á nadie nada, sino amaros unos á otros.",
        cita: "Romanos 13:8",
      },
      {
        texto: "No compré por ansiedad ni por compararme",
        versiculo: "Sean vuestras costumbres sin avaricia; contentos de lo presente.",
        cita: "Hebreos 13:5",
      },
      {
        texto: "Aparté lo de Dios antes que lo mío",
        versiculo:
          "Honra á Jehová de tu sustancia, y de las primicias de todos tus frutos.",
        cita: "Proverbios 3:9",
      },
    ],
    horaExamen: "21:30",
    timbreExamen: "pulso",
  },

  {
    plantilla: "personalizado",
    nombre: "Plan propio",
    emoji: "✍️",
    categoria: "mente",
    resumen: "El tuyo, desde cero. Ponle nombre, propósito, horas y tus propios puntos.",
    proposito:
      "Escribe aquí por qué haces esto. Cuando llegue el día en que no tengas ganas, esto es lo único que vas a leer.",
    versiculo: "Todo lo que te viniere á la mano para hacer, hazlo según tus fuerzas.",
    cita: "Eclesiastés 9:10",
    compromisos: [],
    puntos: [],
  },
];

export function plantillaPorId(id: string): PlantillaPlan | undefined {
  return PLANTILLAS.find((p) => p.plantilla === id);
}
