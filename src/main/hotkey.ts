import { globalShortcut, BrowserWindow } from 'electron'

// Cmd+R auf Mac, Ctrl+R auf Windows (einfacher zu drücken)
const DEFAULT_HOTKEY = 'CommandOrControl+Shift+R'

export function registerHotkeys(mainWindow: BrowserWindow, hotkey = DEFAULT_HOTKEY): boolean {
  const success = globalShortcut.register(hotkey, () => {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('start-recording')
  })

  if (!success) {
    console.error(`Failed to register hotkey: ${hotkey}`)
  }

  return success
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}

export function isHotkeyRegistered(hotkey = DEFAULT_HOTKEY): boolean {
  return globalShortcut.isRegistered(hotkey)
}
