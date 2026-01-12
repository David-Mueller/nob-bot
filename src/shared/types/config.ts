export type XlsxFileConfig = {
  path: string
  auftraggeber: string
  jahr: number
  active: boolean
}

export type AppSettings = {
  hotkey: string
  openaiApiKey: string
  ttsEnabled: boolean
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

export type AppConfig = {
  xlsxBasePath: string
  xlsxFiles: XlsxFileConfig[]
  settings: AppSettings
}
