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

class FakeElement {
  constructor(tagName, ownerDocument, id = '') {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.className = '';
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.disabled = false;
    this.style = {};
    this.listeners = {};
    this._textContent = '';
    this._innerHTML = '';
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
      const buttonPattern = /<button class="upg-btn"([^>]*)data-id="([^"]+)"[^>]*>[\s\S]*?<\/button>/g;
      let match;
      while ((match = buttonPattern.exec(this._innerHTML)) !== null) {
        const button = new FakeElement('button', this.ownerDocument);
        button.className = 'upg-btn';
        button.dataset = { id: match[2] };
        button.disabled = /\bdisabled\b/.test(match[1]);
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
    for (const handler of handlers) {
      handler({ currentTarget: this, target: this, ...event });
    }
  }

  click(event = {}) {
    this.dispatchEvent('click', event);
  }

  querySelectorAll(selector) {
    if (selector === '.upg-btn') {
      return this.children.filter((child) => child.className === 'upg-btn');
    }
    return [];
  }

  getBoundingClientRect() {
    return { left: 0, top: 0 };
  }
}

class FakeDocument {
  constructor() {
    this.elements = {};
    this.body = new FakeElement('body', this);
    this.register(new FakeElement('div', this, 'stats'));
    this.register(new FakeElement('div', this, 'milestone')).textContent = '☕ 작은 카페';
    this.register(new FakeElement('div', this, 'btn-wrap'));
    this.register(new FakeElement('button', this, 'brew-btn'));
    this.register(new FakeElement('div', this, 'cpc-label')).textContent = '클릭당 1원';
    this.register(new FakeElement('div', this, 'toast-area'));
    this.register(new FakeElement('div', this, 'shop'));
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

function createTestHooks() {
  return `
globalThis.__testHooks = {
  getState() {
    return {
      coins,
      total,
      cups,
      owned: { ...owned }
    };
  },
  setState(next) {
    if (Object.prototype.hasOwnProperty.call(next, 'coins')) {
      coins = next.coins;
    }
    if (Object.prototype.hasOwnProperty.call(next, 'total')) {
      total = next.total;
    }
    if (Object.prototype.hasOwnProperty.call(next, 'cups')) {
      cups = next.cups;
    }
    if (Object.prototype.hasOwnProperty.call(next, 'owned')) {
      owned = { ...next.owned };
    }
  },
  refreshAll,
  getCostById(id) {
    return getCost(UPGRADES.find((upgrade) => upgrade.id === id));
  }
};
`;
}

function loadGame() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const script = extractScript(html) + createTestHooks();
  const document = new FakeDocument();
  const intervals = [];
  const timeouts = [];
  const context = vm.createContext({
    document,
    window: {},
    console,
    setTimeout(fn) {
      timeouts.push(fn);
      return timeouts.length - 1;
    },
    clearTimeout() {},
    setInterval(fn) {
      intervals.push(fn);
      return intervals.length - 1;
    },
    clearInterval() {}
  });

  vm.runInContext(script, context);

  return {
    clickBrew(times = 1) {
      const button = document.getElementById('brew-btn');
      for (let index = 0; index < times; index += 1) {
        button.click({ clientX: 80, clientY: 80 });
      }
    },
    buyUpgrade(id) {
      const button = this.getUpgradeButton(id);
      assert(button, `Missing upgrade button: ${id}`);
      button.click();
    },
    getUpgradeButton(id) {
      return document.getElementById('shop').querySelectorAll('.upg-btn').find((button) => button.dataset.id === id) || null;
    },
    getState() {
      return context.__testHooks.getState();
    },
    setState(next) {
      context.__testHooks.setState(next);
    },
    refreshAll() {
      context.__testHooks.refreshAll();
    },
    runIntervals(steps = 1) {
      for (let step = 0; step < steps; step += 1) {
        for (const fn of intervals) {
          fn();
        }
      }
    },
    getText(id) {
      return document.getElementById(id).textContent;
    },
    getStatsMarkup() {
      return document.getElementById('stats').innerHTML;
    },
    getCost(id) {
      return context.__testHooks.getCostById(id);
    }
  };
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

runTest('initial render shows default labels and all upgrades', () => {
  const game = loadGame();
  assert.equal(game.getText('milestone'), '☕ 작은 카페');
  assert.equal(game.getText('cpc-label'), '클릭당 1원');
  assert.equal(game.getUpgradeButton('beans').disabled, true);
  assert.equal(documentedUpgradeCount(game), 8);
  assert.match(game.getStatsMarkup(), /보유/);
});

runTest('brew click updates coins total and cups', () => {
  const game = loadGame();
  game.clickBrew(3);
  const state = game.getState();
  assert.equal(state.coins, 3);
  assert.equal(state.total, 3);
  assert.equal(state.cups, 3);
});

runTest('buying good beans raises click income and next cost', () => {
  const game = loadGame();
  game.setState({ coins: 15, total: 15, cups: 15, owned: {} });
  game.refreshAll();
  assert.equal(game.getUpgradeButton('beans').disabled, false);
  game.buyUpgrade('beans');
  const state = game.getState();
  assert.equal(state.coins, 0);
  assert.equal(state.owned.beans, 1);
  assert.equal(game.getText('cpc-label'), '클릭당 2원');
  assert.equal(game.getCost('beans'), 24);
});

runTest('passive income unlocks upgrades without an extra click', () => {
  const game = loadGame();
  game.setState({ coins: 14.9, total: 14.9, cups: 0, owned: { machine: 1 } });
  game.refreshAll();
  assert.equal(game.getUpgradeButton('beans').disabled, true);
  game.runIntervals(1);
  assert.equal(game.getUpgradeButton('beans').disabled, false);
});

runTest('passive income updates milestone text after crossing 100 total', () => {
  const game = loadGame();
  game.setState({ coins: 0, total: 99, cups: 0, owned: { barista: 1 } });
  game.refreshAll();
  assert.equal(game.getText('milestone'), '☕ 작은 카페');
  game.runIntervals(1);
  assert.equal(game.getText('milestone'), '🫘 단골이 생겼어');
});

function documentedUpgradeCount(game) {
  const ids = ['beans', 'machine', 'barista', 'deco', 'delivery', 'branch', 'franchise', 'app'];
  return ids.filter((id) => game.getUpgradeButton(id)).length;
}
