# Wumpus KB Pathfinding Agent (React + Vite)

React + Vite + Tailwind web app implementing a **Knowledge-Based Pathfinding Agent** in a Wumpus World-style grid.

## Features

- **User-defined grid size** (rows × cols)
- **Random world generation**: ~20% pits + exactly 1 Wumpus (start cell is always safe)
- **Percepts**:
  - Breeze if adjacent to a pit
  - Stench if adjacent to the Wumpus
- **Knowledge Base (Propositional Logic)**:
  - `TELL`: add CNF clauses/sentences
  - `ASK`: query with **resolution refutation** (counts inference steps)
  - Agent proves **¬Pit ∧ ¬Wumpus** before moving into a cell when possible
- **Visualization**:
  - 🟢 Safe/Visited
  - ⬜ Unknown
  - 🔴 Confirmed Pit/Wumpus (entailed by KB)
  - 🟡 Agent position
- **Controls**: step-by-step and auto-run

## Run locally

```bash
cd wumpus-kb-agent
npm install
npm run dev
```

## Key files

- UI: `src/App.tsx`
- Environment: `src/wumpus/world.ts`
- Agent: `src/wumpus/WumpusAgent.ts`
- KB + logic:
  - `src/logic/KnowledgeBase.ts`
  - `src/logic/cnf.ts`
  - `src/logic/resolution.ts`
  - `src/logic/expr.ts`

