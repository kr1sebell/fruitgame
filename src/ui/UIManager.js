import { FACTORY_RECIPES, PLOT_CAPACITY, STORAGE_CAPACITY } from '../gameConfig.js';

const HUD_WIDTH = 240;
const HUD_HEIGHT = 104;
const ACTION_BUTTON_SIZE = 68;
const CARD_HEIGHT = 210;
const TOOLTIP_MIN_WIDTH = 140;

export class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.depth = 2000;

    this.selectedPlot = null;
    this.selectedTree = null;

    this.modals = {};

    this.createHud();
    this.createActionButtons();
    this.createSelectionCard();
    this.createToast();
    this.createTooltip();
    this.createStorageModal();
    this.createFactoryModal();
    this.createSettingsModal();

    this.registerEvents();

    this.updateCurrency();
    this.updateStorage();
    this.updateFactoryQueue();
    this.updateSelectionCard();
    this.updateSettingsView();

    this.handleResize({ width: this.scene.scale.width, height: this.scene.scale.height });
    this.scene.scale.on('resize', this.handleResize, this);
  }

  createHud() {
    const { scene } = this;
    this.hud = scene.add.container(20, 20);
    this.hud.setScrollFactor(0);
    this.hud.setDepth(this.depth);

    const bg = scene.add.graphics();
    bg.fillStyle(0x111827, 0.88);
    bg.fillRoundedRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 16);
    bg.lineStyle(2, 0xffffff, 0.12);
    bg.strokeRoundedRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 16);
    bg.setData('ui', true);

    const title = scene.add.text(20, 16, 'Фермер', {
      fontSize: '18px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc',
      fontStyle: 'bold'
    });
    title.setData('ui', true);

    this.currencyText = scene.add.text(20, 44, '🪙 0', {
      fontSize: '16px',
      fontFamily: 'Segoe UI',
      color: '#22d3ee'
    });
    this.currencyText.setData('ui', true);

    this.storageText = scene.add.text(20, 70, '📦 0/0', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#a5b4fc'
    });
    this.storageText.setData('ui', true);

    this.hud.add([bg, title, this.currencyText, this.storageText]);
  }

  createActionButtons() {
    const { scene } = this;
    this.actionBar = scene.add.container(scene.scale.width - ACTION_BUTTON_SIZE - 42, 32);
    this.actionBar.setScrollFactor(0);
    this.actionBar.setDepth(this.depth);

    this.actionBarBackground = scene.add.graphics();
    this.actionBarBackground.setData('ui', true);

    this.actionButtons = [];

    this.actionBar.add(this.actionBarBackground);
    this.addActionButton('🛒', 'Купить участок', () => {
      scene.handleBuyPlot();
    });
    this.addActionButton('📦', 'Склад', () => {
      this.showModal('storage');
    });
    this.addActionButton('🏭', 'Завод', () => {
      this.showModal('factory');
    });
    this.addActionButton('⚙️', 'Настройки', () => {
      this.showModal('settings');
    });

    this.layoutActionButtons();
    this.redrawActionBarBackground();
  }

  addActionButton(icon, tooltip, callback) {
    const { scene } = this;
    const container = scene.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(this.depth + 1);

    const bg = scene.add.graphics();
    bg.fillStyle(0x312e81, 0.92);
    bg.fillRoundedRect(0, 0, ACTION_BUTTON_SIZE, ACTION_BUTTON_SIZE, 18);
    bg.lineStyle(2, 0xffffff, 0.12);
    bg.strokeRoundedRect(0, 0, ACTION_BUTTON_SIZE, ACTION_BUTTON_SIZE, 18);
    bg.setData('ui', true);

    const label = scene.add.text(ACTION_BUTTON_SIZE / 2, ACTION_BUTTON_SIZE / 2, icon, {
      fontSize: '28px',
      fontFamily: 'Segoe UI Emoji',
      color: '#f8fafc'
    });
    label.setOrigin(0.5);
    label.setData('ui', true);

    container.add([bg, label]);
    container.setSize(ACTION_BUTTON_SIZE, ACTION_BUTTON_SIZE);
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, ACTION_BUTTON_SIZE, ACTION_BUTTON_SIZE), Phaser.Geom.Rectangle.Contains);
    if (container.input) {
      container.input.cursor = 'pointer';
    }
    container.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown()) return;
      this.hideTooltip();
      callback();
    });
    container.on('pointerover', (pointer) => {
      bg.setFillStyle(0x4338ca, 0.95);
      if (tooltip) {
        this.showTooltip(tooltip, pointer);
      }
    });
    container.on('pointermove', (pointer) => {
      this.moveTooltip(pointer);
    });
    container.on('pointerout', () => {
      bg.setFillStyle(0x312e81, 0.92);
      this.hideTooltip();
    });
    container.setData('ui', true);
    container.tooltip = tooltip;

    this.actionButtons.push(container);
    this.actionBar.add(container);
  }

  layoutActionButtons() {
    this.actionButtons.forEach((button, index) => {
      button.y = index * (ACTION_BUTTON_SIZE + 12);
    });
    this.redrawActionBarBackground();
  }

  redrawActionBarBackground() {
    if (!this.actionBarBackground) {
      return;
    }
    const totalButtons = this.actionButtons.length;
    const contentHeight =
      totalButtons > 0 ? (totalButtons - 1) * (ACTION_BUTTON_SIZE + 12) + ACTION_BUTTON_SIZE : ACTION_BUTTON_SIZE;
    const boxHeight = contentHeight + 32;
    this.actionBarBackground.clear();
    this.actionBarBackground.fillStyle(0x0f172a, 0.82);
    this.actionBarBackground.fillRoundedRect(-18, -20, ACTION_BUTTON_SIZE + 36, boxHeight, 24);
    this.actionBarBackground.lineStyle(2, 0xffffff, 0.08);
    this.actionBarBackground.strokeRoundedRect(-18, -20, ACTION_BUTTON_SIZE + 36, boxHeight, 24);
  }

  createSelectionCard() {
    const { scene } = this;
    this.selectionCard = scene.add.container(scene.scale.width / 2, scene.scale.height - CARD_HEIGHT - 30);
    this.selectionCard.setScrollFactor(0);
    this.selectionCard.setDepth(this.depth);

    const bg = scene.add.graphics();
    const width = Math.min(scene.scale.width - 120, 720);
    bg.fillStyle(0x0f172a, 0.9);
    bg.fillRoundedRect(-width / 2, 0, width, CARD_HEIGHT, 24);
    bg.lineStyle(2, 0xffffff, 0.1);
    bg.strokeRoundedRect(-width / 2, 0, width, CARD_HEIGHT, 24);
    bg.setData('ui', true);

    this.selectionCardBackground = bg;
    this.selectionCardWidth = width;

    this.selectionLeftPanel = scene.add.graphics();
    this.selectionLeftPanel.setData('ui', true);
    this.selectionRightPanel = scene.add.graphics();
    this.selectionRightPanel.setData('ui', true);
    this.drawSelectionPanels(width);

    this.selectionDivider = scene.add.rectangle(0, 18, 2, CARD_HEIGHT - 36, 0xffffff, 0.1);
    this.selectionDivider.setOrigin(0.5, 0);
    this.selectionDivider.setData('ui', true);

    this.plotTitle = scene.add.text(-width / 2 + 24, 18, 'Выберите участок', {
      fontSize: '20px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc',
      fontStyle: 'bold'
    });
    this.plotTitle.setData('ui', true);

    this.plotDetails = scene.add.text(-width / 2 + 24, 48, '', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#cbd5f5',
      wordWrap: { width: width / 2 - 48 }
    });
    this.plotDetails.setData('ui', true);

    this.plotButtonRow = scene.add.container(-width / 2 + 24, 110);
    this.plotButtonRow.setData('ui', true);

    this.treeTitle = scene.add.text(width / 2 - 24, 18, 'Дерево не выбрано', {
      fontSize: '20px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc',
      fontStyle: 'bold'
    });
    this.treeTitle.setOrigin(1, 0);
    this.treeTitle.setData('ui', true);

    this.treeDetails = scene.add.text(width / 2 - 24, 48, '', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#cbd5f5',
      align: 'right',
      wordWrap: { width: width / 2 - 48 }
    });
    this.treeDetails.setOrigin(1, 0);
    this.treeDetails.setData('ui', true);

    this.treeButtonRow = scene.add.container(width / 2 - 24, 110);
    this.treeButtonRow.setData('ui', true);

    this.treeProgress = scene.add.graphics();
    this.treeProgress.setScrollFactor(0);
    this.treeProgress.setDepth(this.depth + 2);
    this.treeProgress.setData('ui', true);

    this.selectionCard.add([
      bg,
      this.selectionLeftPanel,
      this.selectionRightPanel,
      this.selectionDivider,
      this.plotTitle,
      this.plotDetails,
      this.plotButtonRow,
      this.treeTitle,
      this.treeDetails,
      this.treeButtonRow,
      this.treeProgress
    ]);

    this.createPlotButtons();
    this.createTreeButtons();
  }

  createPlotButtons() {
    this.addTreeButton = this.createTextButton('Посадить дерево', () => {
      if (this.selectedPlot) {
        this.scene.handleAddTree(this.selectedPlot);
      }
    }, { width: 170 });

    this.plotUpgradeButton = this.createTextButton('Улучшить участок', () => {
      if (this.selectedPlot) {
        this.scene.handleUpgradePlot(this.selectedPlot);
      }
    }, { width: 190 });

    this.plotAutoWater = this.createToggleButton('Автополив', () => {
      if (this.selectedPlot) {
        this.scene.handleTogglePlotAuto(this.selectedPlot, 'water');
      }
    });

    this.plotAutoHarvest = this.createToggleButton('Автосбор', () => {
      if (this.selectedPlot) {
        this.scene.handleTogglePlotAuto(this.selectedPlot, 'harvest');
      }
    });

    this.plotButtonRow.add([
      this.addTreeButton,
      this.plotUpgradeButton,
      this.plotAutoWater,
      this.plotAutoHarvest
    ]);

    this.addTreeButton.x = 0;
    this.addTreeButton.y = 0;
    this.plotUpgradeButton.x = this.addTreeButton.width + 16;
    this.plotUpgradeButton.y = 0;
    this.plotAutoWater.x = 0;
    this.plotAutoWater.y = this.addTreeButton.height + 16;
    this.plotAutoHarvest.x = this.plotAutoWater.width + 16;
    this.plotAutoHarvest.y = this.addTreeButton.height + 16;
  }

  createTreeButtons() {
    this.harvestButton = this.createTextButton('Собрать урожай', () => {
      if (this.selectedTree) {
        this.scene.handleHarvestTree(this.selectedTree);
      }
    }, { width: 190 });

    this.treeUpgradeButton = this.createTextButton('Улучшить дерево', () => {
      if (this.selectedTree) {
        this.scene.handleUpgradeTree(this.selectedTree);
      }
    }, { width: 190 });

    this.treeAutoWater = this.createToggleButton('Автополив', () => {
      if (this.selectedTree) {
        this.scene.handleToggleTreeAuto(this.selectedTree, 'water');
      }
    });

    this.treeAutoHarvest = this.createToggleButton('Автосбор', () => {
      if (this.selectedTree) {
        this.scene.handleToggleTreeAuto(this.selectedTree, 'harvest');
      }
    });

    this.treeButtonRow.add([
      this.harvestButton,
      this.treeUpgradeButton,
      this.treeAutoWater,
      this.treeAutoHarvest
    ]);

    const topRowY = 0;
    const bottomRowY = this.harvestButton.height + 16;

    this.harvestButton.x = -this.harvestButton.width;
    this.harvestButton.y = topRowY;
    this.treeUpgradeButton.x = -this.harvestButton.width - this.treeUpgradeButton.width - 16;
    this.treeUpgradeButton.y = topRowY;
    this.treeAutoWater.x = -this.treeAutoWater.width;
    this.treeAutoWater.y = bottomRowY;
    this.treeAutoHarvest.x = -this.treeAutoWater.width - this.treeAutoHarvest.width - 16;
    this.treeAutoHarvest.y = bottomRowY;
  }

  createToast() {
    const { scene } = this;
    this.toastContainer = scene.add.container(scene.scale.width / 2, scene.scale.height - 80);
    this.toastContainer.setScrollFactor(0);
    this.toastContainer.setDepth(this.depth + 5);

    const bg = scene.add.graphics();
    bg.fillStyle(0x020617, 0.85);
    bg.fillRoundedRect(-200, -28, 400, 56, 18);
    bg.lineStyle(2, 0xffffff, 0.1);
    bg.strokeRoundedRect(-200, -28, 400, 56, 18);
    bg.setData('ui', true);

    this.toastText = scene.add.text(0, 0, '', {
      fontSize: '16px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc'
    });
    this.toastText.setOrigin(0.5, 0.5);
    this.toastText.setData('ui', true);

    this.toastContainer.add([bg, this.toastText]);
    this.toastContainer.setVisible(false);
  }

  createTooltip() {
    const { scene } = this;
    this.tooltip = scene.add.container(0, 0);
    this.tooltip.setScrollFactor(0);
    this.tooltip.setDepth(this.depth + 8);
    this.tooltip.setVisible(false);
    this.tooltip.setData('ui', true);

    this.tooltipBg = scene.add.graphics();
    this.tooltipBg.setData('ui', true);

    this.tooltipText = scene.add.text(0, 0, '', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#e2e8f0',
      align: 'center'
    });
    this.tooltipText.setOrigin(0.5);
    this.tooltipText.setData('ui', true);

    this.tooltip.add([this.tooltipBg, this.tooltipText]);
  }

  createStorageModal() {
    const modal = this.createModal('storage', 'Склад фермера', 480, 420);

    this.storageSummaryText = this.scene.add.text(0, -140, '', {
      fontSize: '16px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc',
      wordWrap: { width: 420 }
    });
    this.storageSummaryText.setOrigin(0.5, 0);
    this.storageSummaryText.setData('ui', true);

    this.storageListText = this.scene.add.text(0, -80, '', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#cbd5f5',
      wordWrap: { width: 420 }
    });
    this.storageListText.setOrigin(0.5, 0);
    this.storageListText.setData('ui', true);

    this.storageButtons = this.scene.add.container(0, 120);
    this.storageButtons.setData('ui', true);

    this.sellCropsButton = this.createTextButton('Продать урожай', () => {
      this.scene.handleSellCrops();
    }, { width: 200 });

    this.sellProductsButton = this.createTextButton('Продать продукцию', () => {
      this.scene.handleSellProducts();
    }, { width: 220, color: 0xf97316 });

    this.storageUpgradeButton = this.createTextButton('Улучшить склад', () => {
      this.scene.handleUpgradeStorage();
    }, { width: 200, color: 0x38bdf8 });

    this.storageButtons.add([
      this.sellCropsButton,
      this.sellProductsButton,
      this.storageUpgradeButton
    ]);

    this.sellCropsButton.x = -220;
    this.sellProductsButton.x = -110;
    this.storageUpgradeButton.x = 20;

    modal.body.add([
      this.storageSummaryText,
      this.storageListText,
      this.storageButtons
    ]);
  }

  createFactoryModal() {
    const modal = this.createModal('factory', 'Завод переработки', 520, 420);

    this.factoryQueueText = this.scene.add.text(0, -150, '', {
      fontSize: '15px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc',
      wordWrap: { width: 440 }
    });
    this.factoryQueueText.setOrigin(0.5, 0);
    this.factoryQueueText.setData('ui', true);

    this.factoryJobsContainer = this.scene.add.container(0, -40);
    this.factoryJobsContainer.setData('ui', true);

    this.factoryButtons = this.scene.add.container(0, 140);
    this.factoryButtons.setData('ui', true);

    this.processButton = this.createTextButton('Переработать яблоки', () => {
      this.scene.handleProcessCrops('apple');
    }, { width: 240, color: 0x22c55e });

    this.factoryButtons.add([this.processButton]);

    modal.body.add([this.factoryQueueText, this.factoryJobsContainer, this.factoryButtons]);
  }

  createSettingsModal() {
    const modal = this.createModal('settings', 'Настройки', 420, 320);

    this.debugToggle = this.createToggleButton('Режим отладки', () => {
      const enabled = !this.debugToggle.active;
      this.scene.handleToggleDebug(enabled);
    }, { width: 220 });

    this.debugToggle.y = -40;

    const note = this.scene.add.text(0, 40, 'Отладка показывает FPS, объекты и даёт чит-кнопки.', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#cbd5f5',
      wordWrap: { width: 320 },
      align: 'center'
    });
    note.setOrigin(0.5, 0.5);
    note.setData('ui', true);

    modal.body.add([this.debugToggle, note]);
  }

  createModal(key, title, width, height) {
    const { scene } = this;
    const container = scene.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(this.depth + 20);
    container.setVisible(false);

    const dim = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x020617, 0.65);
    dim.setOrigin(0, 0);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height),
      Phaser.Geom.Rectangle.Contains
    );
    dim.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown()) return;
      this.hideModal(key);
    });
    dim.setData('ui', true);

    const panel = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);

    const bg = scene.add.graphics();
    bg.fillStyle(0x0f172a, 0.94);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 24);
    bg.lineStyle(2, 0xffffff, 0.1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 24);
    bg.setData('ui', true);

    const titleText = scene.add.text(0, -height / 2 + 28, title, {
      fontSize: '22px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc',
      fontStyle: 'bold'
    });
    titleText.setOrigin(0.5, 0.5);
    titleText.setData('ui', true);

    const closeBtn = this.createIconCloseButton(() => this.hideModal(key));
    closeBtn.x = width / 2 - 26;
    closeBtn.y = -height / 2 + 26;

    const body = scene.add.container(0, 40);
    body.setData('ui', true);

    panel.add([bg, titleText, body, closeBtn]);

    container.add([dim, panel]);

    this.modals[key] = {
      container,
      dim,
      panel,
      body,
      width,
      height,
      titleText
    };

    return this.modals[key];
  }

  createIconCloseButton(callback) {
    const button = this.scene.add.container(0, 0);
    button.setSize(36, 36);
    button.setInteractive(new Phaser.Geom.Rectangle(-18, -18, 36, 36), Phaser.Geom.Rectangle.Contains);
    if (button.input) {
      button.input.cursor = 'pointer';
    }

    const bg = this.scene.add.circle(0, 0, 18, 0x1f2937, 0.95);
    bg.setStrokeStyle(2, 0xffffff, 0.12);
    bg.setData('ui', true);

    const cross = this.scene.add.text(0, 0, '✕', {
      fontSize: '16px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc'
    });
    cross.setOrigin(0.5);
    cross.setData('ui', true);

    button.add([bg, cross]);
    button.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown()) return;
      callback();
    });
    button.on('pointerover', () => bg.setFillStyle(0x334155, 0.95));
    button.on('pointerout', () => bg.setFillStyle(0x1f2937, 0.95));
    button.setData('ui', true);
    return button;
  }

  createTextButton(label, callback, options = {}) {
    const width = options.width || 160;
    const height = options.height || 40;
    const baseColor = options.color || 0x6366f1;
    const hoverColor = options.hoverColor || 0x7c3aed;

    const button = this.scene.add.container(0, 0);
    button.setSize(width, height);

    const bg = this.scene.add.rectangle(0, 0, width, height, baseColor, 0.92);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0xffffff, 0.12);
    bg.setData('ui', true);

    const text = this.scene.add.text(width / 2, height / 2, label, {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#f8fafc'
    });
    text.setOrigin(0.5);
    text.setData('ui', true);

    button.add([bg, text]);
    button.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    if (button.input) {
      button.input.cursor = 'pointer';
    }
    button.setScrollFactor(0);
    button.setDepth(this.depth + 1);
    button.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown() || button.disabled) return;
      callback();
    });
    button.on('pointerover', () => {
      if (button.disabled) return;
      bg.setFillStyle(hoverColor, 0.95);
    });
    button.on('pointerout', () => {
      if (button.disabled) return;
      bg.setFillStyle(baseColor, 0.92);
    });

    button.setScrollFactor(0);
    button.setDepth(this.depth + 1);
    button.width = width;
    button.height = height;
    button.bg = bg;
    button.text = text;
    button.baseColor = baseColor;
    button.hoverColor = hoverColor;
    button.setData('ui', true);

    return button;
  }

  createToggleButton(label, callback, options = {}) {
    const button = this.createTextButton(label, () => {
      callback();
    }, options);
    button.active = false;
    button.setToggleState = (state) => {
      button.active = state;
      button.bg.setFillStyle(state ? 0x22c55e : button.baseColor, state ? 0.95 : 0.92);
      button.text.setColor(state ? '#042f2e' : '#f8fafc');
    };
    return button;
  }

  showModal(key) {
    const modal = this.modals[key];
    if (!modal) return;
    this.hideTooltip();
    modal.container.setVisible(true);
    this.scene.tweens.add({
      targets: modal.panel,
      scale: { from: 0.85, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 220,
      ease: 'Sine.easeOut'
    });
    if (key === 'storage') {
      this.updateStorage();
    }
    if (key === 'factory') {
      this.updateFactoryQueue();
    }
    if (key === 'settings') {
      this.updateSettingsView();
    }
  }

  hideModal(key) {
    const modal = this.modals[key];
    if (!modal) return;
    this.hideTooltip();
    modal.container.setVisible(false);
  }

  registerEvents() {
    const events = this.scene.events;
    events.on('economy:changed', () => this.updateCurrency());
    events.on('storage:changed', () => this.updateStorage());
    events.on('factory:queue-changed', () => this.updateFactoryQueue());
    events.on('factory:job-ready', () => this.updateFactoryQueue());
    events.on('plot:selected', (plot) => {
      this.selectedPlot = plot;
      this.selectedTree = null;
      this.updateSelectionCard();
    });
    events.on('tree:selected', (tree) => {
      this.selectedTree = tree;
      this.selectedPlot = tree?.plot || this.selectedPlot;
      this.updateSelectionCard();
    });
    events.on('plot:changed', () => this.updateSelectionCard());
    events.on('tree:upgraded', () => this.updateSelectionCard());
    events.on('tree:ready', (tree) => {
      if (tree === this.selectedTree) {
        this.updateSelectionCard();
      }
    });
    events.on('ui:clear-selection', () => {
      this.selectedPlot = null;
      this.selectedTree = null;
      this.updateSelectionCard();
    });
    events.on('ui:toast', (message) => this.showToast(message));
  }

  updateCurrency() {
    this.currencyText.setText(`🪙 ${Math.floor(this.scene.player.currency)}`);
  }

  updateStorage() {
    const storage = this.scene.player.storage;
    this.storageText.setText(`📦 ${storage.usedSlots}/${storage.capacity}`);

    if (!this.storageSummaryText) {
      return;
    }

    const lines = [];
    lines.push(`Уровень склада: ${storage.level} (вместимость ${storage.capacity})`);
    if (storage.crops.length === 0 && storage.products.length === 0) {
      lines.push('\nНа складе пусто — самое время заняться деревьями!');
    }
    if (storage.crops.length > 0) {
      lines.push('\nУрожай:');
      storage.crops.forEach((crop) => {
        const remaining = Math.max(0, Math.floor((crop.expiresAt - Date.now()) / 1000));
        lines.push(`• ${crop.type} — ${crop.value} монет (до порчи ${remaining}с)`);
      });
    }
    if (storage.products.length > 0) {
      lines.push('\nПродукция:');
      storage.products.forEach((product) => {
        lines.push(`• ${product.type} ×${product.amount} (цена ${product.value})`);
      });
    }

    this.storageSummaryText.setText(lines.join('\n'));
    this.storageListText.setText('');

    const canSellCrops = storage.crops.length > 0;
    const canSellProducts = storage.products.length > 0;
    const maxLevel = STORAGE_CAPACITY.length - 1;

    this.setButtonEnabled(this.sellCropsButton, canSellCrops);
    this.setButtonEnabled(this.sellProductsButton, canSellProducts);

    if (storage.level < maxLevel) {
      const cost = this.scene.player.calculateStorageUpgradeCost();
      this.storageUpgradeButton.text.setText(`Улучшить склад (${cost})`);
      this.setButtonEnabled(this.storageUpgradeButton, true);
    } else {
      this.storageUpgradeButton.text.setText('Склад максимального уровня');
      this.setButtonEnabled(this.storageUpgradeButton, false);
    }
  }

  updateFactoryQueue() {
    if (!this.factoryQueueText) {
      return;
    }
    const queue = this.scene.player.factory.queue;
    const recipe = FACTORY_RECIPES.apple;
    if (recipe && this.processButton) {
      const available = this.scene.player.storage.crops.filter((crop) => crop.type === 'apple').length;
      const canProcess = available >= recipe.input;
      this.processButton.text.setText(`Переработать яблоки (${recipe.input})`);
      this.setButtonEnabled(this.processButton, canProcess);
    }
    this.factoryJobsContainer.removeAll(true);

    if (queue.length === 0) {
      this.factoryQueueText.setText('Очередь пуста. Отправьте урожай на переработку!');
      return;
    }

    this.factoryQueueText.setText('Очередь заказов:');

    queue.forEach((job, index) => {
      const row = this.scene.add.container(0, index * 56);
      row.setData('ui', true);

      const rowBg = this.scene.add.rectangle(0, 0, 460, 48, 0x111827, 0.6);
      rowBg.setStrokeStyle(1, 0xffffff, 0.08);
      rowBg.setOrigin(0.5, 0.5);
      rowBg.setData('ui', true);

      const recipeForJob = FACTORY_RECIPES[job.type];
      const label = recipeForJob
        ? `${recipeForJob.output.type} ×${recipeForJob.output.amount}`
        : job.type;
      const jobText = this.scene.add.text(-220, 0, `${index + 1}. ${label}`, {
        fontSize: '14px',
        fontFamily: 'Segoe UI',
        color: '#cbd5f5'
      });
      jobText.setOrigin(0, 0.5);
      jobText.setData('ui', true);

      row.add([rowBg, jobText]);

      if (job.ready) {
        const collectButton = this.createTextButton('Забрать', () => {
          this.scene.handleCollectFactory(job.id);
        }, { width: 120, color: 0xfacc15, hoverColor: 0xfbbf24 });
        collectButton.x = 220 - collectButton.width;
        collectButton.y = -collectButton.height / 2;
        row.add(collectButton);
      } else {
        const progress = this.scene.add.graphics();
        progress.setData('ui', true);
        progress.x = 140;
        progress.y = 0;
        progress.fillStyle(0x1e293b, 0.9);
        progress.fillRoundedRect(-100, -6, 200, 12, 6);
        progress.fillStyle(0x38bdf8, 0.95);
        progress.fillRoundedRect(-100, -6, Math.max(0, 200 * job.progress), 12, 6);
        row.add(progress);
      }

      this.factoryJobsContainer.add(row);
    });
  }

  updateSettingsView() {
    if (!this.debugToggle) {
      return;
    }
    this.debugToggle.setToggleState(Boolean(this.scene.player.settings.debug));
  }

  updateSelectionCard() {
    const plot = this.selectedPlot;
    const tree = this.selectedTree;

    if (!plot) {
      this.plotTitle.setText('Выберите участок');
      this.plotDetails.setText('Кликните по участку, чтобы увидеть его параметры и посадить деревья.');
      this.setButtonEnabled(this.addTreeButton, false);
      this.setButtonEnabled(this.plotUpgradeButton, false);
      this.addTreeButton.text.setText('Посадить дерево');
      this.plotUpgradeButton.text.setText('Улучшить участок');
      this.plotAutoWater.setToggleState(false);
      this.plotAutoHarvest.setToggleState(false);
      this.setToggleEnabled(this.plotAutoWater, false);
      this.setToggleEnabled(this.plotAutoHarvest, false);
    } else {
      const available = `${plot.trees.length}/${plot.capacity}`;
      const autoText = [];
      if (plot.autoWater) autoText.push('автополив');
      if (plot.autoHarvest) autoText.push('автосбор');
      this.plotTitle.setText(`Участок ${plot.id} — уровень ${plot.level}`);
      this.plotDetails.setText(`Деревьев: ${available}\n${autoText.length ? autoText.join(', ') : 'Авто-режимы отключены.'}`);
      this.setButtonEnabled(this.addTreeButton, plot.trees.length < plot.capacity);
      const treeCost = this.scene.player.calculateTreeCost(plot);
      this.addTreeButton.text.setText(
        plot.trees.length < plot.capacity ? `Посадить дерево (${treeCost})` : 'Мест нет'
      );
      if (plot.level < PLOT_CAPACITY.length - 1) {
        const cost = this.scene.player.calculatePlotUpgradeCost(plot);
        this.plotUpgradeButton.text.setText(`Улучшить участок (${cost})`);
        this.setButtonEnabled(this.plotUpgradeButton, true);
      } else {
        this.plotUpgradeButton.text.setText('Участок максимального уровня');
        this.setButtonEnabled(this.plotUpgradeButton, false);
      }
      this.plotAutoWater.setToggleState(plot.autoWater);
      this.plotAutoHarvest.setToggleState(plot.autoHarvest);
      this.setToggleEnabled(this.plotAutoWater, true);
      this.setToggleEnabled(this.plotAutoHarvest, true);
    }

    if (!tree) {
      this.treeTitle.setText('Дерево не выбрано');
      this.treeDetails.setText('Выберите дерево, чтобы увидеть прогресс роста, собрать урожай или улучшить его.');
      this.treeProgress.clear();
      this.setButtonEnabled(this.harvestButton, false);
      this.setButtonEnabled(this.treeUpgradeButton, false);
      this.harvestButton.text.setText('Собрать урожай');
      this.treeUpgradeButton.text.setText('Улучшить дерево');
      this.treeAutoWater.setToggleState(false);
      this.treeAutoHarvest.setToggleState(false);
      this.setToggleEnabled(this.treeAutoWater, false);
      this.setToggleEnabled(this.treeAutoHarvest, false);
      return;
    }

    const levelLabel = tree.level <= 0 ? 'семечко' : `уровень ${tree.level}`;
    const readyText = tree.isMature ? 'урожай готов к сбору!' : `рост ${Math.round(tree.growthProgress * 100)}%`;
    const upgradeCost = this.scene.player.calculateTreeUpgradeCost(tree);

    this.treeTitle.setText(`Дерево ${tree.id} — ${levelLabel}`);
    this.treeDetails.setText(`Состояние: ${readyText}`);

    this.drawUiProgress(tree);

    this.setButtonEnabled(this.harvestButton, tree.canHarvest());
    this.setButtonEnabled(this.treeUpgradeButton, tree.level < tree.maxLevel);
    this.treeUpgradeButton.text.setText(
      tree.level < tree.maxLevel ? `Улучшить дерево (${upgradeCost} монет)` : 'Максимальный уровень'
    );

    this.treeAutoWater.setToggleState(tree.autoWater);
    this.treeAutoHarvest.setToggleState(tree.autoHarvest);
    this.setToggleEnabled(this.treeAutoWater, true);
    this.setToggleEnabled(this.treeAutoHarvest, true);
  }

  drawSelectionPanels(width) {
    if (!this.selectionLeftPanel || !this.selectionRightPanel) {
      return;
    }
    this.selectionLeftPanel.clear();
    this.selectionLeftPanel.fillStyle(0x111827, 0.55);
    this.selectionLeftPanel.fillRoundedRect(-width / 2 + 16, 12, width / 2 - 32, CARD_HEIGHT - 24, 18);
    this.selectionRightPanel.clear();
    this.selectionRightPanel.fillStyle(0x0f172a, 0.45);
    this.selectionRightPanel.fillRoundedRect(8, 12, width / 2 - 24, CARD_HEIGHT - 24, 18);
  }

  drawUiProgress(tree) {
    const columnWidth = Math.max(180, this.selectionCardWidth / 2 - 80);
    const startX = this.selectionCardWidth / 2 - 24 - columnWidth;
    const y = 160;
    this.treeProgress.clear();
    this.treeProgress.fillStyle(0x1e293b, 0.9);
    this.treeProgress.fillRoundedRect(startX, y, columnWidth, 16, 10);
    const color = tree.isMature ? 0xfacc15 : 0x38bdf8;
    const value = tree.isMature ? 1 : tree.growthProgress;
    this.treeProgress.fillStyle(color, 0.95);
    this.treeProgress.fillRoundedRect(startX + 2, y + 2, Math.max(0, columnWidth * value - 4), 12, 8);
  }

  update(delta) {
    if (this.selectedTree) {
      this.drawUiProgress(this.selectedTree);
    }
  }

  showToast(message) {
    this.toastText.setText(message);
    this.toastContainer.setVisible(true);
    this.scene.tweens.killTweensOf(this.toastContainer);
    this.toastContainer.alpha = 1;
    this.scene.tweens.add({
      targets: this.toastContainer,
      alpha: 0,
      delay: 1600,
      duration: 600,
      onComplete: () => this.toastContainer.setVisible(false)
    });
  }

  showTooltip(content, pointer) {
    if (!this.tooltip) {
      return;
    }
    this.tooltipText.setText(content);
    const width = Math.max(TOOLTIP_MIN_WIDTH, this.tooltipText.width + 32);
    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(0x020617, 0.92);
    this.tooltipBg.fillRoundedRect(-width / 2, -22, width, 36, 14);
    this.tooltipBg.lineStyle(2, 0xffffff, 0.12);
    this.tooltipBg.strokeRoundedRect(-width / 2, -22, width, 36, 14);
    const y = Math.max(60, pointer.y - 42);
    this.tooltip.setPosition(pointer.x, y);
    this.tooltip.setVisible(true);
  }

  moveTooltip(pointer) {
    if (!this.tooltip?.visible) {
      return;
    }
    const y = Math.max(60, pointer.y - 42);
    this.tooltip.setPosition(pointer.x, y);
  }

  hideTooltip() {
    if (!this.tooltip) {
      return;
    }
    this.tooltip.setVisible(false);
  }

  setButtonEnabled(button, enabled) {
    if (!button) return;
    button.disabled = !enabled;
    button.alpha = enabled ? 1 : 0.4;
    button.bg?.setFillStyle(enabled ? button.baseColor : 0x475569, enabled ? 0.92 : 0.6);
    if (button.text?.setColor) {
      button.text.setColor(enabled ? '#f8fafc' : '#94a3b8');
    }
  }

  setToggleEnabled(button, enabled) {
    if (!button) return;
    button.disabled = !enabled;
    if (!enabled) {
      button.bg?.setFillStyle(0x475569, 0.6);
      button.text?.setColor('#94a3b8');
    } else {
      if (button.active) {
        button.setToggleState(true);
      } else {
        button.bg?.setFillStyle(button.baseColor, 0.92);
        button.text?.setColor('#f8fafc');
      }
    }
  }

  handleResize(gameSize) {
    const { width, height } = gameSize;
    this.hideTooltip();
    this.actionBar.x = width - ACTION_BUTTON_SIZE - 42;
    this.actionBar.y = 32;
    this.layoutActionButtons();

    this.selectionCard.x = width / 2;
    this.selectionCard.y = height - CARD_HEIGHT - 30;

    const newWidth = Math.min(width - 120, 720);
    if (this.selectionCardWidth !== newWidth) {
      this.selectionCardWidth = newWidth;
      this.selectionCardBackground.clear();
      this.selectionCardBackground.fillStyle(0x0f172a, 0.9);
      this.selectionCardBackground.fillRoundedRect(-newWidth / 2, 0, newWidth, CARD_HEIGHT, 24);
      this.selectionCardBackground.lineStyle(2, 0xffffff, 0.1);
      this.selectionCardBackground.strokeRoundedRect(-newWidth / 2, 0, newWidth, CARD_HEIGHT, 24);
      if (this.selectedTree) {
        this.drawUiProgress(this.selectedTree);
      }
    }
    this.drawSelectionPanels(newWidth);

    this.plotTitle.x = -newWidth / 2 + 24;
    this.plotDetails.x = -newWidth / 2 + 24;
    this.treeTitle.x = newWidth / 2 - 24;
    this.treeDetails.x = newWidth / 2 - 24;
    this.treeButtonRow.x = newWidth / 2 - 24;
    if (this.selectionDivider) {
      this.selectionDivider.y = 18;
      this.selectionDivider.setDisplaySize(2, CARD_HEIGHT - 36);
    }

    this.toastContainer.x = width / 2;
    this.toastContainer.y = height - 80;

    Object.values(this.modals).forEach((modal) => {
      modal.dim.setSize(width, height);
      modal.dim.setDisplaySize(width, height);
      if (modal.dim.input?.hitArea) {
        modal.dim.input.hitArea.setTo(0, 0, width, height);
      }
      modal.panel.x = width / 2;
      modal.panel.y = height / 2;
    });
  }

  flashSelectionPanel() {
    this.scene.tweens.add({
      targets: this.selectionCard,
      scale: { from: 0.97, to: 1 },
      duration: 180,
      ease: 'Sine.easeOut'
    });
  }

  flashStoragePanel() {
    this.showModal('storage');
  }

  flashFactoryPanel() {
    this.showModal('factory');
  }
}
