// Service worker for Life Gacha Level-Up (Manifest V3)
// Initializes default save data on install so popup can rely on storage existing.

const STORAGE_KEY = 'lifeGachaData';

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    if (!result || !result[STORAGE_KEY]) {
      chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_DATA });
    }
  });
});
