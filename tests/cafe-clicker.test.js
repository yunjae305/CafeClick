const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');

function extractScript(html) {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) {
    throw new Error('index.html does not contain an inline script');
  }
  return match[1];
}

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  add(...names) {
    const values = new Set(this.element.className.split(/\s+/).filter(Boolean));
    names.forEach((name) => values.add(name));
    this.element.className = Array.from(values).join(' ');
  }

  remove(...names) {
    const blocked = new Set(names);
    this.element.className = this.element.className
      .split(/\s+/)
      .filter((name) => name && !blocked.has(name))
      .join(' ');
  }

  contains(name) {
    return this.element.className.split(/\s+/).includes(name);
  }
}

class FakeElement {
  constructor(tagName, ownerDocument, id = '') {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.className = '';
    this.classList = new FakeClassList(this);
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.style = {};
    this.listeners = {};
    this._textContent = '';
    this._innerHTML = '';
    this.offsetWidth = 170;
  }

  set textContent(value) {
    this._textContent = String(value);
  }

  get textContent() {
    return this._textContent;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    if (this.id === 'shop') {
      const pattern = /<button class="upg-btn"([^>]*)data-id="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g;
      let match;
      while ((match = pattern.exec(this._innerHTML)) !== null) {
        const button = new FakeElement('button', this.ownerDocument);
        button.className = 'upg-btn';
        button.dataset = { id: match[2] };
        button.disabled = /\bdisabled\b/.test(match[1]);
        button.textContent = match[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        this.appendChild(button);
      }
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((item) => item !== child);
    child.parentNode = null;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  dispatchEvent(type, event = {}) {
    const handlers = this.listeners[type] || [];
    handlers.forEach((handler) => {
      handler({ currentTarget: this, target: this, ...event });
    });
  }

  click(event = {}) {
    this.dispatchEvent('click', event);
  }

  querySelectorAll(selector) {
    const matches = [];
    const className = selector.startsWith('.') ? selector.slice(1) : null;
    const visit = (node) => {
      node.children.forEach((child) => {
        if (className && child.className.split(/\s+/).includes(className)) {
          matches.push(child);
        }
        visit(child);
      });
    };
    visit(this);
    return matches;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 170, height: 170 };
  }
}

class FakeDocument {
  constructor() {
    this.elements = {};
    this.body = new FakeElement('body', this);
    [
      ['div', 'stats'],
      ['div', 'milestone'],
      ['div', 'btn-wrap'],
      ['button', 'brew-btn'],
      ['div', 'coffee-name'],
      ['div', 'coffee-desc'],
      ['div', 'cpc-label'],
      ['div', 'cafe-story'],
      ['div', 'toast-area'],
      ['div', 'shop'],
      ['div', 'prestige-title'],
      ['div', 'prestige-beans'],
      ['div', 'prestige-bonus'],
      ['div', 'prestige-preview'],
      ['button', 'prestige-btn']
    ].forEach(([tag, id]) => this.register(new FakeElement(tag, this, id)));
  }

  register(element) {
    if (element.id) {
      this.elements[element.id] = element;
    }
    this.body.appendChild(element);
    return element;
  }

  getElementById(id) {
    return this.elements[id] || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

function createLocalStorage(savedState) {
  const values = new Map();
  if (savedState) {
    values.set('cafeClickSave', JSON.stringify(savedState));
  }
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump(key) {
      return values.has(key) ? JSON.parse(values.get(key)) : null;
    }
  };
}

function createTestHooks() {
  return `
globalThis.__testHooks = {
  getSnapshot() {
    return exportSnapshotForTest();
  },
  setSnapshot(next) {
    importSnapshotForTest(next);
  },
  performPrestige() {
    return performPrestige();
  },
  getCostById(id) {
    return getWholeCost(id).toString();
  },
  getPrestigePreview() {
    return getPrestigePreview().toString();
  },
  getDiagnostics() {
    return {
      drawCount,
      frameCount
    };
  }
};
`;
}

function loadGame(options = {}) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const script = extractScript(html) + createTestHooks();
  const document = new FakeDocument();
  const frameQueue = [];
  const storage = createLocalStorage(options.savedState);
  let now = options.now || 0;
  const context = vm.createContext({
    document,
    window: {},
    console,
    localStorage: options.disableStorage ? undefined : storage,
    Date: {
      now() {
        return now;
      }
    },
    performance: {
      now() {
        return now;
      }
    },
    requestAnimationFrame(fn) {
      frameQueue.push(fn);
      return frameQueue.length - 1;
    },
    cancelAnimationFrame() {},
    setTimeout(fn) {
      frameQueue.push(() => fn());
      return frameQueue.length - 1;
    },
    clearTimeout() {}
  });

  vm.runInContext(script, context);

  const api = {
    runFrames(count = 1, deltaMs = 16) {
      for (let index = 0; index < count; index += 1) {
        now += deltaMs;
        const callbacks = frameQueue.splice(0, frameQueue.length);
        callbacks.forEach((callback) => callback(now));
      }
    },
    flush() {
      this.runFrames(6, 16);
    },
    clickBrew(times = 1) {
      const button = document.getElementById('brew-btn');
      for (let index = 0; index < times; index += 1) {
        button.click({ clientX: 80, clientY: 80 });
        this.flush();
      }
    },
    buyUpgrade(id) {
      const button = this.getUpgradeButton(id);
      assert(button, `Missing upgrade button: ${id}`);
      button.click();
      this.flush();
    },
    prestige() {
      const button = document.getElementById('prestige-btn');
      if (button && !button.disabled) {
        button.click();
      } else {
        context.__testHooks.performPrestige();
      }
      this.flush();
    },
    getUpgradeButton(id) {
      return document.getElementById('shop').querySelectorAll('.upg-btn').find((button) => button.dataset.id === id) || null;
    },
    setState(next) {
      context.__testHooks.setSnapshot(next);
      this.flush();
    },
    getState() {
      return context.__testHooks.getSnapshot();
    },
    getText(id) {
      const element = document.getElementById(id);
      return element ? element.textContent : null;
    },
    getMarkup(id) {
      const element = document.getElementById(id);
      return element ? element.innerHTML : null;
    },
    getElement(id) {
      return document.getElementById(id);
    },
    getStatsMarkup() {
      return document.getElementById('stats').innerHTML;
    },
    getCost(id) {
      return context.__testHooks.getCostById(id);
    },
    getPrestigePreview() {
      return context.__testHooks.getPrestigePreview();
    },
    getSavedState() {
      return storage.dump('cafeClickSave');
    },
    getDiagnostics() {
      return context.__testHooks.getDiagnostics();
    },
    getWholeCoins() {
      return this.getState().run.coins;
    }
  };

  api.flush();
  return api;
}

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack);
    process.exitCode = 1;
  }
}

