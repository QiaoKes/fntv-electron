# Implementation Plan

1. Update `fntv-mpv-config`.
   - Pin MPV to the latest available official build, `20260814`, after the
     previous upstream asset was removed.
   - Pin `uosc_danmaku` to `v2.1.0`.
   - Replace seeded viewing records with the minimal existing visibility
     default.
   - Update focused version documentation and add regression tests.
2. Validate and publish the config bundle.
   - Run the Python test suite.
   - Build the `uosc_danmaku` dependency/package and inspect installed version
     and archive layout.
   - Commit and push `release`, then wait for the existing config release job
     and verify the published asset.
3. Update PR #155.
   - Check out the PR head branch without discarding Trellis artifacts.
   - Remove only the direct upstream danmaku overlay from the release workflow.
   - Refactor the bounded runtime sync only as needed to make preservation
     behavior testable.
   - Add tests proving managed code replacement and user-state preservation.
4. Verify Electron behavior.
   - Add a shared strict-boolean MPV preference normalizer and use it in the
     stored preference, IPC setter, and preload fallback paths.
   - Add a tested Proxy secret-state helper, replace the process-local random
     constant with the persisted value, and verify the secret remains off logs,
     arguments, environment variables, and playback URLs.
   - Add regression tests for fresh-user native playback and two-lifecycle
     orphan Proxy authentication.
   - Run focused MPV configuration tests.
   - Run lint, type-check, the full test suite, and diff checks.
   - Confirm the PR diff no longer contains a second plugin source.
5. Integrate the current release branch.
   - Merge `QiaoKes/fntv-electron:release` into the contributor branch without
     rebasing or force-pushing.
   - Resolve overlaps while retaining PR #156 native macOS controls, the
     Trellis bootstrap, and PR #155 security behavior.
   - Repeat TypeScript, Node, Go, and diff validation on the merged tree.
6. Deliver the PR revision.
   - Commit with the repository convention and a skip-build marker where the
     Electron release workflow recognizes it.
   - Push directly to PR #155's source branch if maintainer editing permits.
   - Otherwise push an owner-repository correction branch and report the exact
     GitHub permission limitation before creating any replacement PR.
   - Update the PR description/review context with the pinned config release,
     three resolved blockers, conflict resolution, and validation results.
   - Re-review the full PR and merge/close linked issues only when no blocking
     findings remain.

## Risky Files And Rollback Points

- `fntv-mpv-config/package_cfg.json`: controls the production upstream asset.
- `fntv-mpv-config/custom_config/uosc_danmaku/danmaku-history.json`: affects
  first-install defaults only; existing histories must never be replaced.
- `fntv-electron/.github/workflows/release.yml`: accidental edits can alter
  release behavior outside the plugin download step.
- `fntv-electron/src/main/handlers/plugins/mpvConfig.ts`: deletion scope must
  remain exactly the managed plugin directory.
- `fntv-electron/src/modules/fn_config/config.ts` and preload playback handling:
  every absent/error path must agree on native playback.
- `fntv-electron/src/main/common/proxy.ts` and the new secret-state helper:
  persistence must not expose the secret or weaken endpoint authentication.
- `fntv-electron/src/main/common/mainwin.ts`: conflict resolution must combine
  PR #156 native window controls with PR #155 renderer security settings.

Do not push until each repository's local checks pass. Do not merge PR #155
until the complete combined diff has been reviewed and all three blockers plus
the branch conflicts are resolved.
