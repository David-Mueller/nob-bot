export type Activity = {
  auftraggeber: string | null
  thema: string | null
  beschreibung: string
  minuten: number | null
  km: number
  auslagen: number
  datum: string | null
}

export type ActivityEntry = {
  id: number
  activity: Activity
  transcript: string
  timestamp: Date
  saved: boolean
  savedFilePath?: string
}
