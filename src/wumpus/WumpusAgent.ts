import { KnowledgeBase } from '../logic/KnowledgeBase'
import { ResolutionRefutation } from '../logic/resolution'
import { coordKey, inBounds, neighbors4, neighbors8, type Coord } from './coords'
import { hasGold, isHazard, perceptAt, type Percept, type World } from './world'
import { breezeSym, pitSym, stenchSym, wumpusSym } from './symbols'

type AgentStatus = 'alive' | 'dead' | 'stuck' | 'won'

function lit(name: string, neg = false) {
  return neg ? `!${name}` : name
}

export class WumpusAgent {
  readonly world: World
  readonly kb: KnowledgeBase
  readonly engine: ResolutionRefutation

  pos: Coord = { r: 0, c: 0 }
  visited: Set<string> = new Set()

  status: AgentStatus = 'alive'
  foundGold = false
  lastPercept: Percept | null = null
  lastDecision: string | null = null

  totalInferenceSteps = 0
  lastAskInferenceSteps = 0
  private kbRevision = 0
  private knownSafe = new Set<string>()
  private knownPit = new Set<string>()
  private knownWumpus = new Set<string>()
  private literalQueryCache = new Map<string, { revision: number; entailed: boolean; inferenceSteps: number }>()
  private perceptLog = new Map<string, Percept>()

  constructor(world: World) {
    this.world = world
    this.kb = new KnowledgeBase()
    this.engine = new ResolutionRefutation()

    // Start cell is safe by definition in this environment
    this.kb.tellClause(new Set([lit(pitSym(this.pos), true)]))
    this.kb.tellClause(new Set([lit(wumpusSym(this.pos), true)]))
  }

  clone(): WumpusAgent {
    const a = new WumpusAgent(this.world)
    ;(a as any).pos = { ...this.pos }
    ;(a as any).visited = new Set(this.visited)
    ;(a as any).status = this.status
    ;(a as any).foundGold = this.foundGold
    ;(a as any).lastPercept = this.lastPercept ? { ...this.lastPercept } : null
    ;(a as any).lastDecision = this.lastDecision
    ;(a as any).totalInferenceSteps = this.totalInferenceSteps
    ;(a as any).lastAskInferenceSteps = this.lastAskInferenceSteps
    ;(a as any).kbRevision = this.kbRevision
    ;(a as any).knownSafe = new Set(this.knownSafe)
    ;(a as any).knownPit = new Set(this.knownPit)
    ;(a as any).knownWumpus = new Set(this.knownWumpus)
    ;(a as any).literalQueryCache = new Map(this.literalQueryCache)
    ;(a as any).perceptLog = new Map(this.perceptLog)
    ;(a as any).engine = new ResolutionRefutation()
    ;(a as any).kb = this.kb.clone()
    return a
  }

  step() {
    if (this.status !== 'alive') return

    // perceive and update KB at current cell
    const percept = perceptAt(this.world, this.pos)
    this.lastPercept = percept
    const currentKey = coordKey(this.pos)
    this.visited.add(currentKey)
    this.knownSafe.add(currentKey)
    this.perceptLog.set(currentKey, percept)

    this.updateKBFromPercept(this.pos, percept)

    // if we stepped into hazard, we die
    if (isHazard(this.world, this.pos)) {
      this.status = 'dead'
      this.lastDecision = 'Died (entered Pit/Wumpus)'
      return
    }

    // goal test: stop as soon as gold is found
    if (hasGold(this.world, this.pos)) {
      this.foundGold = true
      this.status = 'won'
      this.lastDecision = 'Found the gold! Search complete.'
      return
    }

    // choose next move
    const next = this.chooseNextMove()
    if (!next) {
      this.status = 'stuck'
      this.lastDecision = 'No moves available'
      return
    }
    this.lastDecision = `Move to (${next.r + 1}, ${next.c + 1})`
    this.pos = next
  }

  getCellStatus(coord: Coord): {
    provenSafe: boolean
    confirmedPit: boolean
    confirmedWumpus: boolean
    confirmedHazard: boolean
  } {
    const key = coordKey(coord)
    const confirmedPit = this.knownPit.has(key)
    const confirmedWumpus = this.knownWumpus.has(key)
    const confirmedHazard = confirmedPit || confirmedWumpus
    return {
      provenSafe: this.knownSafe.has(key),
      confirmedPit,
      confirmedWumpus,
      confirmedHazard,
    }
  }

  getPerceptAt(coord: Coord): Percept | null {
    return this.perceptLog.get(coordKey(coord)) ?? null
  }

