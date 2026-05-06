# CafeClick Endless Idle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the ending flow and rebuild CafeClick as an endless idle game with BigInt-backed economy, prestige progression, geometric price scaling, and throttled rendering.

**Architecture:** Keep the app in a single `index.html` file, but split the runtime into state, economy, persistence, and draw functions. Replace ending-specific UI and tests with prestige UI, BigInt serialization, and requestAnimationFrame-driven updates against stable DOM nodes.

**Tech Stack:** Vanilla HTML, CSS, JavaScript, Node.js `assert`, `fs`, and `vm`

---

### Task 1: Replace the regression tests with endless-idle expectations

**Files:**
- Modify: `tests/cafe-clicker.test.js`
- Test: `tests/cafe-clicker.test.js`

- [ ] **Step 1: Write the failing endless-idle harness tests**

```javascript
runTest('initial render shows prestige panel and no ending overlay', () => {
  const game = loadGame();
  assert.equal(game.getElement('ending-overlay'), null);
  assert.match(game.getText('prestige-title'), /환생/);
  assert.match(game.getText('prestige-bonus'), /\+0%/);
});

runTest('prestige bonus and formatter support very large values', () => {
  const game = loadGame();
  game.setState({
    run: {
      coins: '123456789000',
      total: '123456789000',
      cups: '12',
      owned: { machine: '1' }
    },
    prestige: {
      goldenBeans: '10'
    }
  });
  game.flush();
  assert.match(game.getStatsMarkup(), /1\.2억/);
  game.runFrames(10, 100);
  assert.equal(game.getWholeCoins(), '123456792');
});
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `node tests/cafe-clicker.test.js`
Expected: FAIL because the current app still exposes ending UI and Number-based state.

- [ ] **Step 3: Expand the failing coverage for prestige reset, geometric costs, and draw throttling**

```javascript
runTest('prestige resets run state but keeps permanent beans', () => {
  const game = loadGame();
  game.setState({
    run: {
      coins: '1500000',
      total: '4000000',
      cups: '30',
      owned: { machine: '2', branch: '1' }
    }
  });
  assert.equal(game.getPrestigePreview(), '2');
  game.prestige();
  assert.equal(game.getWholeCoins(), '0');
  assert.equal(game.getState().prestige.goldenBeans, '2');
});

runTest('costs grow geometrically and draw count is throttled', () => {
  const game = loadGame();
  game.setState({
    run: {
      coins: '1000000',
      total: '1000000',
      owned: { machine: '0' }
    }
  });
  game.flush();
  const firstCost = game.getCost('machine');
  game.buyUpgrade('machine');
  const secondCost = game.getCost('machine');
  assert.notEqual(firstCost, secondCost);
  const before = game.getDiagnostics().drawCount;
  game.runFrames(20, 16);
  const after = game.getDiagnostics().drawCount;
  assert(after - before < 20);
});
```

- [ ] **Step 4: Re-run the tests and keep the failures tied to missing endless-idle behavior**

Run: `node tests/cafe-clicker.test.js`
Expected: FAIL on endless-idle assertions, not on harness syntax.

### Task 2: Rebuild the single-file runtime around BigInt and prestige state

**Files:**
- Modify: `index.html`
- Test: `tests/cafe-clicker.test.js`

- [ ] **Step 1: Replace ending-specific markup with prestige UI and stable panels**

```html
<div class="prestige-card">
  <div class="prestige-title" id="prestige-title">환생</div>
  <div class="prestige-value" id="prestige-beans">황금 원두 0개</div>
  <div class="prestige-value" id="prestige-bonus">영구 수익 +0%</div>
  <div class="prestige-preview" id="prestige-preview">지금 환생하면 +0개</div>
  <button id="prestige-btn">환생하기</button>
</div>
```

- [ ] **Step 2: Replace Number state with scaled BigInt run and prestige state**

```javascript
const SCALE = 1000n;
const PRESTIGE_THRESHOLD = 1000000n;

function createRunState() {
  return {
    coinsRaw: 0n,
    totalRaw: 0n,
    cups: 0n,
    owned: Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, 0n])),
    costs: Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, toRaw(upgrade.baseCost)])),
    passiveBuffer: 0n,
    sessionStartedAt: Date.now()
  };
}

