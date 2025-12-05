// Life Gacha Level-Up popup logic
// Everything is plain JS; data persists in chrome.storage.local.

const STORAGE_KEY = 'lifeGachaData';
const PULL_COST = 100;
const DUPLICATE_BONUS = 20;

const REWARD_PRESETS = {
  small: { xp: 20, currency: 10 },
  medium: { xp: 40, currency: 20 },
  big: { xp: 80, currency: 40 }
};

// Character pool for the gacha system.
const CHARACTER_POOL = [
  { id: 'c1', name: 'Aurora', rarity: 'Common', element: 'Light', description: 'A bright spirit who cheers you on.' },
  { id: 'c2', name: 'Zeph', rarity: 'Common', element: 'Wind', description: 'Swift breezes, swift progress.' },
  { id: 'c3', name: 'Marin', rarity: 'Common', element: 'Water', description: 'Calm focus and steady tides.' },
  { id: 'c4', name: 'Bruno', rarity: 'Rare', element: 'Earth', description: 'Grounded guardian of habits.' },
  { id: 'c5', name: 'Ignis', rarity: 'Rare', element: 'Fire', description: 'Hot-headed ally that ignites action.' },
  { id: 'c6', name: 'Nyx', rarity: 'Epic', element: 'Shadow', description: 'Strategist of late-night grinds.' },
  { id: 'c7', name: 'Lumen', rarity: 'Epic', element: 'Light', description: 'Beacon who glows brighter with effort.' },
  { id: 'c8', name: 'Vera', rarity: 'Legendary', element: 'Void', description: 'Mythic wanderer bending time for you.' }
];

// Rarity rates sum to 100.
const RARITY_RATES = [
  { rarity: 'Legendary', rate: 5 },
  { rarity: 'Epic', rate: 10 },
  { rarity: 'Rare', rate: 25 },
  { rarity: 'Common', rate: 60 }
];

const elements = {
  level: document.getElementById('player-level'),
  xpText: document.getElementById('xp-text'),
  xpProgress: document.getElementById('xp-progress'),
  currency: document.getElementById('player-currency'),
  taskForm: document.getElementById('task-form'),
  taskTitle: document.getElementById('task-title'),
  taskDesc: document.getElementById('task-desc'),
  taskReward: document.getElementById('task-reward'),
  taskList: document.getElementById('task-list'),
  pullBtn: document.getElementById('pull-btn'),
  gachaResult: document.getElementById('gacha-result'),
  collection: document.getElementById('collection'),
  mainCharacter: document.getElementById('main-character'),
  toast: document.getElementById('toast')
};

const DEFAULT_DATA = {
  player: {
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    currency: 0
  },
  tasks: [],
  ownedCharacters: [],
  mainCharacterId: null
};

// --- Storage helpers ---
function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || { ...DEFAULT_DATA };
      // Guard against missing fields if older saves exist.
      const merged = {
        ...DEFAULT_DATA,
        ...data,
        player: { ...DEFAULT_DATA.player, ...data.player },
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        ownedCharacters: Array.isArray(data.ownedCharacters) ? data.ownedCharacters : [],
        mainCharacterId: data.mainCharacterId ?? null
      };
      resolve(merged);
    });
  });
}

function saveData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

// --- UI helpers ---
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  setTimeout(() => elements.toast.classList.remove('visible'), 1800);
}

function rarityClass(rarity) {
  return `rarity-${rarity}`;
}

function rarityColor(rarity) {
  const map = {
    Common: 'var(--common)',
    Rare: 'var(--rare)',
    Epic: 'var(--epic)',
    Legendary: 'var(--legendary)'
  };
  return map[rarity] || 'var(--text)';
}

// --- Task logic ---
async function handleAddTask(event) {
  event.preventDefault();
  const title = elements.taskTitle.value.trim();
  const description = elements.taskDesc.value.trim();
  const rewardKey = elements.taskReward.value;
  const reward = REWARD_PRESETS[rewardKey] || REWARD_PRESETS.small;

  if (!title) {
    showToast('Please enter a task title.');
    return;
  }

  const data = await loadData();
  const task = {
    id: `task-${Date.now()}`,
    title,
    description,
    createdAt: Date.now(),
    completed: false,
    rewardXP: reward.xp,
    rewardCurrency: reward.currency
  };

  data.tasks.unshift(task);
  await saveData(data);
  elements.taskForm.reset();
  renderTasks(data);
  showToast('Task added!');
}

async function toggleCompleteTask(taskId) {
  const data = await loadData();
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || task.completed) return;

  task.completed = true;
  data.player.currentXP += task.rewardXP;
  data.player.currency += task.rewardCurrency;

  showToast(`+${task.rewardXP} XP, +${task.rewardCurrency} Gems!`);

  // Handle leveling up; loop allows multiple levels from one large reward.
  while (data.player.currentXP >= data.player.xpToNextLevel) {
    data.player.currentXP -= data.player.xpToNextLevel;
    data.player.level += 1;
    data.player.xpToNextLevel = 100 * data.player.level;
    showToast(`Level Up! Now level ${data.player.level}`);
  }

  await saveData(data);
  renderPlayer(data.player);
  renderTasks(data);
}

async function deleteTask(taskId) {
  const data = await loadData();
  data.tasks = data.tasks.filter((t) => t.id !== taskId);
  await saveData(data);
  renderTasks(data);
}

async function editTask(taskId) {
  const data = await loadData();
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return;

  const newTitle = prompt('Edit task title', task.title);
  if (newTitle === null) return; // Cancelled
  const newDesc = prompt('Edit description (optional)', task.description || '');

  task.title = newTitle.trim() || task.title;
  task.description = (newDesc || '').trim();

  await saveData(data);
  renderTasks(data);
}

