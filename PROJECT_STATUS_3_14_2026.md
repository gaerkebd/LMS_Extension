# Canvas LMS Time Estimator - Project Status

> Quick reference for project state. See [README.md](.claude/README.md) for full documentation.

---

## Current Status: **MVP Complete + Debugging Phase**

The extension is feature-complete and functional. Recent work focused on the debug panel for testing AI integrations.

**Last Updated:** March 2026
**Branch:** `master`

---

## Progress Overview

### Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| Canvas API Integration | Done | Fetches courses & assignments, filters by due date |
| Heuristic Time Estimation | Done | Rule-based fallback, works without AI |
| AI Time Estimation | Done | OpenAI, Anthropic, Ollama (local) supported |
| Popup UI | Done | Assignment list, weekly summary, grouped by due date |
| Options Page | Done | Canvas settings, AI config, user preferences |
| Content Script | Done | Badge injection into Canvas pages |
| Service Worker | Done | Background refresh, caching, notifications |
| Debug Panel | Done | Testing AI providers, viewing logs, batch tests |

### Architecture Summary

```
src/
├── background/service-worker.ts   - Message hub, caching, alarms
├── content/content-script.ts      - Canvas DOM injection
├── debug/DebugPanel.tsx           - Development testing UI
├── options/Options.tsx            - Settings page (React)
├── popup/Popup.tsx                - Main extension popup (React)
├── services/
│   ├── canvas-api.ts              - Canvas LMS API wrapper
│   └── time-estimator.ts          - AI + heuristic estimation
└── types/index.ts                 - TypeScript interfaces
```

---

## Tasks Remaining

### High Priority
- [ ] **Badge injection preference** - Content script doesn't respect `injectBadges` setting

### Medium Priority
- [ ] Add API rate limiting for Canvas requests
- [ ] Add retry logic for failed AI/Canvas API calls
- [ ] Improve error messages (currently generic "Connection failed")

### Low Priority / Nice to Have
- [ ] Offline mode detection
- [ ] Unit tests (Vitest configured but no tests written)
- [ ] Usage analytics (opt-in)
- [ ] Restore root README.md (currently only in .claude/)

---

## Known Issues

1. **Uncommitted changes** in `src/services/canvas-api.ts` (minor formatting)
2. **Root README.md deleted** - documentation moved to `.claude/README.md`

---

## Quick Start for Development

```bash
# Install dependencies
npm install

# Run development build with hot reload
npm run dev

# Load in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

### Testing the Extension

1. **Debug Panel**: Open `chrome-extension://<id>/src/debug/index.html`
2. **Test Canvas Connection**: Options page → Test Connection button
3. **Test AI Providers**: Debug panel → Select provider → Run single/batch tests

---

## Git History (Recent)

```
cf4dd3d - Debugging panel updates
61391a3 - Implementing AI functionality in Debugging
10cd9e9 - First working Version, using Heuristics
2533dcd - MVP done
9c9f4b4 - Skeleton, restarting due to lost REPO
```

---

## Tech Stack

- **React 18** + **TypeScript 5.3**
- **Vite 5** with CRXJS plugin
- **Tailwind CSS 3.4**
- **Chrome Extension Manifest V3**

---

## Next Steps Suggestion

1. Fix the debug panel to use production prompts for accurate testing
2. Wire up the `injectBadges` preference in content script
3. Consider adding the root README back for GitHub visibility
4. Write some basic tests before adding more features
