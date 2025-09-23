import { CONFIG, formatCurrency } from './config.js';
import { StorageService } from './storage.js';
import { Player, Warehouse, Plot, Tree, createDefaultPlotAndTree } from './models.js';

export class Game {
  constructor(storage = new StorageService()) {
    this.storage = storage;
    this.listeners = new Set();
    this.pendingMessages = [];
    this.tickHandle = null;
    this.lastTick = Date.now();
    this.player = new Player();
    this.warehouse = new Warehouse();
    this.plots = new Map();
    this.trees = new Map();
    this.load();
  }

  load() {
    const saved = this.storage.load();
    if (saved && saved.version === CONFIG.version) {
      this.player = new Player(saved.player);
      this.warehouse = new Warehouse(saved.warehouse);
      const plotList = Array.isArray(saved.plots) ? saved.plots : [];
      const treeList = Array.isArray(saved.trees) ? saved.trees : [];
      this.plots = new Map(plotList.map((dto) => [dto.id, new Plot(dto)]));
      this.trees = new Map(treeList.map((dto) => [dto.id, new Tree(dto)]));
      this.lastTick = saved.lastTick ?? Date.now();
    } else {
      this.initializeDefaults();
      this.save();
    }

    if (this.plots.size === 0 || this.trees.size === 0) {
      this.initializeDefaults();
      this.save();
    }

    // ensure relations between plots and trees
    this.plots.forEach((plot) => {
      plot.treeIds = plot.treeIds.filter((id) => this.trees.has(id));
    });
    this.trees.forEach((tree) => {
      const plot = this.plots.get(tree.plotId);
      if (!plot) {
        this.trees.delete(tree.id);
      }
    });

    const now = Date.now();
    const elapsed = Math.max(0, now - (this.lastTick ?? now));
    if (elapsed > 0) {
      this.advanceTime(elapsed, now);
    }
    this.lastTick = now;
    this.save();
    this.emitChange();
  }

  initializeDefaults() {
    this.player = new Player({ balance: 6000 });
    this.warehouse = new Warehouse({ level: 1, items: [] });
    this.plots = new Map();
    this.trees = new Map();
    const { plot, tree } = createDefaultPlotAndTree();
    this.plots.set(plot.id, plot);
    this.trees.set(tree.id, tree);
    this.lastTick = Date.now();
    this.pendingMessages.push({ type: 'info', text: 'На ферме появился первый участок и семечко.' });
  }

  save() {
    const payload = {
      version: CONFIG.version,
      lastTick: this.lastTick,
      player: this.player.serialize(),
      warehouse: this.warehouse.serialize(),
      plots: Array.from(this.plots.values()).map((plot) => plot.serialize()),
      trees: Array.from(this.trees.values()).map((tree) => tree.serialize()),
    };
    this.storage.save(payload);
  }

  start() {
    if (this.tickHandle) {
      return;
    }
    this.tickHandle = window.setInterval(() => this.tick(), CONFIG.tickInterval);
  }

