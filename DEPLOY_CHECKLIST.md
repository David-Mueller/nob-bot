# Aktivitäten - Production Deployment Checklist

Use this checklist to track readiness for production release.

---

## Pre-Release Quality Gates

### Code Quality
- [ ] TypeScript compilation passes without errors (`pnpm typecheck`)
- [ ] All ESLint checks pass (`pnpm lint`)
- [ ] Type definitions consolidated (no duplication)
- [ ] Module-level state refactored to service container
- [ ] IPC handlers validate input with Zod schemas
- [ ] No `any` types in production code
- [ ] No console.log() in production paths

### Testing
- [ ] Unit tests written for composables (useWhisper, useAudioRecorder)
- [ ] Unit tests written for stores (useActivityStore, useChatStore)
- [ ] Integration tests for IPC handlers
- [ ] End-to-end tests for critical user flows
- [ ] Test coverage >70%

### Security
- [ ] Context isolation enabled ✓
- [ ] Sandbox enabled ✓
- [ ] Node integration disabled ✓
- [ ] No sensitive data in logs
- [ ] API keys not hardcoded
- [ ] Path traversal validation active
- [ ] XLSX files validate against formula injection
- [ ] Window open handler prevents navigation
- [ ] Preload script minimized

### Performance
- [ ] Whisper model loading <5s
- [ ] LLM responses <10s
- [ ] UI remains responsive during long operations
- [ ] Memory usage stable after 1h of use
- [ ] No memory leaks on repeated operations

### Compatibility
- [ ] Builds successfully on macOS (Intel + Apple Silicon)
- [ ] Builds successfully on Windows 10/11
- [ ] Builds successfully on Ubuntu 20.04+
- [ ] Installers work on target platforms
- [ ] Microphone permissions requested properly
- [ ] Config migration works (YAML → secure storage)

---

## Release Process

### Branch & Versioning
- [ ] Create release branch: `release/v1.x.x`
- [ ] Bump version in `package.json`
- [ ] Update CHANGELOG.md
- [ ] Create PR for release review
- [ ] Merge to main after approval

### Build & Publish
- [ ] GitHub Actions build completes without errors
- [ ] All artifacts generated:
  - [ ] macOS DMG
  - [ ] Windows EXE installer
  - [ ] checksums/signatures
- [ ] Artifacts uploaded to GitHub Releases
- [ ] Release notes published

### Deployment
- [ ] Internal testing on all platforms
- [ ] Beta release to selected users
- [ ] Monitor for crashes/errors (1-2 weeks)
- [ ] Promote to general release

### Post-Release
- [ ] Update website/download page
- [ ] Announce via email/social media
- [ ] Monitor bug reports
- [ ] Prepare hotfix process if needed

---

## Platform-Specific Checklist

### macOS
- [ ] App signed with Apple certificate
- [ ] Notarized by Apple (required for Gatekeeper)
- [ ] DMG icon displays correctly
- [ ] Dock icon appears in Catalina+
- [ ] Microphone permission prompt shows
- [ ] Accessibility permissions requested

### Windows
- [ ] NSIS installer runs without errors
- [ ] Installer creates start menu shortcuts
- [ ] Uninstaller works correctly
- [ ] Windows Defender doesn't flag as malware
- [ ] Works on Windows 10 (build 1909+) and 11

### Linux (Future)
- [ ] AppImage builds
- [ ] .deb package builds
- [ ] PulseAudio/ALSA microphone detection works

---

## Documentation

- [ ] README updated with download links
- [ ] CONTRIBUTING.md written
- [ ] Architecture documentation clear
- [ ] IPC API documented
- [ ] Troubleshooting guide created
- [ ] Release notes detailed and clear

---

## Monitoring & Support

### Error Tracking
- [ ] Sentry integration implemented (optional but recommended)
- [ ] Error reporting to developers
- [ ] User can submit feedback

### Metrics
- [ ] Track installation count
- [ ] Monitor crash rates
- [ ] Track feature usage
- [ ] Collect performance metrics

### Support
- [ ] Email support address active
- [ ] Bug report template available
- [ ] FAQ maintained
- [ ] Known issues documented

---

## Dependencies & Supply Chain

### Dependency Audit
- [ ] Run `pnpm audit` - no critical vulnerabilities
- [ ] Review all direct dependencies
- [ ] License compliance verified (MIT, Apache OK; GPL needs approval)
- [ ] No unmaintained dependencies