runTest('initial render shows prestige panel and no ending overlay', () => {
  const game = loadGame();
  assert.equal(game.getElement('ending-overlay'), null);
  assert.equal(game.getText('prestige-title'), '환생');
  assert.equal(game.getText('prestige-bonus'), '영구 수익 +0%');
  assert.equal(game.getText('prestige-preview'), '지금 환생하면 황금 원두 +0');
});

runTest('prestige bonus applies to passive income and large values format with Korean units', () => {
  const game = loadGame();
  game.setState({
    run: {
      coins: '123456789',
      total: '123456789',
      cups: '12',
      owned: { machine: '1' }
    },
    prestige: {
      goldenBeans: '10'
    }
  });
  assert.match(game.getStatsMarkup(), /1.2억/);
  game.runFrames(10, 100);
  assert.equal(game.getWholeCoins(), '123456792');
});

runTest('saved data restores run and prestige state', () => {
  const game = loadGame({
    savedState: {
      version: 2,
      run: {
        coins: '321',
        total: '1500',
        cups: '44',
        owned: { machine: '1', deco: '1' }
      },
      prestige: {
        goldenBeans: '7',
        prestigeCount: '2',
        bestRun: '9000000'
      }
    }
  });
  assert.equal(game.getState().run.coins, '321');
  assert.equal(game.getState().prestige.goldenBeans, '7');
  assert.equal(game.getText('prestige-bonus'), '영구 수익 +35%');
});

runTest('prestige resets run state but keeps permanent beans', () => {
  const game = loadGame();
  game.setState({
    run: {
      coins: '4000000',
      total: '4000000',
      cups: '30',
      owned: { machine: '2', branch: '1' }
    }
  });
  assert.equal(game.getPrestigePreview(), '2');
  game.prestige();
  assert.equal(game.getState().run.coins, '0');
  assert.equal(game.getState().run.total, '0');
  assert.equal(game.getState().run.owned.machine, '0');
  assert.equal(game.getState().prestige.goldenBeans, '2');
  assert.equal(game.getSavedState().prestige.goldenBeans, '2');
});

runTest('geometric costs grow after purchases and draw count stays throttled', () => {
  const game = loadGame();
  game.setState({
    run: {
      coins: '1000000',
      total: '1000000'
    }
  });
  assert.equal(game.getCost('machine'), '50');
  game.buyUpgrade('machine');
  assert.equal(game.getCost('machine'), '80');
  const before = game.getDiagnostics().drawCount;
  game.runFrames(20, 16);
  const after = game.getDiagnostics().drawCount;
  assert(after - before < 20);
});
