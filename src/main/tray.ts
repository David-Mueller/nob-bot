import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): Tray {
  // Load icon from resources
  const resourcesDir = is.dev
    ? join(app.getAppPath(), 'resources')
    : join(process.resourcesPath, 'resources')

  const iconPath = join(resourcesDir, 'icon.png')
  console.log('[Tray] Loading icon from:', iconPath)

  let icon = nativeImage.createFromPath(iconPath)
  console.log('[Tray] Icon loaded, empty:', icon.isEmpty(), 'size:', icon.getSize())

  // Resize for menu bar (macOS recommends 16x16 or 22x22)
  icon = icon.resize({ width: 22, height: 22 })

  tray = new Tray(icon)
  console.log('[Tray] Tray instance created')

  // On macOS, set a title as fallback if icon doesn't show
  if (process.platform === 'darwin') {
    tray.setTitle('A')  // Short title visible in menu bar
  }

  // Verify tray exists
  if (tray) {
    console.log('[Tray] Tray is valid, bounds:', tray.getBounds())
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Öffnen',
      click: (): void => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Neue Aktivität',
      click: (): void => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('start-recording')
      }
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: (): void => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('Aktivitäten')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
