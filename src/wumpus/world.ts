import { inBounds, neighbors4, type Coord } from './coords'

export type Cell = {
  pit: boolean
  wumpus: boolean
  gold: boolean
}

export type Percept = {
  breeze: boolean
  stench: boolean
}

export type World = {
  rows: number
  cols: number
  grid: Cell[][]
}

export function createWorld(opts: {
  rows: number
  cols: number
  pitCount: number
  wumpusCount: number
}): World {
  const { rows, cols } = opts
  const grid: Cell[][] = Array.from({ length: rows }).map(() =>
    Array.from({ length: cols }).map(() => ({ pit: false, wumpus: false, gold: false })),
  )

  const start: Coord = { r: 0, c: 0 }

  const available: Coord[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === start.r && c === start.c) continue
      available.push({ r, c })
    }
  }

  // Fisher-Yates shuffle for random placements
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[available[i], available[j]] = [available[j], available[i]]
  }

  const maxSlots = available.length
  const pitsToPlace = Math.max(0, Math.min(opts.pitCount, maxSlots))
  const remainingAfterPits = maxSlots - pitsToPlace
  const wumpusToPlace = Math.max(0, Math.min(opts.wumpusCount, remainingAfterPits))
  const remainingAfterHazards = remainingAfterPits - wumpusToPlace

  let idx = 0
  for (let i = 0; i < pitsToPlace; i++, idx++) {
    const p = available[idx]
    grid[p.r][p.c].pit = true
  }

  for (let i = 0; i < wumpusToPlace; i++, idx++) {
    const w = available[idx]
    grid[w.r][w.c].wumpus = true
  }

  // place exactly one gold on a non-hazard, non-start cell when possible
  if (remainingAfterHazards > 0) {
    const g = available[idx]
    grid[g.r][g.c].gold = true
  } else {
    // fallback: if no free slot remains, place gold at start
    grid[start.r][start.c].gold = true
  }

  return { rows, cols, grid }
}

export function perceptAt(world: World, coord: Coord): Percept {
  const adj = neighbors4(coord).filter((n) => inBounds(n, world.rows, world.cols))
  let breeze = false
  let stench = false
  for (const n of adj) {
    const cell = world.grid[n.r][n.c]
    if (cell.pit) breeze = true
    if (cell.wumpus) stench = true
  }
  return { breeze, stench }
}

export function isHazard(world: World, coord: Coord): boolean {
  const cell = world.grid[coord.r][coord.c]
  return cell.pit || cell.wumpus
}

export function hasGold(world: World, coord: Coord): boolean {
  return world.grid[coord.r][coord.c].gold
}

