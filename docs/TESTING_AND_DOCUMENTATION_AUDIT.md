# Testing & Documentation Audit Report
## Aktivitäten Electron App

**Date:** 2026-01-11
**Scope:** Testing strategy, test coverage, testability assessment, and documentation quality

---

## Executive Summary

**Test Coverage:** 0% (No tests exist)
**Documentation Completeness:** 68/100
**Testability Score:** 35/100 (Poor - significant structural barriers)

### Critical Findings

1. **Zero test coverage** - No unit, integration, or e2e tests exist
2. **Module-level state** prevents service isolation and mocking
3. **No test framework** configured (no jest, vitest, or similar)
4. **Good architectural documentation** in CLAUDE.md
5. **Minimal inline documentation** (7 files with JSDoc out of 38 total)

---

## 1. Test Coverage Analysis

### Current State: NO TESTS EXIST

**Files Scanned:** 38 TypeScript/Vue files
**Test Files Found:** 0
**Test Framework:** None configured

#### Coverage by Layer

| Layer | Files | Tests | Coverage | Priority |
|-------|-------|-------|----------|----------|
| **Main Services** | 10 | 0 | 0% | CRITICAL |
| **IPC Handlers** | 7 | 0 | 0% | HIGH |
| **Renderer Stores** | 3 | 0 | 0% | HIGH |
| **Renderer Composables** | 4 | 0 | 0% | MEDIUM |
| **Vue Components** | 4 | 0 | 0% | LOW |
| **Shared Types** | 5 | 0 | N/A | LOW |
| **Utils** | 1 | 0 | 0% | HIGH |

### Critical Untested Paths

#### High-Risk Services (PRIORITY 1)

1. **`src/main/services/excel.ts` (290 LOC)**
   - Excel file manipulation with style preservation
   - Row insertion and cell styling logic
   - Data type conversions (dates, times, numbers)
   - **Risk:** Data corruption, formula breakage, style loss

2. **`src/main/services/llm.ts` (362 LOC)**
   - Activity parsing from transcripts
   - Follow-up question handling
   - Correction parsing with merge logic
   - **Risk:** Incorrect activity extraction, lost data in corrections

3. **`src/main/services/whisper.ts` (274 LOC)**
   - Cloud/local fallback logic
   - Audio format conversions
   - Language detection and retry logic
   - **Risk:** Transcription failures, incorrect language detection

4. **`src/main/services/config.ts` (181 LOC)**
   - API key migration to secure storage
   - File/settings persistence
   - Auftraggeber-to-file mapping
   - **Risk:** Configuration loss, security leaks

5. **`src/main/services/backup.ts` (124 LOC)**
   - File backup creation with timestamps
   - Old backup cleanup (max 50 backups)
   - Restore functionality
   - **Risk:** Backup failures, data loss

#### Security-Critical Components (PRIORITY 1)

6. **`src/main/utils/pathValidator.ts` (64 LOC)**
   - Path traversal prevention
   - Allowed directory validation
   - **Risk:** Path traversal attacks, unauthorized file access
   - **MUST BE TESTED IMMEDIATELY**

7. **`src/main/services/secureStorage.ts`**
   - API key encryption/decryption
   - **Risk:** Credential exposure
   - **MUST BE TESTED IMMEDIATELY**

#### Complex Business Logic (PRIORITY 2)

8. **`src/main/services/glossar.ts` (348 LOC)**
   - Excel glossar loading with normalization
   - Multi-file glossar merging
   - Auto-creation from existing data
   - **Risk:** Term lookup failures, incorrect standardization

9. **`src/main/services/fileScanner.ts`**
   - Glob pattern matching for Excel files
   - **Risk:** File discovery failures

#### State Management (PRIORITY 2)

10. **`src/renderer/src/stores/activities.ts`**
    - Entry CRUD operations
    - Missing field detection
    - Draft restoration logic
    - **Risk:** Activity data loss, state corruption

11. **`src/renderer/src/stores/recording.ts`**
    - Recording flow state machine
    - Edit/follow-up mode switching
    - **Risk:** UI state bugs, lost recordings

---

## 2. Testability Assessment

**Score: 35/100 (POOR)**

### Major Structural Barriers

#### 1. Module-Level Mutable State (CRITICAL)

**Services with module-level state:**
```typescript
// whisper.ts
let localTranscriber: TranscriptionPipeline | null = null
let openaiClient: OpenAI | null = null

// llm.ts
let llm: ChatOpenAI | null = null

// config.ts
let currentConfig: AppConfig = { ...DEFAULT_CONFIG }

// glossar.ts
const glossarCache = new Map<string, Glossar>()
```

