# Cafe Clicker Repair Design

**Goal:** Restore the single-file clicker game so the README-described gameplay works reliably in the browser and stays visually consistent as the game state changes.

## Scope

- Keep the project as a static single-page app in `index.html`.
- Keep the existing left-play and right-upgrade layout.
- Match the documented feature set: click income, automatic income, eight upgrades, 1.6x repeated pricing, milestone titles, first-purchase toast, and click particles.
- Avoid extra systems that are not part of the provided reference material.

## Root Cause

The current app initializes and renders, but the automatic income loop only refreshes the stats cards. As a result, coin totals increase in the background while milestone text and upgrade button availability stay stale until another manual action triggers `refreshAll()`. This breaks the core clicker loop because passive progress does not fully propagate to the UI.

## Repair Approach

- Rebuild the single-file implementation cleanly inside `index.html` while preserving the same overall structure and visual language.
- Centralize rendering through one full refresh path so any state-changing action keeps all visible UI in sync.
- Keep the game state minimal: `coins`, `total`, `cups`, `owned`, `toastTimer`, and particle bookkeeping.
- Keep upgrade and milestone data in plain arrays so the behavior stays easy to verify against the README.

## UI Structure

- Header with coffee icon and title.
- Left panel with summary stats, milestone label, brew button, click-income label, and toast area.
- Right panel with the full upgrade list.
- Mobile layout remains a stacked version of the same panels.

## Data Flow

1. Startup calls a full render.
2. Clicking the brew button increases `coins`, `total`, and `cups`, creates a particle, then refreshes the full UI.
3. Buying an upgrade deducts coins, increments the owned count, optionally shows the first-purchase toast, then refreshes the full UI.
4. The automatic income interval increases `coins` and `total` from `getCPS()` and then refreshes the full UI so the shop and milestone stay current.

## Verification

- Add a lightweight Node-based regression test script under `tests/` that runs the inline game script against a small fake DOM.
- Verify the current bug first by asserting passive income updates the milestone automatically.
- Extend verification to cover initial render, click income, upgrade purchasing, and repeated-cost calculation.
- After implementation, run the test script again and confirm the working tree and remote branch state before pushing.
