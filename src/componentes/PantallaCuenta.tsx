import { useEffect, useMemo, useState } from "react";
import { PAISES, paisDe } from "@/datos/paises";
import { abrirEnlace } from "@/logica/enlaces";
import {
  aceptarAmistad,
  borrarCuenta,
  buscarHermanos,
  comoFallo,
  entrarConGoogle,
  guardarPerfil,
  leerPerfil,
  limpiarUsuario,
  listarAmigos,
  pedirAmistad,
  quitarAmistad,
  salir,
  usuarioValido,
  leerWhatsapp,
  guardarWhatsapp,
  enlaceWhatsapp,
  publicarCifras,
  vigilarSesion,
  type Amigo,
  type Perfil,
  type Sesion,
} from "@/logica/nube";
import { Boton, Campo, Entrada, Etiqueta, Selector, Tarjeta, Vacio } from "./piezas";

/**
 * La cuenta: entrar, el perfil y los amigos.
 *
 * Alex la pidió «muy elegante, estilo YouVersion». Elegante aquí no es adorno:
 * es que quepa de un vistazo quién eres, desde cuándo andas en esto y qué
 * llevas por delante — y que no haya ni una cifra puesta para que nadie se mida
 * con nadie.
 *
 * **Lo que no está aquí también es una decisión.** No hay tabla de rachas de
 * los amigos, ni «quién va ganando», ni insignias. La constancia anima; la
 * comparación hunde, y en una app de disciplina cristiana convertir la
 * fidelidad en un marcador la volvería un escaparate — justo lo contrario de
 * para lo que se hizo.
 */
export function PantallaCuenta({
  racha,
  diasEnPie,
  totalCumplidos,
}: {
  racha: number;
  diasEnPie: number;
  totalCumplidos: number;
}) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  /**
   * Sube uno cada vez que se entra, para volver a enganchar el vigilante.
   *
   * Hace falta por cómo se carga Firebase en diferido: el vigilante **no se
   * engancha si en este móvil nunca se había entrado**, que es justo el caso de
   * quien se registra por primera vez. Sin esto, la sesión se creaba de verdad
   * pero nadie se lo contaba a la pantalla.
   */
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let soltar: (() => void) | null = null;
    let vivo = true;
    void vigilarSesion((s) => {
      if (!vivo) return;
      setSesion(s);
      setCargando(false);
    }).then((f) => {
      if (vivo) soltar = f;
      else f();
    });
    return () => {
      vivo = false;
      soltar?.();
    };
  }, [intento]);

  // El perfil se lee cuando hay sesión, y se vuelve a leer si cambia de cuenta.
  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      return;
    }
    let vivo = true;
    void leerPerfil(sesion.uid)
      .then((p) => {
        if (!vivo) return;
        setPerfil(p);
        if (!p) setEditando(true); // sin perfil, lo primero es hacerlo
      })
      .catch((e) => vivo && setError(comoFallo(e)));
    return () => {
      vivo = false;
    };
  }, [sesion]);

  /**
   * Entrar, y **enseñarlo en el momento**.
   *
   * Aquí sólo se llamaba a `entrarConGoogle()` y se confiaba en que el
   * vigilante avisara. Para quien ya había entrado alguna vez en ese móvil
   * funcionaba; **para quien se registraba por primera vez, no**: el vigilante
   * ni siquiera estaba enganchado, porque no se engancha hasta que consta que
   * hubo una sesión.
   *
   * El resultado era desconcertante: la cuenta se creaba de verdad, pero la
   * pantalla seguía pidiendo entrar. Había que dar atrás y volver — y entonces
   * aparecía el perfil ya hecho. Le pasó a Alex y le pasó a José, el primer
   * amigo que probó la app.
   *
   * Ahora se usa lo que devuelve la propia llamada, y además se vuelve a
   * enganchar el vigilante para que la salida siga avisando.
   */
  /**
   * Sube las cifras del teléfono, o las retira si ya no se quieren enseñar.
   *
   * **Las cifras viven en el teléfono**; esto sólo publica una copia para que
   * un hermano pueda animarte. Se hace al abrir la pantalla de la cuenta y no
   * a cada cambio: escribir en el servidor cada vez que se marca un bloque
   * sería gastar la cuota de todos para que nadie lo note.
   */
  useEffect(() => {
    if (!perfil) return;
    let vivo = true;
    const mostrar = perfil.muestraRachas !== false;
    const cambiaron =
      perfil.racha !== racha ||
      perfil.diasEnPie !== diasEnPie ||
      perfil.cumplidos !== totalCumplidos;
    // Si están apagadas y ya no hay nada publicado, no hay nada que hacer.
    if (!cambiaron && (mostrar || perfil.racha === undefined)) return;
    void publicarCifras(perfil.uid, { racha, diasEnPie, cumplidos: totalCumplidos }, mostrar)
      .then(() => {
        if (vivo && mostrar) {
          setPerfil((p) =>
            p ? { ...p, racha, diasEnPie, cumplidos: totalCumplidos } : p,
          );
        }
      })
      .catch(() => {
        // Que no se puedan publicar no debe romper la pantalla: son un adorno
        // para otros, no algo que el dueño necesite.
      });
    return () => {
      vivo = false;
    };
  }, [perfil, racha, diasEnPie, totalCumplidos]);

  const entrar = async () => {
    setError("");
    try {
      const nueva = await entrarConGoogle();
      setSesion(nueva);
      setIntento((n) => n + 1);
    } catch (e) {
      const m = comoFallo(e);
      if (m) setError(m);
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <Cabecera />
        <Vacio>Un momento…</Vacio>
      </div>
    );
  }

  if (!sesion) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <Cabecera />
        <Invitacion onEntrar={entrar} />
        {error ? <Aviso>{error}</Aviso> : null}
      </div>
    );
  }

  if (editando || !perfil) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <Cabecera />
        <EditorDePerfil
          sesion={sesion}
          perfil={perfil}
          onGuardado={(p) => {
            setPerfil(p);
            setEditando(false);
          }}
          onDejarlo={perfil ? () => setEditando(false) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <Cabecera />
      <FichaDePerfil
        perfil={perfil}
        racha={racha}
        diasEnPie={diasEnPie}
        totalCumplidos={totalCumplidos}
        onEditar={() => setEditando(true)}
      />
      <Amigos yo={perfil} />
      <Cierre perfil={perfil} onFuera={() => setPerfil(null)} />
      {error ? <Aviso>{error}</Aviso> : null}
    </div>
  );
}

