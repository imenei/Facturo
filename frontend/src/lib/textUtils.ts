/**
 * Coupe les « mots » trop longs (sans espace) d'un texte, pour qu'ils passent à la ligne
 * dans les cellules des tableaux PDF / Word au lieu de déborder sur les colonnes voisines.
 * Exemple : « reparationunitecentraletypedesktop*instalationwindows+ » (aucun espace).
 */
export function breakLongWords(text: unknown, maxLen = 28): string {
  const value = String(text ?? '');
  return value
    .split('\n')
    .map((line) =>
      line
        .split(' ')
        .map((word) => {
          if (word.length <= maxLen) return word;
          const parts: string[] = [];
          for (let i = 0; i < word.length; i += maxLen) parts.push(word.slice(i, i + maxLen));
          return parts.join('\n');
        })
        .join(' '),
    )
    .join('\n');
}

/** Couleur hexadécimale valide (#RGB ou #RRGGBB) -> [r, g, b], sinon null. */
export function hexToRgb(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  let value = String(hex).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(value)) value = value.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/** Texte lisible (blanc ou noir) sur un fond de couleur donnée. */
export function readableTextOn(rgb: [number, number, number]): [number, number, number] {
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.62 ? [20, 20, 20] : [255, 255, 255];
}
