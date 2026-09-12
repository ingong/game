# Crimson Furnace — js13kGames 2026 submission

Status: prepared locally; NOT submitted. GitHub login is required at https://js13kgames.com/submit.

## Entry details

- Name: Crimson Furnace
- Category: Desktop (keyboard required; do not select Mobile)
- Source: https://github.com/ingong/game
- Build: dist/game.zip
- Theme: Unicorns and Rainbows

## Description for the submission form

Race a unicorn across seven rainbow skyways in a compact 2.5D chase runner. Dodge crystals, time your way through lightning, leap over gaps, and use springs to survive increasingly demanding courses. Clear all seven stages before time runs out.

Controls: Arrow Up accelerates, Arrow Down brakes, and Arrow Left/Right steer. Space starts the game, jumps and double-jumps, retries after failure, and advances after a stage clear.

Built with JavaScript and Canvas 2D. The complete game runs offline from a single HTML file with an embedded pixel-art unicorn atlas and procedural environments.

## Verification

Official rules: https://js13kgames.com/2026/rules (checked 2026-09-13).
Deadline: 2026-09-13 13:00 CEST / 20:00 Asia/Seoul.

- npm test: 129 passed, 0 failed.
- npm run build: 12,831 / 13,312 bytes (481 bytes remaining).
- unzip -t: passes; one top-level index.html.
- SHA-256: e520c4599a653b6d5486c08851bb87c2ba577c71ffddb486216579050ca5a515
- In-app Chromium: game starts and renders; no captured console errors or warnings in the smoke check.
- Latest Chrome and Firefox: full required verification still pending; Firefox is not installed.
- Public GitHub repository confirmed.
- Restricted muscle-runner reference removed from current source tree and manifest; local copy preserved in ignored .local-references/. Git history was not rewritten.

## Remaining submission steps

1. Sign in to js13kGames with GitHub.
2. Complete the six-step form, upload the ZIP, and run its validation.
3. Complete presentation and author information.
4. Review the final submission and applicable terms, then submit and record the entry URL/status.

The rules grant the organizer and its subsidiaries, agents and partner companies a perpetual, irrevocable, worldwide, royalty-free nonexclusive license to use, reproduce, adapt, modify, publish, distribute, perform, create derivatives from and display the submission. Entrants retain ownership. The privacy policy also describes competition and partner-content emails.
