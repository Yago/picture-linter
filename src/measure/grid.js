export const GRID = {
  minWidth: 300,
  maxWidth: 3000,
  step: 20,
  aspectRatios: [16 / 9, 3 / 4],
  densities: [1, 2, 3],
};

export function viewportKey(width, height) {
  return `${width}x${height}`;
}

export function parseViewportKey(key) {
  const [width, height] = key.split('x').map(Number);
  return { width, height };
}

export function* iterateGrid() {
  for (const ratio of GRID.aspectRatios) {
    for (let width = GRID.minWidth; width <= GRID.maxWidth; width += GRID.step) {
      yield { width, height: Math.round(width / ratio), ratio };
    }
  }
}

export function gridSize() {
  const widths = Math.floor((GRID.maxWidth - GRID.minWidth) / GRID.step) + 1;
  return widths * GRID.aspectRatios.length;
}