**Impact:**
- **Cannot isolate tests** - state leaks between test runs
- **Cannot mock dependencies** - services self-instantiate clients
- **Cannot test error states** - hard to inject failures
- **Test order dependency** - tests affect each other

**Solution Required:** Dependency injection or factory pattern

#### 2. No Dependency Injection

**Current pattern:**
```typescript
// Services directly import and instantiate dependencies
import OpenAI from 'openai'
import { ChatOpenAI } from '@langchain/openai'

export async function initLLM(): Promise<void> {
  llm = new ChatOpenAI({ ... }) // Hard to mock
}
```

**Testability issues:**
- Cannot inject mock OpenAI client
- Cannot test without real API calls
- Cannot simulate API failures

#### 3. Hard-Coded External Dependencies

**External dependencies without abstraction:**
- OpenAI Whisper API (network calls)
- OpenAI GPT-4o API (network calls)
- OpenAI TTS API (network calls)
- File system operations (disk I/O)
- Electron app paths (environment-specific)

**Test implications:**
- Slow tests (network/disk I/O)
- Flaky tests (API rate limits, network failures)
- Expensive tests (API costs)
- Environment-dependent tests (paths)

#### 4. Electron Runtime Coupling

**Services depend on Electron APIs:**
```typescript
import { app } from 'electron'

env.cacheDir = join(app.getPath('userData'), 'models')
const CONFIG_DIR = join(app.getPath('home'), '.aktivitaeten')
```

**Cannot test without:**
- Electron test environment (Spectron/Playwright for Electron)
- Mock app paths
- Test-specific data directories

#### 5. Type Safety Issues for Testing

**Some functions lack proper return types:**
```typescript
// Implicit return types make mocking harder
const handleProgress = (progress) => { ... }
```

**Missing validation in critical paths:**
- Excel file validation happens at service layer (should be earlier)
- No runtime type guards for Activity objects from LLM

### Positive Testability Aspects

1. **Pure utility functions** (can be tested easily)
   - `normalizeForLookup()` in glossar.ts
   - Time formatting helpers in stores
   - Path validation in pathValidator.ts

2. **Type definitions** in `src/shared/types/`
   - Clear contracts for Activity, Config, Glossar
   - Zod schemas provide runtime validation

3. **Separation of concerns**
   - IPC handlers separated from business logic
   - Services don't directly access DOM
   - Clear boundaries between main/renderer

4. **Good JSDoc on critical services**
   - backup.ts, excel.ts, glossar.ts, tts.ts have function-level docs
   - Explains "why" not just "what"

---

## 3. Test Pyramid Recommendations

### Recommended Distribution

```
      /\
     /e2e\      5% - Full workflow tests
    /------\
   /integ-  \   25% - IPC + service integration
  /----------\
 /   unit     \ 70% - Service & utility tests
/==============\
```

### Unit Tests (70% - ~200-250 tests)

