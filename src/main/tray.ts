import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): Tray {
  // In dev, use project root; in prod, use resourcesPath
  const resourcesDir = is.dev
    ? join(app.getAppPath(), 'resources')
    : join(process.resourcesPath, 'resources')

  const iconPath = join(resourcesDir, 'icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  // Mark as template for proper macOS menu bar appearance
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }))

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
