# Design: MPV Plugin Packaging Ownership

## Ownership Boundary

`fntv-mpv-config` owns upstream selection, version pinning, download,
extraction, custom defaults, and production of the complete MPV archive.
`fntv-electron` consumes that archive and installs its contents. Electron does
not query or overlay an individual upstream plugin repository.

## Package Flow

1. `fntv-mpv-config/package_cfg.json` pins MPV to official build `20260814`
   and `uosc_danmaku` to stable `v2.1.0`.
2. The existing config build downloads the release asset and installs it at
   `portable_config/scripts/uosc_danmaku`.
3. The config release workflow publishes the complete archive.
4. The Electron release workflow downloads that archive as its sole MPV
   bundle input.

This retains the repository's current package design and avoids introducing a
second version source in Electron.

The MPV pin is advanced because the previous `20260203` upstream release asset
was removed and now returns HTTP 404. Selecting an existing immutable release
restores the complete package pipeline instead of producing a partial bundle.

## Runtime Upgrade Contract

The bundled `scripts/uosc_danmaku` directory is application-managed code. On
an existing installation it may be replaced as a unit from the bundled copy.
The following are user-owned and must not be overwritten during upgrade:

- `danmaku-history.json`
- all files under `script-opts`
- scripts other than `scripts/uosc_danmaku`

On a fresh installation, the complete portable configuration is copied once.
The shipped history seed is reduced to the existing default visibility flag,
so no repository-owned media mappings are distributed.

## Compatibility

Upstream `v2.1.0` explicitly supports uosc `5.12.0`, which is the version
already pinned by the config repository. Its history path and data shape remain
compatible with the PR #155 persistence approach.

## Delivery And Rollback

The config repository change is committed and pushed first so its existing
release workflow can publish a complete archive. The Electron correction is
then pushed to PR #155. Rolling back consists of restoring the previous config
dependency pin/release and reverting the focused PR commit; user state remains
outside the replaced plugin directory throughout.

## Trade-offs

The runtime sync remains deliberately scoped to `uosc_danmaku` rather than
adding a general manifest. This solves issue #154 and the PR architecture defect
with the smallest contract change. A generic managed-path manifest can be
designed separately if more plugins need in-place upgrades.

## Playback Default Contract

The legacy `hideOriginalPlayButton` field continues to represent MPV playback
ownership for compatibility, but only the literal boolean `true` enables it.
A small shared normalization helper is used by both the main-process preference
reader and preload configuration handling so missing values and failure
fallbacks cannot diverge again. Existing explicit user choices remain intact;
an absent value becomes native playback as described by PR #155.

## Proxy Ownership Across Restarts

The Proxy secret protects localhost control endpoints from untrusted remote web
content rendered by Electron. It is not a login credential and does not defend
against another process running as the same operating-system user.

Electron loads or creates a 32-byte random secret in a dedicated file under its
user-data directory. The file is written atomically and restricted to mode
`0600` on POSIX. The secret remains absent from logs, command-line arguments,
environment variables, and playback URLs; it is passed to a newly spawned Proxy
only through stdin, as in PR #155.

Because the file survives an abnormal Electron exit, the next Electron process
can authenticate the existing Proxy health endpoint and reuse the orphan. A
valid 64-character lowercase hexadecimal value is required; malformed local
state is replaced for future starts. The existing fixed port, authenticated
health payload, daemon behavior, and short-lived playback sessions are retained.

## Release-Branch Integration

The current `release` branch is merged into the contributor branch with a normal
merge commit. Conflict resolution must preserve both sides' intended behavior,
particularly the native macOS title-bar controls from PR #156 and PR #155's
renderer isolation. This avoids rewriting contributor history and avoids a
force push.
