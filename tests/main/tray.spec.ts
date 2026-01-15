import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron'

// Mock @electron-toolkit/utils
vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: true
  }
}))

import { createTray, destroyTray } from '@main/tray'

describe('tray', () => {
  let mockWindow: BrowserWindow

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock window
    mockWindow = {
      show: vi.fn(),
      focus: vi.fn(),
      webContents: {
        send: vi.fn()
      }
    } as unknown as BrowserWindow
  })

  describe('createTray', () => {
    it('should create a tray instance', () => {
      const tray = createTray(mockWindow)
      expect(tray).toBeDefined()
      expect(Tray).toHaveBeenCalled()
    })

    it('should load icon from resources', () => {
      createTray(mockWindow)
      expect(nativeImage.createFromPath).toHaveBeenCalledWith(
        expect.stringContaining('icon.png')
      )
    })

    it('should set tooltip', () => {
      const tray = createTray(mockWindow)
      expect(tray.setToolTip).toHaveBeenCalledWith('Aktivitäten')
    })

    it('should set context menu', () => {
      const tray = createTray(mockWindow)
      expect(tray.setContextMenu).toHaveBeenCalled()
    })

    it('should build context menu with correct template', () => {
      createTray(mockWindow)
      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Öffnen' }),
          expect.objectContaining({ label: 'Neue Aktivität' }),
          expect.objectContaining({ type: 'separator' }),
          expect.objectContaining({ label: 'Beenden' })
        ])
      )
    })

    it('should register click handler', () => {
      const tray = createTray(mockWindow)
      expect(tray.on).toHaveBeenCalledWith('click', expect.any(Function))
    })

    it('should show and focus window on click', () => {
      const tray = createTray(mockWindow)
      // Get the click callback
      const onCall = vi.mocked(tray.on).mock.calls.find((call) => call[0] === 'click')
      const clickHandler = onCall?.[1] as () => void
      clickHandler()

      expect(mockWindow.show).toHaveBeenCalled()
      expect(mockWindow.focus).toHaveBeenCalled()
    })

    it('should show and focus window on Öffnen menu click', () => {
      createTray(mockWindow)

      // Get the menu template
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0] as Array<{
        label?: string
        click?: () => void
      }>
      const oeffnenItem = template.find((item) => item.label === 'Öffnen')
      oeffnenItem?.click?.()

      expect(mockWindow.show).toHaveBeenCalled()
      expect(mockWindow.focus).toHaveBeenCalled()
    })

    it('should start recording on Neue Aktivität menu click', () => {
      createTray(mockWindow)

      // Get the menu template
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0] as Array<{
        label?: string
        click?: () => void
      }>
      const neueAktivitaetItem = template.find((item) => item.label === 'Neue Aktivität')
      neueAktivitaetItem?.click?.()

      expect(mockWindow.show).toHaveBeenCalled()
      expect(mockWindow.focus).toHaveBeenCalled()
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('start-recording')
    })

    it('should quit app on Beenden menu click', () => {
      createTray(mockWindow)

      // Get the menu template
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0] as Array<{
        label?: string
        click?: () => void
      }>
      const beendenItem = template.find((item) => item.label === 'Beenden')
      beendenItem?.click?.()

      expect(app.quit).toHaveBeenCalled()
    })
  })

  describe('destroyTray', () => {
    it('should not throw when tray does not exist initially', () => {
      // destroyTray should handle null tray gracefully
      expect(() => destroyTray()).not.toThrow()
    })

    it('should destroy tray when it exists', () => {
      const tray = createTray(mockWindow)
      destroyTray()
      expect(tray.destroy).toHaveBeenCalled()
    })
  })
})
