# Changelog

All notable changes for TunesReloaded Reworked are documented in this file.

This project follows a simple entry format:
- `YYYY-MM-DD` heading per update batch
- short bullets grouped by area

## 2026-02-14

### Branding And Docs
- Renamed visible variant branding to **TunesReloaded Reworked**.
- Reworked README to describe this repository as a rework and link upstream clearly.
- Updated About page with explicit original-vs-variant sections.
- Added variant-specific disclaimer and AI-assisted implementation note.

### Browser Compatibility And Startup Flow
- Added runtime capability detection (`secureContext`, directory picker, file picker, WebUSB).
- Removed startup hard-block behavior for unsupported environments.
- Moved hard API gating to connect-time (`selectIpodFolder`) when directory picker is missing.
- Updated browser compatibility guidance text with Brave flag instructions.

### Sync And Device Setup Reliability
- Fixed sqlite tree copy race in filesystem sync by removing un-awaited async IIFE.
- Implemented awaited fallback sequence:
  - `iTunes Library.itlp`
  - `iTunes Library`
  - `iTunesControl`
- Added explicit WebUSB guards in both app flow and firewire setup module.

### UI And Interaction Fixes
- Fixed context menu misplacement by using viewport coordinates for fixed-position menu.
- Added viewport clamping for context menu positioning near window edges.
- Adjusted main panel sizing.
- Updated playlist/song list height behavior and introduced dynamic song-list height sync to playlist list.
