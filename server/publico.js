// Las rutas de lectura son públicas (las usa la pantalla del televisor): no exponen la referencia
// externa de la integración, solo de dónde viene el ítem.
export function publico(fila) {
  const { external_ref: ref, ...resto } = fila;
  return { ...resto, origen: typeof ref === 'string' && ref.startsWith('marketingpro:') ? 'marketingpro' : '' };
}
