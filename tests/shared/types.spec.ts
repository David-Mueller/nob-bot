import { describe, it, expect } from 'vitest'
import type {
  Activity,
  ActivityEntry,
  XlsxFileConfig,
  AppSettings,
  AppConfig,
  GlossarKategorie,
  GlossarEintrag,
  Glossar,
  SaveResult,
  WhisperMode,
  ProgressCallback
} from '@shared/types'

// Since these are pure type definitions, we test that they can be used correctly
// TypeScript compilation validates the types; runtime tests verify structure expectations

describe('shared/types/activity', () => {
  describe('Activity type', () => {
    it('should have correct structure with all fields', () => {
      const activity: Activity = {
        beschreibung: 'Test description',
        auftraggeber: 'Test Client',
        thema: 'Test Theme',
        datum: '2026-01-15',
        minuten: 60,
        km: 10,
        auslagen: 50
      }

      expect(activity.beschreibung).toBe('Test description')
      expect(activity.auftraggeber).toBe('Test Client')
      expect(activity.thema).toBe('Test Theme')
      expect(activity.datum).toBe('2026-01-15')
      expect(activity.minuten).toBe(60)
      expect(activity.km).toBe(10)
      expect(activity.auslagen).toBe(50)
    })

    it('should allow null for nullable fields', () => {
      const activity: Activity = {
        beschreibung: 'Minimal activity',
        auftraggeber: null,
        thema: null,
        datum: null,
        minuten: null,
        km: 0,
        auslagen: 0
      }

      expect(activity.auftraggeber).toBeNull()
      expect(activity.thema).toBeNull()
      expect(activity.datum).toBeNull()
      expect(activity.minuten).toBeNull()
    })

    it('should require beschreibung to be a string', () => {
      const activity: Activity = {
        beschreibung: 'Required field',
        auftraggeber: null,
        thema: null,
        datum: null,
        minuten: null,
        km: 0,
        auslagen: 0
      }

      expect(typeof activity.beschreibung).toBe('string')
    })
  })

  describe('ActivityEntry type', () => {
    it('should have correct structure', () => {
      const entry: ActivityEntry = {
        id: 1,
        activity: {
          beschreibung: 'Test',
          auftraggeber: 'Client',
          thema: 'Theme',
          datum: '2026-01-15',
          minuten: 30,
          km: 0,
          auslagen: 0
        },
        transcript: 'Voice transcript text',
        timestamp: new Date('2026-01-15T10:00:00Z'),
        saved: false
      }

      expect(entry.id).toBe(1)
      expect(entry.activity.beschreibung).toBe('Test')
      expect(entry.transcript).toBe('Voice transcript text')
      expect(entry.timestamp instanceof Date).toBe(true)
      expect(entry.saved).toBe(false)
    })

    it('should allow optional savedFilePath', () => {
      const entry: ActivityEntry = {
        id: 2,
        activity: {
          beschreibung: 'Test',
          auftraggeber: 'Client',
          thema: 'Theme',
          datum: '2026-01-15',
          minuten: 30,
          km: 0,
          auslagen: 0
        },
        transcript: 'Transcript',
        timestamp: new Date(),
        saved: true,
        savedFilePath: '/path/to/file.xlsx'
      }

      expect(entry.savedFilePath).toBe('/path/to/file.xlsx')
    })

    it('should allow undefined savedFilePath', () => {
      const entry: ActivityEntry = {
        id: 3,
        activity: {
          beschreibung: 'Test',
          auftraggeber: null,
          thema: null,
          datum: null,
          minuten: null,
          km: 0,
          auslagen: 0
        },
        transcript: 'Transcript',
        timestamp: new Date(),
        saved: false
      }

      expect(entry.savedFilePath).toBeUndefined()
    })
  })
})

