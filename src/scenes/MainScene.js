import {
  TILE_WIDTH,
  TILE_HEIGHT,
  WORLD_ROWS,
  WORLD_COLS,
  FACTORY_RECIPES,
  FACTORY_PROCESS_TIME
} from '../gameConfig.js';
import { SaveManager } from '../systems/SaveManager.js';
import { Player } from '../models/Player.js';
import { UIManager } from '../ui/UIManager.js';
import { DebugPanel } from '../ui/DebugPanel.js';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.origin = { x: 0, y: 0 };
    this.ui = null;
    this.player = null;
    this.debugPanel = null;
    this.plotSlots = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 4, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 4 }
    ];
  }

  preload() {
    this.createTextures();
  }

  create(data) {
    const width = this.scale.width;
    this.origin.x = width / 2;
    this.origin.y = 120;

    const savedState = SaveManager.load();
    this.player = new Player(this, savedState);

    this.createWorld();

    this.ui = new UIManager(this);
    this.debugPanel = new DebugPanel(this);
    this.debugPanel.setVisible(this.player.settings.debug);

    this.ui.updateCurrency();
    this.ui.updateStorage();
    this.ui.updateFactoryQueue();

    this.player.factory.createSprite(this.toIsoPoint(1, 4));
    this.createWarehouseSprite();

    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => {
        SaveManager.save(this.player.toJSON());
      }
    });

    window.addEventListener('beforeunload', () => {
      SaveManager.save(this.player.toJSON());
    });
  }

  createTextures() {
    const diamond = this.add.graphics();
    diamond.fillStyle(0x74b9ff, 1);
    diamond.beginPath();
    diamond.moveTo(TILE_WIDTH / 2, 0);
    diamond.lineTo(TILE_WIDTH, TILE_HEIGHT / 2);
    diamond.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
    diamond.lineTo(0, TILE_HEIGHT / 2);
    diamond.closePath();
    diamond.fillPath();
    diamond.generateTexture('ground', TILE_WIDTH, TILE_HEIGHT);
    diamond.clear();

    diamond.fillStyle(0x55efc4, 1);
    diamond.beginPath();
    diamond.moveTo(TILE_WIDTH / 2, 4);
    diamond.lineTo(TILE_WIDTH - 4, TILE_HEIGHT / 2);
    diamond.lineTo(TILE_WIDTH / 2, TILE_HEIGHT - 4);
    diamond.lineTo(4, TILE_HEIGHT / 2);
    diamond.closePath();
    diamond.fillPath();
    diamond.lineStyle(2, 0x27ae60, 1);
    diamond.strokePath();
    diamond.generateTexture('plot-tile', TILE_WIDTH, TILE_HEIGHT);
    diamond.clear();
    diamond.destroy();

    this.createTreeTexture(0, 0x636e72);
    this.createTreeTexture(1, 0x6ab04c);
    this.createTreeTexture(2, 0x45ce30);
    this.createTreeTexture(3, 0x22a6b3);
    this.createTreeTexture(4, 0xf0932b);

    const factory = this.add.graphics();
    factory.fillStyle(0x6c5ce7, 1);
    factory.beginPath();
    factory.moveTo(60, 0);
    factory.lineTo(120, 32);
    factory.lineTo(60, 64);
    factory.lineTo(0, 32);
    factory.closePath();
    factory.fillPath();
    factory.fillStyle(0xd35400, 1);
    factory.fillRect(36, 32, 48, 40);
    factory.fillStyle(0xe17055, 1);
    factory.fillRect(36, 10, 48, 28);
    factory.lineStyle(2, 0xffffff, 0.4);
    factory.strokeRect(36, 32, 48, 40);
    factory.generateTexture('factory', 120, 96);
    factory.destroy();

    const warehouse = this.add.graphics();
    warehouse.fillStyle(0x2d3436, 1);
    warehouse.beginPath();
    warehouse.moveTo(55, 4);
    warehouse.lineTo(110, 32);
    warehouse.lineTo(55, 60);
    warehouse.lineTo(0, 32);
    warehouse.closePath();
    warehouse.fillPath();
    warehouse.fillStyle(0x74b9ff, 1);
    warehouse.fillRect(30, 30, 50, 32);
    warehouse.lineStyle(2, 0xffffff, 0.4);
    warehouse.strokeRect(30, 30, 50, 32);
    warehouse.generateTexture('warehouse', 110, 80);
    warehouse.destroy();
  }

  createTreeTexture(stage, color) {
    const g = this.add.graphics();
    g.fillStyle(0x8e5b2c, 1);
    g.fillRect(28, 60, 12, 32);
    g.fillStyle(color, 1);
    const radius = 16 + stage * 6;
    g.fillCircle(34, 48, radius);
    g.lineStyle(2, 0xffffff, 0.3);
    g.strokeCircle(34, 48, radius - 3);
    g.generateTexture(`tree-stage-${stage}`, 68, 100);
    g.destroy();
  }

  createWorld() {
    for (let row = 0; row < WORLD_ROWS; row += 1) {
      for (let col = 0; col < WORLD_COLS; col += 1) {
        const pos = this.toIsoPoint(col, row);
        const tile = this.add.image(pos.x, pos.y, 'ground');
        tile.setDepth(pos.y - 100);
      }
    }
  }

  createWarehouseSprite() {
    const pos = this.toIsoPoint(0.5, 4.5);
    const sprite = this.add.image(pos.x, pos.y, 'warehouse');
    sprite.setOrigin(0.5, 0.75);
    sprite.setDepth(pos.y + 5);
  }

  toIsoPoint(col, row) {
    const x = (col - row) * (TILE_WIDTH / 2) + this.origin.x;
    const y = (col + row) * (TILE_HEIGHT / 2) + this.origin.y;
    return { x, y };
  }

  handleBuyPlot() {
    if (this.player.availablePlotSlots <= 0) {
      this.events.emit('ui:toast', 'Нет доступных участков для покупки');
      return;
    }
    const cost = this.player.calculatePlotCost();
    if (this.player.currency < cost) {
      this.events.emit('ui:toast', 'Недостаточно монет');
      return;
    }
    const usedPositions = new Set(this.player.plots.map((plot) => `${plot.position.x},${plot.position.y}`));
    const slot = this.plotSlots.find((s) => !usedPositions.has(`${s.x},${s.y}`));
    if (!slot) {
      this.events.emit('ui:toast', 'Все участки уже заняты');
      return;
    }
    this.player.currency -= cost;
    const plot = this.player.purchasePlot(slot);
    this.events.emit('economy:changed');
    this.events.emit('plot:selected', plot);
    SaveManager.save(this.player.toJSON());
  }

  handleAddTree(plot) {
    const cost = this.player.calculateTreeCost(plot);
    if (this.player.currency < cost) {
      this.events.emit('ui:toast', 'Недостаточно монет для посадки');
      return;
    }
    if (plot.trees.length >= plot.capacity) {
      this.events.emit('ui:toast', 'Участок заполнен');
      return;
    }
    this.player.currency -= cost;
    plot.purchaseTree();
    this.events.emit('economy:changed');
    this.events.emit('plot:selected', plot);
    SaveManager.save(this.player.toJSON());
  }

  handleUpgradePlot(plot) {
    const cost = this.player.calculatePlotUpgradeCost(plot);
    if (this.player.currency < cost) {
      this.events.emit('ui:toast', 'Не хватает монет');
      return;
    }
    plot.upgrade();
    this.player.currency -= cost;
    this.events.emit('economy:changed');
    this.events.emit('plot:selected', plot);
    SaveManager.save(this.player.toJSON());
  }

  handleUpgradeStorage() {
    const cost = this.player.calculateStorageUpgradeCost();
    if (this.player.currency < cost) {
      this.events.emit('ui:toast', 'Нужно больше монет');
      return;
    }
    this.player.currency -= cost;
    this.player.upgradeStorage();
    this.events.emit('economy:changed');
    SaveManager.save(this.player.toJSON());
  }

  handleSellCrops() {
    const total = this.player.storage.sellCrops();
    if (total <= 0) {
      this.events.emit('ui:toast', 'Нет урожая для продажи');
      return;
    }
    this.player.currency += total;
    this.events.emit('storage:changed');
    this.events.emit('economy:changed');
    SaveManager.save(this.player.toJSON());
  }

  handleSellProducts() {
    const total = this.player.storage.sellProducts();
    if (total <= 0) {
      this.events.emit('ui:toast', 'Нет продукции');
      return;
    }
    this.player.currency += total;
    this.events.emit('storage:changed');
    this.events.emit('economy:changed');
    SaveManager.save(this.player.toJSON());
  }

  handleProcessCrops(type) {
    const recipe = FACTORY_RECIPES[type];
    if (!recipe) {
      return;
    }
    const available = this.player.storage.crops.filter((crop) => crop.type === type).length;
    if (available < recipe.input) {
      this.events.emit('ui:toast', 'Недостаточно урожая для переработки');
      return;
    }
    this.player.storage.removeCrop(type, recipe.input);
    this.player.factory.enqueue(type);
    this.events.emit('storage:changed');
    SaveManager.save(this.player.toJSON());
  }

  handleCollectFactory(jobId) {
    if (this.player.factory.collect(jobId)) {
      this.events.emit('storage:changed');
      SaveManager.save(this.player.toJSON());
    }
  }

  handleTogglePlotAuto(plot, mode) {
    if (mode === 'water') {
      plot.autoWater = !plot.autoWater;
    }
    if (mode === 'harvest') {
      plot.autoHarvest = !plot.autoHarvest;
    }
    this.events.emit('plot:selected', plot);
    SaveManager.save(this.player.toJSON());
  }

  handleToggleTreeAuto(tree, mode) {
    if (mode === 'water') {
      tree.autoWater = !tree.autoWater;
    }
    if (mode === 'harvest') {
      tree.autoHarvest = !tree.autoHarvest;
    }
    this.events.emit('tree:selected', tree);
    SaveManager.save(this.player.toJSON());
  }

  handleHarvestTree(tree) {
    const result = tree.harvest();
    if (result) {
      this.events.emit('storage:changed');
      SaveManager.save(this.player.toJSON());
    }
  }

  handleToggleDebug(enabled) {
    this.player.toggleDebugMode(enabled);
    this.debugPanel.setVisible(enabled);
    SaveManager.save(this.player.toJSON());
  }

  debugFastForward() {
    const delta = 60000; // 60 seconds
    this.player.plots.forEach((plot) => {
      plot.trees.forEach((tree) => {
        tree.update(delta);
      });
    });
    this.player.storage.crops.forEach((crop) => {
      crop.expiresAt -= delta;
    });
    this.player.factory.queue.forEach((job) => {
      if (!job.ready) {
        job.progress = Math.min(1, job.progress + delta / (FACTORY_PROCESS_TIME * 1000));
        if (job.progress >= 1) {
          job.progress = 1;
          job.ready = true;
        }
      }
    });
    this.events.emit('storage:changed');
    this.ui.updateFactoryQueue();
  }

  update(time, delta) {
    if (!this.player) return;
    this.player.update(delta);
    this.debugPanel.update();
  }
}
