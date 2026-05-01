import type { Coord } from './coords'

export function pitSym(coord: Coord): string {
  return `P_${coord.r}_${coord.c}`
}

export function wumpusSym(coord: Coord): string {
  return `W_${coord.r}_${coord.c}`
}

export function breezeSym(coord: Coord): string {
  return `B_${coord.r}_${coord.c}`
}

export function stenchSym(coord: Coord): string {
  return `S_${coord.r}_${coord.c}`
}

