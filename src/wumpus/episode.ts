import { createWorld, type World } from './world'

export type EpisodeState = {
  world: World
  revealAll: boolean
}

export function createNewEpisode(opts: {
  rows: number
  cols: number
  pitCount: number
  wumpusCount: number
}): EpisodeState {
  return {
    world: createWorld(opts),
    revealAll: false,
  }
}

