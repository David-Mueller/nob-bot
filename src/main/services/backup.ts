import { copyFile, mkdir, readdir, unlink, stat } from 'fs/promises'
import { join, dirname, basename, extname } from 'path'

const MAX_BACKUPS = 50

/**
 * Creates a timestamped backup of a file before modifying it.
 * Backups are stored in a 'backups' subdirectory.
 */
export async function createBackup(filePath: string): Promise<string> {
  // Verify source file exists
  await stat(filePath)

  const dir = dirname(filePath)
  const backupDir = join(dir, 'backups')
  const name = basename(filePath, extname(filePath))
  const ext = extname(filePath)

  // Format: name_YYYY-MM-DD_HH-mm-ss.xlsx
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-') + '_' + [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('-')

  const backupPath = join(backupDir, `${name}_${timestamp}${ext}`)

  // Create backups directory if it doesn't exist
  await mkdir(backupDir, { recursive: true })

  // Copy original file to backup
  await copyFile(filePath, backupPath)

  console.log(`[Backup] Created: ${backupPath}`)

  // Clean old backups (async, don't wait)
  cleanOldBackups(backupDir, name, ext).catch(err => {
    console.warn('[Backup] Failed to clean old backups:', err)
  })

  return backupPath
}

/**
 * Removes old backups keeping only the most recent MAX_BACKUPS files.
 */
async function cleanOldBackups(
  backupDir: string,
  baseName: string,
  ext: string
): Promise<void> {
  try {
    const files = await readdir(backupDir)

    // Filter to only backups of this file
    const backups = files
      .filter(f => f.startsWith(baseName + '_') && f.endsWith(ext))
      .sort()
      .reverse() // Newest first

    // Delete everything beyond MAX_BACKUPS
    const toDelete = backups.slice(MAX_BACKUPS)

    for (const oldBackup of toDelete) {
      const oldPath = join(backupDir, oldBackup)
      await unlink(oldPath)
      console.log(`[Backup] Deleted old: ${oldBackup}`)
    }

    if (toDelete.length > 0) {
      console.log(`[Backup] Cleaned ${toDelete.length} old backup(s)`)
    }
  } catch (err) {
    // Non-critical, just log
    console.warn('[Backup] Cleanup error:', err)
  }
}

/**
 * Lists all backups for a given file.
 */
export async function listBackups(filePath: string): Promise<string[]> {
  const dir = dirname(filePath)
  const backupDir = join(dir, 'backups')
  const name = basename(filePath, extname(filePath))
  const ext = extname(filePath)

  try {
    const files = await readdir(backupDir)
    return files
      .filter(f => f.startsWith(name + '_') && f.endsWith(ext))
      .sort()
      .reverse()
      .map(f => join(backupDir, f))
  } catch {
    return []
  }
}

/**
 * Restores a backup to the original file location.
 * Creates a backup of current state before restoring.
 */
export async function restoreBackup(
  backupPath: string,
  originalPath: string
): Promise<void> {
  // Backup current state first
  try {
    await createBackup(originalPath)
  } catch {
    // Original might not exist, that's ok
  }

  // Restore from backup
  await copyFile(backupPath, originalPath)
  console.log(`[Backup] Restored: ${backupPath} -> ${originalPath}`)
}
