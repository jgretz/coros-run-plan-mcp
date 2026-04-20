import { z } from 'zod';
import { defineTool } from '../types.ts';
import { fetchActivityDetail } from '../../api/training-data.ts';
import { capOutput } from '../../utils.ts';

export const getActivity = defineTool({
  name: 'get_activity',
  description:
    'Get full detail for a single COROS activity including laps, HR zones, power metrics. Requires sportType from list_activities.',
  inputSchema: {
    id: z.string().describe('Activity ID (labelId) from list_activities'),
    sportType: z
      .number()
      .int()
      .describe('Sport type ID from list_activities (e.g. 100=Running, 200=Road Bike, 201=Indoor Cycling). Required by COROS API.'),
  },
  async handler({ id, sportType }) {
    const result = await fetchActivityDetail(id, sportType);
    if (!result.ok) {
      return {
        content: [{ type: 'text' as const, text: `Failed to get activity: ${result.error}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: capOutput(JSON.stringify(result.value)) }],
    };
  },
});
