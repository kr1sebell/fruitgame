export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
export const WORLD_ROWS = 6;
export const WORLD_COLS = 6;

export const INITIAL_PLAYER_STATE = {
  currency: 200,
  plots: [
    {
      id: 'plot-1',
      level: 1,
      position: { x: 2, y: 2 },
      trees: [
        {
          id: 'tree-1',
          level: 0,
          growthProgress: 0,
          plantedAt: Date.now(),
          autoWater: false,
          autoHarvest: false,
          lastAutoCharge: Date.now()
        }
      ],
      autoWater: false,
      autoHarvest: false,
      lastAutoCharge: Date.now()
    }
  ],
  storage: {
    level: 1,
    crops: [],
    products: []
  },
  factory: {
    level: 1,
    queue: []
  },
  settings: {
    debug: false,
    lastSave: Date.now()
  }
};

export const TREE_DATA = {
  baseGrowthSeconds: 45,
  levels: [
    { yield: 0 },
    { yield: 2, value: 6 },
    { yield: 3, value: 10 },
    { yield: 4, value: 15 },
    { yield: 6, value: 24 }
  ],
  maxLevel: 4
};

export const STORAGE_CAPACITY = [0, 20, 40, 80, 120];
export const PLOT_CAPACITY = [0, 1, 2, 4, 6];
export const FACTORY_PROCESS_TIME = 30; // seconds
export const FACTORY_RECIPES = {
  apple: {
    input: 3,
    output: { type: 'juice', amount: 1, value: 45 }
  }
};

export const AUTO_COSTS = {
  water: 25,
  harvest: 40
};

export const SPOIL_SECONDS = 120;
export const SAVE_KEY = 'fruit-dominion-save-v1';
