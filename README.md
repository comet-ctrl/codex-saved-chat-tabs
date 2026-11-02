# Codex Saved Chat Tabs

Open existing Codex chats in native tabs in the right pane, while keeping the main chat on the left.

This is an **unofficial, experimental Windows modification** for one pinned Codex desktop build. It is not an OpenAI product and is not affiliated with or endorsed by OpenAI. This repository distributes the patch source and build tools only. You must supply your own installed application.

## What it does

- Adds one **Open saved chat** button to the native header.
- Lists chats visible in the sidebar and previously cached chats, with search and keyboard selection.
- Opens each selected saved chat in its own native right-pane tab, beside file, browser, and other tool tabs.
- Selecting an already-open chat focuses its existing tab instead of opening a duplicate.
- Uses the native transcript, composer, scrolling, close controls, and pane resizing.
- Keeps the left chat unchanged when opening a right-pane chat.

The picker moves into the right header when the pane is open. There is no additional tab strip above the main transcript. Temporary Side chat creation remains available through the native controls.

## Compatibility

| Item | Supported / required |
| --- | --- |
| Platform | Windows, x64 |
| Inspected package | `OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0` |
| Inspected renderer/runtime | `26.1027.30824` |
| Python | 3.10 or later; standard library only for building |
| Node.js for tests | 22.22.2+, 24.15.0+, or 26+ within the ranges in `package.json` |

The builder verifies the original renderer's SHA-256 and a unique patch anchor. It refuses unknown builds. This is not a general-purpose patch for future Codex versions.

## Build

Clone this repository and open PowerShell in its directory. Close the modified copy before rebuilding it.

Locate the original installation:

```powershell
$tabsPackage = Get-AppxPackage -Name OpenAI.Codex |
    Where-Object { $_.Version -eq [version]'26.1027.3384.0' } |
    Select-Object -First 1
if (-not $tabsPackage) { throw 'The supported Codex package is not installed.' }
$tabsSource = Join-Path $tabsPackage.InstallLocation 'app'
python .\build.py $tabsSource (Join-Path $PWD 'app')
```

Alternatively, pass the original app directory explicitly:

```powershell
python .\build.py 'C:\path\to\original\app' '.\app'
```

The builder copies the application into `app/`, patches the local renderer, and updates the copied executable's embedded archive hash. It does not modify the installed app. Do not publish the generated application or `patched-module.mjs`; they contain application code and are ignored by Git.

## Launch and use

1. Finish your work and quit the existing Codex instance normally.
2. Run `.\Launch.ps1` from PowerShell, or open `app\ChatGPT.exe`.
3. Open the main chat from the sidebar.
4. Click **Open saved chat**, then choose another existing chat.
5. Repeat to open more right-pane tabs. Click their native tab titles to switch.
6. Drag the divider to resize the panes. Close a tab with its native close button.

The picker searches up to 80 cached/sidebar chats, not the full account history. To expose another chat, find and open it in the normal sidebar first. Native tab titles may truncate when the pane is narrow.

The saved conversations persist, but restoring the right-pane layout after restarting the application is not guaranteed. Do not treat a right-pane tab as a backup of a conversation.

## Tests and validation

```powershell
npm ci
npm test
npm run check
python -m py_compile build.py
```

The five DOM regression tests cover:

- One picker control in the native header, without extra transcript padding.
- Opening multiple saved chats without navigating the main chat or replacing another tab.
- Search, Enter-to-open, and recovery after an opening error.
- Ignoring retained hidden UI surfaces and preventing side-chat binding from replacing the primary context.
- Moving the single picker between fallback, main-toolbar, and right-panel layouts.

The local v7 build was also exercised in a running diagnostic instance: two saved chats remained in separate native tabs, reselecting them did not create duplicates, and exactly one picker control remained. No prompts were submitted during that verification. DOM tests do not substitute for checking a new application build in the actual UI. CI checks source and tests; it does not run the proprietary desktop app.

## Limitations and rollback

- The modified copy's vendor signature is invalidated by the local executable change. Archive integrity enforcement remains enabled with the rebuilt archive hash.
- The standalone copy cannot use the Windows package updater. Updating Codex requires reviewing compatibility and rebuilding from the new original application; the pinned builder will reject it until adapted.
- The default launcher enables no debugging port. This repository includes no diagnostic profiles, account data, logs, real chat screenshots, application binaries, or extracted renderer bundles.
- To roll back, quit the modified copy and launch the installed Codex normally. No chat-history migration or deletion is performed.

## Source license

The original patch code in this repository is licensed under MIT. The installed Codex application and generated application copies remain subject to their own terms and are not covered by this repository's license.
