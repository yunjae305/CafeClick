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
      const pattern = /<button class="upg-btn"([^>]*)data-id="([^"]+)"[^>]*>[\s\S]*?<\/button>/g;
      let match;
      while ((match = pattern.exec(this._innerHTML)) !== null) {
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
      ['div', 'ending-overlay'],
      ['div', 'ending-title'],
      ['div', 'ending-route'],
      ['div', 'ending-stats'],
      ['button', 'close-ending'],
      ['button', 'close-ending-2'],
      ['button', 'restart-btn']
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
  getState() {
    return {
      coins,
      total,
      cups,
      owned: { ...owned },
      clickCount,
      highestCPS,
      endingShown
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
    if (Object.prototype.hasOwnProperty.call(next, 'clickCount')) {
      clickCount = next.clickCount;
    }
    if (Object.prototype.hasOwnProperty.call(next, 'highestCPS')) {
      highestCPS = next.highestCPS;
    }
    if (Object.prototype.hasOwnProperty.call(next, 'endingShown')) {
      endingShown = next.endingShown;
    }
  },
  refreshAll,
  getCostById(id) {
    return getCost(UPGRADES.find((upgrade) => upgrade.id === id));
  }
};
`;
}

function loadGame(options = {}) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const script = extractScript(html) + createTestHooks();
  const document = new FakeDocument();
  const intervals = [];
  const timeouts = [];
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
    clickElement(id, event = {}) {
      const element = document.getElementById(id);
      assert(element, `Missing element: ${id}`);
      element.click(event);
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
        intervals.forEach((fn) => fn());
      }
    },
    advanceTime(ms) {
      now += ms;
    },
    getText(id) {
      return document.getElementById(id).textContent;
    },
    getMarkup(id) {
      return document.getElementById(id).innerHTML;
    },
    getClassName(id) {
      return document.getElementById(id).className;
    },
    getStatsMarkup() {
      return document.getElementById('stats').innerHTML;
    },
    getCost(id) {
      return context.__testHooks.getCostById(id);
    },
    getSavedState() {
      return storage.dump('cafeClickSave');
    },
    getParticles() {
      return document.getElementById('btn-wrap').children.map((child) => ({
        text: child.textContent,
        fontSize: child.style.fontSize || '',
        className: child.className
      }));
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

runTest('initial render shows coffee card cafe story and all upgrades', () => {
  const game = loadGame();
  assert.equal(game.getText('coffee-name'), '맥심 모카골드');
  assert.match(game.getText('coffee-desc'), /종이컵/);
  assert.equal(game.getText('milestone'), '작은 카페');
  assert.match(game.getText('cafe-story'), /낡은 플라스틱 의자 2개/);
  assert.equal(game.getText('brew-btn'), '☕');
  assert.equal(game.getUpgradeButton('beans').disabled, true);
  assert.equal(documentedUpgradeCount(game), 8);
  assert.match(game.getStatsMarkup(), /보유/);
  assert.equal(game.getClassName('ending-overlay'), 'ending-overlay');
});

runTest('coffee unlock updates button toast animation and cafe milestone text', () => {
  const game = loadGame();
  game.setState({ coins: 49, total: 49, cups: 10, owned: {} });
  game.refreshAll();
  game.clickBrew(1);
  assert.equal(game.getText('coffee-name'), '캔커피 (레쓰비)');
  assert.match(game.getText('coffee-desc'), /자판기/);
  assert.match(game.getMarkup('toast-area'), /새로운 커피 해금/);
  assert.match(game.getClassName('brew-btn'), /scale-up/);

  game.setState({ coins: 1000, total: 1000, cups: 10, owned: {} });
  game.refreshAll();
  assert.equal(game.getText('milestone'), '지역 명소');
  assert.match(game.getText('cafe-story'), /줄이 생겼다/);
});

runTest('first purchase toast uses flavor text and game auto-saves', () => {
  const game = loadGame();
  game.setState({ coins: 200, total: 200, cups: 5, owned: {} });
  game.refreshAll();
  game.buyUpgrade('barista');
  assert.match(game.getMarkup('toast-area'), /지수다/);
  assert.equal(game.getState().owned.barista, 1);
  assert.equal(game.getSavedState().owned.barista, 1);
});

runTest('saved data loads back into the game and passive income pulses the brew button', () => {
  const game = loadGame({
    savedState: {
      coins: 321,
      total: 1500,
      cups: 44,
      owned: { machine: 1, deco: 1 }
    }
  });
  assert.equal(game.getState().coins, 321);
  assert.equal(game.getText('coffee-name'), '카페라떼');
  assert.equal(game.getText('cpc-label'), '클릭당 6원');
  game.runIntervals(1);
  assert.match(game.getClassName('brew-btn'), /pulse/);
  assert.equal(game.getUpgradeButton('machine').disabled, false);
});

runTest('ending overlay shows summary stats and restart clears progress', () => {
  const game = loadGame({
    savedState: {
      coins: 999999,
      total: 999999,
      cups: 245,
      owned: { machine: 2, branch: 3, franchise: 1 }
    }
  });
  game.advanceTime(65000);
  game.runIntervals(1);
  assert.match(game.getClassName('ending-overlay'), /open/);
  assert.equal(game.getText('ending-title'), '🌍 글로벌 브랜드 달성!');
  assert.match(game.getMarkup('ending-route'), /블랙 아이보리/);
  assert.match(game.getMarkup('ending-stats'), /1분 5초/);
  assert.match(game.getMarkup('ending-stats'), /245잔/);
  assert.match(game.getMarkup('ending-stats'), /2호점 오픈/);
  assert.match(game.getMarkup('ending-stats'), /804원\/초/);
  game.clickElement('restart-btn');
  assert.equal(game.getState().coins, 0);
  assert.equal(game.getState().total, 0);
  assert.deepEqual(game.getState().owned, {});
  assert.equal(game.getSavedState(), null);
  assert.equal(game.getClassName('ending-overlay'), 'ending-overlay');
});

runTest('particles scale with click income and 100th click creates a coffee burst', () => {
  const strongClickGame = loadGame();
  strongClickGame.setState({ coins: 0, total: 0, cups: 0, owned: { app: 1 } });
  strongClickGame.refreshAll();
  strongClickGame.clickBrew(1);
  assert.equal(strongClickGame.getParticles()[0].fontSize, '24px');

  const burstGame = loadGame();
  burstGame.clickBrew(100);
  const particles = burstGame.getParticles();
  assert(particles.length >= 103 && particles.length <= 105);
  const emojiParticles = particles.filter((particle) => particle.text === '🥤');
  assert(emojiParticles.length >= 3 && emojiParticles.length <= 5);
});

function documentedUpgradeCount(game) {
  const ids = ['beans', 'machine', 'barista', 'deco', 'delivery', 'branch', 'franchise', 'app'];
  return ids.filter((id) => game.getUpgradeButton(id)).length;
}