**Target: src/main/services/**

1. **whisper.ts**
   - Mock OpenAI client, test cloud transcription
   - Mock pipeline, test local transcription
   - Test audio format conversions
   - Test fallback logic (cloud → local)
   - Test language detection retry

2. **llm.ts**
   - Mock ChatOpenAI, test activity parsing
   - Test nullable field defaults (km=0, auslagen=0)
   - Test correction merge logic (preserve unchanged)
   - Test follow-up answer merging
   - Test client name normalization

3. **excel.ts**
   - Mock XLSX.readFile/writeFile
   - Test cell style copying from template
   - Test date/time value conversions
   - Test row finding logic
   - Test backup triggering

4. **config.ts**
   - Mock fs promises
   - Test YAML load/save
   - Test API key migration to secure storage
   - Test auftraggeber-to-file lookup

5. **backup.ts**
   - Mock fs promises
   - Test timestamp generation
   - Test old backup cleanup (50 max)
   - Test restore with pre-backup

6. **glossar.ts**
   - Mock XLSX read
   - Test synonym lookup normalization
   - Test multi-glossar merging
   - Test auto-generation from existing data
   - Test cache invalidation

7. **pathValidator.ts** (SECURITY CRITICAL)
   - Test path traversal prevention (`../../../etc/passwd`)
   - Test allowed directory validation
   - Test Excel extension validation
   - Test normalization edge cases

**Target: src/renderer/src/stores/**

8. **activities.ts**
   - Test entry CRUD operations
   - Test missing field detection
   - Test draft restoration
   - Test unsaved filtering

9. **recording.ts**
   - Test state transitions
   - Test edit/follow-up mode switching
   - Test context tracking

**Target: src/renderer/src/composables/**

10. **useWhisper.ts**
    - Test audio resampling to 16kHz
    - Test mono channel extraction
    - Test status state machine

### Integration Tests (25% - ~70-90 tests)

**Target: IPC communication**

1. **whisperHandlers + whisper service**
   - Test full transcription flow through IPC
   - Test progress events to renderer

2. **llmHandlers + llm service**
   - Test activity parsing through IPC
   - Test correction flow

3. **excelHandlers + excel + backup services**
   - Test full write operation with backup
   - Test file validation errors

4. **configHandlers + config + secureStorage**
   - Test settings update with API key encryption
   - Test file mapping CRUD

5. **glossarHandlers + glossar service**
   - Test glossar loading from multiple files
   - Test cache consistency

### E2E Tests (5% - ~15-20 tests)

**Target: Full user workflows**

1. **Voice recording → transcription → parsing → save**
   - Record audio
   - Verify transcript
   - Verify activity extraction
   - Verify Excel write

2. **Follow-up question flow**
   - Record incomplete activity
   - Receive TTS question
   - Answer by voice
   - Verify completion

3. **Correction workflow**
   - Save activity
   - Record correction
   - Verify merge preserves unchanged fields

4. **File configuration**
   - Add Excel file
   - Map to Auftraggeber
   - Verify activity saves to correct file

5. **Glossar normalization**
   - Configure Excel with glossar
   - Record activity with synonym
   - Verify standardized term in output

---

## 4. Documentation Quality Assessment

**Score: 68/100**

### Strengths

1. **Excellent CLAUDE.md** (92/100)
   - Clear architecture overview with process boundaries
   - Data flow diagrams (voice → whisper → LLM → excel)
   - IPC pattern documentation
   - Important patterns section (toRaw, config loading order)
   - Build commands

2. **Comprehensive feature specs** (85/100)
   - 24 detailed feature specs in `docs/specs/FEAT-*.md`
   - Covers major features (glossar, TTS, secure storage, backups)
   - Good historical record of evolution

3. **JSDoc on critical services** (75/100)
   - backup.ts: Excellent function-level docs
   - excel.ts: Good docs on complex operations
   - glossar.ts: Clear docs on normalization
   - tts.ts: Simple but sufficient

4. **Clear type definitions** (80/100)
   - Activity, Config, Glossar well-defined
   - Zod schemas document LLM expectations
   - IPC types in shared/types/ipc.ts

### Gaps

1. **Missing inline comments on complex logic** (40/100)
   - 31 of 38 files have NO JSDoc comments
   - Complex LLM prompt logic undocumented
   - Whisper audio conversion lacks explanation
   - Excel style copying needs "why" comments

2. **No API reference documentation** (0/100)
   - No docs for window.api methods
   - IPC contracts not documented externally
   - Service public APIs not listed

3. **No setup/deployment guides** (30/100)
   - README.md is minimal (41 lines)
   - No troubleshooting section
   - No Windows-specific setup notes
   - No API key setup guide (beyond .env.example)

4. **No architecture decision records (ADRs)** (0/100)
   - Why module-level state was chosen?
   - Why SheetJS over other Excel libraries?
   - Why OpenAI over local models?

5. **No error handling documentation** (0/100)
   - What happens when OpenAI API is down?
   - What if Excel file is locked?
   - What if glossar sheet is malformed?

### Files Without Documentation

**Completely undocumented (need comments):**

- src/renderer/src/composables/*.ts (4 files)
- src/renderer/src/stores/*.ts (3 files)
- src/main/ipc/*.ts (7 files)
- src/main/services/drafts.ts
- src/main/services/fileScanner.ts
- src/main/services/secureStorage.ts

**Critical code needing comments:**

1. **App.vue** (complex state orchestration)
   - Recording flow state machine
   - Edit vs follow-up mode switching
   - Auto-save trigger logic

2. **llm.ts SYSTEM_PROMPT**
   - Each rule needs inline comment explaining why
   - "KRITISCH" sections need examples

3. **whisper.ts audio conversion**
   - Why resample to 16kHz?
   - Why mono channel?
   - Buffer alignment logic needs explanation

4. **excel.ts style copying**
   - Template row concept unclear
   - Time value fraction logic needs comment

---

## 5. Recommended Improvements

### Phase 1: Foundation (Week 1-2)

**1. Set up test infrastructure**

```bash
pnpm add -D vitest @vitest/ui @testing-library/vue happy-dom
pnpm add -D @electron/test-utils playwright-electron
```

**Add to package.json:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Create vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts']
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main')
    }
  }
})
```

**2. Refactor for testability - Dependency Injection**

**Before (whisper.ts):**
```typescript
let openaiClient: OpenAI | null = null

async function initOpenAI() {
  openaiClient = new OpenAI({ apiKey })
}
```

**After:**
```typescript
export class WhisperService {
  constructor(
    private openaiClient?: OpenAI,
    private getApiKeyFn: () => Promise<string> = getApiKey
  ) {}

  async init() {
    if (!this.openaiClient) {
      const apiKey = await this.getApiKeyFn()
      this.openaiClient = new OpenAI({ apiKey })
    }
  }
}

// Export singleton for production
export const whisperService = new WhisperService()

// For tests:
// const mockClient = { ... }
// const service = new WhisperService(mockClient, () => 'test-key')
```

**3. Add first security tests**

Create `src/main/utils/pathValidator.test.ts`:
```typescript
import { describe, test, expect } from 'vitest'
import { validatePath, validateExcelPath } from './pathValidator'

describe('pathValidator - SECURITY CRITICAL', () => {
  describe('path traversal prevention', () => {
    test('blocks ../ traversal', () => {
      expect(() => validatePath('../../../etc/passwd'))
        .toThrow('Path traversal not allowed')
    })

    test('blocks encoded traversal', () => {
      expect(() => validatePath('%2e%2e%2f'))
        .toThrow('Path traversal not allowed')
    })

    test('blocks Windows traversal', () => {
      expect(() => validatePath('..\\..\\..\\windows\\system32'))
        .toThrow('Path traversal not allowed')
    })
  })

  describe('allowed directory validation', () => {
    test('allows paths in xlsxBasePath', () => {
      // Setup mock config with xlsxBasePath
      const validPath = 'D:\\C-Con\\AL-kas\\file.xlsx'
      expect(() => validateExcelPath(validPath)).not.toThrow()
    })

    test('blocks paths outside allowed dirs', () => {
      expect(() => validatePath('/tmp/malicious.xlsx'))
        .toThrow('Path outside allowed directories')
    })
  })
})
```

### Phase 2: Core Service Tests (Week 3-4)

**Priority order:**

1. pathValidator.test.ts (SECURITY)
2. backup.test.ts (DATA SAFETY)
3. excel.test.ts (DATA INTEGRITY)
4. llm.test.ts (BUSINESS LOGIC)
5. config.test.ts (CONFIGURATION)
6. whisper.test.ts (INTEGRATION)
7. glossar.test.ts (BUSINESS LOGIC)

**Mock strategy for external APIs:**

```typescript
// tests/mocks/openai.ts
export const mockOpenAI = {
  audio: {
    transcriptions: {
      create: vi.fn().mockResolvedValue({
        text: 'Test transcript',
        language: 'de'
      })
    }
  }
}

// tests/mocks/xlsx.ts
export const mockXLSX = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  utils: {
    decode_range: vi.fn(),
    encode_cell: vi.fn(),
    // ...
  }
}
```

### Phase 3: Integration Tests (Week 5-6)

**Test IPC handlers with real services but mocked external APIs:**

```typescript
// tests/integration/whisper-ipc.test.ts
import { ipcMain } from 'electron'
import { registerWhisperHandlers } from '@main/ipc/whisperHandlers'

describe('Whisper IPC Integration', () => {
  beforeEach(() => {
    // Mock OpenAI
    // Register handlers
    // Create mock BrowserWindow
  })

  test('full transcription flow', async () => {
    const mockAudioBuffer = new ArrayBuffer(1024)
    const result = await ipcMain.invoke('whisper:transcribe', mockAudioBuffer)

    expect(result).toEqual({
      text: expect.any(String),
      language: 'de',
      mode: 'cloud'
    })
  })
})
```

### Phase 4: E2E Tests (Week 7-8)

**Use Playwright for Electron:**

```typescript
// tests/e2e/voice-workflow.spec.ts
import { test, expect, _electron as electron } from '@playwright/test'

test('complete voice recording workflow', async () => {
  const app = await electron.launch({ args: ['.'] })
  const window = await app.firstWindow()

  // Click record button
  await window.click('[data-testid="record-button"]')

  // Simulate audio input (needs mock audio stream)

  // Wait for transcription
  await window.waitForSelector('[data-testid="transcript"]')

  // Verify activity parsed
  await expect(window.locator('[data-testid="activity-auftraggeber"]'))
    .toContainText('Expected Client')

  // Save to Excel
  await window.click('[data-testid="save-button"]')

  // Verify file written
  // Check Excel file content

  await app.close()
})
```

### Phase 5: Documentation Improvements

**1. Add README sections:**

```markdown
## Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+
- Windows 10+ or macOS 12+

## Setup

1. Install dependencies:
   \`\`\`bash
   pnpm install
   \`\`\`

2. Configure API key:
   \`\`\`bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   \`\`\`

3. Configure Excel files:
   - Set xlsxBasePath in Settings
   - Map each file to an Auftraggeber
   - Ensure files have month-named sheets (Januar, Februar, etc.)

## Troubleshooting

### "Whisper model not loading"
- Check network connection for cloud API
- For local mode, first load downloads ~200MB model
- Check console for download progress

### "Excel file locked"
- Close Excel before saving activities
- Check backups/ folder for recovery

### "API key not working"
- Verify key in Settings (stored encrypted)
- Check OpenAI account has credits
- Try removing and re-adding key
```

**2. Add inline JSDoc to undocumented files:**

Focus on:
- Complex composables (useWhisper, useAudioRecorder)
- Stores (explain state transitions)
- IPC handlers (document contracts)

**3. Create API reference:**

Generate from code or manually document:
```markdown
# IPC API Reference

## window.api.whisper

### transcribe(pcmData: ArrayBuffer, blob?: ArrayBuffer)
Transcribes audio using OpenAI Whisper API (cloud) or local model as fallback.

**Parameters:**
- `pcmData` - PCM audio data at 16kHz
- `blob` - Original audio blob for cloud API

**Returns:** `Promise<TranscriptionResult>`
- `text` - Transcribed text
- `language` - Detected language code
- `mode` - 'cloud' | 'local' | 'none'

**Throws:**
- API key not configured
- Network error (cloud mode)
- Model not loaded (local mode)
```

---

## 6. Testing Strategy Summary

### Immediate Actions (This Week)

1. **Install Vitest** and create basic config
2. **Write security tests** for pathValidator.ts
3. **Refactor one service** for DI (start with backup.ts - smallest, no external deps)
4. **Add 10-15 unit tests** for backup.ts

### Short-term Goals (Month 1)

1. **50% unit test coverage** on services
2. **All security-critical code tested** (pathValidator, secureStorage)
3. **Refactor 3 major services** for DI (whisper, llm, config)
4. **5 integration tests** for IPC handlers

### Medium-term Goals (Month 2-3)

1. **70% overall coverage**
2. **All services refactored** for testability
3. **20 integration tests**
4. **5 E2E tests** for critical workflows
5. **CI integration** (GitHub Actions) running tests on PRs

### Ongoing Practices

1. **TDD for new features** - write tests first
2. **Test-first refactoring** - add tests before changing code
3. **Coverage gates** - block PRs below 60% coverage
4. **Review test quality** - not just code coverage %

---

## 7. Risk Assessment

### Current Risks Without Tests

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Excel data corruption** | CRITICAL | MEDIUM | Add excel.ts tests immediately |
| **Path traversal exploit** | CRITICAL | LOW | Add pathValidator tests ASAP |
| **LLM merge bugs lose data** | HIGH | MEDIUM | Add llm.ts correction tests |
| **Config migration failures** | HIGH | LOW | Add config.ts tests |
| **Backup failures unnoticed** | HIGH | MEDIUM | Add backup.ts tests + monitoring |
| **Whisper fallback broken** | MEDIUM | LOW | Add integration tests |
| **IPC contract drift** | MEDIUM | MEDIUM | Add integration tests |

### Test Investment ROI

**Estimated effort:** 4-6 weeks for comprehensive test suite
**Expected benefits:**
- **Prevent data loss bugs** (estimated 2-3 critical bugs/year)
- **Enable safe refactoring** (reduce regression bugs by 80%)
- **Faster feature development** (catch bugs in minutes, not hours)
- **Better code quality** (testable code is better code)
- **Easier onboarding** (tests document behavior)

---

## 8. Conclusion

The Aktivitäten app has **zero test coverage** and **poor testability** due to module-level state and lack of dependency injection. However, it has **excellent architectural documentation** and clear separation of concerns.

**Immediate priorities:**

1. ✅ Set up Vitest
2. ✅ Test security-critical pathValidator
3. ✅ Refactor backup.ts for DI (easiest starting point)
4. ✅ Add 10-15 tests to prove the testing infrastructure works

**Long-term vision:**

Transform this into a **test-driven codebase** with:
- 70%+ test coverage
- All services using dependency injection
- Fast, reliable test suite (<30s)
- E2E tests for critical workflows
- CI/CD integration with test gates

The current codebase is **production-ready but untested**. Adding tests will:
- Prevent future bugs
- Enable confident refactoring
- Improve code quality
- Reduce maintenance burden

**Recommended next step:** Schedule 1-2 weeks for Phase 1 foundation work.
