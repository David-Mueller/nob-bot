import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create the mocks using vi.hoisted so they're available during vi.mock
const { mockExistsSync, mockReadFile, mockWriteFile, mockMkdir, mockUnlink, mockSafeStorage } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockUnlink: vi.fn(),
  mockSafeStorage: {
    isEncryptionAvailable: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn()
  }
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  // Include common exports that might be needed
  default: { existsSync: mockExistsSync }
}))

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  unlink: mockUnlink,
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    unlink: mockUnlink
  }
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'home') return '/tmp/test-home'
      return '/tmp'
    })
  },
  safeStorage: mockSafeStorage
}))

import {
  isEncryptionAvailable,
  storeApiKey,
  retrieveApiKey,
  hasStoredApiKey,
  clearApiKey
} from '@main/services/secureStorage'

describe('secureStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isEncryptionAvailable', () => {
    it('should return true when encryption is available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      expect(isEncryptionAvailable()).toBe(true)
    })

    it('should return false when encryption is not available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
      expect(isEncryptionAvailable()).toBe(false)
    })
  })

  describe('storeApiKey', () => {
    it('should create secure directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false)
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      mockSafeStorage.encryptString.mockReturnValue(Buffer.from('encrypted'))
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      await storeApiKey('test-api-key')

      expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('.aktivitaeten/secure'), { recursive: true })
    })

    it('should encrypt and store API key when encryption is available', async () => {
      mockExistsSync.mockReturnValue(true)
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      const encryptedBuffer = Buffer.from('encrypted-data')
      mockSafeStorage.encryptString.mockReturnValue(encryptedBuffer)
      mockWriteFile.mockResolvedValue(undefined)

      await storeApiKey('test-api-key')

      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('test-api-key')
      expect(mockWriteFile).toHaveBeenCalledWith(expect.stringContaining('openai.key'), encryptedBuffer)
    })

    it('should store base64 encoded key when encryption is not available', async () => {
      mockExistsSync.mockReturnValue(true)
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
      mockWriteFile.mockResolvedValue(undefined)

      await storeApiKey('test-api-key')

      const expectedEncoded = Buffer.from('test-api-key').toString('base64')
      expect(mockWriteFile).toHaveBeenCalledWith(expect.stringContaining('openai.key'), expectedEncoded, 'utf-8')
    })

    it('should remove stored key file when empty string is passed', async () => {
      // First call for secure dir check, second for key file check
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
      mockUnlink.mockResolvedValue(undefined)

      await storeApiKey('')

      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('openai.key'))
    })

    it('should not attempt unlink when empty string passed and file does not exist', async () => {
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false)

      await storeApiKey('')

      expect(mockUnlink).not.toHaveBeenCalled()
    })
  })

  describe('retrieveApiKey', () => {
    it('should return empty string when key file does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await retrieveApiKey()

      expect(result).toBe('')
    })

    it('should decrypt and return API key when encryption is available', async () => {
      mockExistsSync.mockReturnValue(true)
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      const encryptedBuffer = Buffer.from('encrypted')
      mockReadFile.mockResolvedValue(encryptedBuffer)
      mockSafeStorage.decryptString.mockReturnValue('decrypted-api-key')

      const result = await retrieveApiKey()

      expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(encryptedBuffer)
      expect(result).toBe('decrypted-api-key')
    })

    it('should decode base64 when encryption is not available', async () => {
      mockExistsSync.mockReturnValue(true)
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
      const encodedKey = Buffer.from('my-api-key').toString('base64')
      mockReadFile.mockResolvedValue(Buffer.from(encodedKey))

      const result = await retrieveApiKey()

      expect(result).toBe('my-api-key')
    })

    it('should return empty string on read error', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockRejectedValue(new Error('Read error'))

      const result = await retrieveApiKey()

      expect(result).toBe('')
    })
  })

  describe('hasStoredApiKey', () => {
    it('should return true when key file exists', async () => {
      mockExistsSync.mockReturnValue(true)

      const result = await hasStoredApiKey()

      expect(result).toBe(true)
    })

    it('should return false when key file does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await hasStoredApiKey()

      expect(result).toBe(false)
    })
  })

  describe('clearApiKey', () => {
    it('should unlink key file when it exists', async () => {
      mockExistsSync.mockReturnValue(true)
      mockUnlink.mockResolvedValue(undefined)

      await clearApiKey()

      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('openai.key'))
    })

    it('should do nothing when key file does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      await clearApiKey()

      expect(mockUnlink).not.toHaveBeenCalled()
    })
  })
})
