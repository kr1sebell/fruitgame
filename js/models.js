import { CONFIG, computeGrowthDuration } from './config.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nextId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function defaultCropType() {
  const entries = Object.keys(CONFIG.crops);
  return entries[0] ?? 'orange';
}

function resolveCrop(type) {
  return CONFIG.crops[type] ?? CONFIG.crops[defaultCropType()];
}

export class Player {
  constructor(dto = {}) {
    this.name = dto.name ?? 'Фермер';
    this.balance = dto.balance ?? 6000;
  }

  canAfford(amount) {
    return this.balance >= amount;
  }

  spend(amount) {
    if (!this.canAfford(amount)) {
      return false;
    }
    this.balance -= amount;
    return true;
  }

  earn(amount) {
    this.balance += amount;
  }

  serialize() {
    return {
      name: this.name,
      balance: this.balance,
    };
  }
}

export class InventoryItem {
  constructor(dto = {}) {
    this.id = dto.id ?? nextId('item');
    this.type = dto.type ?? 'orange';
    this.quantity = dto.quantity ?? 0;
    this.harvestedAt = dto.harvestedAt ?? Date.now();
    this.expiresAt = dto.expiresAt ?? Date.now();
  }

  get isExpired() {
    return Date.now() >= this.expiresAt;
  }

  remainingTime(now = Date.now()) {
    return this.expiresAt - now;
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      quantity: this.quantity,
      harvestedAt: this.harvestedAt,
      expiresAt: this.expiresAt,
    };
  }
}

export class Warehouse {
  constructor(dto = {}) {
    this.level = dto.level ?? 1;
    this.items = (dto.items ?? []).map((item) => new InventoryItem(item));
  }

  get capacity() {
    return (
      CONFIG.warehouse.baseCapacity +
      (Math.max(1, this.level) - 1) * CONFIG.warehouse.perLevel
    );
  }

  get used() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  }

  get available() {
    return this.capacity - this.used;
  }

  canStore(amount) {
    return amount <= this.available;
  }

  addItem(type, quantity, now = Date.now()) {
    const produce = CONFIG.produce[type];
    if (!produce) {
      return false;
    }
    if (!this.canStore(quantity * (produce.weight ?? 1))) {
      return false;
    }
    const expiresAt = now + (produce.shelfLife ?? CONFIG.durations.day);
    this.items.push(
      new InventoryItem({
        type,
        quantity,
        harvestedAt: now,
        expiresAt,
      })
    );
    return true;
  }

  removeItem(itemId) {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index >= 0) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  getItem(itemId) {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  cleanupExpired(now = Date.now()) {
    let removedQuantity = 0;
    this.items = this.items.filter((item) => {
      if (item.remainingTime(now) <= 0) {
        removedQuantity += item.quantity;
        return false;
      }
      return true;
    });
    return removedQuantity;
  }

  upgradeCost() {
    return Math.round(
      CONFIG.warehouse.upgradeBaseCost *
        Math.pow(CONFIG.warehouse.upgradeFactor, Math.max(0, this.level - 1))
    );
  }

  upgrade() {
    this.level += 1;
  }

  totalQuantity(type) {
    return this.items
      .filter((item) => item.type === type)
      .reduce((total, item) => total + item.quantity, 0);
  }

  removeQuantity(type, quantity) {
    if (quantity <= 0) {
      return 0;
    }
    const sorted = this.items
      .filter((item) => item.type === type)
      .sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));
    let remaining = quantity;
    sorted.forEach((item) => {
      if (remaining <= 0) {
        return;
      }
      const deduction = Math.min(item.quantity, remaining);
      item.quantity -= deduction;
      remaining -= deduction;
    });
    this.items = this.items.filter((item) => item.quantity > 0);
    return quantity - remaining;
  }

  removeType(type) {
    const removed = this.totalQuantity(type);
    if (removed <= 0) {
      return 0;
    }
    this.items = this.items.filter((item) => item.type !== type);
    return removed;
  }

  serialize() {
    return {
      level: this.level,
      items: this.items.map((item) => item.serialize()),
    };
  }
}

export class Plot {
  constructor(dto = {}) {
    this.id = dto.id ?? nextId('plot');
    this.level = dto.level ?? 1;
    this.treeIds = dto.treeIds ?? [];
    this.autoWater = dto.autoWater ?? false;
    this.autoHarvest = dto.autoHarvest ?? false;
    this.autoWaterNextCharge = dto.autoWaterNextCharge ?? null;
    this.autoHarvestNextCharge = dto.autoHarvestNextCharge ?? null;
    this.createdAt = dto.createdAt ?? Date.now();
  }

  get capacity() {
    return CONFIG.plot.baseCapacity + (Math.max(1, this.level) - 1) * CONFIG.plot.capacityPerLevel;
  }

  hasSpace() {
    return this.treeIds.length < this.capacity;
  }

