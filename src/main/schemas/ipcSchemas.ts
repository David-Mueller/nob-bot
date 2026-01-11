import { z } from 'zod'

// Path validation schemas
export const FilePathSchema = z
  .string()
  .min(1, 'Path required')
  .max(500, 'Path too long')
  .refine((p) => !p.includes('..'), 'Path traversal not allowed')

export const ExcelPathSchema = FilePathSchema.refine(
  (p) => /\.(xlsx|xls)$/i.test(p),
  'Must be Excel file'
)

// Activity schema for excel:saveActivity
export const ActivitySchema = z.object({
  auftraggeber: z.string().nullable(),
  thema: z.string().nullable(),
  beschreibung: z.string().min(1),
  minuten: z.number().nullable(),
  km: z.number().default(0),
  auslagen: z.number().default(0),
  datum: z.string().nullable()
})

export type ValidatedActivity = z.infer<typeof ActivitySchema>

// Settings update schema for config:updateSettings
export const SettingsUpdateSchema = z.object({
  hotkey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  whisperModel: z.enum(['tiny', 'base', 'small']).optional(),
  ttsEnabled: z.boolean().optional(),
  ttsVoice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional()
})

export type ValidatedSettingsUpdate = z.infer<typeof SettingsUpdateSchema>

// Draft activity schema for drafts:save
export const DraftActivitySchema = z.object({
  id: z.number(),
  activity: ActivitySchema,
  transcript: z.string(),
  timestamp: z.string(),
  saved: z.boolean()
})

export const DraftArraySchema = z.array(DraftActivitySchema)

export type ValidatedDraftActivity = z.infer<typeof DraftActivitySchema>

// File config update schema for config:updateFile
export const FileConfigUpdateSchema = z.object({
  auftraggeber: z.string().optional(),
  jahr: z.number().int().min(2000).max(2100).optional(),
  active: z.boolean().optional()
})

export type ValidatedFileConfigUpdate = z.infer<typeof FileConfigUpdateSchema>

// Auftraggeber + Jahr lookup schema
export const AuftraggeberLookupSchema = z.object({
  auftraggeber: z.string().min(1),
  jahr: z.number().int().min(2000).max(2100)
})

// Month schema for excel:getActivities
export const MonthSchema = z.number().int().min(1).max(12)

// String schemas for simple text inputs
export const StringInputSchema = z.string().min(1)
