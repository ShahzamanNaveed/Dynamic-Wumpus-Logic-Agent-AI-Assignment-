export type Coord = { r: number; c: number }

export function coordKey(coord: Coord): string {
  return `${coord.r},${coord.c}`
}

export function parseCoordKey(key: string): Coord {
  const [r, c] = key.split(',').map((x) => Number.parseInt(x, 10))
  return { r, c }
}

export function inBounds(coord: Coord, rows: number, cols: number): boolean {
  return coord.r >= 0 && coord.r < rows && coord.c >= 0 && coord.c < cols
}

export function neighbors4(coord: Coord): Coord[] {
  return [
    { r: coord.r - 1, c: coord.c },
    { r: coord.r + 1, c: coord.c },
    { r: coord.r, c: coord.c - 1 },
    { r: coord.r, c: coord.c + 1 },
  ]
}

export function neighbors8(coord: Coord): Coord[] {
  return [
    { r: coord.r - 1, c: coord.c - 1 },
    { r: coord.r - 1, c: coord.c },
    { r: coord.r - 1, c: coord.c + 1 },
    { r: coord.r, c: coord.c - 1 },
    { r: coord.r, c: coord.c + 1 },
    { r: coord.r + 1, c: coord.c - 1 },
    { r: coord.r + 1, c: coord.c },
    { r: coord.r + 1, c: coord.c + 1 },
  ]
}

