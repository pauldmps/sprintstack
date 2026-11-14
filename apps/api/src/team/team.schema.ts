import { z } from 'zod';
import { userIdSchema } from '@/common.schema';
import { ProjectRole, TimeOffType } from '../generated/prisma/enums';

/** Date-only columns travel as ISO dates, so no timezone can shift them a day. */
export const isoDateSchema = z.iso.date();

const titleSchema = z
  .string()
  .trim()
  .max(60)
  .nullish()
  .transform((value) => value || null);

export const updateTeamMemberSchema = z.object({
  userId: userIdSchema,
  role: z.enum(ProjectRole).optional(),
  // Left out stays as it is; null or blank clears it.
  title: titleSchema.optional(),
  estimates: z.boolean().optional(),
});

const holidayNameSchema = z.string().trim().min(1, 'Name is required.').max(60);

export const createHolidaySchema = z.object({
  date: isoDateSchema,
  name: holidayNameSchema,
});

export const updateHolidaySchema = z.object({
  date: isoDateSchema.optional(),
  name: holidayNameSchema.optional(),
});

// Keep in step with timeOffSchema in packages/shared/src/schemas/time-off.ts.
export const timeOffSchema = z
  .object({
    userId: userIdSchema,
    type: z.enum(TimeOffType),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  // ISO dates sort as text.
  .refine((value) => value.startDate <= value.endDate, {
    path: ['endDate'],
    message: 'The last day can’t be before the first.',
  })
  .refine((value) => value.type !== 'half' || value.startDate === value.endDate, {
    path: ['endDate'],
    message: 'A half day covers one day only.',
  });

export const setSprintCapacitySchema = z.object({
  sprintId: z.uuid(),
  userId: userIdSchema,
  // The column is Decimal(4, 1); a sprint is never near that long.
  adjustmentDays: z.number().multipleOf(0.5, 'Use whole or half days.').min(-60).max(60),
});

export type UpdateTeamMember = z.output<typeof updateTeamMemberSchema>;
export type CreateHoliday = z.output<typeof createHolidaySchema>;
export type UpdateHoliday = z.output<typeof updateHolidaySchema>;
export type TimeOffEntry = z.output<typeof timeOffSchema>;
export type SetSprintCapacity = z.output<typeof setSprintCapacitySchema>;
