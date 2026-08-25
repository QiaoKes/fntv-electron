# Align MPV plugin packaging with config repository

## Goal

Make PR #155 merge-ready by restoring `fntv-mpv-config` as the single source
of truth for the bundled `uosc_danmaku` plugin, correcting the native-playback
default, making orphan Proxy reuse work across Electron restarts, and resolving
the branch's conflicts with the current `release` branch.

## Background

- `fntv-mpv-config/package_cfg.json` currently pins `uosc_danmaku` to `v2.0.0`.
- The latest stable upstream release is `v2.1.0` at commit
  `e3aeb8a4fe301d903bb39e2e17fbbcf27c6141d1`; its release asset SHA-256 is
  `f5e2ee6277a266072dfad7a698bb276d52413d94e1761871a3ec8747f01ce805`.
- Upstream also has a `v2.2.0-alpha` tag and newer `main` commits. They are not
  stable releases and must not be consumed by a release build.
- PR #155 first downloads the latest `QiaoKes/fntv-mpv-config` release, then
  replaces its pinned plugin with a mutable upstream `main` snapshot.
- Upstream stores persistent visibility and match history in
  `~~/danmaku-history.json`, outside `scripts/uosc_danmaku`.
- The config repository currently ships real media match history to new users.
- PR #155 describes native FNMedia playback as the default, but both the stored
  preference reader and renderer timeout/missing-value fallbacks currently
  enable MPV interception.
- PR #155 creates a new Proxy authentication secret on every Electron process
  start. An orphan Proxy retained after an abnormal exit still expects the old
  secret, so the new process cannot authenticate or reuse it and cannot bind the
  occupied fixed port.
- PR #155 is currently reported by GitHub as conflicting with `release`, which
  now includes PR #156 and the Trellis bootstrap commit.
- The first config release attempt showed that upstream removed the pinned MPV
  `20260203` release asset. The user approved upgrading MPV to the latest
  available official build, `20260814`, so the bundle remains buildable.

## Requirements

1. Update the config repository dependency to the latest stable
   `uosc_danmaku` release, `v2.1.0`.
2. Keep plugin version selection and download behavior exclusively in
   `fntv-mpv-config`.
3. Remove the direct `Tony15246/uosc_danmaku` download and overlay from the
   Electron release workflow in PR #155.
4. On first MPV configuration initialization, seed the bundled portable
   configuration as PR #155 currently intends.
5. On later launches, replace only bundled `scripts/uosc_danmaku` code and
   preserve the user's `script-opts`, `danmaku-history.json`, and unrelated
   scripts.
6. Replace the repository's real seeded media history with a minimal default
   that retains the existing new-install visibility choice.
7. Add focused tests for the config dependency/default history and the
   Electron upgrade preservation behavior.
8. Publish the config update through its existing release workflow, then push
   the Electron correction to PR #155's source branch when GitHub permits it.
9. Treat MPV interception as enabled only for an explicit stored/configured
   boolean `true`; new, missing, malformed, timed-out, and failed configuration
   reads must retain native FNMedia playback.
10. Persist the random Proxy ownership secret in a dedicated per-user state
    file with user-only POSIX permissions, reuse the same valid secret after an
    abnormal Electron restart, and continue sending it to the Proxy through
    stdin rather than process arguments or playback URLs.
11. Keep the existing short-lived playback-session capability and authenticated
    Proxy health contract unchanged.
12. Merge the current `release` branch into the PR source branch and resolve
    conflicts without dropping either PR #155's security changes or PR #156's
    native macOS window controls.
13. Re-review the complete combined diff before deciding whether PR #155 and
    its associated issues can be merged/closed.
14. Update the MPV dependency to the latest available official Windows build,
    `20260814`, and cover the production pin with a regression test.

## Acceptance Criteria

- [ ] The config package resolves and installs the official `v2.1.0` release.
- [ ] A generated package contains `main.lua` with `VERSION = "2.1.0"` under
      `portable_config/scripts/uosc_danmaku`.
- [ ] The Electron workflow contains no upstream danmaku repository query,
      archive download, or overlay step.
- [ ] An existing user's plugin code is refreshed from the bundled config
      package while custom `script-opts/uosc_danmaku.conf`,
      `script-opts/uosc.conf`, and `danmaku-history.json` remain byte-for-byte
      unchanged.
- [ ] Unrelated user scripts remain unchanged.
- [ ] A fresh installation receives only a minimal default history file, not
      repository-owned viewing records.
- [ ] Config repository tests and Electron lint, type-check, and focused/full
      tests pass.
- [ ] The updated config release and PR #155 revision identify the pinned
      `uosc_danmaku` version.
- [ ] A fresh or missing playback preference leaves MPV interception disabled;
      explicit `true` enables it and explicit `false` disables it.
- [ ] Renderer configuration timeout and missing/malformed reply data fail safe
      to native playback.
- [ ] Two simulated Electron lifecycles using the same user-data directory load
      the same valid 256-bit Proxy secret.
- [ ] The Proxy secret file contains no credentials beyond the random ownership
      token, is never logged or placed in a URL, and is mode `0600` on POSIX.
- [ ] A health probe using the persisted secret can authenticate an orphan
      Proxy, while an unrelated or unauthenticated service is not reused.
- [ ] PR #155 is no longer conflicting with `release`, and the merged result
      retains the native macOS window-control implementation from PR #156.
- [ ] Full TypeScript and Go checks pass after resolving the combined diff.
- [ ] The complete config release build downloads and packages MPV `20260814`
      together with uosc_danmaku `v2.1.0`.

## Out of Scope

- A generic MPV bundle manifest or a new package-management framework.
- Automatically overwriting user configuration with future product defaults.
- Upgrading uosc, smart-skip, or unrelated Electron dependencies.
- Replacing the fixed Proxy port or implementing cross-platform process
  enumeration/termination.
- Changing the short-lived Proxy playback-session protocol.