function createPrestigeState() {
  return {
    goldenBeans: 0n,
    prestigeCount: 0n,
    bestRunRaw: 0n
  };
}
```

- [ ] **Step 3: Add BigInt formatting, multiplier, and geometric cost helpers**

```javascript
function getIncomeMultiplierBps() {
  return 10000n + prestigeState.goldenBeans * 500n;
}

function applyMultiplier(rawAmount) {
  return rawAmount * getIncomeMultiplierBps() / 10000n;
}

function scaleCost(rawCost, ratio) {
  return rawCost * ratio / 1000n;
}
```

- [ ] **Step 4: Add prestige preview and reset flow**

```javascript
function getPrestigePreview() {
  const totalWhole = runState.totalRaw / SCALE;
  if (totalWhole < PRESTIGE_THRESHOLD) {
    return 0n;
  }
  return sqrtBigInt(totalWhole / PRESTIGE_THRESHOLD);
}

function performPrestige() {
  const gain = getPrestigePreview();
  if (gain < 1n) {
    return false;
  }
  prestigeState.goldenBeans += gain;
  prestigeState.prestigeCount += 1n;
  prestigeState.bestRunRaw = maxBigInt(prestigeState.bestRunRaw, runState.totalRaw);
  runState = createRunState();
  markDirty();
  saveGame();
  return true;
}
```

- [ ] **Step 5: Replace the ending interval with a requestAnimationFrame loop and stable draw**

```javascript
function gameLoop(timestamp) {
  if (lastFrameAt === 0) {
    lastFrameAt = timestamp;
  }
  const deltaMs = BigInt(Math.max(0, Math.floor(timestamp - lastFrameAt)));
  lastFrameAt = timestamp;
  applyPassiveIncome(deltaMs);
  if (dirty && timestamp - lastDrawAt >= 80) {
    draw();
    lastDrawAt = timestamp;
  }
  requestAnimationFrame(gameLoop);
}
```

- [ ] **Step 6: Run the tests to move the runtime from red to green**

Run: `node tests/cafe-clicker.test.js`
Expected: PASS

### Task 3: Rebuild the test harness around requestAnimationFrame and BigInt snapshots

**Files:**
- Modify: `tests/cafe-clicker.test.js`
- Test: `tests/cafe-clicker.test.js`

- [ ] **Step 1: Replace interval-only timing control with requestAnimationFrame stepping**

```javascript
const frames = [];
const context = vm.createContext({
  requestAnimationFrame(fn) {
    frames.push(fn);
    return frames.length - 1;
  },
  cancelAnimationFrame() {},
  Date: {
    now() {
      return now;
    }
  }
});
```

- [ ] **Step 2: Add helpers for BigInt-friendly state injection and flushing**

```javascript
runFrames(count = 1, deltaMs = 16) {
  for (let step = 0; step < count; step += 1) {
    now += deltaMs;
    const callbacks = frames.splice(0, frames.length);
    callbacks.forEach((callback) => callback(now));
  }
},

flush() {
  this.runFrames(6, 16);
}
```

- [ ] **Step 3: Expose prestige and diagnostics hooks from the runtime**

```javascript
prestige() {
  return context.__testHooks.performPrestige();
},

getDiagnostics() {
  return context.__testHooks.getDiagnostics();
}
```

- [ ] **Step 4: Re-run the regression file to confirm the harness matches the new runtime**

Run: `node tests/cafe-clicker.test.js`
Expected: PASS

### Task 4: Align docs and project narrative with endless idle behavior

**Files:**
- Modify: `README.md`
- Modify: `docs/repair-design.md`
- Modify: `docs/repair.md`

- [ ] **Step 1: Rewrite the top summary and feature bullets around endless-idle systems**

```markdown
| 프로젝트 한 줄 설명 | 엔딩이 없는 무한 방치형 클릭커 게임으로 전환하면서 BigInt 경제, 환생 시스템, 영구 버프, 렌더 최적화를 구현한 유지보수 프로젝트 |
```

- [ ] **Step 2: Replace ending-centric descriptions with prestige and large-number engineering notes**

```markdown
- BigInt 기반 대규모 재화 연산
- 환생 이후에도 유지되는 영구 수익 버프
- requestAnimationFrame 기반 뷰 업데이트 최적화
```

- [ ] **Step 3: Run the tests after doc alignment to confirm no accidental runtime change**

Run: `node tests/cafe-clicker.test.js`
Expected: PASS
