import { useEffect, useState } from "react";
import { acierta } from "@/logica/cerradura";

/**
 * La pantalla del código.
 *
 * Tapa la app entera. No enseña nada de dentro —ni la racha, ni el nombre del
 * plan, ni la primera línea del diario— porque una pantalla de bloqueo que deja
 * ver por encima del hombro no bloquea nada.
 *
 * El teclado es de números y grande a propósito: se usa medio dormido a las
 * tres de la mañana, con una mano, y con la alarma repicando.
 */

const LARGO = 4;

export function PantallaBloqueo({
  onAbrir,
  titulo = "Tu código",
  pie,
}: {
  onAbrir: () => void;
  titulo?: string;
  pie?: string;
}) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState(false);
  const [intentos, setIntentos] = useState(0);

  // Cuando se completan los cuatro dígitos se comprueba solo: pedir además un
  // botón de «entrar» es un toque de más cada vez, todos los días.
  useEffect(() => {
    if (codigo.length < LARGO) return;
    let vivo = true;
    void acierta(codigo).then((bien) => {
      if (!vivo) return;
      if (bien) {
        onAbrir();
        return;
      }
      setError(true);
      setIntentos((n) => n + 1);
      // Se borra tras un instante, para que se vea que falló.
      window.setTimeout(() => {
        if (!vivo) return;
        setCodigo("");
        setError(false);
      }, 550);
    });
    return () => {
      vivo = false;
    };
  }, [codigo, onAbrir]);

  const pulsar = (n: string) => {
    if (codigo.length >= LARGO || error) return;
    setCodigo((c) => c + n);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-fondo px-8">
      <p className="text-sm text-tenue">{titulo}</p>

      <div className={`mt-6 flex gap-3.5 ${error ? "temblor" : ""}`}>
        {Array.from({ length: LARGO }).map((_, i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full border transition ${
              error
                ? "border-fallo bg-fallo"
                : i < codigo.length
                  ? "border-acento bg-acento"
                  : "border-borde"
            }`}
          />
        ))}
      </div>

      <p className="mt-4 h-5 text-xs text-fallo">
        {error ? "Ese no es." : intentos >= 3 ? "Tómate un segundo." : ""}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <Tecla key={n} onClick={() => pulsar(n)}>
            {n}
          </Tecla>
        ))}
        <span />
        <Tecla onClick={() => pulsar("0")}>0</Tecla>
        <Tecla
          onClick={() => setCodigo((c) => c.slice(0, -1))}
          etiqueta="Borrar el último número"
        >
          ⌫
        </Tecla>
      </div>

      {pie ? (
        <p className="mt-8 max-w-xs text-center text-xs leading-relaxed text-tenue">{pie}</p>
      ) : null}
    </div>
  );
}

function Tecla({
  children,
  onClick,
  etiqueta,
}: {
  children: React.ReactNode;
  onClick: () => void;
  etiqueta?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={etiqueta}
      className="cifras size-16 rounded-full border border-borde bg-superficie text-xl transition active:border-acento active:bg-acento/15"
    >
      {children}
    </button>
  );
}
