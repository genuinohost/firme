/**
 * Los países, con su bandera.
 *
 * Primero los de habla hispana, que es de donde viene y va a venir casi todo el
 * mundo, y después el resto por orden. Una lista alfabética pura obligaría a
 * bajar hasta la uve para encontrar Venezuela, y eso en el país de casi todos
 * los primeros usuarios es un roce tonto en la primera pantalla que ven.
 */
export type Pais = { codigo: string; nombre: string; bandera: string };

export const PAISES: Pais[] = [
  { codigo: "VE", nombre: "Venezuela", bandera: "🇻🇪" },
  { codigo: "CO", nombre: "Colombia", bandera: "🇨🇴" },
  { codigo: "MX", nombre: "México", bandera: "🇲🇽" },
  { codigo: "ES", nombre: "España", bandera: "🇪🇸" },
  { codigo: "AR", nombre: "Argentina", bandera: "🇦🇷" },
  { codigo: "PE", nombre: "Perú", bandera: "🇵🇪" },
  { codigo: "CL", nombre: "Chile", bandera: "🇨🇱" },
  { codigo: "EC", nombre: "Ecuador", bandera: "🇪🇨" },
  { codigo: "US", nombre: "Estados Unidos", bandera: "🇺🇸" },
  { codigo: "PA", nombre: "Panamá", bandera: "🇵🇦" },
  { codigo: "DO", nombre: "República Dominicana", bandera: "🇩🇴" },
  { codigo: "GT", nombre: "Guatemala", bandera: "🇬🇹" },
  { codigo: "CR", nombre: "Costa Rica", bandera: "🇨🇷" },
  { codigo: "BO", nombre: "Bolivia", bandera: "🇧🇴" },
  { codigo: "HN", nombre: "Honduras", bandera: "🇭🇳" },
  { codigo: "SV", nombre: "El Salvador", bandera: "🇸🇻" },
  { codigo: "NI", nombre: "Nicaragua", bandera: "🇳🇮" },
  { codigo: "PY", nombre: "Paraguay", bandera: "🇵🇾" },
  { codigo: "UY", nombre: "Uruguay", bandera: "🇺🇾" },
  { codigo: "CU", nombre: "Cuba", bandera: "🇨🇺" },
  { codigo: "PR", nombre: "Puerto Rico", bandera: "🇵🇷" },
  { codigo: "BR", nombre: "Brasil", bandera: "🇧🇷" },
  { codigo: "PT", nombre: "Portugal", bandera: "🇵🇹" },
  { codigo: "CA", nombre: "Canadá", bandera: "🇨🇦" },
  { codigo: "IT", nombre: "Italia", bandera: "🇮🇹" },
  { codigo: "FR", nombre: "Francia", bandera: "🇫🇷" },
  { codigo: "DE", nombre: "Alemania", bandera: "🇩🇪" },
  { codigo: "GB", nombre: "Reino Unido", bandera: "🇬🇧" },
  { codigo: "NL", nombre: "Países Bajos", bandera: "🇳🇱" },
  { codigo: "CH", nombre: "Suiza", bandera: "🇨🇭" },
  { codigo: "AU", nombre: "Australia", bandera: "🇦🇺" },
  { codigo: "OT", nombre: "Otro país", bandera: "🌎" },
];

export function paisDe(nombre?: string): Pais | null {
  if (!nombre) return null;
  return PAISES.find((p) => p.nombre === nombre) ?? null;
}
