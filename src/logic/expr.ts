export type Expr =
  | { type: 'var'; name: string }
  | { type: 'not'; expr: Expr }
  | { type: 'and'; args: Expr[] }
  | { type: 'or'; args: Expr[] }
  | { type: 'imp'; a: Expr; b: Expr }
  | { type: 'iff'; a: Expr; b: Expr }

export const v = (name: string): Expr => ({ type: 'var', name })
export const not = (expr: Expr): Expr => ({ type: 'not', expr })
export const and = (...args: Expr[]): Expr => ({ type: 'and', args })
export const or = (...args: Expr[]): Expr => ({ type: 'or', args })
export const imp = (a: Expr, b: Expr): Expr => ({ type: 'imp', a, b })
export const iff = (a: Expr, b: Expr): Expr => ({ type: 'iff', a, b })

export type Literal = string // e.g. "P_1_2" or "!P_1_2"
export type Clause = Set<Literal>
export type CNF = Clause[] // conjunction of clauses

export function lit(name: string, neg = false): Literal {
  return neg ? `!${name}` : name
}

export function negateLit(l: Literal): Literal {
  return l.startsWith('!') ? l.slice(1) : `!${l}`
}

