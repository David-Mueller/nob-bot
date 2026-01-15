import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create the mocks using vi.hoisted so they're available during vi.mock
const { mockStat, mockMkdir, mockCopyFile, mockReaddir, mockUnlink } = vi.hoisted(() => ({
  mockStat: vi.fn(),
  mockMkdir: vi.fn(),
  mockCopyFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockUnlink: vi.fn()
}))

vi.mock('fs/promises', () => ({
  stat: mockStat,
  mkdir: mockMkdir,
  copyFile: mockCopyFile,
  readdir: mockReaddir,
  unlink: mockUnlink,
  default: {
    stat: mockStat,
    mkdir: mockMkdir,
    copyFile: mockCopyFile,
    readdir: mockReaddir,
    unlink: mockUnlink
  }
}))

import { createBackup, listBackups, restoreBackup } from '@main/services/backup'

describe('backup service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T10:30:45'))
  })

  describe('createBackup', () => {
    it('should create a timestamped backup file', async () => {
      mockStat.mockResolvedValue({})
      mockMkdir.mockResolvedValue(undefined)
      mockCopyFile.mockResolvedValue(undefined)
      mockReaddir.mockResolvedValue([])

      const result = await createBackup('/data/file.xlsx')

      expect(mockStat).toHaveBeenCalledWith('/data/file.xlsx')
      expect(mockMkdir).toHaveBeenCalledWith('/data/backups', { recursive: true })
      expect(mockCopyFile).toHaveBeenCalledWith(
        '/data/file.xlsx',
        '/data/backups/file_2026-01-15_10-30-45.xlsx'
      )
      expect(result).toBe('/data/backups/file_2026-01-15_10-30-45.xlsx')
    })

    it('should throw error if source file does not exist', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'))

      await expect(createBackup('/data/missing.xlsx')).rejects.toThrow('ENOENT')
    })

    it('should handle files in nested directories', async () => {
      mockStat.mockResolvedValue({})
      mockMkdir.mockResolvedValue(undefined)
      mockCopyFile.mockResolvedValue(undefined)
      mockReaddir.mockResolvedValue([])

      const result = await createBackup('/deep/nested/path/document.xlsx')

      expect(mockMkdir).toHaveBeenCalledWith('/deep/nested/path/backups', { recursive: true })
      expect(result).toBe('/deep/nested/path/backups/document_2026-01-15_10-30-45.xlsx')
    })

    it('should trigger cleanup of old backups asynchronously', async () => {
      vi.useRealTimers() // Use real timers for this test

      mockStat.mockResolvedValue({})
      mockMkdir.mockResolvedValue(undefined)
      mockCopyFile.mockResolvedValue(undefined)

      // Simulate more than 50 backups
      const manyBackups = Array.from({ length: 55 }, (_, i) =>
        `file_2026-01-${String(i + 1).padStart(2, '0')}_10-30-45.xlsx`
      ).sort().reverse()
      mockReaddir.mockResolvedValue(manyBackups)
      mockUnlink.mockResolvedValue(undefined)

      await createBackup('/data/file.xlsx')

      // Wait for async cleanup to complete - use a small delay for the promise to settle
      await new Promise(resolve => setTimeout(resolve, 50))

      // Should delete 5 oldest backups (55 - 50 = 5)
      expect(mockUnlink).toHaveBeenCalledTimes(5)
    })

    it('should handle cleanup failure gracefully', async () => {
      mockStat.mockResolvedValue({})
      mockMkdir.mockResolvedValue(undefined)
      mockCopyFile.mockResolvedValue(undefined)
      mockReaddir.mockRejectedValue(new Error('Permission denied'))

      // Should not throw even if cleanup fails
      const result = await createBackup('/data/file.xlsx')
      expect(result).toBe('/data/backups/file_2026-01-15_10-30-45.xlsx')
    })
  })

  describe('listBackups', () => {
    it('should return sorted list of backup paths', async () => {
      mockReaddir.mockResolvedValue([
        'file_2026-01-10_08-00-00.xlsx',
        'file_2026-01-15_10-30-45.xlsx',
        'file_2026-01-12_14-22-33.xlsx',
        'other_2026-01-11_09-00-00.xlsx' // Different file, should be filtered
      ])

      const result = await listBackups('/data/file.xlsx')

      expect(mockReaddir).toHaveBeenCalledWith('/data/backups')
      expect(result).toEqual([
        '/data/backups/file_2026-01-15_10-30-45.xlsx',
        '/data/backups/file_2026-01-12_14-22-33.xlsx',
        '/data/backups/file_2026-01-10_08-00-00.xlsx'
      ])
    })

    it('should return empty array if backup directory does not exist', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'))

      const result = await listBackups('/data/file.xlsx')

      expect(result).toEqual([])
    })

    it('should return empty array if no matching backups exist', async () => {
      mockReaddir.mockResolvedValue([
        'other_2026-01-10_08-00-00.xlsx',
        'different_2026-01-15_10-30-45.xlsx'
      ])

      const result = await listBackups('/data/file.xlsx')

      expect(result).toEqual([])
    })

    it('should filter backups by both filename prefix and extension', async () => {
      mockReaddir.mockResolvedValue([
        'file_2026-01-10_08-00-00.xlsx',
        'file_2026-01-10_08-00-00.txt', // Wrong extension - filtered out
        'other_2026-01-12_14-22-33.xlsx', // Wrong prefix - filtered out
        'file_2026-01-12_14-22-33.xlsx'
      ])

      const result = await listBackups('/data/file.xlsx')

      // Matches file_* with .xlsx extension only
      expect(result).toEqual([
        '/data/backups/file_2026-01-12_14-22-33.xlsx',
        '/data/backups/file_2026-01-10_08-00-00.xlsx'
      ])
    })
  })

  describe('restoreBackup', () => {
    it('should restore backup to original location', async () => {
      mockStat.mockResolvedValue({})
      mockMkdir.mockResolvedValue(undefined)
      mockCopyFile.mockResolvedValue(undefined)
      mockReaddir.mockResolvedValue([])

      await restoreBackup('/data/backups/file_2026-01-10_08-00-00.xlsx', '/data/file.xlsx')

      // Should have called copyFile twice: once for backup, once for restore
      expect(mockCopyFile).toHaveBeenNthCalledWith(
        1,
        '/data/file.xlsx',
        '/data/backups/file_2026-01-15_10-30-45.xlsx'
      )
      expect(mockCopyFile).toHaveBeenNthCalledWith(
        2,
        '/data/backups/file_2026-01-10_08-00-00.xlsx',
        '/data/file.xlsx'
      )
    })

    it('should restore even if original file does not exist', async () => {
      // First call (createBackup) fails because original doesn't exist
      mockStat.mockRejectedValue(new Error('ENOENT'))
      mockCopyFile.mockResolvedValue(undefined)

      await restoreBackup('/data/backups/file_2026-01-10_08-00-00.xlsx', '/data/new.xlsx')

      // Should still attempt restore
      expect(mockCopyFile).toHaveBeenCalledWith(
        '/data/backups/file_2026-01-10_08-00-00.xlsx',
        '/data/new.xlsx'
      )
    })
  })
})
