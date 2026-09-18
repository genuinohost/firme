/**
 * «Publicarla en el muro», la casilla que va debajo de lo que uno escribe.
 *
 * Está aquí y no copiada en cada repaso por una razón concreta: **el texto de
 * aviso tiene que ser el mismo en todos los sitios**. Si en un sitio pone
 * «sólo la ven tus hermanos» y en otro «la ve cualquiera», el que lea el
 * primero va a publicar cosas creyendo algo que no es. Un aviso de privacidad
 * repetido a mano se desincroniza el día que alguien toca uno de los dos.
 *
 * Nace apagada siempre. Nadie publica nada por no haber leído una casilla.
 */
export function CasillaPublicar({
  valor,
  onCambiar,
  hayTexto,
}: {
  valor: boolean;
  onCambiar: (v: boolean) => void;
  /** Sin nada escrito no hay nada que publicar, y la casilla estorba. */
  hayTexto: boolean;
}) {
  if (!hayTexto) return null;

  return (
    <label className="mt-2 flex items-start justify-between gap-3 rounded-xl border border-borde px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm">Publicarla en el muro</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-tenue">
          La podrá leer <strong>cualquiera</strong>, sea hermano tuyo o no, e irá
          con tu nombre. No se publica de qué plan viene ni cómo acabó tu día.
          Puedes retirarla desde el diario cuando quieras.
        </span>
      </span>
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => onCambiar(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-acento)]"
      />
    </label>
  );
}
