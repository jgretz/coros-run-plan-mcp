# CLAUDE.md

**Important:** After reading this file, read `CLAUDE-WORKING.md` for ongoing work context and session notes.

## Imports

#.claude/rules/typescript.md
#.claude/rules/testing.md
#.claude/rules/git.md
#.claude/rules/integrations.md
#.claude/rules/error-handling.md

## Project

Coros - MCP server for connecting to the COROS Training Hub API. Enables Claude to create and manage scheduled exercises (runs/bikes) on the COROS calendar.

## Commands

```bash
bun install              # Install deps
bun run dev              # Dev server
bun test                 # Run tests (uses bun:test)
```

## Code Style

- Prettier: single quotes, semicolons, trailing commas
- ES modules only (import/export), destructure imports
- Functional > OO > procedural
- Prefer `function()` over `() =>`
- Small composable functions
- Comments only for "why", be terse

## Rules

- Do what's asked; nothing more, nothing less
- Be terse in explanations
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER create .md files unless explicitly requested
- Record working notes and learnings to `CLAUDE-WORKING.md`
