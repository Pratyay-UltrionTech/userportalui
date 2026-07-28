/** Unified service card / catalog detail lines: # heading, * / + included, - excluded. */

export type ServiceDetailRow =
  | { kind: 'heading'; text: string }
  | { kind: 'included'; text: string }
  | { kind: 'excluded'; text: string };

function cellToLines(cell: string): string[] {
  return String(cell ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function flattenCells(cells: string[] | undefined): string[] {
  const out: string[] = [];
  for (const c of cells ?? []) out.push(...cellToLines(c));
  return out;
}

function lineHasControlPrefix(line: string): boolean {
  const t = line.trimStart();
  return /^[#*+\-]/.test(t);
}

/**
 * Merge legacy split arrays into one ordered line list for parsing.
 * New saves: only descriptionPoints holds prefixed lines; excludedPoints is [].
 * Legacy: plain included lines + excluded lines → synthetic * / - prefixes.
 */
export function flattenStoredServiceLines(
  descriptionPoints: string[] | undefined,
  excludedPoints: string[] | undefined,
): string[] {
  const fromDesc = flattenCells(descriptionPoints);
  const fromEx = flattenCells(excludedPoints);
  const descStructured = fromDesc.some(lineHasControlPrefix);

  if (descStructured) {
    return [
      ...fromDesc,
      ...fromEx.map((l) => {
        const t = l.trim();
        if (!t) return null;
        return lineHasControlPrefix(t) ? t : `- ${t.replace(/^\s*-\s*/, '').trim()}`;
      }).filter((x): x is string => Boolean(x)),
    ];
  }

  return [
    ...fromDesc.map((l) => (lineHasControlPrefix(l) ? l : `* ${l.replace(/^\s*\*\s*/, '').trim()}`)),
    ...fromEx.map((l) => {
      const t = l.trim();
      if (!t) return null;
      if (lineHasControlPrefix(t)) return t;
      return `- ${t.replace(/^\s*-\s*/, '').trim()}`;
    }).filter((x): x is string => Boolean(x)),
  ];
}

export function parseServiceDetailRows(lines: string[]): ServiceDetailRow[] {
  const out: ServiceDetailRow[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith('#')) {
      const title = t.replace(/^#+\s*/, '').trim();
      if (title) out.push({ kind: 'heading', text: title });
    } else if (t.startsWith('*')) {
      const text = t.replace(/^\*\s*/, '').trim();
      if (text) out.push({ kind: 'included', text });
    } else if (t.startsWith('+')) {
      const text = t.replace(/^\+\s*/, '').trim();
      if (text) out.push({ kind: 'included', text });
    } else if (t.startsWith('-')) {
      const text = t.replace(/^-\s*/, '').trim();
      if (text) out.push({ kind: 'excluded', text });
    } else {
      out.push({ kind: 'included', text: t });
    }
  }
  return out;
}
