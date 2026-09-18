import { useEffect, useMemo, useState } from "react";
import { PAISES, paisDe } from "@/datos/paises";
import {
  aceptarAmistad,
  borrarCuenta,
  buscarPorUsuario,
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
  }, []);

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

  const entrar = async () => {
    setError("");
    try {
      await entrarConGoogle();
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
  const [ciudad, setCiudad] = useState(perfil?.ciudad ?? "");
  const [pais, setPais] = useState(perfil?.pais ?? "Venezuela");
  const [versiculo, setVersiculo] = useState(perfil?.versiculo ?? "");
  const [cita, setCita] = useState(perfil?.cita ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const usuarioBien = usuarioValido(usuario);
  const puede = nombre.trim().length >= 2 && usuarioBien && !guardando;

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const nuevo: Perfil = {
      uid: sesion.uid,
      nombre: nombre.trim(),
      usuario,
      foto: perfil?.foto ?? sesion.foto ?? undefined,
      ciudad,
      pais,
      versiculo,
      cita,
      desde: perfil?.desde ?? Date.now(),
    };
    try {
      await guardarPerfil(nuevo, perfil?.usuario);
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
        {/*
          Los ejemplos **describen** lo que va en el campo, no inventan a una
          persona.

          Aquí estaba escrito el nombre real de Alex, y un amigo suyo que
          entraba por primera vez se encontró con «johnny.martinez» de ejemplo.
          Da igual que sea sólo un texto de ayuda: quien lo ve no distingue un
          ejemplo del dato de otro, y lo que concluye es que la app le está
          enseñando la cuenta de alguien. Poner el nombre de una persona real
          —aunque sea el dueño— en la pantalla de otra no se hace.
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
  const [lista, setLista] = useState<Amigo[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [hallado, setHallado] = useState<Perfil | null | "nada">(null);
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
    setHallado(null);
    try {
      const p = await buscarPorUsuario(busqueda);
      setHallado(p ?? "nada");
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
      setHallado(null);
      setBusqueda("");
      await refrescar();
    } catch (e) {
      setError(comoFallo(e));
    }
  };

  return (
    <Tarjeta>
      <Etiqueta>hermanos · {aceptadas.length}</Etiqueta>

      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(limpiarUsuario(e.target.value))}
            placeholder="Su nombre de usuario"
            onKeyDown={(e) => {
              if (e.key === "Enter") void buscar();
            }}
          />
        </div>
        <Boton deshabilitado={!usuarioValido(busqueda) || buscando} onClick={() => void buscar()}>
          {buscando ? "…" : "Buscar"}
        </Boton>
      </div>

      {hallado === "nada" ? (
        <p className="mt-2 text-xs leading-relaxed text-tenue">
          No hay nadie con ese nombre. Compruébalo con él: se escribe igual que aparece
          en su perfil, con el @ por delante.
        </p>
      ) : null}

      {hallado && hallado !== "nada" ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-acento/40 bg-acento/5 p-3">
          <Retrato nombre={hallado.nombre} foto={hallado.foto} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{hallado.nombre}</p>
            <p className="cifras truncate text-xs text-tenue">@{hallado.usuario}</p>
          </div>
          {hallado.uid === yo.uid ? (
            <span className="shrink-0 text-xs text-tenue">eres tú</span>
          ) : (
            <Boton variante="fuerte" onClick={() => void pedir(hallado)}>
              Agregar
            </Boton>
          )}
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
              <FilaAmigo key={a.uid} amigo={a}>
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

function FilaAmigo({ amigo, children }: { amigo: Amigo; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-borde px-3 py-2.5">
      <RetratoPequeno nombre={amigo.nombre} foto={amigo.foto} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{amigo.nombre}</p>
        <p className="cifras truncate text-xs text-tenue">@{amigo.usuario}</p>
      </div>
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