  stop() {
    if (this.tickHandle) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emitChange() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  enqueueMessage(text, type = 'info') {
    this.pendingMessages.push({ text, type, id: `${Date.now()}-${Math.random()}` });
  }

  drainMessages() {
    const queue = [...this.pendingMessages];
    this.pendingMessages = [];
    return queue;
  }

  tick() {
    const now = Date.now();
    const delta = Math.max(0, now - this.lastTick);
    if (delta > 0) {
      this.advanceTime(delta, now);
      this.lastTick = now;
      this.save();
      this.emitChange();
    }
  }

  advanceTime(delta, now) {
    let remaining = delta;
    let current = this.lastTick;
    const longStep = 60 * 1000;
    const shortStep = CONFIG.tickInterval;

    while (remaining > 0) {
      const chunk = remaining > longStep ? longStep : Math.min(shortStep, remaining);
      current += chunk;
      this.applyAutomationCharges(current);
      this.advanceTrees(chunk, current);
      this.processAutoHarvest(current);
      if (chunk >= CONFIG.durations.expirationCheck || remaining - chunk <= 0) {
        this.cleanupExpired(current);
      }
      remaining -= chunk;
    }
  }

  applyAutomationCharges(now) {
    const ensure = (entity, key, cost) => {
      if (!entity[key]) {
        entity[`${key}NextCharge`] = null;
        return;
      }
      const scheduleKey = `${key}NextCharge`;
      const interval = CONFIG.durations.day;
      if (!entity[scheduleKey]) {
        if (!this.player.spend(cost)) {
          entity[key] = false;
          entity[scheduleKey] = null;
          this.enqueueMessage('Недостаточно монет для оплаты автоуслуги.', 'error');
          return;
        }
        entity[scheduleKey] = now + interval;
        return;
      }
      while (now >= entity[scheduleKey]) {
        if (!this.player.spend(cost)) {
          entity[key] = false;
          entity[scheduleKey] = null;
          this.enqueueMessage('Автоуслуга отключена: не хватает монет.', 'error');
          return;
        }
        entity[scheduleKey] += interval;
      }
    };

    this.plots.forEach((plot) => {
      ensure(plot, 'autoWater', CONFIG.automationCosts.plotWater);
      ensure(plot, 'autoHarvest', CONFIG.automationCosts.plotHarvest);
    });

    this.trees.forEach((tree) => {
      ensure(tree, 'autoWater', CONFIG.automationCosts.treeWater);
      ensure(tree, 'autoHarvest', CONFIG.automationCosts.treeHarvest);
    });
  }

  advanceTrees(chunk, now) {
    this.trees.forEach((tree) => {
      const plot = this.plots.get(tree.plotId);
      tree.advance(chunk, now, {
        onAutoWater: (currentTree) => {
          if (!plot) {
            return;
          }
          if (plot.autoWater || currentTree.autoWater) {
            currentTree.water();
          }
        },
      });
    });
  }

  processAutoHarvest(now) {
    this.trees.forEach((tree) => {
      const plot = this.plots.get(tree.plotId);
      const wantsAuto = tree.canHarvest() && (tree.autoHarvest || plot?.autoHarvest);
      if (wantsAuto) {
        this.harvestTree(tree.id, { auto: true, now });
      }
    });
  }

  cleanupExpired(now) {
    const removed = this.warehouse.cleanupExpired(now);
    if (removed > 0) {
      this.enqueueMessage(`Склад очистился от ${removed} просроченных партий.`, 'warning');
    }
  }

  getNextPlotCost() {
    return Math.round(
      CONFIG.plot.purchaseBaseCost * Math.pow(CONFIG.plot.purchaseFactor, this.plots.size - 1)
    );
  }

  buyPlot() {
    const cost = this.getNextPlotCost();
    if (!this.player.spend(cost)) {
      this.enqueueMessage('Недостаточно монет для покупки участка.', 'error');
      this.emitChange();
      return { success: false, message: 'Недостаточно монет для покупки участка.' };
    }
    const plot = new Plot({ level: 1 });
    this.plots.set(plot.id, plot);
    this.enqueueMessage(`Участок приобретён за ${formatCurrency(cost)} монет.`, 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  plantTree(plotId) {
    const plot = this.plots.get(plotId);
    if (!plot) {
      this.enqueueMessage('Участок не найден.', 'error');
      this.emitChange();
      return { success: false, message: 'Участок не найден.' };
    }
    if (!plot.hasSpace()) {
      this.enqueueMessage('Нет свободных слотов на участке.', 'error');
      this.emitChange();
      return { success: false, message: 'Нет свободных слотов на участке.' };
    }
    const cost = Math.round(CONFIG.tree.baseCost * (1 + 0.15 * plot.treeIds.length));
    if (!this.player.spend(cost)) {
      this.enqueueMessage('Недостаточно монет для посадки дерева.', 'error');
      this.emitChange();
      return { success: false, message: 'Недостаточно монет для посадки дерева.' };
    }
    const tree = new Tree({ plotId: plot.id, level: 0, type: 'orange' });
    this.trees.set(tree.id, tree);
    plot.registerTree(tree);
    this.enqueueMessage(`Новое дерево посажено за ${formatCurrency(cost)} монет.`, 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  waterTree(treeId) {
    const tree = this.trees.get(treeId);
    if (!tree) {
      this.enqueueMessage('Дерево не найдено.', 'error');
      this.emitChange();
      return { success: false, message: 'Дерево не найдено.' };
    }
    tree.water();
    this.enqueueMessage('Дерево полито вручную.', 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  upgradePlot(plotId) {
    const plot = this.plots.get(plotId);
    if (!plot) {
      this.enqueueMessage('Участок не найден.', 'error');
      this.emitChange();
      return { success: false, message: 'Участок не найден.' };
    }
    const cost = plot.upgradeCost();
    if (!this.player.spend(cost)) {
      this.enqueueMessage('Недостаточно монет для улучшения участка.', 'error');
      this.emitChange();
      return { success: false, message: 'Недостаточно монет для улучшения участка.' };
    }
    plot.upgrade();
    this.enqueueMessage('Участок стал просторнее!', 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  upgradeTree(treeId) {
    const tree = this.trees.get(treeId);
    if (!tree) {
      this.enqueueMessage('Дерево не найдено.', 'error');
      this.emitChange();
      return { success: false, message: 'Дерево не найдено.' };
    }
    const cost = tree.upgradeCost();
    if (!this.player.spend(cost)) {
      this.enqueueMessage('Недостаточно монет для улучшения дерева.', 'error');
      this.emitChange();
      return { success: false, message: 'Недостаточно монет для улучшения дерева.' };
    }
    tree.level += 1;
    tree.resetGrowth();
    this.enqueueMessage('Дерево стало мощнее и принесёт больше плодов.', 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  harvestTree(treeId, options = {}) {
    const tree = this.trees.get(treeId);
    if (!tree) {
      if (!options.auto) {
        this.enqueueMessage('Дерево не найдено.', 'error');
        this.emitChange();
      }
      return { success: false, message: 'Дерево не найдено.' };
    }
    if (!tree.canHarvest()) {
      if (!options.auto) {
        this.enqueueMessage('Урожай ещё не готов.', 'info');
        this.emitChange();
      }
      return { success: false, message: 'Урожай ещё не готов.' };
    }
    const produceType = tree.type;
    const produceMeta = CONFIG.produce[produceType];
    const quantity = tree.harvestYield();
    const weight = quantity * (produceMeta?.weight ?? 1);
    if (!this.warehouse.canStore(weight)) {
      if (!options.auto) {
        this.enqueueMessage('Склад переполнен, освободите место!', 'error');
        this.emitChange();
      }
      return { success: false, message: 'Недостаточно места на складе.' };
    }
    const added = this.warehouse.addItem(produceType, quantity, options.now ?? Date.now());
    if (!added) {
      return { success: false, message: 'Не удалось добавить урожай на склад.' };
    }
    tree.resetGrowth();
    this.enqueueMessage(`Собрано ${quantity} ед. урожая.`, options.auto ? 'info' : 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  togglePlotAutomation(plotId, kind) {
    const plot = this.plots.get(plotId);
    if (!plot) {
      return { success: false, message: 'Участок не найден.' };
    }
    const key = kind === 'water' ? 'autoWater' : 'autoHarvest';
    const cost = kind === 'water' ? CONFIG.automationCosts.plotWater : CONFIG.automationCosts.plotHarvest;
    plot[key] = !plot[key];
    if (plot[key]) {
      if (!this.player.spend(cost)) {
        plot[key] = false;
        this.enqueueMessage('Не хватает монет для активации автоуслуги.', 'error');
        this.emitChange();
        return { success: false };
      }
      plot[`${key}NextCharge`] = Date.now() + CONFIG.durations.day;
      this.enqueueMessage('Автоуслуга активирована на участке.', 'success');
    } else {
      plot[`${key}NextCharge`] = null;
      this.enqueueMessage('Автоуслуга отключена на участке.', 'info');
    }
    this.save();
    this.emitChange();
    return { success: true };
  }

  toggleTreeAutomation(treeId, kind) {
    const tree = this.trees.get(treeId);
    if (!tree) {
      return { success: false, message: 'Дерево не найдено.' };
    }
    const key = kind === 'water' ? 'autoWater' : 'autoHarvest';
    const cost = kind === 'water' ? CONFIG.automationCosts.treeWater : CONFIG.automationCosts.treeHarvest;
    tree[key] = !tree[key];
    if (tree[key]) {
      if (!this.player.spend(cost)) {
        tree[key] = false;
        this.enqueueMessage('Не хватает монет для запуска автоуслуги.', 'error');
        this.emitChange();
        return { success: false };
      }
      tree[`${key}NextCharge`] = Date.now() + CONFIG.durations.day;
      this.enqueueMessage('Автоуслуга для дерева активирована.', 'success');
    } else {
      tree[`${key}NextCharge`] = null;
      this.enqueueMessage('Автоуслуга для дерева отключена.', 'info');
    }
    this.save();
    this.emitChange();
    return { success: true };
  }

  upgradeWarehouse() {
    const cost = this.warehouse.upgradeCost();
    if (!this.player.spend(cost)) {
      this.enqueueMessage('Недостаточно монет для улучшения склада.', 'error');
      this.emitChange();
      return { success: false, message: 'Недостаточно монет для улучшения склада.' };
    }
    this.warehouse.upgrade();
    this.enqueueMessage('Склад увеличил вместимость.', 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  sellItem(itemId) {
    const item = this.warehouse.getItem(itemId);
    if (!item) {
      this.enqueueMessage('Партия не найдена.', 'error');
      this.emitChange();
      return { success: false, message: 'Партия не найдена.' };
    }
    const produce = CONFIG.produce[item.type];
    const reward = (produce?.sellPrice ?? 1) * item.quantity;
    this.player.earn(reward);
    this.warehouse.removeItem(item.id);
    this.enqueueMessage(`Продано за ${formatCurrency(reward)} монет.`, 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  processItem(itemId) {
    const item = this.warehouse.getItem(itemId);
    if (!item) {
      this.enqueueMessage('Партия не найдена.', 'error');
      this.emitChange();
      return { success: false, message: 'Партия не найдена.' };
    }
    const produce = CONFIG.produce[item.type];
    if (!produce?.process) {
      this.enqueueMessage('Этот продукт нельзя переработать.', 'error');
      this.emitChange();
      return { success: false, message: 'Этот продукт нельзя переработать.' };
    }
    const { ratio, result: resultPerBatch, product } = produce.process;
    const batches = Math.floor(item.quantity / ratio);
    if (batches <= 0) {
      this.enqueueMessage('Недостаточно сырья для переработки.', 'error');
      this.emitChange();
      return { success: false, message: 'Недостаточно сырья для переработки.' };
    }
    const removedQuantity = batches * ratio;
    item.quantity -= removedQuantity;
    if (item.quantity <= 0) {
      this.warehouse.removeItem(item.id);
    }
    const outputQty = batches * resultPerBatch;
    const resultMeta = CONFIG.produce[product];
    const requiredWeight = outputQty * (resultMeta?.weight ?? 1);
    if (!this.warehouse.canStore(requiredWeight)) {
      // rollback
      if (item.quantity === 0) {
        item.quantity = removedQuantity;
        this.warehouse.items.push(item);
      } else {
        item.quantity += removedQuantity;
      }
      this.enqueueMessage('Недостаточно места на складе для результата.', 'error');
      this.emitChange();
      return { success: false, message: 'Недостаточно места на складе для результата.' };
    }
    this.warehouse.addItem(product, outputQty, Date.now());
    this.enqueueMessage('Сырьё отправлено на переработку.', 'success');
    this.save();
    this.emitChange();
    return { success: true };
  }

  getState(now = Date.now()) {
    const warehouseItems = this.warehouse.items.map((item) => {
      const produce = CONFIG.produce[item.type] ?? { name: item.type, shelfLife: CONFIG.durations.day };
      const remaining = item.remainingTime(now);
      const percent = Math.max(0, Math.min(100, (remaining / produce.shelfLife) * 100));
      return {
        id: item.id,
        type: item.type,
        name: produce.name ?? item.type,
        quantity: item.quantity,
        expiresAt: item.expiresAt,
        harvestedAt: item.harvestedAt,
        remaining,
        percent,
      };
    });

    const plots = Array.from(this.plots.values()).map((plot) => {
      const trees = plot.treeIds
        .map((treeId) => this.trees.get(treeId))
        .filter(Boolean)
        .map((tree) => {
          const produce = CONFIG.produce[tree.type] ?? {};
          let status = '';
          if (tree.level === 0) {
            status = 'Саженец набирает силу';
          } else if (tree.readyToHarvest) {
            status = 'Урожай готов к сбору';
          } else {
            status = 'Созревает урожай';
          }
          return {
            id: tree.id,
            type: tree.type,
            level: tree.level,
            hydrationPercent: tree.hydrationPercent,
            hydrationRemaining: tree.hydrationRemaining,
            growthPercent: tree.growthPercent,
            readyToHarvest: tree.canHarvest(),
            nextYield: tree.harvestYield(),
            status,
            autoWater: tree.autoWater,
            autoHarvest: tree.autoHarvest,
            upgradeCost: tree.upgradeCost(),
            produceName: produce.name ?? 'Урожай',
          };
        });
      return {
        id: plot.id,
        level: plot.level,
        capacity: plot.capacity,
        used: plot.treeIds.length,
        autoWater: plot.autoWater,
        autoHarvest: plot.autoHarvest,
        upgradeCost: plot.upgradeCost(),
        trees,
      };
    });

    const state = {
      player: {
        name: this.player.name,
        balance: this.player.balance,
      },
      totals: {
        plotCount: this.plots.size,
        treeCount: this.trees.size,
      },
      warehouse: {
        level: this.warehouse.level,
        capacity: this.warehouse.capacity,
        used: this.warehouse.used,
        available: this.warehouse.available,
        upgradeCost: this.warehouse.upgradeCost(),
        items: warehouseItems,
      },
      plots,
      nextPlotCost: this.getNextPlotCost(),
      messages: this.drainMessages(),
    };
    return state;
  }
}