function renderTasks(data) {
  elements.taskList.innerHTML = '';

  if (!data.tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No tasks yet. Add one to start earning!';
    elements.taskList.appendChild(empty);
    return;
  }

  data.tasks.forEach((task) => {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'completed' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.disabled = task.completed;
    checkbox.addEventListener('change', () => toggleCompleteTask(task.id));

    const info = document.createElement('div');
    info.className = 'task-info';

    const title = document.createElement('h3');
    title.textContent = task.title;

    const desc = document.createElement('p');
    desc.textContent = task.description || 'No description';

    const reward = document.createElement('p');
    reward.className = 'element';
    reward.textContent = `Reward: +${task.rewardXP} XP / +${task.rewardCurrency} Gems`;

    info.appendChild(title);
    info.appendChild(desc);
    info.appendChild(reward);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editTask(task.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.classList.add('delete');
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(checkbox);
    card.appendChild(info);
    card.appendChild(actions);

    elements.taskList.appendChild(card);
  });
}

// --- Player rendering ---
function renderPlayer(player) {
  elements.level.textContent = player.level;
  elements.currency.textContent = player.currency;
  elements.xpText.textContent = `${player.currentXP} / ${player.xpToNextLevel}`;
  const pct = Math.min(100, Math.floor((player.currentXP / player.xpToNextLevel) * 100));
  elements.xpProgress.style.width = `${pct}%`;
}

// --- Gacha ---
function rollRarity() {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const entry of RARITY_RATES) {
    cumulative += entry.rate;
    if (roll <= cumulative) return entry.rarity;
  }
  return 'Common';
}

function pickCharacterByRarity(rarity) {
  const candidates = CHARACTER_POOL.filter((c) => c.rarity === rarity);
  if (!candidates.length) return null;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

async function handlePull() {
  const data = await loadData();
  if (data.player.currency < PULL_COST) {
    showToast('Not enough Gems. Complete more tasks!');
    return;
  }

  data.player.currency -= PULL_COST;
  const rarity = rollRarity();
  const character = pickCharacterByRarity(rarity);
  if (!character) {
    showToast('No characters found for that rarity.');
    return;
  }

  let message = '';
  const alreadyOwned = data.ownedCharacters.includes(character.id);
  if (alreadyOwned) {
    data.player.currency += DUPLICATE_BONUS;
    message = `Duplicate! You received ${DUPLICATE_BONUS} bonus Gems.`;
  } else {
    data.ownedCharacters.push(character.id);
    message = `New character: ${character.name}!`;
    if (!data.mainCharacterId) {
      data.mainCharacterId = character.id;
    }
  }

  await saveData(data);
  renderPlayer(data.player);
  renderCollection(data);
  renderGachaResult(character, message, alreadyOwned);
  showToast(message);
}

function renderGachaResult(character, extraMessage, isOwned) {
  if (!character) {
    elements.gachaResult.textContent = 'Pull to see what you get!';
    return;
  }
  const card = document.createElement('div');
  card.className = 'character-card';
  card.innerHTML = `
    <div class="rarity-tag ${rarityClass(character.rarity)}">${character.rarity}</div>
    <h3>${character.name}</h3>
    <p class="element">Element: ${character.element}</p>
    <p class="element">${character.description}</p>
    <p class="element">${isOwned ? 'Already owned' : 'Added to collection!'}</p>
    <strong style="color:${rarityColor(character.rarity)}">${extraMessage}</strong>
  `;
  elements.gachaResult.innerHTML = '';
  elements.gachaResult.appendChild(card);
}

// --- Collection ---
function getCharacterById(id) {
  return CHARACTER_POOL.find((c) => c.id === id);
}

async function setMainCharacter(id) {
  const data = await loadData();
  if (!data.ownedCharacters.includes(id)) return;
  data.mainCharacterId = id;
  await saveData(data);
  renderCollection(data);
}

function renderCollection(data) {
  elements.collection.innerHTML = '';

  if (!data.ownedCharacters.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Pull characters to fill your collection!';
    elements.collection.appendChild(empty);
  }

  data.ownedCharacters.forEach((id) => {
    const character = getCharacterById(id);
    if (!character) return;
    const card = document.createElement('div');
    card.className = 'character-card';
    card.innerHTML = `
      <div class="rarity-tag ${rarityClass(character.rarity)}">${character.rarity}</div>
      <h3>${character.name}</h3>
      <p class="element">Element: ${character.element}</p>
    `;
    card.addEventListener('click', () => setMainCharacter(id));
    elements.collection.appendChild(card);
  });

  renderMainCharacter(data);
}

function renderMainCharacter(data) {
  elements.mainCharacter.innerHTML = '';
  const character = data.mainCharacterId ? getCharacterById(data.mainCharacterId) : null;
  if (!character) {
    const placeholder = document.createElement('span');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'No main character yet';
    elements.mainCharacter.appendChild(placeholder);
    return;
  }

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = character.name;

  const rarity = document.createElement('span');
  rarity.className = `rarity ${rarityClass(character.rarity)}`;
  rarity.textContent = character.rarity;

  const element = document.createElement('div');
  element.className = 'element';
  element.textContent = `Element: ${character.element}`;

  elements.mainCharacter.appendChild(name);
  elements.mainCharacter.appendChild(rarity);
  elements.mainCharacter.appendChild(element);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  const data = await loadData();
  renderPlayer(data.player);
  renderTasks(data);
  renderCollection(data);

  elements.taskForm.addEventListener('submit', handleAddTask);
  elements.pullBtn.addEventListener('click', handlePull);
});
