# Cafe Clicker Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the cafe clicker so every README-documented feature works correctly and passive income keeps the whole UI in sync.

**Architecture:** Keep the app as a single `index.html` file with inline HTML, CSS, and JavaScript. Add one lightweight Node regression test that runs the inline script against a fake DOM so the core loop can be verified without adding dependencies.

**Tech Stack:** Vanilla HTML, CSS, JavaScript, Node.js built-in `assert`, `fs`, and `vm`

---

### Task 1: Add a failing regression test for the passive-income sync bug

**Files:**
- Create: `tests/cafe-clicker.test.js`
- Test: `tests/cafe-clicker.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
runTest('passive income updates milestone text after crossing 100 total', () => {
  const game = loadGame();
  game.setState({ coins: 0, total: 99, cups: 0, owned: { barista: 1 } });
  game.refreshAll();
  game.runIntervals(1);
  assert.equal(game.getText('milestone'), '🫘 단골이 생겼어');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/cafe-clicker.test.js`
Expected: FAIL because the current interval path only refreshes the stats cards.

- [ ] **Step 3: Build the minimal fake DOM harness around the test**

```javascript
function loadGame() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const script = extractScript(html) + testHooks;
  const document = createDocument();
  const intervals = [];
  const context = vm.createContext({
    document,
    window: {},
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: (fn) => {
      intervals.push(fn);
      return intervals.length - 1;
    },
    clearInterval: () => {}
  });
  vm.runInContext(script, context);
  return createApi(context, document, intervals);
}
```

- [ ] **Step 4: Re-run the test file and keep the passive-income assertion failing cleanly**

Run: `node tests/cafe-clicker.test.js`
Expected: FAIL only on the passive-income milestone assertion.

- [ ] **Step 5: Commit**

```bash
git add tests/cafe-clicker.test.js
git commit -m "test: cover cafe clicker passive income sync"
```

### Task 2: Rebuild the single-file game logic around full UI refreshes

**Files:**
- Modify: `index.html`
- Test: `tests/cafe-clicker.test.js`

- [ ] **Step 1: Replace the broken or stale runtime flow with a clean full-refresh implementation**

```javascript
function refreshAll() {
  renderStats();
  renderShop();
  milestoneEl.textContent = getMilestone();
  cpcLabelEl.textContent = `클릭당 ${getCPC()}원`;
}

setInterval(() => {
  const cps = getCPS();
  if (!cps) {
    return;
  }
  coins += cps / 10;
  total += cps / 10;
  refreshAll();
}, 100);
```

- [ ] **Step 2: Keep README-matching data and interactions in the rebuilt file**

```javascript
const UPGRADES = [
  { id: 'beans', name: '좋은 원두', emoji: '🫘', desc: '클릭당 +1', costBase: 15, costMult: 1.6, cpc: 1, cps: 0 },
  { id: 'machine', name: '에스프레소 머신', emoji: '⚙️', desc: '초당 +2', costBase: 50, costMult: 1.6, cpc: 0, cps: 2 },
  { id: 'barista', name: '바리스타 고용', emoji: '👩‍🍳', desc: '초당 +10', costBase: 200, costMult: 1.6, cpc: 0, cps: 10 }
];
```

- [ ] **Step 3: Remove non-essential leftovers from the previous version**

```javascript
let pid = 0;
```

Replace unused state or stale logic so the final file only keeps behavior that still serves the game.

- [ ] **Step 4: Run the test file to verify the rebuilt implementation passes**

Run: `node tests/cafe-clicker.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html tests/cafe-clicker.test.js
git commit -m "fix: repair cafe clicker gameplay"
```

### Task 3: Verify repo state and publish

**Files:**
- Modify: `README.md` only if it no longer matches implementation

- [ ] **Step 1: Re-read the README against the repaired game behavior**

```text
Confirm the upgrade list, milestone thresholds, and single-file structure still match the implementation.
```

- [ ] **Step 2: Run the regression test again before publishing**

Run: `node tests/cafe-clicker.test.js`
Expected: PASS

- [ ] **Step 3: Check repository state**

Run: `git status --short --branch`
Expected: only intended changes are present

- [ ] **Step 4: Push the repaired project**

Run: `git push origin main`
Expected: remote `main` updates successfully
