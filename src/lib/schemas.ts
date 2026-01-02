import { z } from 'zod';

export const bangladeshPhoneSchema = z
  .string()
  .regex(/^(\+?880|88)?017\d{8}$/, 'Invalid Bangladesh phone number');

export const studentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  studentPhone: z.string().optional().refine((val) => !val || bangladeshPhoneSchema.safeParse(val).success, 'Invalid student phone'),
  guardianPhone: z.string().optional().refine((val) => !val || bangladeshPhoneSchema.safeParse(val).success, 'Invalid guardian phone'),
  teacherPhone: z.string().optional().refine((val) => !val || bangladeshPhoneSchema.safeParse(val).success, 'Invalid teacher phone'),
});

export const paymentSchema = z.object({
  studentId: z.string().min(1, 'Student ID required'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  status: z.enum(['paid', 'unpaid']).default('unpaid'),
});

export const settingsSchema = z.object({
  coachingName: z.string().min(1, 'Coaching name required'),
  sendToStudent: z.boolean().default(true),
  sendToGuardian: z.boolean().default(true),
  sendToTeacher: z.boolean().default(false),
});

export const markPaidSchema = z.object({
  studentId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export type Student = z.infer<typeof studentSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type MarkPaidInput = z.infer<typeof markPaidSchema>;
