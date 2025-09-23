import { CONFIG } from './config.js';

export class StorageService {
  constructor(key = CONFIG.storageKey) {
    this.key = key;
  }

  load() {
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Не удалось загрузить сохранение', error);
      return null;
    }
  }

  save(state) {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state));
    } catch (error) {
      console.warn('Не удалось сохранить игру', error);
    }
  }

  clear() {
    window.localStorage.removeItem(this.key);
  }
}
