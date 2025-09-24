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
    this.sky = null;
    this.warehouseLabel = null;
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
    const height = this.scale.height;
    this.origin.x = width / 2;
    this.origin.y = 180;

    this.createBackground(width, height);

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
      this.ui?.hideTooltip?.();
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

    this.scale.on('resize', this.handleSceneResize, this);
  }

  createBackground(width, height) {
    const key = 'sky-background';
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      const textureWidth = Math.max(1920, width);
      const textureHeight = Math.max(1080, height);
      g.fillGradientStyle(0x0ea5e9, 0x38bdf8, 0x1d4ed8, 0x1e3a8a, 1, 1, 1, 1);
      g.fillRect(0, 0, textureWidth, textureHeight);
      g.generateTexture(key, textureWidth, textureHeight);
      g.destroy();
    }
    if (this.sky) {
      this.sky.destroy();
    }
    this.sky = this.add.image(0, 0, key);
    this.sky.setOrigin(0, 0);
    this.sky.setScrollFactor(0);
    this.sky.setDepth(-1000);
    this.sky.setDisplaySize(width, height);
  }

  createTextures() {
    if (this.textures.exists('ground-tile-0')) {
      return;
    }

    const createDiamond = (key, colors) => {
      const g = this.add.graphics();
      g.fillStyle(colors.base, 1);
      g.beginPath();
      g.moveTo(TILE_WIDTH / 2, 2);
      g.lineTo(TILE_WIDTH - 2, TILE_HEIGHT / 2);
      g.lineTo(TILE_WIDTH / 2, TILE_HEIGHT - 2);
      g.lineTo(2, TILE_HEIGHT / 2);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, colors.stroke, 0.6);
      g.strokePath();
      if (colors.accents) {
        colors.accents.forEach((accent) => {
          g.lineStyle(accent.width, accent.color, accent.alpha);
          g.beginPath();
          g.moveTo(accent.from.x, accent.from.y);
          g.lineTo(accent.to.x, accent.to.y);
          g.strokePath();
        });
      }
      g.generateTexture(key, TILE_WIDTH, TILE_HEIGHT);
      g.destroy();
    };

    createDiamond('ground-tile-0', {
      base: 0x3f83f8,
      stroke: 0x1d4ed8,
      accents: [
        { from: { x: TILE_WIDTH / 2, y: 8 }, to: { x: TILE_WIDTH - 12, y: TILE_HEIGHT / 2 }, width: 2, color: 0x60a5fa, alpha: 0.35 },
        { from: { x: 12, y: TILE_HEIGHT / 2 }, to: { x: TILE_WIDTH / 2, y: TILE_HEIGHT - 8 }, width: 2, color: 0x60a5fa, alpha: 0.25 }
      ]
    });
    createDiamond('ground-tile-1', {
      base: 0x2563eb,
      stroke: 0x1d4ed8,
      accents: [
        { from: { x: 18, y: TILE_HEIGHT / 2 }, to: { x: TILE_WIDTH / 2, y: 10 }, width: 2, color: 0x3b82f6, alpha: 0.28 },
        { from: { x: TILE_WIDTH / 2, y: TILE_HEIGHT - 10 }, to: { x: TILE_WIDTH - 18, y: TILE_HEIGHT / 2 }, width: 2, color: 0x3b82f6, alpha: 0.22 }
      ]
    });
    createDiamond('ground-tile-2', {
      base: 0x1e40af,
      stroke: 0x1e3a8a,
      accents: [
        { from: { x: TILE_WIDTH / 2, y: 6 }, to: { x: TILE_WIDTH / 2, y: TILE_HEIGHT - 6 }, width: 2, color: 0x3b82f6, alpha: 0.18 }
      ]
    });

    const plot = this.add.graphics();
    plot.fillStyle(0x15803d, 1);
    plot.beginPath();
    plot.moveTo(TILE_WIDTH / 2, 6);
    plot.lineTo(TILE_WIDTH - 6, TILE_HEIGHT / 2);
    plot.lineTo(TILE_WIDTH / 2, TILE_HEIGHT - 6);
    plot.lineTo(6, TILE_HEIGHT / 2);
    plot.closePath();
    plot.fillPath();
    plot.lineStyle(3, 0x22c55e, 0.9);
    plot.strokePath();
    plot.lineStyle(2, 0x86efac, 0.35);
    for (let i = 1; i < 5; i += 1) {
      plot.beginPath();
      plot.moveTo(TILE_WIDTH / 2 - 48 + i * 16, TILE_HEIGHT / 2 - 24);
      plot.lineTo(TILE_WIDTH / 2 + 48 - i * 16, TILE_HEIGHT / 2 + 24);
      plot.strokePath();
    }
    plot.generateTexture('plot-tile', TILE_WIDTH, TILE_HEIGHT);
    plot.destroy();

    this.createTreeTexture(0, 0x475569);
    this.createTreeTexture(1, 0x22c55e);
    this.createTreeTexture(2, 0x16a34a);
    this.createTreeTexture(3, 0x0ea5e9);
    this.createTreeTexture(4, 0xf97316);

    const highlight = this.add.graphics();
    highlight.lineStyle(4, 0xfacc15, 0.9);
    highlight.fillStyle(0xffffff, 0.12);
    highlight.beginPath();
    highlight.moveTo(TILE_WIDTH / 2, 6);
    highlight.lineTo(TILE_WIDTH - 6, TILE_HEIGHT / 2);
    highlight.lineTo(TILE_WIDTH / 2, TILE_HEIGHT - 6);
    highlight.lineTo(6, TILE_HEIGHT / 2);
    highlight.closePath();
    highlight.fillPath();
    highlight.strokePath();
    highlight.generateTexture('plot-highlight', TILE_WIDTH, TILE_HEIGHT);
    highlight.destroy();

    const factory = this.add.graphics();
    factory.fillStyle(0x7c3aed, 1);
    factory.beginPath();
    factory.moveTo(60, 6);
    factory.lineTo(120, 36);
    factory.lineTo(60, 66);
    factory.lineTo(0, 36);
    factory.closePath();
    factory.fillPath();
    factory.fillStyle(0xf97316, 1);
    factory.fillRect(36, 32, 48, 40);
    factory.lineStyle(3, 0xffffff, 0.3);
    factory.strokeRect(36, 32, 48, 40);
    factory.fillStyle(0xffffff, 0.5);
    factory.fillRect(42, 38, 14, 18);
    factory.fillRect(64, 38, 14, 18);
    factory.generateTexture('factory', 120, 96);
    factory.destroy();

    const warehouse = this.add.graphics();
    warehouse.fillStyle(0x1f2937, 1);
    warehouse.beginPath();
    warehouse.moveTo(55, 6);
    warehouse.lineTo(110, 34);
    warehouse.lineTo(55, 62);
    warehouse.lineTo(0, 34);
    warehouse.closePath();
    warehouse.fillPath();
    warehouse.fillStyle(0x38bdf8, 1);
    warehouse.fillRect(30, 36, 50, 32);
    warehouse.lineStyle(3, 0xffffff, 0.25);
    warehouse.strokeRect(30, 36, 50, 32);
    warehouse.fillStyle(0xffffff, 0.45);
    warehouse.fillRect(34, 40, 18, 20);
    warehouse.fillRect(58, 40, 18, 20);
    warehouse.generateTexture('warehouse', 110, 80);
    warehouse.destroy();
  }

  createTreeTexture(stage, color) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(34, 92, 40, 14);
    g.fillStyle(0x8b5e3c, 1);
    g.fillRect(30, 60, 8, 34);
    const radius = 18 + stage * 7;
    g.fillStyle(color, 1);
    g.fillCircle(34, 48, radius);
    g.lineStyle(3, 0xffffff, 0.25);
    g.strokeCircle(34, 48, radius - 4);
    g.generateTexture(`tree-stage-${stage}`, 68, 100);
    g.destroy();
  }

  createWorld() {
    for (let row = 0; row < WORLD_ROWS; row += 1) {
      for (let col = 0; col < WORLD_COLS; col += 1) {
        const pos = this.toIsoPoint(col, row);
        const textureIndex = (row + col) % 3;
        const tile = this.add.image(pos.x, pos.y, `ground-tile-${textureIndex}`);
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
      if (this.warehouseLabel) {
        this.warehouseLabel.setColor('#bae6fd');
      }
    });
    sprite.on('pointerout', () => {
      sprite.clearTint();
      if (this.warehouseLabel) {
        this.warehouseLabel.setColor('#e2e8f0');
      }
    });

    if (this.warehouseLabel) {
      this.warehouseLabel.destroy();
    }
    this.warehouseLabel = this.add.text(pos.x, pos.y - 68, 'Склад', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#e2e8f0'
    });
    this.warehouseLabel.setOrigin(0.5, 1);
    this.warehouseLabel.setBackgroundColor('rgba(15,23,42,0.78)');
    this.warehouseLabel.setPadding(8, 4);
    this.warehouseLabel.setDepth(sprite.depth + 5);
    this.warehouseLabel.setData('ui', false);
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

  handleUpgradeTree(tree) {
    if (!tree) {
      return;
    }
    if (tree.level >= tree.maxLevel) {
      this.events.emit('ui:toast', 'Дерево уже на максимальном уровне');
      return;
    }
    const cost = this.player.calculateTreeUpgradeCost(tree);
    if (this.player.currency < cost) {
      this.events.emit('ui:toast', 'Нужно больше монет для улучшения');
      return;
    }
    this.player.currency -= cost;
    tree.upgrade();
    this.events.emit('economy:changed');
    this.events.emit('tree:selected', tree);
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
    this.events.emit('storage:changed');
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
    plot.refreshBadge();
    this.events.emit('plot:changed', plot);
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

  handleSceneResize(gameSize) {
    if (this.sky) {
      this.sky.setDisplaySize(gameSize.width, gameSize.height);
    }
  }
}
