export type Pattern = 'line' | 'x' | 'full';

export function checkPattern(marked: boolean[][], pattern: Pattern): boolean {
  switch (pattern) {
    case 'line': return checkLine(marked);
    case 'x': return checkX(marked);
    case 'full': return checkFull(marked);
  }
}

function checkLine(marked: boolean[][]): boolean {
  for (let row = 0; row < 5; row++) {
    if (marked[row].every(cell => cell)) return true;
  }
  for (let col = 0; col < 5; col++) {
    if (marked.every(row => row[col])) return true;
  }
  if (marked.every((row, i) => row[i])) return true;
  if (marked.every((row, i) => row[4 - i])) return true;
  return false;
}

function checkX(marked: boolean[][]): boolean {
  const diag1 = marked.every((row, i) => row[i]);
  const diag2 = marked.every((row, i) => row[4 - i]);
  return diag1 && diag2;
}

function checkFull(marked: boolean[][]): boolean {
  return marked.every(row => row.every(cell => cell));
}

export function getCompletion(marked: boolean[][], pattern: Pattern): number {
  const total = 25;
  const markedCount = marked.flat().filter(Boolean).length;
  if (pattern === 'full') return markedCount / total;

  let best = 0;
  for (let row = 0; row < 5; row++) {
    const pct = marked[row].filter(Boolean).length / 5;
    if (pct > best) best = pct;
  }
  for (let col = 0; col < 5; col++) {
    const count = marked.reduce((s, r) => s + (r[col] ? 1 : 0), 0);
    const pct = count / 5;
    if (pct > best) best = pct;
  }
  const d1 = marked.reduce((s, r, i) => s + (r[i] ? 1 : 0), 0) / 5;
  if (d1 > best) best = d1;
  const d2 = marked.reduce((s, r, i) => s + (r[4 - i] ? 1 : 0), 0) / 5;
  if (d2 > best) best = d2;

  return best;
}
