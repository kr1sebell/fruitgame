import { INITIAL_PLAYER_STATE, SAVE_KEY } from '../gameConfig.js';

export class SaveManager {
  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        return JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE));
      }
      const data = JSON.parse(raw);
      return SaveManager.mergeWithDefaults(data);
    } catch (err) {
      console.warn('Failed to load save, using defaults', err);
      return JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE));
    }
  }

  static mergeWithDefaults(data) {
    const defaults = JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE));
    return {
      ...defaults,
      ...data,
      plots: (data.plots || defaults.plots).map((plot, index) => {
        const basePlot = defaults.plots[index] || defaults.plots[0];
        return {
          ...basePlot,
          ...plot,
          trees: (plot.trees || []).map((tree) => ({
            ...tree
          }))
        };
      }),
      storage: {
        ...defaults.storage,
        ...data.storage,
        crops: data.storage?.crops || [],
        products: data.storage?.products || []
      },
      factory: {
        ...defaults.factory,
        ...data.factory,
        queue: data.factory?.queue || []
      },
      settings: {
        ...defaults.settings,
        ...data.settings
      }
    };
  }

  static save(playerState) {
    try {
      const payload = {
        ...playerState,
        settings: {
          ...playerState.settings,
          lastSave: Date.now()
        }
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to save game state', err);
    }
  }
}
