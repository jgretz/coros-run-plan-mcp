import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpTool } from './types.ts';
import { corosLogin } from './auth/coros-login.ts';
import { listWorkouts } from './program/list-workouts.ts';
import { getWorkout } from './program/get-workout.ts';
import { createWorkout } from './program/create-workout.ts';
import { deleteWorkout } from './program/delete-workout.ts';
import { getCalendar } from './schedule/get-calendar.ts';
import { scheduleWorkoutTool } from './schedule/schedule-workout.ts';
import { unscheduleWorkoutTool } from './schedule/unschedule-workout.ts';

export const tools: McpTool[] = [
  corosLogin,
  listWorkouts,
  getWorkout,
  createWorkout,
  deleteWorkout,
  getCalendar,
  scheduleWorkoutTool,
  unscheduleWorkoutTool,
];

export function registerTools(server: McpServer): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      tool.handler,
    );
  }
}
