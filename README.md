# Coros MCP for Run & Bike workouts

MCP server for the COROS Training Hub API. Create, manage, and schedule run/bike workouts from Claude.

## Prerequisites

- [Bun](https://bun.sh) runtime
- COROS account with email login

## Setup

```bash
git clone <repo-url>
cd coros
bun install
```

## Configuration

Set these environment variables:

| Variable         | Description                                     | Required |
| ---------------- | ----------------------------------------------- | -------- |
| `COROS_EMAIL`    | COROS account email                             | Yes      |
| `COROS_PASSWORD` | COROS account password                          | Yes      |
| `COROS_REGION`   | API region: `us`, `eu`, or `cn` (default: `us`) | No       |

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "coros": {
      "command": "bunx",
      "args": ["--bun", "coros"],
      "env": {
        "COROS_EMAIL": "your@email.com",
        "COROS_PASSWORD": "your-password",
        "COROS_REGION": "us"
      }
    }
  }
}
```

### Claude Code

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "coros": {
      "command": "bunx",
      "args": ["--bun", "coros"],
      "env": {
        "COROS_EMAIL": "your@email.com",
        "COROS_PASSWORD": "your-password",
        "COROS_REGION": "us"
      }
    }
  }
}
```

## Available Tools

| Tool                 | Description                                                                      |
| -------------------- | -------------------------------------------------------------------------------- |
| `coros_login`        | Authenticate with COROS Training Hub                                             |
| `list_workouts`      | List saved workouts, optionally filtered by sport or name                        |
| `get_workout`        | Get full details of a saved workout by ID                                        |
| `create_workout`     | Create a run or bike workout with warmup, intervals, steady blocks, and cooldown |
| `delete_workout`     | Delete one or more saved workouts by ID                                          |
| `get_calendar`       | Get scheduled workouts for a date range                                          |
| `schedule_workout`   | Add a saved workout to the calendar on a specific date                           |
| `unschedule_workout` | Remove a scheduled workout from the calendar                                     |

## Usage Examples

```
"Log in to COROS"
"List my run workouts"
"Create a 30-minute easy run with 10-minute warmup and 5-minute cooldown"
"Create a 6x800m interval workout at 5K pace with 400m recovery jogs"
"Schedule my tempo run for next Tuesday"
"Show my training calendar for this week"
"Remove the workout scheduled on 20260220"
```

## Notes

- **Regions**: `us` (default), `eu`, `cn` — must match your COROS account region
- **Sports**: run and bike only
- **Units**: time targets in seconds, distance targets in centimeters
- **Dates**: YYYYMMDD format (e.g. `20260216`)

## Inspiration

- [coros-workout-mcp](https://github.com/rowlando/coros-workout-mcp) — MCP server for COROS workouts
- [coros-mcp-server](https://lobehub.com/mcp/yourusername-coros-mcp-server) — COROS MCP server on LobeHub
- [coros-api](https://github.com/xballoy/coros-api) — Reverse-engineered COROS API client
