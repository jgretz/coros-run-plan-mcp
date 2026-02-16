import { describe, it, expect } from 'bun:test';
import { tools, registerTools } from '../../src/tools/index.ts';

describe('tools registry', () => {
  it('should export all 8 tools', () => {
    expect(tools).toHaveLength(8);
  });

  it('should have unique tool names', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(8);
  });

  it('should contain expected tool names', () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual([
      'coros_login',
      'list_workouts',
      'get_workout',
      'create_workout',
      'delete_workout',
      'get_calendar',
      'schedule_workout',
      'unschedule_workout',
    ]);
  });

  it('should register all tools with the server', () => {
    const registered: string[] = [];
    const server = {
      registerTool: (name: string) => {
        registered.push(name);
      },
    };

    registerTools(server as never);

    expect(registered).toHaveLength(8);
    expect(registered).toContain('coros_login');
    expect(registered).toContain('schedule_workout');
  });
});
