import { negateLit, type CNF, type Clause, type Expr, type Literal } from './expr'

function flattenAnd(expr: Expr): Expr[] {
  if (expr.type !== 'and') return [expr]
  return expr.args.flatMap(flattenAnd)
}

function flattenOr(expr: Expr): Expr[] {
  if (expr.type !== 'or') return [expr]
  return expr.args.flatMap(flattenOr)
}

function eliminateImpIff(expr: Expr): Expr {
  switch (expr.type) {
    case 'var':
      return expr
    case 'not':
      return { type: 'not', expr: eliminateImpIff(expr.expr) }
    case 'and':
      return { type: 'and', args: expr.args.map(eliminateImpIff) }
    case 'or':
      return { type: 'or', args: expr.args.map(eliminateImpIff) }
    case 'imp': {
      // (a -> b) === (!a OR b)
      const a = eliminateImpIff(expr.a)
      const b = eliminateImpIff(expr.b)
      return { type: 'or', args: [{ type: 'not', expr: a }, b] }
    }
    case 'iff': {
      // (a <-> b) === (a->b) AND (b->a)
      const a = eliminateImpIff(expr.a)
      const b = eliminateImpIff(expr.b)
      return { type: 'and', args: [{ type: 'or', args: [{ type: 'not', expr: a }, b] }, { type: 'or', args: [{ type: 'not', expr: b }, a] }] }
    }
  }
}

function pushNotInwards(expr: Expr): Expr {
  switch (expr.type) {
    case 'var':
      return expr
    case 'and':
      return { type: 'and', args: expr.args.map(pushNotInwards) }
    case 'or':
      return { type: 'or', args: expr.args.map(pushNotInwards) }
    case 'not': {
      const e = expr.expr
      if (e.type === 'var') return expr
      if (e.type === 'not') return pushNotInwards(e.expr)
      if (e.type === 'and') return { type: 'or', args: e.args.map((x) => pushNotInwards({ type: 'not', expr: x })) }
      if (e.type === 'or') return { type: 'and', args: e.args.map((x) => pushNotInwards({ type: 'not', expr: x })) }
      // should not happen after eliminating imp/iff
      return pushNotInwards(eliminateImpIff(expr))
    }
    default:
      return pushNotInwards(eliminateImpIff(expr))
  }
}

function distributeOrOverAnd(a: Expr, b: Expr): Expr {
  // (a OR (b1 AND b2)) -> (a OR b1) AND (a OR b2)
  if (a.type === 'and') return { type: 'and', args: a.args.map((ai) => distributeOrOverAnd(ai, b)) }
  if (b.type === 'and') return { type: 'and', args: b.args.map((bi) => distributeOrOverAnd(a, bi)) }
  return { type: 'or', args: [a, b] }
}

function toCNFExpr(expr: Expr): Expr {
  const e = pushNotInwards(eliminateImpIff(expr))
  switch (e.type) {
    case 'and':
      return { type: 'and', args: e.args.map(toCNFExpr) }
    case 'or': {
      const items = flattenOr(e).map(toCNFExpr)
      // fold distribution left
      let acc = items[0]
      for (let i = 1; i < items.length; i++) acc = distributeOrOverAnd(acc, items[i])
      return acc
    }
    default:
      return e
  }
}

function clauseFromOrExpr(expr: Expr): Clause {
  const out: Clause = new Set()
  const items = flattenOr(expr)
  for (const it of items) {
    if (it.type === 'var') out.add(it.name)
    else if (it.type === 'not' && it.expr.type === 'var') out.add(`!${it.expr.name}`)
    else throw new Error('CNF conversion produced non-literal in clause')
  }
  return simplifyClause(out)
}

function simplifyClause(clause: Clause): Clause {
  // remove duplicates already handled by Set; drop tautologies
  for (const l of clause) {
    if (clause.has(negateLit(l))) return new Set(['__TAUTOLOGY__'])
  }
  return clause
}

function simplifyCNF(cnf: CNF): CNF {
  const out: CNF = []
  for (const cl of cnf) {
    if (cl.size === 1 && cl.has('__TAUTOLOGY__')) continue
    out.push(cl)
  }
  return out
}

export function exprToCNF(expr: Expr): CNF {
  const cnfExpr = toCNFExpr(expr)
  if (cnfExpr.type === 'and') {
    const clauses = flattenAnd(cnfExpr).map((e) => clauseFromOrExpr(e.type === 'or' ? e : e))
    return simplifyCNF(
      clauses.map((cl) => {
        // if it wasn't OR, clauseFromOrExpr will treat as literal (via flattenOr)
        return cl
      }),
    )
  }
  return simplifyCNF([clauseFromOrExpr(cnfExpr.type === 'or' ? cnfExpr : cnfExpr)])
}

export function literalClause(l: Literal): Clause {
  return new Set([l])
}

