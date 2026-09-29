import { escapeHtml } from './text.js';

const PROSE_ACTIONS = ['stop-phantom', 'fix-markup', 'fit-background', 'svg-oversized', 'ignore-placeholder'];

export function solutionParts(result) {
  const actions = result?.actions ?? [];
  const proseActions = [];
  for (const type of PROSE_ACTIONS) {
    for (const action of actions) {
      if (action.action === type && action.summary) proseActions.push(action.summary);
    }
  }
  if (proseActions.length) return { prose: joinPhrases(proseActions), code: '' };

  const prose = [];
  const code = [];
  const short = actions.find((action) => action.action === 'source-short' && action.summary);
  if (short) prose.push(short.summary);
  const sizes = actions.find((action) => action.action === 'update-sizes' && action.to);
  if (sizes) code.push(`sizes="${sizes.to}"`);
  if (!short) {
    const widths = [...new Set(
      actions.filter((action) => action.action === 'add-candidates').flatMap((action) => action.widths ?? []),
    )].sort((a, b) => a - b);
    if (widths.length) code.push(widths.map((width) => `${width}w`).join(', '));
  }
  return {
    prose: prose.length ? joinPhrases(prose) : (code.length ? '' : 'No change.'),
    code: code.join('\n'),
  };
}

export function solutionMarkup(result) {
  const { prose, code } = solutionParts(result);
  const text = prose ? `<p class="pl-explain__solution">${escapeHtml(prose)}</p>` : '';
  const block = code ? `<pre class="pl-explain__snippet">${escapeHtml(code)}</pre>` : '';
  return `${text}${block}`;
}

function joinPhrases(parts) {
  return parts
    .map((part) => String(part).trim())
    .filter(Boolean)
    .map((part) => (part.endsWith('.') ? part : `${part}.`))
    .join(' ');
}
