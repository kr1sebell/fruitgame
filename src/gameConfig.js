export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
export const WORLD_ROWS = 6;
export const WORLD_COLS = 6;

export const INITIAL_PLAYER_STATE = {
  currency: 250,
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
          isMature: false,
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
  levels: [
    { growthSeconds: 42, yield: 0, value: 0 },
    { growthSeconds: 64, yield: 2, value: 7 },
    { growthSeconds: 56, yield: 3, value: 11 },
    { growthSeconds: 48, yield: 5, value: 17 },
    { growthSeconds: 40, yield: 7, value: 25 }
  ],
  autoWaterBoost: 0.35,
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

export const TREE_UPGRADE_COSTS = [0, 0, 160, 340, 620];
export const TREE_PLANT_COST = 90;
export const TREE_PLANT_COST_STEP = 25;
export const PLOT_PURCHASE_COSTS = [0, 0, 260, 360, 520, 760];
export const PLOT_UPGRADE_COSTS = [0, 180, 360, 640, 980];
export const STORAGE_UPGRADE_COSTS = [0, 160, 340, 720, 1200];
