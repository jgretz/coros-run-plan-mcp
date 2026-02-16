import { z } from 'zod';

export const DaySchema = z
  .string()
  .regex(/^\d{8}$/, 'Day must be YYYYMMDD format');