describe('shared/types/config', () => {
  describe('XlsxFileConfig type', () => {
    it('should have correct structure', () => {
      const config: XlsxFileConfig = {
        path: '/path/to/file.xlsx',
        auftraggeber: 'Client Name',
        jahr: 2026,
        active: true
      }

      expect(config.path).toBe('/path/to/file.xlsx')
      expect(config.auftraggeber).toBe('Client Name')
      expect(config.jahr).toBe(2026)
      expect(config.active).toBe(true)
    })

    it('should allow inactive files', () => {
      const config: XlsxFileConfig = {
        path: '/path/to/old.xlsx',
        auftraggeber: 'Old Client',
        jahr: 2024,
        active: false
      }

      expect(config.active).toBe(false)
    })
  })

  describe('AppSettings type', () => {
    it('should have correct structure', () => {
      const settings: AppSettings = {
        hotkey: 'CommandOrControl+Shift+R',
        openaiApiKey: 'sk-test-key',
        hasApiKey: true,
        ttsEnabled: true,
        ttsVoice: 'nova'
      }

      expect(settings.hotkey).toBe('CommandOrControl+Shift+R')
      expect(settings.hasApiKey).toBe(true)
      expect(settings.ttsEnabled).toBe(true)
      expect(settings.ttsVoice).toBe('nova')
    })

    it('should accept all valid voice options', () => {
      const voices: Array<AppSettings['ttsVoice']> = [
        'alloy',
        'echo',
        'fable',
        'onyx',
        'nova',
        'shimmer'
      ]

      for (const voice of voices) {
        const settings: AppSettings = {
          hotkey: 'Alt+R',
          openaiApiKey: '',
          hasApiKey: false,
          ttsEnabled: false,
          ttsVoice: voice
        }
        expect(settings.ttsVoice).toBe(voice)
      }
    })
  })

  describe('AppConfig type', () => {
    it('should have correct structure', () => {
      const config: AppConfig = {
        xlsxBasePath: '/base/path',
        xlsxFiles: [
          {
            path: '/base/path/file1.xlsx',
            auftraggeber: 'Client 1',
            jahr: 2026,
            active: true
          },
          {
            path: '/base/path/file2.xlsx',
            auftraggeber: 'Client 2',
            jahr: 2025,
            active: false
          }
        ],
        settings: {
          hotkey: 'CommandOrControl+Shift+R',
          openaiApiKey: '',
          hasApiKey: true,
          ttsEnabled: false,
          ttsVoice: 'nova'
        }
      }

      expect(config.xlsxBasePath).toBe('/base/path')
      expect(config.xlsxFiles).toHaveLength(2)
      expect(config.settings.hotkey).toBe('CommandOrControl+Shift+R')
    })

    it('should allow empty xlsxFiles array', () => {
      const config: AppConfig = {
        xlsxBasePath: '/base/path',
        xlsxFiles: [],
        settings: {
          hotkey: 'Alt+R',
          openaiApiKey: '',
          hasApiKey: false,
          ttsEnabled: false,
          ttsVoice: 'alloy'
        }
      }

      expect(config.xlsxFiles).toHaveLength(0)
    })
  })
})

describe('shared/types/glossar', () => {
  describe('GlossarKategorie type', () => {
    it('should accept valid categories', () => {
      const categories: GlossarKategorie[] = ['Auftraggeber', 'Thema', 'Kunde', 'Sonstiges']

      for (const category of categories) {
        expect(['Auftraggeber', 'Thema', 'Kunde', 'Sonstiges']).toContain(category)
      }
    })
  })

  describe('GlossarEintrag type', () => {
    it('should have correct structure', () => {
      const eintrag: GlossarEintrag = {
        kategorie: 'Auftraggeber',
        begriff: 'Main Company',
        synonyme: ['Company', 'Main', 'MC']
      }

      expect(eintrag.kategorie).toBe('Auftraggeber')
      expect(eintrag.begriff).toBe('Main Company')
      expect(eintrag.synonyme).toHaveLength(3)
    })

    it('should allow empty synonyme array', () => {
      const eintrag: GlossarEintrag = {
        kategorie: 'Thema',
        begriff: 'Development',
        synonyme: []
      }

      expect(eintrag.synonyme).toHaveLength(0)
    })
  })

  describe('Glossar type', () => {
    it('should have correct structure', () => {
      const glossar: Glossar = {
        eintraege: [
          {
            kategorie: 'Auftraggeber',
            begriff: 'Company A',
            synonyme: ['CA']
          },
          {
            kategorie: 'Thema',
            begriff: 'Development',
            synonyme: ['Dev']
          }
        ],
        byKategorie: new Map([
          [
            'Auftraggeber',
            [
              {
                kategorie: 'Auftraggeber',
                begriff: 'Company A',
                synonyme: ['CA']
              }
            ]
          ],
          [
            'Thema',
            [
              {
                kategorie: 'Thema',
                begriff: 'Development',
                synonyme: ['Dev']
              }
            ]
          ]
        ]),
        lookupMap: new Map([
          ['ca', 'Company A'],
          ['dev', 'Development']
        ])
      }

      expect(glossar.eintraege).toHaveLength(2)
      expect(glossar.byKategorie.size).toBe(2)
      expect(glossar.lookupMap.get('ca')).toBe('Company A')
    })

    it('should allow empty glossar', () => {
      const emptyGlossar: Glossar = {
        eintraege: [],
        byKategorie: new Map(),
        lookupMap: new Map()
      }

      expect(emptyGlossar.eintraege).toHaveLength(0)
      expect(emptyGlossar.byKategorie.size).toBe(0)
      expect(emptyGlossar.lookupMap.size).toBe(0)
    })
  })
})