### Security Review
- [ ] OpenAI API key usage reviewed
- [ ] Secure storage implementation verified
- [ ] No credentials in git history
- [ ] .env.example doesn't contain secrets

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| App startup time | <2s | TBD |
| Whisper model load | <5s | TBD |
| Transcription latency | <1s | TBD |
| LLM parsing latency | <5s | TBD |
| Memory usage (idle) | <100MB | TBD |
| Memory usage (recording) | <200MB | TBD |
| Disk footprint | <500MB | TBD |

---

## Known Issues & Limitations

- [ ] Document all known issues
- [ ] List platform-specific limitations
- [ ] Note any disabled features
- [ ] Planned future improvements listed

**Example:**
```
## Known Issues
- XLSX formula injection not validated (v1.1)
- No dark mode support (planned for v2.0)
- Linux support not available (coming v2.0)
- Some older macOS versions (10.13) may not work (EOL in v2.0)
```

---

## Versioning Strategy

### Semantic Versioning
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Release Cadence
- v1.0.0: Initial release
- v1.0.x: Hotfixes (as needed)
- v1.1.0: First feature release (4-6 weeks)
- v1.2.0: Second feature release (4-6 weeks)

---

## Rollback Plan

If critical issue discovered post-release:

1. **Halt distribution:** Remove from download page
2. **Release hotfix:** Branch from v1.0.0, fix issue, release v1.0.1
3. **Notify users:** Email about critical fix
4. **Auto-update:** Implement update mechanism to push fix
5. **Communicate:** Post-mortem on blog/email

---

## Sign-Off

- [ ] Product Owner approval
- [ ] QA Manager sign-off
- [ ] Security review complete
- [ ] Deployment engineer approval

### Approvals
- Product: _________________ Date: _______
- QA: _________________ Date: _______
- Security: _________________ Date: _______
- Deploy: _________________ Date: _______

---

## Go/No-Go Decision

**Release Ready:** [ ] Yes [ ] No

**Decision Date:** _________________

**Approved By:** _________________

**Notes:**
```
[Add any notes or concerns here]
```

---

## Post-Release Communication

### Announcement Template

**Subject:** Introducing Aktivitäten v1.0.0 - Voice Activity Logging

**Body:**

```
We're excited to announce the release of Aktivitäten v1.0.0!

This desktop app makes it easy to log your work activities using voice input.
Just speak what you did, and our AI assistant will categorize and save it to Excel.

Key Features:
- Voice input with automatic transcription
- AI-powered activity parsing
- Excel integration with automatic backups
- Secure API key storage
- Multi-language support

Download now:
- [macOS DMG](...)
- [Windows Installer](...)

Requirements:
- macOS 10.15+ or Windows 10 (build 1909+)
- Microphone connected
- Internet connection for voice transcription

Feedback? Issues? Email us at support@nob-con.de

Happy logging!
```

---

## Ongoing Maintenance

### Daily (First Week)
- [ ] Monitor crash reports
- [ ] Respond to user issues
- [ ] Deploy hotfixes if needed

### Weekly (Month 1)
- [ ] Review user feedback
- [ ] Track key metrics
- [ ] Plan bug fixes
- [ ] Prioritize next features

### Monthly (Ongoing)
- [ ] Update dependencies
- [ ] Review security advisories
- [ ] Plan next release
- [ ] Communicate roadmap

### Quarterly
- [ ] Major feature planning
- [ ] Architecture review
- [ ] Performance analysis
- [ ] User research/surveys

---

## Success Criteria

### Week 1
- [x] 0 critical bugs in production
- [x] App successfully launches on target platforms
- [x] Users can record and save activities
- [x] No security incidents

### Month 1
- [x] 100+ installations
- [x] 95%+ success rate for features
- [x] <1% crash rate
- [x] Positive user feedback

### Quarter 1
- [x] 1,000+ active users
- [x] Feature parity with requirements
- [x] <0.5% crash rate
- [x] Revenue targets (if applicable)

---

## Handoff Checklist

Before handing off to ops team:

- [ ] Runbooks written for common issues
- [ ] Support contacts documented
- [ ] Monitoring/alerting configured
- [ ] Escalation procedures defined
- [ ] Update process automated
- [ ] Disaster recovery plan in place
- [ ] Team trained on deployment process

---

**Last Updated:** 2026-01-11
**Version:** 1.0 (Template)
**Next Review:** Before first release