  registerTree(tree) {
    if (!this.treeIds.includes(tree.id)) {
      this.treeIds.push(tree.id);
    }
  }

  unregisterTree(treeId) {
    this.treeIds = this.treeIds.filter((id) => id !== treeId);
  }

  upgradeCost() {
    return Math.round(
      CONFIG.plot.upgradeBaseCost * Math.pow(CONFIG.plot.upgradeFactor, Math.max(0, this.level - 1))
    );
  }

  upgrade() {
    this.level += 1;
  }

  serialize() {
    return {
      id: this.id,
      level: this.level,
      treeIds: [...this.treeIds],
      autoWater: this.autoWater,
      autoHarvest: this.autoHarvest,
      autoWaterNextCharge: this.autoWaterNextCharge,
      autoHarvestNextCharge: this.autoHarvestNextCharge,
      createdAt: this.createdAt,
    };
  }
}

export class Tree {
  constructor(dto = {}) {
    this.id = dto.id ?? nextId('tree');
    this.plotId = dto.plotId;
    this.type = dto.type ?? defaultCropType();
    this.level = dto.level ?? 0;
    this.growthProgress = dto.growthProgress ?? 0;
    this.hydrationRemaining = dto.hydrationRemaining ?? CONFIG.durations.hydration;
    this.readyToHarvest = dto.readyToHarvest ?? false;
    this.autoWater = dto.autoWater ?? false;
    this.autoHarvest = dto.autoHarvest ?? false;
    this.autoWaterNextCharge = dto.autoWaterNextCharge ?? null;
    this.autoHarvestNextCharge = dto.autoHarvestNextCharge ?? null;
    this.lastTickAt = dto.lastTickAt ?? Date.now();
  }

  get hydrationPercent() {
    return clamp((this.hydrationRemaining / CONFIG.durations.hydration) * 100, 0, 100);
  }

  get growthDuration() {
    return computeGrowthDuration(this.level, this.type);
  }

  get growthPercent() {
    if (this.readyToHarvest) {
      return 100;
    }
    return clamp((this.growthProgress / this.growthDuration) * 100, 0, 100);
  }

  canHarvest() {
    return this.readyToHarvest && this.level >= 1;
  }

  harvestYield() {
    const crop = resolveCrop(this.type);
    const base = crop.baseYield ?? 10;
    const bonus = (Math.max(1, this.level) - 1) * (crop.yieldPerLevel ?? 5);
    return Math.round(base + bonus);
  }

  get produceType() {
    const crop = resolveCrop(this.type);
    return crop.produce ?? this.type;
  }

  upgradeCost() {
    return Math.round(
      CONFIG.tree.upgradeBaseCost * Math.pow(CONFIG.tree.upgradeFactor, Math.max(0, this.level))
    );
  }

  water() {
    this.hydrationRemaining = CONFIG.durations.hydration;
    this.readyToHarvest = this.readyToHarvest;
  }

  resetGrowth() {
    this.growthProgress = 0;
    this.readyToHarvest = false;
  }

  advance(delta, now, options = {}) {
    const autoWater = options.onAutoWater;
    let remaining = delta;
    const maxHydration = CONFIG.durations.hydration;

    while (remaining > 0) {
      if (this.hydrationRemaining <= 0) {
        if (typeof autoWater === 'function') {
          autoWater(this);
        }
        if (this.hydrationRemaining <= 0) {
          break;
        }
      }

      const step = Math.min(remaining, this.hydrationRemaining);
      const applied = Math.max(1, step);
      this.hydrationRemaining = clamp(this.hydrationRemaining - applied, 0, maxHydration);
      if (!this.readyToHarvest) {
        this.growthProgress = clamp(this.growthProgress + applied, 0, this.growthDuration);
        if (this.growthProgress >= this.growthDuration) {
          if (this.level === 0) {
            this.level = 1;
            this.growthProgress = 0;
            this.readyToHarvest = false;
          } else {
            this.readyToHarvest = true;
            this.growthProgress = this.growthDuration;
          }
        }
      }
      remaining -= applied;
    }

    this.lastTickAt = now;
  }

  serialize() {
    return {
      id: this.id,
      plotId: this.plotId,
      type: this.type,
      level: this.level,
      growthProgress: this.growthProgress,
      hydrationRemaining: this.hydrationRemaining,
      readyToHarvest: this.readyToHarvest,
      autoWater: this.autoWater,
      autoHarvest: this.autoHarvest,
      autoWaterNextCharge: this.autoWaterNextCharge,
      autoHarvestNextCharge: this.autoHarvestNextCharge,
      lastTickAt: this.lastTickAt,
    };
  }
}

export function createDefaultPlotAndTree() {
  const plot = new Plot({ level: 1 });
  const tree = new Tree({ plotId: plot.id, level: 0 });
  plot.registerTree(tree);
  return { plot, tree };
}