function Cabecera() {
  return (
    <header className="pt-2">
      <h1 className="text-xl font-semibold">Mi cuenta</h1>
      <p className="mt-1 text-sm leading-relaxed text-tenue">
        Para que los hermanos te encuentren y caminen contigo.
      </p>
    </header>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-fallo/40 bg-fallo/10 px-3 py-2 text-xs leading-relaxed">
      {children}
    </p>
  );
}

/**
 * La primera pantalla, la que decide si alguien entra o no.
 *
 * Aquí se dice **antes** de pedir nada qué sube y qué no. Un aviso de
 * privacidad que llega después de crear la cuenta no es un aviso, es un trámite
 * — y lo que hay en este teléfono es de lo más íntimo que alguien escribe.
 */
function Invitacion({ onEntrar }: { onEntrar: () => void }) {
  return (
    <>
      <Tarjeta>
        <Etiqueta>entrar</Etiqueta>
        <p className="mt-2 text-sm leading-relaxed">
          La app funciona entera sin cuenta, y va a seguir funcionando. La cuenta
          sirve para una sola cosa: que otros hermanos te encuentren y sepan que
          estás peleando la misma batalla.
        </p>
        <div className="mt-4">
          <Boton variante="fuerte" ancho onClick={onEntrar}>
            Entrar con Google
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta>
        <Etiqueta>qué sube y qué no</Etiqueta>
        <ul className="mt-2 flex flex-col gap-2 text-sm leading-relaxed">
          <li className="flex gap-2">
            <span className="shrink-0 text-logro" aria-hidden>
              ↑
            </span>
            <span>
              <strong>Sube</strong> tu nombre, tu foto, tu ciudad y tu país, y quiénes
              son tus amigos.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-fallo" aria-hidden>
              ✕
            </span>
            <span>
              <strong>No sube nada de lo que escribes.</strong> Ni el diario, ni las
              notas, ni los repasos de la noche. Eso se queda en este teléfono, y no
              hay forma de que llegue a ningún servidor nuestro.
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-tenue">
          Puedes borrar la cuenta entera desde aquí cuando quieras, y se va de verdad.
        </p>
      </Tarjeta>
    </>
  );
}

// ------------------------------------------------------------------ el perfil

