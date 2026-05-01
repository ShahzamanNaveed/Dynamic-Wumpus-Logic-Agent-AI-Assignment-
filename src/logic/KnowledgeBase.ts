import { exprToCNF, literalClause } from './cnf'
import type { Clause, Expr } from './expr'
import { ResolutionRefutation } from './resolution'

export class KnowledgeBase {
  private clauses: Clause[] = []
  private symbols: Set<string> = new Set()

  tell(expr: Expr) {
    const cnf = exprToCNF(expr)
    for (const clause of cnf) this.addClause(clause)
  }

  tellClause(clause: Clause) {
    this.addClause(clause)
  }

  askEntailsLiteral(literal: string, engine: ResolutionRefutation): { entailed: boolean; inferenceSteps: number } {
    engine.resetCounter()
    const res = engine.entailsByRefutation(this.getClauses(), [literalClause(literal)])
    return { entailed: res.entailed, inferenceSteps: res.inferenceSteps }
  }

  getClauses(): Clause[] {
    return this.clauses
  }

  getStats() {
    return {
      clauseCount: this.clauses.length,
      symbolCount: this.symbols.size,
    }
  }

  clone(): KnowledgeBase {
    const kb = new KnowledgeBase()
    // preserve object identity separation
    for (const cl of this.clauses) kb.tellClause(new Set(cl))
    return kb
  }

  private addClause(clause: Clause) {
    this.clauses.push(clause)
    for (const l of clause) {
      const sym = l.startsWith('!') ? l.slice(1) : l
      this.symbols.add(sym)
    }
  }
}

