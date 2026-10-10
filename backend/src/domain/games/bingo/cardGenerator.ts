export interface BingoCard {
  id: string;
  numbers: number[][];
  marked: boolean[][];
}

function shuffleAndPick(min: number, max: number, count: number): number[] {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

export function generateCard(): BingoCard {
  const bCol = shuffleAndPick(1, 15, 5);
  const iCol = shuffleAndPick(16, 30, 5);
  const nCol = shuffleAndPick(31, 45, 4);
  const gCol = shuffleAndPick(46, 60, 5);
  const oCol = shuffleAndPick(61, 75, 5);

  const numbers: number[][] = [];
  const marked: boolean[][] = [];

  for (let row = 0; row < 5; row++) {
    numbers[row] = [];
    marked[row] = [];
    numbers[row][0] = bCol[row];
    marked[row][0] = false;
    numbers[row][1] = iCol[row];
    marked[row][1] = false;
    if (row === 2) {
      numbers[row][2] = 0;
      marked[row][2] = true;
    } else {
      const nIndex = row < 2 ? row : row - 1;
      numbers[row][2] = nCol[nIndex];
      marked[row][2] = false;
    }
    numbers[row][3] = gCol[row];
    marked[row][3] = false;
    numbers[row][4] = oCol[row];
    marked[row][4] = false;
  }

  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    numbers,
    marked,
  };
}
