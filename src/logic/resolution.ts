import { negateLit, type Clause, type Literal } from './expr'

function clauseKey(c: Clause): string {
  return Array.from(c).sort().join('|')
}

function isTautology(c: Clause): boolean {
  for (const l of c) {
    if (c.has(negateLit(l))) return true
  }
  return false
}

function resolvePair(a: Clause, b: Clause): Clause[] {
  const out: Clause[] = []
  for (const lit of a) {
    const neg = negateLit(lit)
    if (!b.has(neg)) continue
    const resolvent: Clause = new Set()
    for (const x of a) if (x !== lit) resolvent.add(x)
    for (const y of b) if (y !== neg) resolvent.add(y)
    if (!isTautology(resolvent)) out.push(resolvent)
  }
  return out
}

export type ResolutionResult = {
  entailed: boolean
  inferenceSteps: number
  derivedClauses: number
}

export class ResolutionRefutation {
  inferenceSteps = 0
  maxInferenceSteps = 5000

  resetCounter() {
    this.inferenceSteps = 0
  }

  /**
   * Proves KB ⊨ query by refutation: KB ∧ ¬query is unsatisfiable.
   *
   * Input clauses must already be CNF.
   */
  entailsByRefutation(kbClauses: Clause[], queryClausesCNF: Clause[]): ResolutionResult {
    // negate query CNF by adding negation of each clause conjunction:
    // For our usage we pass query as a single literal clause CNF, so ¬query is just its negated literal.
    // If queryCNF has multiple clauses (AND), we conservatively only support the single-clause query form here.
    if (queryClausesCNF.length !== 1 || queryClausesCNF[0].size !== 1) {
      throw new Error('Only single-literal queries are supported in entailsByRefutation')
    }

    const [onlyLit] = Array.from(queryClausesCNF[0]) as [Literal]
    const negatedQuery: Clause = new Set([negateLit(onlyLit)])

    const clauses: Clause[] = [...kbClauses.map((c) => new Set(c)), negatedQuery]
    const seen = new Set<string>(clauses.map(clauseKey))
    const pairsChecked = new Set<string>()

    const queue: number[] = clauses.map((_, idx) => idx)
    let qIndex = 0

    while (qIndex < queue.length) {
      const i = queue[qIndex++]
      const ci = clauses[i]
      for (let j = 0; j < clauses.length; j++) {
        const cj = clauses[j]
        const a = i < j ? i : j
        const b = i < j ? j : i
        const key = `${a}:${b}`
        if (pairsChecked.has(key)) continue
        pairsChecked.add(key)

        const resolvents = resolvePair(ci, cj)
        for (const r of resolvents) {
          this.inferenceSteps += 1
          if (this.inferenceSteps >= this.maxInferenceSteps) {
            return { entailed: false, inferenceSteps: this.inferenceSteps, derivedClauses: seen.size }
          }
          if (r.size === 0) {
            return { entailed: true, inferenceSteps: this.inferenceSteps, derivedClauses: seen.size }
          }
          const rk = clauseKey(r)
          if (!seen.has(rk)) {
            seen.add(rk)
            clauses.push(r)
            queue.push(clauses.length - 1)
          }
        }
      }
    }
    return { entailed: false, inferenceSteps: this.inferenceSteps, derivedClauses: seen.size }
  }
}

