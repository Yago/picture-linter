/**
 * Parse srcset / image-set candidates and pick the one a browser would use.
 * w-descriptors: smallest candidate whose width ≥ sizesPx × density (else largest).
 * x-descriptors: smallest candidate whose density ≥ device density (else largest).
 */
export function parseSrcset(value) {
  if (!value || !value.trim()) return [];
  const candidates = [];
  for (const part of splitCandidates(value)) {
    const candidate = parseCandidate(part.trim());
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function splitCandidates(value) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function parseCandidate(part) {
  const urlMatch = part.match(/^(?:url\((['"]?)(.*?)\1\)|([^ \t]+))(.*)$/i);
  if (!urlMatch) return null;
  const url = (urlMatch[2] ?? urlMatch[3] ?? '').replace(/^["']|["']$/g, '');
  if (!url) return null;
  const rest = (urlMatch[4] ?? '').trim();
  const width = rest.match(/^(\d+(?:\.\d+)?)w\b/i);
  if (width) return { url, width: Number(width[1]) };
  const density = rest.match(/^(\d+(?:\.\d+)?)x\b/i);
  if (density) return { url, density: Number(density[1]) };
  if (/^(\d+(?:\.\d+)?)dppx\b/i.test(rest)) {
    return { url, density: Number(rest.match(/^(\d+(?:\.\d+)?)/)[1]) };
  }
  return { url, width: undefined, density: 1 };
}

export function pickCandidate(candidates, layoutWidth, density) {
  if (!candidates.length) return null;
  const hasW = candidates.some((c) => c.width != null);
  const hasX = candidates.some((c) => c.density != null && c.width == null);
  if (hasW && hasX) return null;
  if (hasW) {
    const sorted = [...candidates].filter((c) => c.width != null).sort((a, b) => a.width - b.width);
    const need = layoutWidth * density;
    return sorted.find((c) => c.width >= need) ?? sorted[sorted.length - 1];
  }
  const sorted = [...candidates].sort((a, b) => (a.density ?? 1) - (b.density ?? 1));
  return sorted.find((c) => (c.density ?? 1) >= density) ?? sorted[sorted.length - 1];
}

export function intrinsicWidth(candidate) {
  if (!candidate) return 0;
  if (candidate.width != null) return candidate.width;
  return 0;
}
