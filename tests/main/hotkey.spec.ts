import { describe, it, expect, vi, beforeEach } from 'vitest'
import { globalShortcut, BrowserWindow } from 'electron'
import { registerHotkeys, unregisterHotkeys, isHotkeyRegistered } from '@main/hotkey'

describe('hotkey', () => {
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

    // Default mock implementations
    vi.mocked(globalShortcut.register).mockReturnValue(true)
    vi.mocked(globalShortcut.isRegistered).mockReturnValue(true)
  })

  describe('registerHotkeys', () => {
    it('should register the default hotkey', () => {
      const success = registerHotkeys(mockWindow)

      expect(success).toBe(true)
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+Shift+R',
        expect.any(Function)
      )
    })

    it('should register a custom hotkey', () => {
      const customHotkey = 'Alt+Shift+A'
      const success = registerHotkeys(mockWindow, customHotkey)

      expect(success).toBe(true)
      expect(globalShortcut.register).toHaveBeenCalledWith(customHotkey, expect.any(Function))
    })

    it('should return false when registration fails', () => {
      vi.mocked(globalShortcut.register).mockReturnValue(false)

      const success = registerHotkeys(mockWindow)

      expect(success).toBe(false)
    })

    it('should show window when hotkey is pressed', () => {
      registerHotkeys(mockWindow)

      // Get the callback passed to register
      const callback = vi.mocked(globalShortcut.register).mock.calls[0][1]
      callback()

      expect(mockWindow.show).toHaveBeenCalled()
    })

    it('should focus window when hotkey is pressed', () => {
      registerHotkeys(mockWindow)

      const callback = vi.mocked(globalShortcut.register).mock.calls[0][1]
      callback()

      expect(mockWindow.focus).toHaveBeenCalled()
    })

    it('should send start-recording event when hotkey is pressed', () => {
      registerHotkeys(mockWindow)

      const callback = vi.mocked(globalShortcut.register).mock.calls[0][1]
      callback()

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('start-recording')
    })

    it('should log error when registration fails', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(globalShortcut.register).mockReturnValue(false)

      registerHotkeys(mockWindow)

      expect(consoleSpy).toHaveBeenCalledWith('Failed to register hotkey: CommandOrControl+Shift+R')
      consoleSpy.mockRestore()
    })
  })

  describe('unregisterHotkeys', () => {
    it('should unregister all hotkeys', () => {
      unregisterHotkeys()

      expect(globalShortcut.unregisterAll).toHaveBeenCalled()
    })
  })

  describe('isHotkeyRegistered', () => {
    it('should check if default hotkey is registered', () => {
      const result = isHotkeyRegistered()

      expect(result).toBe(true)
      expect(globalShortcut.isRegistered).toHaveBeenCalledWith('CommandOrControl+Shift+R')
    })

    it('should check if custom hotkey is registered', () => {
      const customHotkey = 'Alt+Shift+B'
      const result = isHotkeyRegistered(customHotkey)

      expect(globalShortcut.isRegistered).toHaveBeenCalledWith(customHotkey)
      expect(result).toBe(true)
    })

    it('should return false when hotkey is not registered', () => {
      vi.mocked(globalShortcut.isRegistered).mockReturnValue(false)

      const result = isHotkeyRegistered()

      expect(result).toBe(false)
    })
  })
})
