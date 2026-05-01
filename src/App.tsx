import { useEffect, useMemo, useRef, useState } from 'react'
import { createNewEpisode, type EpisodeState } from './wumpus/episode'
import { WumpusAgent } from './wumpus/WumpusAgent'
import { coordKey, type Coord } from './wumpus/coords'

type RunMode = 'stopped' | 'running'

function clampInt(value: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function Cell({
  coord,
  episode,
  agent,
  status,
}: {
  coord: Coord
  episode: EpisodeState
  agent: WumpusAgent
  status: ReturnType<WumpusAgent['getCellStatus']>
}) {
  const isAgent = coord.r === agent.pos.r && coord.c === agent.pos.c
  const key = coordKey(coord)
  const visited = agent.visited.has(key)
  const worldCell = episode.world.grid[coord.r][coord.c]
  const showGold = worldCell.gold && (visited || episode.revealAll || agent.foundGold)
  const percept = agent.getPerceptAt(coord)
  const boardTone = (coord.r + coord.c) % 2 === 0 ? 'bg-slate-900/90' : 'bg-slate-900/60'

  const classes = useMemo(() => {
    if (isAgent) return 'bg-yellow-300 text-zinc-900 ring-yellow-100/70'
    if (showGold) return 'bg-amber-500 text-zinc-900 ring-amber-100/70'
    if (status.confirmedHazard) return 'bg-rose-500 text-white ring-rose-100/70'
    if (visited) return 'bg-emerald-900/95 text-emerald-200 ring-emerald-700/70'
    if (status.provenSafe) return 'bg-indigo-900/85 text-indigo-200 ring-indigo-600/60'
    return `${boardTone} text-zinc-200 ring-zinc-400/30`
  }, [boardTone, isAgent, showGold, status.confirmedHazard, status.provenSafe, visited])

  const mainLabel = useMemo(() => {
    if (isAgent) return 'A'
    if (showGold) return 'G'
    if (status.confirmedPit) return 'P'
    if (status.confirmedWumpus) return 'W'
    return ''
  }, [isAgent, showGold, status.confirmedPit, status.confirmedWumpus])

  const perceptLabel = useMemo(() => {
    if (!visited || !percept) return ''
    if (percept.breeze && percept.stench) return '~ !'
    if (percept.breeze) return '~'
    if (percept.stench) return '!'
    return ''
  }, [visited, percept])

  const title = useMemo(() => {
    const parts: string[] = [`(${coord.r + 1}, ${coord.c + 1})`]
    if (visited) parts.push('Visited')
    if (status.provenSafe) parts.push('Proven safe: ¬Pit ∧ ¬Wumpus')
    if (status.confirmedPit) parts.push('Confirmed Pit')
    if (status.confirmedWumpus) parts.push('Confirmed Wumpus')
    if (episode.revealAll) {
      const cell = episode.world.grid[coord.r][coord.c]
      if (cell.pit) parts.push('World: Pit')
      if (cell.wumpus) parts.push('World: Wumpus')
      if (cell.gold) parts.push('World: Gold')
    }
    if (showGold) parts.push('Gold discovered')
    return parts.join(' • ')
  }, [coord, episode, showGold, status, visited])

  return (
    <div
      title={title}
      className={[
        'relative h-14 w-14 select-none rounded-xl border border-white/10',
        'flex items-center justify-center font-bold ring-1 shadow-lg shadow-black/25',
        'transition-transform duration-200 hover:-translate-y-0.5',
        classes,
      ].join(' ')}
    >
      <span className="text-lg">{mainLabel}</span>
      <span className="absolute bottom-1 left-1 text-[10px] text-zinc-400">
        {coord.r},{coord.c}
      </span>
      <span className="absolute top-1 right-1 text-[11px] text-cyan-300">{perceptLabel}</span>
    </div>
  )
}

export default function App() {
  const [rowsInput, setRowsInput] = useState('8')
  const [colsInput, setColsInput] = useState('8')
  const [pitsInput, setPitsInput] = useState('12')
  const [wumpusInput, setWumpusInput] = useState('2')
  const [episode, setEpisode] = useState<EpisodeState>(() =>
    createNewEpisode({ rows: 8, cols: 8, pitCount: 12, wumpusCount: 2 }),
  )
  const [agent, setAgent] = useState(() => new WumpusAgent(episode.world))
  const [runMode, setRunMode] = useState<RunMode>('stopped')
  const timerRef = useRef<number | null>(null)

  const reset = () => {
    const rows = clampInt(rowsInput, 2, 14, 8)
    const cols = clampInt(colsInput, 2, 14, 8)
    const maxHazards = Math.max(0, rows * cols - 2)
    const pitCount = clampInt(pitsInput, 0, maxHazards, 12)
    const wumpusCount = clampInt(wumpusInput, 0, maxHazards - pitCount, 2)

    setRowsInput(String(rows))
    setColsInput(String(cols))
    setPitsInput(String(pitCount))
    setWumpusInput(String(wumpusCount))

    const nextEpisode = createNewEpisode({ rows, cols, pitCount, wumpusCount })
    setEpisode(nextEpisode)
    setAgent(new WumpusAgent(nextEpisode.world))
    setRunMode('stopped')
  }

  const step = () => {
    setAgent((prev) => {
      const next = prev.clone()
      next.step()
      return next
    })
  }

  useEffect(() => {
    if (runMode !== 'running') {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    if (timerRef.current != null) return
    timerRef.current = window.setInterval(() => {
      setAgent((prev) => {
        const next = prev.clone()
        next.step()
        return next
      })
    }, 160)
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [runMode])

  useEffect(() => {
    if (agent.status !== 'alive' && runMode === 'running') {
      setRunMode('stopped')
    }
  }, [agent.status, runMode])

  const statusGrid = useMemo(() => {
    const out: Record<string, ReturnType<WumpusAgent['getCellStatus']>> = {}
    for (let r = 0; r < episode.world.rows; r++) {
      for (let c = 0; c < episode.world.cols; c++) {
        const coord = { r, c }
        out[coordKey(coord)] = agent.getCellStatus(coord)
      }
    }
    return out
  }, [agent, episode.world.cols, episode.world.rows])

  const percept = agent.lastPercept
  const kbStats = agent.kb.getStats()
  const totalPits = useMemo(
    () => episode.world.grid.flat().filter((cell) => cell.pit).length,
    [episode.world.grid],
  )
  const totalWumpus = useMemo(
    () => episode.world.grid.flat().filter((cell) => cell.wumpus).length,
    [episode.world.grid],
  )
  const totalGold = useMemo(
    () => episode.world.grid.flat().filter((cell) => cell.gold).length,
    [episode.world.grid],
  )

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_#13203d_0%,_#080d19_40%,_#05070f_100%)] text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <div className="rounded-3xl border border-cyan-500/20 bg-[#050b18]/75 p-4 shadow-[0_0_80px_rgba(14,165,233,0.08)] backdrop-blur md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                Knowledge-Based Pathfinding Agent
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                Wumpus Board (Diagonal Mode)
              </h1>
              <div className="mt-1 text-sm text-zinc-300">
                Agent can move in 8 directions and reasons with resolution refutation.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400">Rows</span>
                <input
                  value={rowsInput}
                  onChange={(e) => setRowsInput(e.target.value)}
                  className="h-10 w-full rounded-lg bg-slate-900/90 px-3 text-sm ring-1 ring-cyan-400/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400">Cols</span>
                <input
                  value={colsInput}
                  onChange={(e) => setColsInput(e.target.value)}
                  className="h-10 w-full rounded-lg bg-slate-900/90 px-3 text-sm ring-1 ring-cyan-400/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400">Pits</span>
                <input
                  value={pitsInput}
                  onChange={(e) => setPitsInput(e.target.value)}
                  className="h-10 w-full rounded-lg bg-slate-900/90 px-3 text-sm ring-1 ring-cyan-400/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400">Wumpus</span>
                <input
                  value={wumpusInput}
                  onChange={(e) => setWumpusInput(e.target.value)}
                  className="h-10 w-full rounded-lg bg-slate-900/90 px-3 text-sm ring-1 ring-cyan-400/20"
                />
              </label>
              <button
                onClick={reset}
                className="h-10 rounded-lg bg-cyan-300 px-3 text-sm font-bold text-slate-900"
              >
                New Board
              </button>
              <button
                onClick={() => setEpisode((e) => ({ ...e, revealAll: !e.revealAll }))}
                className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-zinc-100 ring-1 ring-cyan-400/20"
              >
                {episode.revealAll ? 'Hide Map' : 'Reveal Map'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/45 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-zinc-300">
                  Hazards: <span className="font-bold text-rose-300">{totalPits}</span> pits,{' '}
                  <span className="font-bold text-fuchsia-300">{totalWumpus}</span> wumpus,{' '}
                  <span className="font-bold text-amber-300">{totalGold}</span> gold
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={step}
                    disabled={agent.status !== 'alive'}
                    className="h-10 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Step
                  </button>
                  <button
                    onClick={() => setRunMode((m) => (m === 'running' ? 'stopped' : 'running'))}
                    disabled={agent.status !== 'alive'}
                    className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {runMode === 'running' ? 'Stop' : 'Auto-run'}
                  </button>
                </div>
              </div>

              <div
                className="grid gap-1.5 rounded-2xl border border-cyan-500/20 bg-[#030916] p-3"
                style={{ gridTemplateColumns: `repeat(${episode.world.cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: episode.world.rows }).map((_, r) =>
                  Array.from({ length: episode.world.cols }).map((__, c) => {
                    const coord = { r, c }
                    const key = coordKey(coord)
                    return (
                      <Cell
                        key={key}
                        coord={coord}
                        episode={episode}
                        agent={agent}
                        status={statusGrid[key]}
                      />
                    )
                  }),
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
                <span className="rounded-md bg-amber-950 px-2 py-1 text-amber-200 ring-1 ring-amber-500/30">Agent (&lt;&gt;)</span>
                <span className="rounded-md bg-emerald-950 px-2 py-1 text-emerald-200 ring-1 ring-emerald-500/30">Visited safe</span>
                <span className="rounded-md bg-indigo-950 px-2 py-1 text-indigo-200 ring-1 ring-indigo-500/30">Inferred safe (?)</span>
                <span className="rounded-md bg-slate-900 px-2 py-1 text-zinc-300 ring-1 ring-slate-600/40">Unknown</span>
                <span className="rounded-md bg-rose-950 px-2 py-1 text-rose-200 ring-1 ring-rose-500/30">Pit</span>
                <span className="rounded-md bg-fuchsia-950 px-2 py-1 text-fuchsia-200 ring-1 ring-fuchsia-500/30">Wumpus</span>
                <span className="rounded-md bg-amber-950 px-2 py-1 text-amber-200 ring-1 ring-amber-500/30">Gold</span>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-cyan-200 ring-1 ring-cyan-500/30">~ Breeze</span>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-yellow-200 ring-1 ring-yellow-500/30">! Stench</span>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/45 p-4">
              <div className="text-sm font-semibold tracking-wide text-zinc-200">Live Sidebar</div>
              <div className="mt-3 grid gap-3 text-sm">
                <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-400">Percepts</div>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded-md bg-zinc-800 px-2 py-1">Breeze: {percept?.breeze ? 'Yes' : 'No'}</span>
                    <span className="rounded-md bg-zinc-800 px-2 py-1">Stench: {percept?.stench ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-400">Inference</div>
                  <div className="mt-1">Total steps: <span className="font-bold">{agent.totalInferenceSteps}</span></div>
                  <div>Last ask steps: <span className="font-bold">{agent.lastAskInferenceSteps}</span></div>
                </div>

                <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-400">Knowledge Base</div>
                  <div className="mt-1">Clauses: <span className="font-bold">{kbStats.clauseCount}</span></div>
                  <div>Symbols: <span className="font-bold">{kbStats.symbolCount}</span></div>
                </div>

                <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-3">
                  <div className="text-xs uppercase tracking-wider text-zinc-400">Agent</div>
                  <div className="mt-1">Status: <span className="font-bold">{agent.status}</span></div>
                  <div>
                    Position: <span className="font-bold">({agent.pos.r + 1}, {agent.pos.c + 1})</span>
                  </div>
                  <div>Visited: <span className="font-bold">{agent.visited.size}</span></div>
                  <div>Gold found: <span className="font-bold">{agent.foundGold ? 'Yes' : 'No'}</span></div>
                  <div className="truncate">Decision: <span className="font-bold">{agent.lastDecision ?? '(none yet)'}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