describe('shared/types/ipc', () => {
  describe('SaveResult type', () => {
    it('should have success result structure', () => {
      const result: SaveResult = {
        success: true,
        filePath: '/path/to/saved/file.xlsx'
      }

      expect(result.success).toBe(true)
      expect(result.filePath).toBe('/path/to/saved/file.xlsx')
      expect(result.error).toBeUndefined()
    })

    it('should have error result structure', () => {
      const result: SaveResult = {
        success: false,
        error: 'Failed to save file'
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save file')
      expect(result.filePath).toBeUndefined()
    })

    it('should allow minimal success result', () => {
      const result: SaveResult = {
        success: true
      }

      expect(result.success).toBe(true)
    })
  })

  describe('WhisperMode type', () => {
    it('should accept valid modes', () => {
      const modes: WhisperMode[] = ['cloud', 'none']

      for (const mode of modes) {
        expect(['cloud', 'none']).toContain(mode)
      }
    })
  })

  describe('ProgressCallback type', () => {
    it('should be a function that accepts progress number', () => {
      const callback: ProgressCallback = (progress: number) => {
        expect(typeof progress).toBe('number')
      }

      callback(0)
      callback(50)
      callback(100)
    })

    it('should work with progress values', () => {
      let capturedProgress = -1
      const callback: ProgressCallback = (progress) => {
        capturedProgress = progress
      }

      callback(75)
      expect(capturedProgress).toBe(75)
    })
  })
})

describe('shared/types/index', () => {
  it('should re-export Activity type', () => {
    const activity: Activity = {
      beschreibung: 'Test',
      auftraggeber: null,
      thema: null,
      datum: null,
      minuten: null,
      km: 0,
      auslagen: 0
    }
    expect(activity.beschreibung).toBe('Test')
  })

  it('should re-export ActivityEntry type', () => {
    const entry: ActivityEntry = {
      id: 1,
      activity: {
        beschreibung: 'Test',
        auftraggeber: null,
        thema: null,
        datum: null,
        minuten: null,
        km: 0,
        auslagen: 0
      },
      transcript: 'Text',
      timestamp: new Date(),
      saved: false
    }
    expect(entry.id).toBe(1)
  })

  it('should re-export XlsxFileConfig type', () => {
    const config: XlsxFileConfig = {
      path: '/path',
      auftraggeber: 'Client',
      jahr: 2026,
      active: true
    }
    expect(config.path).toBe('/path')
  })

  it('should re-export AppSettings type', () => {
    const settings: AppSettings = {
      hotkey: 'Alt+R',
      openaiApiKey: '',
      hasApiKey: false,
      ttsEnabled: false,
      ttsVoice: 'nova'
    }
    expect(settings.hotkey).toBe('Alt+R')
  })

  it('should re-export AppConfig type', () => {
    const config: AppConfig = {
      xlsxBasePath: '/base',
      xlsxFiles: [],
      settings: {
        hotkey: 'Alt+R',
        openaiApiKey: '',
        hasApiKey: false,
        ttsEnabled: false,
        ttsVoice: 'nova'
      }
    }
    expect(config.xlsxBasePath).toBe('/base')
  })

  it('should re-export Glossar types', () => {
    const kategorie: GlossarKategorie = 'Auftraggeber'
    expect(kategorie).toBe('Auftraggeber')

    const eintrag: GlossarEintrag = {
      kategorie: 'Thema',
      begriff: 'Test',
      synonyme: []
    }
    expect(eintrag.begriff).toBe('Test')

    const glossar: Glossar = {
      eintraege: [],
      byKategorie: new Map(),
      lookupMap: new Map()
    }
    expect(glossar.eintraege).toHaveLength(0)
  })

  it('should re-export SaveResult type', () => {
    const result: SaveResult = {
      success: true
    }
    expect(result.success).toBe(true)
  })

  it('should re-export WhisperMode type', () => {
    const mode: WhisperMode = 'cloud'
    expect(mode).toBe('cloud')
  })

  it('should re-export ProgressCallback type', () => {
    const callback: ProgressCallback = () => {}
    expect(typeof callback).toBe('function')
  })
})
