# Coros

MCP server for connecting to the COROS Training Hub API. Enables Claude to create and manage scheduled exercises (runs/bikes) on the COROS calendar.

**After reading:** Check CLAUDE-WORKING.md for ongoing work context.

## Commands

```bash
bun install              # Install deps
bun run dev              # Dev server
bun test                 # Run tests (uses bun:test)
```

## Project Rules

- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER create .md files unless explicitly requested
- Record working notes to CLAUDE-WORKING.md

## MCP Structure

- Tools expose discrete actions (create, read, update, delete)
- Use clear tool names and descriptions
- Validate inputs with schemas
- Return structured responses
- Keep business logic separate from MCP tool handlers
- API client handles protocol, tool handlers handle MCP framing
- Use DI/configuration for API credentials