function EditorDePerfil({
  sesion,
  perfil,
  onGuardado,
  onDejarlo,
}: {
  sesion: Sesion;
  perfil: Perfil | null;
  onGuardado: (p: Perfil) => void;
  onDejarlo?: () => void;
}) {
  const [nombre, setNombre] = useState(perfil?.nombre ?? sesion.nombre ?? "");
  const [usuario, setUsuario] = useState(
    perfil?.usuario ?? limpiarUsuario(sesion.nombre ?? sesion.correo?.split("@")[0] ?? ""),
  );
  const [foto, setFoto] = useState(perfil?.foto ?? sesion.foto ?? "");
  const [ciudad, setCiudad] = useState(perfil?.ciudad ?? "");
  const [pais, setPais] = useState(perfil?.pais ?? "Venezuela");
  const [versiculo, setVersiculo] = useState(perfil?.versiculo ?? "");
  const [cita, setCita] = useState(perfil?.cita ?? "");
  const [muestraRachas, setMuestraRachas] = useState(perfil?.muestraRachas !== false);
  const [whatsapp, setWhatsapp] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // El WhatsApp vive aparte del perfil, así que se pide por su cuenta.
  useEffect(() => {
    let vivo = true;
    void leerWhatsapp(sesion.uid).then((w) => {
      if (vivo && w) setWhatsapp(w);
    });
    return () => {
      vivo = false;
    };
  }, [sesion.uid]);

  const usuarioBien = usuarioValido(usuario);
  const puede = nombre.trim().length >= 2 && usuarioBien && !guardando;

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const nuevo: Perfil = {
      uid: sesion.uid,
      nombre: nombre.trim(),
      usuario,
      foto: foto || undefined,
      ciudad,
      pais,
      versiculo,
      cita,
      desde: perfil?.desde ?? Date.now(),
      muestraRachas,
    };
    try {
      await guardarPerfil(nuevo, perfil?.usuario);
      await guardarWhatsapp(sesion.uid, whatsapp);
      onGuardado(nuevo);
    } catch (e) {
      setError(comoFallo(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta>
      <Etiqueta>{perfil ? "tu perfil" : "completa tu perfil"}</Etiqueta>

      <div className="mt-3 flex flex-col gap-3">
        <ElegirFoto foto={foto} nombre={nombre} onFoto={setFoto} />

        {/*
          Los ejemplos **describen** lo que va en el campo. No inventan a una
          persona, y mucho menos nombran a una real.

          Aquí estuvo el nombre del dueño de la app, y alguien que entraba por
          primera vez se lo encontró de ejemplo en su propio registro. Da igual
          que fuera sólo un texto de ayuda: quien lo ve no distingue un ejemplo
          del dato de otro, y lo que concluye es que la app le está enseñando
          una cuenta ajena.

          El guardián de `scripts/publicar-release.mjs` se niega a publicar si
          esto vuelve — y la primera vez que saltó fue por **este mismo
          comentario**, que repetía el nombre al explicarlo. Por eso ahora no
          lo dice.
        */}
        <Campo etiqueta="Cómo te llamas">
          <Entrada
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre y apellido"
            maxLength={40}
          />
        </Campo>

        <Campo etiqueta="Tu nombre de usuario">
          <Entrada
            value={usuario}
            onChange={(e) => setUsuario(limpiarUsuario(e.target.value))}
            placeholder="tu.nombre"
            maxLength={20}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-tenue">
            {usuario && !usuarioBien
              ? "De 3 a 20 letras, números, punto o guion bajo."
              : "Por este nombre te encontrarán los hermanos. Puedes cambiarlo después."}
          </p>
        </Campo>

        <div className="flex gap-2">
          <div className="flex-1">
            <Campo etiqueta="Ciudad">
              <Entrada
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Caracas"
                maxLength={60}
              />
            </Campo>
          </div>
          <div className="flex-1">
            <Campo etiqueta="País">
              <Selector value={pais} onChange={(e) => setPais(e.target.value)}>
                {PAISES.map((p) => (
                  <option key={p.codigo} value={p.nombre}>
                    {p.bandera} {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
        </div>

        <Campo etiqueta="Un versículo que llevas por delante">
          <Entrada
            value={versiculo}
            onChange={(e) => setVersiculo(e.target.value)}
            placeholder="Todo lo puedo en Cristo que me fortalece"
            maxLength={300}
          />
        </Campo>

        <Campo etiqueta="De dónde es">
          <Entrada
            value={cita}
            onChange={(e) => setCita(e.target.value)}
            placeholder="Filipenses 4:13"
            maxLength={60}
          />
        </Campo>

        {/*
          El WhatsApp **no va en el perfil**, va aparte.

          El perfil lo puede leer cualquiera que haya entrado — hace falta para
          buscar a un hermano por su nombre —, y un número de teléfono ahí lo
          recoge cualquiera con una cuenta y un rato libre. Vive en otro sitio,
          y las reglas del servidor comprueban que quien lo pide sea un hermano
          ya aceptado.
        */}
        <Campo etiqueta="Tu WhatsApp (sólo lo ven tus hermanos)">
          <Entrada
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+58 412 000 0000"
            maxLength={40}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-tenue">
            Para que puedan escribirte cuando haga falta. Puedes pegar el número o
            el enlace. <strong>No lo ve quien sólo te busca</strong>: sólo los
            hermanos que ya aceptaste.
          </p>
        </Campo>

        {/*
          Las cifras, y quién decide.

          Alex lo planteó así y es lo correcto: «cada quien decide si las
          oculta». Enseñar rachas ajenas puede volver esto un escaparate;
          esconderlas siempre le quita a un hermano la forma más sencilla de
          animar a otro. La decisión es de quien se juega la suya.
        */}
        <label className="flex items-start justify-between gap-3 rounded-xl border border-borde px-3 py-3">
          <span className="min-w-0">
            <span className="block text-sm">Que mis hermanos vean mis cifras</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-tenue">
              Tu racha, tus días en pie y lo cumplido. Si lo apagas, se borran del
              servidor — no se quedan escondidas ahí.
            </span>
          </span>
          <input
            type="checkbox"
            checked={muestraRachas}
            onChange={(e) => setMuestraRachas(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-acento)]"
          />
        </label>


        {error ? <Aviso>{error}</Aviso> : null}

        <div className="flex gap-2">
          <div className="flex-1">
            <Boton variante="fuerte" ancho deshabilitado={!puede} onClick={guardar}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </div>
          {onDejarlo ? <Boton onClick={onDejarlo}>Dejarlo</Boton> : null}
        </div>
      </div>
    </Tarjeta>
  );
}

function FichaDePerfil({
  perfil,
  racha,
  diasEnPie,
  totalCumplidos,
  onEditar,
}: {
  perfil: Perfil;
  racha: number;
  diasEnPie: number;
  totalCumplidos: number;
  onEditar: () => void;
}) {
  const bandera = paisDe(perfil.pais)?.bandera ?? "";
  const desde = perfil.desde
    ? new Date(perfil.desde).toLocaleDateString("es", { month: "long", year: "numeric" })
    : null;

  return (
    <Tarjeta>
      <div className="flex items-start gap-3.5">
        <Retrato nombre={perfil.nombre} foto={perfil.foto} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg leading-tight font-semibold">{perfil.nombre}</p>
          <p className="cifras truncate text-sm text-acento">@{perfil.usuario}</p>
          {perfil.ciudad || perfil.pais ? (
            <p className="mt-1 truncate text-xs text-tenue">
              {bandera ? `${bandera} ` : ""}
              {[perfil.ciudad, perfil.pais].filter(Boolean).join(", ")}
            </p>
          ) : null}
          {desde ? <p className="text-xs text-tenue">en Genuino desde {desde}</p> : null}
        </div>
      </div>

      {perfil.versiculo ? (
        <blockquote className="mt-4 border-l-2 border-acento/60 pl-3">
          <p className="font-cita text-[15px] leading-relaxed italic">«{perfil.versiculo}»</p>
          {perfil.cita ? <p className="mt-1 text-xs text-tenue">— {perfil.cita}</p> : null}
        </blockquote>
      ) : null}

      {/*
        Estas tres cifras son **tuyas y solo se ven aquí**: salen de este
        teléfono y no viajan a ninguna parte. Un amigo ve quién eres y desde
        cuándo, no cómo vas. La constancia anima; la comparación hunde.
      */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Cifra valor={racha} etiqueta="racha" acento />
        <Cifra valor={diasEnPie} etiqueta="días en pie" />
        <Cifra valor={totalCumplidos} etiqueta="cumplidos" />
      </div>
      <p className="mt-2 text-center text-[11px] text-tenue">
        Estas cifras son tuyas. No las ve nadie más.
      </p>

      <div className="mt-4">
        <Boton ancho onClick={onEditar}>
          Editar mi perfil
        </Boton>
      </div>
    </Tarjeta>
  );
}

function Retrato({ nombre, foto }: { nombre: string; foto?: string }) {
  const [rota, setRota] = useState(false);
  const inicial = nombre.trim().charAt(0).toUpperCase() || "·";

  if (foto && !rota) {
    return (
      <img
        src={foto}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setRota(true)}
        className="size-16 shrink-0 rounded-full border border-borde object-cover"
      />
    );
  }
  return (
    <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-acento/40 bg-acento/10 text-2xl text-acento">
      {inicial}
    </div>
  );
}

function Cifra({
  valor,
  etiqueta,
  acento,
}: {
  valor: number;
  etiqueta: string;
  acento?: boolean;
}) {
  return (
    <div className="rounded-xl border border-borde bg-superficie-alta px-2 py-3 text-center">
      <p className={`cifras text-xl leading-none ${acento ? "text-acento" : ""}`}>{valor}</p>
      <p className="mt-1 text-[11px] leading-tight text-tenue">{etiqueta}</p>
    </div>
  );
}

// ------------------------------------------------------------------ los amigos

function Amigos({ yo }: { yo: Perfil }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [lista, setLista] = useState<Amigo[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [hallados, setHallados] = useState<Perfil[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");

  const refrescar = async () => {
    try {
      setLista(await listarAmigos(yo.uid));
    } catch (e) {
      setError(comoFallo(e));
    }
  };

  useEffect(() => {
    void refrescar();
    // Sólo al montar y al cambiar de cuenta; lo demás se refresca a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yo.uid]);

  const { recibidas, aceptadas, enviadas } = useMemo(() => {
    const l = lista ?? [];
    return {
      recibidas: l.filter((a) => a.estado === "recibida"),
      aceptadas: l.filter((a) => a.estado === "aceptada"),
      enviadas: l.filter((a) => a.estado === "enviada"),
    };
  }, [lista]);

  const buscar = async () => {
    setBuscando(true);
    setError("");
    setHallados(null);
    try {
      setHallados(await buscarHermanos(busqueda));
    } catch (e) {
      setError(comoFallo(e));
    } finally {
      setBuscando(false);
    }
  };

  const pedir = async (otro: Perfil) => {
    setError("");
    try {
      await pedirAmistad(yo, otro);
      setHallados(null);
      setBusqueda("");
      await refrescar();
    } catch (e) {
      setError(comoFallo(e));
    }
  };

  if (abierto) {
    return (
      <div className="flex flex-col gap-4">
        <FichaDeHermano uid={abierto} onVolver={() => setAbierto(null)} />
      </div>
    );
  }

  return (
    <Tarjeta>
      <Etiqueta>hermanos · {aceptadas.length}</Etiqueta>

      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Su nombre o su usuario"
            onKeyDown={(e) => {
              if (e.key === "Enter") void buscar();
            }}
          />
        </div>
        <Boton deshabilitado={busqueda.trim().length < 3 || buscando} onClick={() => void buscar()}>
          {buscando ? "…" : "Buscar"}
        </Boton>
      </div>

      {hallados?.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-tenue">
          No hay nadie con ese nombre. Prueba con su nombre de usuario — el que
          empieza por @ y le sale a él en su perfil.
        </p>
      ) : null}

      {/*
        Varios resultados, no uno.

        Antes esto sólo encontraba por el nombre de usuario exacto, y eso es un
        muro: nadie se sabe de memoria el usuario de otro. Alex intentó agregar
        a un amigo, no le salió nadie, y dio por hecho que la función estaba
        rota — cuando lo que pasaba es que había buscado por el nombre.
      */}
      {hallados && hallados.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {hallados.map((h) => (
            <div
              key={h.uid}
              className="flex items-center gap-3 rounded-xl border border-acento/40 bg-acento/5 p-3"
            >
              <RetratoPequeno nombre={h.nombre} foto={h.foto} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{h.nombre}</p>
                <p className="cifras truncate text-xs text-tenue">
                  {"@" + h.usuario + (h.ciudad ? " · " + h.ciudad : "")}
                </p>
              </div>
              {h.uid === yo.uid ? (
                <span className="shrink-0 text-xs text-tenue">eres tú</span>
              ) : (
                <Boton variante="fuerte" onClick={() => void pedir(h)}>
                  Agregar
                </Boton>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-2">
          <Aviso>{error}</Aviso>
        </div>
      ) : null}

      {/* Lo que espera respuesta va primero: es lo único que pide algo de uno. */}
      {recibidas.length > 0 ? (
        <div className="mt-4">
          <Etiqueta>te han pedido</Etiqueta>
          <div className="mt-2 flex flex-col gap-2">
            {recibidas.map((a) => (
              <FilaAmigo key={a.uid} amigo={a}>
                <Boton
                  variante="fuerte"
                  onClick={async () => {
                    await aceptarAmistad(yo.uid, a.uid);
                    await refrescar();
                  }}
                >
                  Aceptar
                </Boton>
              </FilaAmigo>
            ))}
          </div>
        </div>
      ) : null}

      {aceptadas.length > 0 ? (
        <div className="mt-4">
          <Etiqueta>tus hermanos</Etiqueta>
          <div className="mt-2 flex flex-col gap-2">
            {aceptadas.map((a) => (
              <FilaAmigo key={a.uid} amigo={a} onAbrir={() => setAbierto(a.uid)}>
                <button
                  onClick={async () => {
                    await quitarAmistad(yo.uid, a.uid);
                    await refrescar();
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-fallo"
                >
                  quitar
                </button>
              </FilaAmigo>
            ))}
          </div>
        </div>
      ) : null}

      {enviadas.length > 0 ? (
        <div className="mt-4">
          <Etiqueta>esperando respuesta</Etiqueta>
          <div className="mt-2 flex flex-col gap-2">
            {enviadas.map((a) => (
              <FilaAmigo key={a.uid} amigo={a}>
                <button
                  onClick={async () => {
                    await quitarAmistad(yo.uid, a.uid);
                    await refrescar();
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-fallo"
                >
                  deshacer
                </button>
              </FilaAmigo>
            ))}
          </div>
        </div>
      ) : null}

      {lista !== null && lista.length === 0 ? (
        <p className="mt-4 text-xs leading-relaxed text-tenue">
          Todavía no tienes a nadie. Pásale tu nombre de usuario —
          <span className="cifras text-acento"> @{yo.usuario}</span> — a un hermano y que
          te busque.
        </p>
      ) : null}
    </Tarjeta>
  );
}

/**
 * Una fila de hermano. **Se toca y se abre su ficha.**
 *
 * Alex: «toco su nombre y no pasa nada. Debería poder ver su perfil, sus
 * rachas, frases favoritas». Tenía razón — agregar a alguien y que no se pueda
 * ver nada de él es agregar por agregar.
 */
function FilaAmigo({
  amigo,
  onAbrir,
  children,
}: {
  amigo: Amigo;
  onAbrir?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-borde pr-2.5 transition hover:border-acento">
      <button
        onClick={onAbrir}
        disabled={!onAbrir}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
        aria-label={onAbrir ? `Ver el perfil de ${amigo.nombre}` : undefined}
      >
        <RetratoPequeno nombre={amigo.nombre} foto={amigo.foto} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{amigo.nombre}</span>
          <span className="cifras block truncate text-xs text-tenue">@{amigo.usuario}</span>
        </span>
        {onAbrir ? (
          <span className="shrink-0 text-tenue" aria-hidden>
            ›
          </span>
        ) : null}
      </button>
      {children}
    </div>
  );
}

function RetratoPequeno({ nombre, foto }: { nombre: string; foto?: string }) {
  const [rota, setRota] = useState(false);
  if (foto && !rota) {
    return (
      <img
        src={foto}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setRota(true)}
        className="size-9 shrink-0 rounded-full border border-borde object-cover"
      />
    );
  }
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie-alta text-sm text-tenue">
      {nombre.trim().charAt(0).toUpperCase() || "·"}
    </div>
  );
}

// ------------------------------------------------------------------ el cierre

/**
 * Salir y borrar.
 *
 * Borrar la cuenta tiene que estar **aquí dentro y funcionar**: Google Play lo
 * exige para cualquier app con cuentas, y además es lo decente. Se avisa de lo
 * que se lleva por delante y de lo que no, porque lo que más asusta al borrar
 * es no saber si te llevas también el diario — y no, el diario no se toca.
 */
function Cierre({ perfil, onFuera }: { perfil: Perfil; onFuera: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");

  return (
    <Tarjeta>
      <Etiqueta>cerrar</Etiqueta>

      <div className="mt-3 flex flex-col gap-2">
        <Boton
          ancho
          onClick={async () => {
            await salir();
            onFuera();
          }}
        >
          Salir de la cuenta
        </Boton>

        {!confirmando ? (
          <Boton variante="fantasma" ancho onClick={() => setConfirmando(true)}>
            Borrar mi cuenta
          </Boton>
        ) : (
          <div className="rounded-xl border border-fallo/40 bg-fallo/5 p-3">
            <p className="text-sm leading-relaxed">
              Se borra tu perfil, tu nombre de usuario y tus amistades, y no se puede
              deshacer.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-tenue">
              <strong>Tu diario, tus notas y tus rachas se quedan</strong> — nunca
              estuvieron en la cuenta. Siguen en este teléfono como hasta ahora.
            </p>
            {error ? (
              <div className="mt-2">
                <Aviso>{error}</Aviso>
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <Boton
                  variante="fantasma"
                  ancho
                  deshabilitado={borrando}
                  onClick={async () => {
                    setBorrando(true);
                    setError("");
                    try {
                      await borrarCuenta(perfil.uid, perfil.usuario);
                      onFuera();
                    } catch (e) {
                      setError(comoFallo(e));
                    } finally {
                      setBorrando(false);
                    }
                  }}
                >
                  {borrando ? "Borrando…" : "Sí, bórrala"}
                </Boton>
              </div>
              <Boton onClick={() => setConfirmando(false)}>Dejarlo</Boton>
            </div>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

/**
 * Elegir la foto del perfil desde el propio teléfono.
 *
 * Alex: «agregar opción de foto de perfil, que se pueda subir desde el cell».
 * Hasta ahora sólo se traía el avatar de Google, y quien no tiene foto ahí se
 * quedaba con una letra.
 *
 * ── Por qué no hace falta un servidor de archivos ─────────────────────────
 *
 * La foto se **encoge aquí mismo** a 192 píxeles y se guarda con el perfil. Un
 * retrato de 192 píxeles pesa unos diez kilobytes, que caben de sobra en el
 * perfil: no hace falta montar un almacén de archivos, ni pagarlo, ni escribir
 * reglas nuevas para él, ni preocuparse de borrar la foto cuando alguien borra
 * su cuenta — se va con el perfil, porque es el perfil.
 *
 * Se recorta cuadrada por el centro antes de encoger. Si no, una foto vertical
 * del móvil sale aplastada, y nadie se pone una foto para verse deformado.
 */
function ElegirFoto({
  foto,
  nombre,
  onFoto,
}: {
  foto: string;
  nombre: string;
  onFoto: (dato: string) => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");

  const elegir = async (archivo: File) => {
    setTrabajando(true);
    setError("");
    try {
      onFoto(await encoger(archivo));
    } catch {
      setError("No se pudo usar esa imagen. Prueba con otra.");
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="flex items-center gap-3.5">
      <Retrato nombre={nombre || "·"} foto={foto || undefined} />
      <div className="min-w-0 flex-1">
        <label className="block">
          <span
            className={`inline-block cursor-pointer rounded-xl border px-3 py-2 text-sm transition ${
              trabajando
                ? "border-borde text-tenue"
                : "border-borde text-tenue hover:border-acento hover:text-acento"
            }`}
          >
            {trabajando ? "Preparando…" : foto ? "Cambiar la foto" : "Poner una foto"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Se limpia el input para que elegir el mismo archivo otra vez
              // vuelva a disparar el cambio.
              e.target.value = "";
              if (f) void elegir(f);
            }}
          />
        </label>
        {foto ? (
          <button
            onClick={() => onFoto("")}
            className="ml-2 rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-fallo"
          >
            quitar
          </button>
        ) : null}
        <p className="mt-1.5 text-xs leading-relaxed text-tenue">
          Se guarda pequeña, dentro de tu perfil. La ven los hermanos que te busquen.
        </p>
        {error ? <p className="mt-1 text-xs text-fallo">{error}</p> : null}
      </div>
    </div>
  );
}

/** Lado del retrato, en píxeles. Diez kilobytes y se ve bien en cualquier móvil. */
const LADO_FOTO = 192;

/**
 * Recorta cuadrado por el centro y encoge, sin salir del teléfono.
 *
 * `createImageBitmap` no existe en todos los navegadores viejos, así que se cae
 * a una imagen normal: lo que no puede pasar es que el botón no haga nada.
 */
async function encoger(archivo: File): Promise<string> {
  const imagen = await cargarImagen(archivo);
  const lado = Math.min(imagen.width, imagen.height);
  const x = (imagen.width - lado) / 2;
  const y = (imagen.height - lado) / 2;

  const lienzo = document.createElement("canvas");
  lienzo.width = LADO_FOTO;
  lienzo.height = LADO_FOTO;
  const pincel = lienzo.getContext("2d");
  if (!pincel) throw new Error("sin-lienzo");
  pincel.drawImage(imagen, x, y, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);

  return lienzo.toDataURL("image/jpeg", 0.75);
}

function cargarImagen(archivo: File): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === "function") return createImageBitmap(archivo);
  return new Promise((bien, mal) => {
    const img = new Image();
    img.onload = () => bien(img);
    img.onerror = () => mal(new Error("no-se-pudo-leer"));
    img.src = URL.createObjectURL(archivo);
  });
}

/**
 * La ficha de un hermano.
 *
 * Alex: «toco su nombre y no pasa nada. Debería poder ver su perfil, sus
 * rachas —cada quien decide si las oculta—, frases favoritas».
 *
 * Agregar a alguien y que no se pueda ver nada de él es agregar por agregar.
 * Aquí está lo que esa persona **ha decidido** enseñar, y nada más:
 *
 *  - Su perfil y el versículo que lleva por delante, que es lo que eligió
 *    poner de cara a los demás.
 *  - Sus cifras, **sólo si las tiene abiertas**. Es su decisión, no la nuestra:
 *    enseñar rachas ajenas puede volver esto un escaparate, y esconderlas
 *    siempre le quita a un hermano la forma más sencilla de animar a otro.
 *  - Su WhatsApp, **sólo si lo puso** — y sólo llega aquí porque ya sois
 *    hermanos aceptados; las reglas del servidor lo comprueban.
 *
 * Lo que no está, y no va a estar: nada de lo que escribe. Ni su diario, ni sus
 * notas, ni sus repasos.
 */
function FichaDeHermano({
  uid,
  onVolver,
}: {
  uid: string;
  onVolver: () => void;
}) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [p, w] = await Promise.all([leerPerfil(uid), leerWhatsapp(uid)]);
      if (!vivo) return;
      setPerfil(p);
      setWhatsapp(w);
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [uid]);

  if (cargando) return <Vacio>Un momento…</Vacio>;
  if (!perfil) return <Vacio>Ese hermano ya no tiene perfil.</Vacio>;

  const bandera = paisDe(perfil.pais)?.bandera ?? "";
  const desde = perfil.desde
    ? new Date(perfil.desde).toLocaleDateString("es", { month: "long", year: "numeric" })
    : null;
  const enlace = whatsapp ? enlaceWhatsapp(whatsapp) : null;

  return (
    <>
      <button
        onClick={onVolver}
        className="-ml-2 self-start rounded-lg px-3 py-2 text-sm text-tenue transition hover:text-texto"
      >
        ‹ Mis hermanos
      </button>

      <Tarjeta>
        <div className="flex items-start gap-3.5">
          <Retrato nombre={perfil.nombre} foto={perfil.foto} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg leading-tight font-semibold">{perfil.nombre}</p>
            <p className="cifras truncate text-sm text-acento">@{perfil.usuario}</p>
            {perfil.ciudad || perfil.pais ? (
              <p className="mt-1 truncate text-xs text-tenue">
                {bandera ? bandera + " " : ""}
                {[perfil.ciudad, perfil.pais].filter(Boolean).join(", ")}
              </p>
            ) : null}
            {desde ? <p className="text-xs text-tenue">en Genuino desde {desde}</p> : null}
          </div>
        </div>

        {perfil.versiculo ? (
          <blockquote className="mt-4 border-l-2 border-acento/60 pl-3">
            <p className="font-cita text-[15px] leading-relaxed italic">
              «{perfil.versiculo}»
            </p>
            {perfil.cita ? <p className="mt-1 text-xs text-tenue">— {perfil.cita}</p> : null}
          </blockquote>
        ) : null}

        {perfil.muestraRachas !== false && perfil.racha !== undefined ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <Cifra valor={perfil.racha ?? 0} etiqueta="racha" acento />
              <Cifra valor={perfil.diasEnPie ?? 0} etiqueta="días en pie" />
              <Cifra valor={perfil.cumplidos ?? 0} etiqueta="cumplidos" />
            </div>
            <p className="mt-2 text-center text-[11px] text-tenue">
              Las comparte para que le animes, no para medirse contigo.
            </p>
          </>
        ) : (
          <p className="mt-4 text-center text-xs leading-relaxed text-tenue">
            Prefiere no enseñar sus cifras, y está bien: la carrera es suya y de Dios.
          </p>
        )}
      </Tarjeta>

      {enlace ? (
        <Tarjeta>
          <Etiqueta>escríbele</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            Una palabra a tiempo sostiene más que diez consejos tarde.
          </p>
          <div className="mt-3">
            <Boton variante="fuerte" ancho onClick={() => void abrirEnlace(enlace)}>
              Escribirle por WhatsApp
            </Boton>
          </div>
        </Tarjeta>
      ) : null}
    </>
  );
}
