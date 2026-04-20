import { describe, it, expect } from 'bun:test';
import { tools, registerTools } from '../../src/tools/index.ts';

const EXPECTED_TOOL_NAMES = [
  'coros_login',
  'list_workouts',
  'get_workout',
  'create_workout',
  'delete_workout',
  'get_calendar',
  'schedule_workout',
  'unschedule_workout',
  'list_activities',
  'get_activity',
  'get_daily_metrics',
];

describe('tools registry', () => {
  it('should export all tools', () => {
    expect(tools).toHaveLength(EXPECTED_TOOL_NAMES.length);
  });

  it('should have unique tool names', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(EXPECTED_TOOL_NAMES.length);
  });

  it('should contain expected tool names', () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
  });

  it('should register all tools with the server', () => {
    const registered: string[] = [];
    const server = {
      registerTool: (name: string) => {
        registered.push(name);
      },
    };

    registerTools(server as never);

    expect(registered).toHaveLength(EXPECTED_TOOL_NAMES.length);
    expect(registered).toContain('coros_login');
    expect(registered).toContain('list_activities');
    expect(registered).toContain('get_daily_metrics');
  });
});