  private chooseNextMove(): Coord | null {
    this.lastAskInferenceSteps = 0

    const candidates = neighbors8(this.pos).filter((n) => inBounds(n, this.world.rows, this.world.cols))
    const unvisited = candidates.filter((c) => !this.visited.has(coordKey(c)))
    if (unvisited.length === 0) return null

    const provenSafe: Coord[] = []
    const unknown: Coord[] = []

    for (const c of unvisited) {
      const result = this.inferCell(c)
      const resPit = { entailed: result.noPit, inferenceSteps: result.stepsNoPit }
      const resW = { entailed: result.noWumpus, inferenceSteps: result.stepsNoWumpus }
      this.lastAskInferenceSteps += resPit.inferenceSteps + resW.inferenceSteps

      if (resPit.entailed && resW.entailed) provenSafe.push(c)
      else unknown.push(c)
    }

    if (provenSafe.length > 0) return provenSafe[0]
    return unknown[0]
  }

  private updateKBFromPercept(at: Coord, percept: Percept) {
    const adj = neighbors4(at).filter((n) => inBounds(n, this.world.rows, this.world.cols))

    // record percept symbols
    this.kb.tellClause(new Set([lit(breezeSym(at), !percept.breeze)]))
    this.kb.tellClause(new Set([lit(stenchSym(at), !percept.stench)]))

    // Breeze rules (Pits)
    if (!percept.breeze) {
      // No breeze => all adjacent are not pits
      for (const n of adj) this.kb.tellClause(new Set([lit(pitSym(n), true)]))
    } else {
      // Breeze => at least one adjacent pit (P1 OR P2 OR ...)
      const clause = new Set<string>()
      for (const n of adj) clause.add(lit(pitSym(n), false))
      if (clause.size > 0) this.kb.tellClause(clause)
    }

    // Stench rules (Wumpus)
    if (!percept.stench) {
      // No stench => all adjacent are not wumpus
      for (const n of adj) this.kb.tellClause(new Set([lit(wumpusSym(n), true)]))
    } else {
      // Stench => at least one adjacent wumpus (W1 OR W2 OR ...)
      const clause = new Set<string>()
      for (const n of adj) clause.add(lit(wumpusSym(n), false))
      if (clause.size > 0) this.kb.tellClause(clause)
    }
    this.kbRevision += 1
    this.literalQueryCache.clear()
  }

  private queryLiteralCached(literal: string, count: boolean): { entailed: boolean; inferenceSteps: number } {
    const cached = this.literalQueryCache.get(literal)
    if (cached && cached.revision === this.kbRevision) {
      if (count) this.totalInferenceSteps += cached.inferenceSteps
      return { entailed: cached.entailed, inferenceSteps: cached.inferenceSteps }
    }

    const { entailed, inferenceSteps } = this.kb.askEntailsLiteral(literal, this.engine)
    this.literalQueryCache.set(literal, { revision: this.kbRevision, entailed, inferenceSteps })
    if (count) this.totalInferenceSteps += inferenceSteps
    return { entailed, inferenceSteps }
  }

  private inferCell(coord: Coord): {
    noPit: boolean
    noWumpus: boolean
    stepsNoPit: number
    stepsNoWumpus: number
  } {
    const key = coordKey(coord)
    if (this.knownPit.has(key)) return { noPit: false, noWumpus: false, stepsNoPit: 0, stepsNoWumpus: 0 }
    if (this.knownWumpus.has(key)) return { noPit: false, noWumpus: false, stepsNoPit: 0, stepsNoWumpus: 0 }
    if (this.knownSafe.has(key)) return { noPit: true, noWumpus: true, stepsNoPit: 0, stepsNoWumpus: 0 }

    const pit = pitSym(coord)
    const w = wumpusSym(coord)

    const noPitRes = this.queryLiteralCached(lit(pit, true), true)
    const noWumpusRes = this.queryLiteralCached(lit(w, true), true)
    const pitRes = this.queryLiteralCached(lit(pit, false), false)
    const wumpusRes = this.queryLiteralCached(lit(w, false), false)

    if (pitRes.entailed) this.knownPit.add(key)
    if (wumpusRes.entailed) this.knownWumpus.add(key)
    if (noPitRes.entailed && noWumpusRes.entailed) this.knownSafe.add(key)

    return {
      noPit: noPitRes.entailed,
      noWumpus: noWumpusRes.entailed,
      stepsNoPit: noPitRes.inferenceSteps,
      stepsNoWumpus: noWumpusRes.inferenceSteps,
    }
  }
}

