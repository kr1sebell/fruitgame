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
    this.selectionMarker = null;
    this.cursors = null;
    this.keys = null;
    this.dragCamera = { active: false, x: 0, y: 0 };
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
    this.origin.y = 180;

    const savedState = SaveManager.load();
    this.player = new Player(this, savedState);

    this.createWorld();

    this.selectionMarker = this.add.image(0, 0, 'plot-highlight');
    this.selectionMarker.setVisible(false);
    this.selectionMarker.setAlpha(0.9);
    this.selectionMarker.setDepth(900);

    const camera = this.cameras.main;
    const mapWidth = (WORLD_COLS + WORLD_ROWS) * (TILE_WIDTH / 2);
    const mapHeight = (WORLD_COLS + WORLD_ROWS) * (TILE_HEIGHT / 2) + 600;
    camera.setZoom(0.9);
    camera.setBounds(this.origin.x - mapWidth - 200, this.origin.y - 320, mapWidth * 2 + 400, mapHeight);
    camera.centerOn(this.origin.x, this.origin.y + 160);
    camera.roundPixels = true;

    this.ui = new UIManager(this);
    this.debugPanel = new DebugPanel(this);
    this.debugPanel.setVisible(this.player.settings.debug);

    this.ui.updateCurrency();
    this.ui.updateStorage();
    this.ui.updateFactoryQueue();

    this.player.factory.createSprite(this.toIsoPoint(1, 4));
    this.createWarehouseSprite();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ W: 'W', A: 'A', S: 'S', D: 'D' });

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer, gameObjects) => {
      const clickedUI = gameObjects.some((obj) => obj?.getData && obj.getData('ui'));
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        if (clickedUI) {
          return;
        }
        this.dragCamera.active = true;
        this.dragCamera.x = pointer.x;
        this.dragCamera.y = pointer.y;
        return;
      }
      if (!clickedUI) {
        const clickedInteractive = gameObjects.some((obj) => {
          if (!obj?.getData) return false;
          return obj.getData('plot') || obj.getData('tree') || obj.getData('factory');
        });
        if (!clickedInteractive) {
          this.events.emit('ui:clear-selection');
        }
      }
    });

    this.input.on('pointerup', () => {
      this.dragCamera.active = false;
    });

    this.input.on('pointermove', (pointer) => {
      if (this.dragCamera.active) {
        const cam = this.cameras.main;
        cam.scrollX -= (pointer.x - this.dragCamera.x) / cam.zoom;
        cam.scrollY -= (pointer.y - this.dragCamera.y) / cam.zoom;
        this.dragCamera.x = pointer.x;
        this.dragCamera.y = pointer.y;
      }
    });

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const cam = this.cameras.main;
      const zoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.65, 1.6);
      cam.setZoom(zoom);
    });

    this.events.on('plot:selected', (plot) => this.highlightPlot(plot));
    this.events.on('tree:selected', (tree) => this.highlightPlot(tree ? tree.plot : null));
    this.events.on('ui:clear-selection', () => this.highlightPlot(null));

    if (this.player.plots.length > 0) {
      this.events.emit('plot:selected', this.player.plots[0]);
    }

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

    const highlight = this.add.graphics();
    highlight.lineStyle(4, 0xf9ca24, 0.9);
    highlight.fillStyle(0xffffff, 0.18);
    highlight.beginPath();
    highlight.moveTo(TILE_WIDTH / 2, 4);
    highlight.lineTo(TILE_WIDTH - 4, TILE_HEIGHT / 2);
    highlight.lineTo(TILE_WIDTH / 2, TILE_HEIGHT - 4);
    highlight.lineTo(4, TILE_HEIGHT / 2);
    highlight.closePath();
    highlight.fillPath();
    highlight.strokePath();
    highlight.generateTexture('plot-highlight', TILE_WIDTH, TILE_HEIGHT);
    highlight.destroy();

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
    sprite.setData('ui', false);
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      this.ui?.flashStoragePanel();
      this.events.emit('storage:changed');
    });
    sprite.on('pointerover', () => {
      sprite.setTint(0x81ecec);
    });
    sprite.on('pointerout', () => {
      sprite.clearTint();
    });
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

  highlightPlot(plot) {
    if (!this.selectionMarker) {
      return;
    }
    if (!plot) {
      this.selectionMarker.setVisible(false);
      return;
    }
    const iso = this.toIsoPoint(plot.position.x, plot.position.y);
    this.selectionMarker.setVisible(true);
    this.selectionMarker.setPosition(iso.x, iso.y);
    this.selectionMarker.setDepth(iso.y - 8);
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
    this.handleCameraControls(delta);
    this.player.update(delta);
    if (this.ui) {
      this.ui.update(delta);
    }
    if (this.debugPanel) {
      this.debugPanel.update();
    }
  }

  handleCameraControls(delta) {
    if (!this.cameras?.main) {
      return;
    }
    const cam = this.cameras.main;
    const speed = (delta / 1000) * (360 / cam.zoom);
    if (this.cursors?.left?.isDown || this.keys?.A?.isDown) {
      cam.scrollX -= speed;
    }
    if (this.cursors?.right?.isDown || this.keys?.D?.isDown) {
      cam.scrollX += speed;
    }
    if (this.cursors?.up?.isDown || this.keys?.W?.isDown) {
      cam.scrollY -= speed;
    }
    if (this.cursors?.down?.isDown || this.keys?.S?.isDown) {
      cam.scrollY += speed;
    }
  }
}
