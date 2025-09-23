export const CONFIG = {
  version: 2,
  storageKey: 'orange-paradise-state',
  tickInterval: 1000,
  durations: {
    day: 10 * 60 * 1000, // 10 минут = 1 игровой день
    hydration: 6 * 60 * 1000, // дерево требует полив раз в 6 минут
    growthBase: 8 * 60 * 1000,
    expirationCheck: 60 * 1000,
  },
  plot: {
    baseCapacity: 2,
    capacityPerLevel: 1,
    purchaseBaseCost: 2500,
    purchaseFactor: 1.8,
    upgradeBaseCost: 1500,
    upgradeFactor: 1.6,
  },
  tree: {
    baseCost: 800,
    upgradeBaseCost: 950,
    upgradeFactor: 1.55,
    growthLevelFactor: 0.85,
    baseYield: 14,
    yieldPerLevel: 9,
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
  produce: {
    orange: {
      name: 'Апельсины',
      shelfLife: 30 * 60 * 1000,
      sellPrice: 16,
      weight: 1,
      process: {
        product: 'juice',
        ratio: 3,
        result: 1,
      },
    },
    juice: {
      name: 'Апельсиновый сок',
      shelfLife: 45 * 60 * 1000,
      sellPrice: 48,
      weight: 1,
    },
  },
};

export function computeGrowthDuration(level) {
  const base = CONFIG.durations.growthBase;
  const factor = CONFIG.tree.growthLevelFactor;
  if (level <= 0) {
    return base * 1.1;
  }
  return base * Math.pow(factor, Math.max(0, level - 1));
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
