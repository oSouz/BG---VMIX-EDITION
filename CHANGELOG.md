# 0.6.0

- Windows x64 installer and portable application include Node.js 22.23.5, Python 3.12.10 and pinned native rendering libraries.
- Added Start Menu and optional Desktop shortcuts, uninstaller, and official NDI runtime setup when needed.
- Installed user data lives outside program files and survives upgrade/uninstall; source edition data can be migrated on first installed launch.
- Active transmission is never forcibly stopped during upgrade: installer asks to close the active installed edition first.
- Added pinned download/checksum manifest, installer build scripts, third-party notices and GitHub Windows regression checks.
- vMix and sustained-load validation remain pending; user-reported OBS, Resolume and ProPresenter compatibility is retained.

# 0.5.0

- Persist NDI name/resolution/FPS, vMix address and selected input GUID in validated local settings.
- Restore settings after restart without automatically starting NDI or executing vMix commands.
- Preserve malformed settings and recover with defaults; keep a backup before replacing the invalid file.
- Add explicit Save configuration control for NDI and restore the saved vMix input only if it is present.
- Add per-user instance registry and launcher mutex so other package copies reuse the active session; stop shortcut uses that session's control file.
- Installer bundling remains the next distribution stage; this release is still a source package.

# 0.4.1

- Fixed startup alongside older Studio versions that occupy port 3947 without a health endpoint.
- Launcher selects a free local port and remembers it for subsequent launches and shutdown.
- Existing Studio/NDI processes are preserved.

# 0.4.0

- Windows launcher checks Node.js, starts the Studio hidden and opens the browser. Reopening reuses the running instance.
- Added authenticated shutdown and ENCERRAR-STUDIO.bat for Studio and NDI together.
- NDI setup detects Python 3.12 x64 and remembers its local executable path.
- Centralized visible version from VERSION; added a non-sensitive health endpoint for launch checks.
- Added allowlisted ZIP packaging, SHA-256 manifest verification and clean-transfer instructions.
- User-reported NDI validation: OBS, Resolume and ProPresenter. vMix and sustained-load validation remain pending.

# 0.3.0

- Added native GPU NDI sender using the shared Studio shaders, an independent process and the official NDI runtime.
- Added start/stop, source name, resolution, frame rate, measured FPS, sent frame count and receiver count to the home page.
- Added local Python setup helper and real NDI discovery/video/color/TAKE integration check.
- Validated 1080p30 locally on RTX 2060 in a short run; cross-machine and sustained-load validation remain outstanding.
- WebGL output and Resolume baseline remain available and unchanged in behavior.

# 0.2.0

- TAKE and live engine changes prepare the shader on all connected outputs before committing the transition.
- Preparation failures, disconnected participants and 10-second timeouts preserve the existing PGM scene.
- Existing scene keeps animating during target compilation. Concurrent scene edits are rejected while preparing.
- Panel command timeout accommodates preparation and reports server error details.
- Local access token is persisted outside Git to retain output URLs across restarts.
- Original Resolume baseline remains unchanged. NDI sender remains unimplemented.

# 0.1.0

- Independent local runtime, original Studio panel adapter, clean WebGL output and vMix HTTP bridge.
- Resolume 1.17.1 source retained unchanged under baseline/.
- NDI sender is not implemented in this release.
