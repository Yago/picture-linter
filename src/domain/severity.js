const RANK = { red: 3, orange: 2, skip: 1, green: 0 };

export function worstSeverity(severities) {
  let worst = 'green';
  for (const severity of severities) {
    if (RANK[severity] > RANK[worst]) worst = severity;
  }
  return worst;
}

export function isWorse(a, b) {
  return RANK[a] > RANK[b];
}
