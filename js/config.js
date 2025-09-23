const MINUTE = 60 * 1000;

const TIME_DEFAULTS = {
  // 1 реальный день внутри игры
  realDayMinutes: 20,
  // раз в сколько минут требуется полив
  wateringIntervalMinutes: 6,
  // раз в сколько минут созревает урожай
  harvestIntervalMinutes: 9,
};

const PRODUCE_CATALOG = {
  orange: {
    name: 'Апельсины',
    icon: '🍊',
    shelfLife: 45 * MINUTE,
    sellPrice: 18,
    weight: 1,
    process: {
      product: 'orangeJuice',
      ratio: 3,
      result: 1,
    },
  },
  orangeJuice: {
    name: 'Апельсиновый сок',
    icon: '🥤',
    shelfLife: 90 * MINUTE,
    sellPrice: 54,
    weight: 1,
  },
  apple: {
    name: 'Яблоки',
    icon: '🍎',
    shelfLife: 40 * MINUTE,
    sellPrice: 16,
    weight: 1,
    process: {
      product: 'appleCider',
      ratio: 4,
      result: 1,
    },
  },
  appleCider: {
    name: 'Яблочный сидр',
    icon: '🍶',
    shelfLife: 85 * MINUTE,
    sellPrice: 58,
    weight: 1,
  },
  cherry: {
    name: 'Вишня',
    icon: '🍒',
    shelfLife: 36 * MINUTE,
    sellPrice: 20,
    weight: 1,
    process: {
      product: 'cherryJam',
      ratio: 5,
      result: 2,
    },
  },
  cherryJam: {
    name: 'Вишнёвое варенье',
    icon: '🥫',
    shelfLife: 92 * MINUTE,
    sellPrice: 68,
    weight: 1,
  },
  lemon: {
    name: 'Лимоны',
    icon: '🍋',
    shelfLife: 38 * MINUTE,
    sellPrice: 17,
    weight: 1,
    process: {
      product: 'lemonade',
      ratio: 4,
      result: 1,
    },
  },
  lemonade: {
    name: 'Лимонад',
    icon: '🧃',
    shelfLife: 78 * MINUTE,
    sellPrice: 60,
    weight: 1,
  },
};

const CROP_CATALOG = {
  orange: {
    title: 'Апельсиновое дерево',
    produce: 'orange',
    icon: '🍊',
    seedCost: 850,
    baseYield: 14,
    yieldPerLevel: 9,
    growthModifier: 1,
  },
  apple: {
    title: 'Яблоня',
    produce: 'apple',
    icon: '🍎',
    seedCost: 780,
    baseYield: 12,
    yieldPerLevel: 7,
    growthModifier: 0.95,
  },
  cherry: {
    title: 'Вишнёвое дерево',
    produce: 'cherry',
    icon: '🍒',
    seedCost: 720,
    baseYield: 10,
    yieldPerLevel: 6,
    growthModifier: 0.85,
  },
  lemon: {
    title: 'Лимонное дерево',
    produce: 'lemon',
    icon: '🍋',
    seedCost: 760,
    baseYield: 11,
    yieldPerLevel: 7,
    growthModifier: 1.05,
  },
};

export const CONFIG = {
  version: 3,
  storageKey: 'orange-paradise-state',
  tickInterval: 1000,
  time: TIME_DEFAULTS,
  durations: {},
  plot: {
    baseCapacity: 2,
    capacityPerLevel: 1,
    purchaseBaseCost: 2500,
    purchaseFactor: 1.8,
    upgradeBaseCost: 1500,
    upgradeFactor: 1.6,
  },
  tree: {
    upgradeBaseCost: 950,
    upgradeFactor: 1.55,
    growthLevelFactor: 0.85,
  },
  warehouse: {
    baseCapacity: 120,
    perLevel: 80,
    upgradeBaseCost: 1800,
    upgradeFactor: 1.7,
  },
  automationCosts: {
    treeWater: 140,
    treeHarvest: 180,
    plotWater: 320,
    plotHarvest: 360,
  },
  crops: CROP_CATALOG,
  produce: PRODUCE_CATALOG,
};

CONFIG.durations = {
  minute: MINUTE,
  day: TIME_DEFAULTS.realDayMinutes * MINUTE,
  hydration: TIME_DEFAULTS.wateringIntervalMinutes * MINUTE,
  growthBase: TIME_DEFAULTS.harvestIntervalMinutes * MINUTE,
  expirationCheck: MINUTE,
};

export function computeGrowthDuration(level, type) {
  const base = CONFIG.durations.growthBase;
  const factor = CONFIG.tree.growthLevelFactor;
  const modifier = CONFIG.crops[type]?.growthModifier ?? 1;
  const duration = base * modifier;
  if (level <= 0) {
    return duration * 1.1;
  }
  return duration * Math.pow(factor, Math.max(0, level - 1));
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Math.floor(amount));
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds} с`;
  }
  return `${minutes} мин ${seconds.toString().padStart(2, '0')} с`;
}
