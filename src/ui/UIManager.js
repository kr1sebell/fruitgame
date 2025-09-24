import { FACTORY_RECIPES } from '../gameConfig.js';

const PANEL_ALPHA = 0.92;

export class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.depth = 1000;

    this.selectedPlot = null;
    this.selectedTree = null;

    this.storageRefresh = 0;
    this.factoryRefresh = 0;

    this.toastEvent = null;

    this.createLayout();
    this.registerEvents();

    this.updateCurrency();
    this.updateStorage();
    this.updateFactoryQueue();
    this.updateSettingsView();
    this.clearSelection();

    this.handleResize({ width: this.scene.scale.width, height: this.scene.scale.height });
    this.scene.scale.on('resize', this.handleResize, this);
  }

  createLayout() {
    const { scene } = this;

    this.topBar = scene.add.container(0, 0);
    this.topBar.setScrollFactor(0);
    this.topBar.setDepth(this.depth);

    this.topBarBg = scene.add.rectangle(0, 0, scene.scale.width, 72, 0x000000, 0.28);
    this.topBarBg.setOrigin(0, 0);
    this.topBarBg.setStrokeStyle(1, 0xffffff, 0.18);
    this.topBarBg.setData('ui', true);

    this.currencyText = scene.add.text(24, 16, 'Баланс: 0', {
      fontSize: '20px',
      fontFamily: 'Segoe UI',
      color: '#f5f6fa',
      fontStyle: 'bold'
    });
    this.currencyText.setShadow(2, 2, '#000000', 2, true, true);
    this.currencyText.setScrollFactor(0);
    this.currencyText.setDepth(this.depth + 1);
    this.currencyText.setData('ui', true);

    this.topButtonRow = scene.add.container(0, 0);
    this.topButtonRow.setScrollFactor(0);
    this.topButtonRow.setDepth(this.depth + 1);

    this.topBar.add([this.topBarBg, this.currencyText, this.topButtonRow]);

    this.topButtons = [];
    this.btnBuyPlot = this.createButton('Купить участок', () => scene.handleBuyPlot());
    this.btnUpgradeStorage = this.createButton('Улучшить склад', () => scene.handleUpgradeStorage(), {
      pulseTarget: 'storage'
    });
    this.btnSellCrops = this.createButton('Продать урожай', () => scene.handleSellCrops(), {
      fill: 0x27ae60,
      pulseTarget: 'storage'
    });
    this.btnSellProducts = this.createButton('Продать продукцию', () => scene.handleSellProducts(), {
      fill: 0xe58e26,
      pulseTarget: 'storage'
    });
    this.btnSettings = this.createButton('Настройки', () => this.showSettings(true), {
      fill: 0x6c5ce7,
      pulseTarget: null
    });

    this.topButtons.push(
      this.btnBuyPlot,
      this.btnUpgradeStorage,
      this.btnSellCrops,
      this.btnSellProducts,
      this.btnSettings
    );

    this.topButtons.forEach((button) => {
      button.setData('ui', true);
      this.topButtonRow.add(button);
    });

    this.storagePanel = this.createPanel(16, 76, 260, 240, 'Склад');
    this.storagePanel.container.setData('ui', true);
    this.storageSummaryText = scene.add.text(0, 0, '', this.getPanelTextStyle());
    this.storageSummaryText.setScrollFactor(0);
    this.storageSummaryText.setDepth(this.depth + 1);
    this.storageSummaryText.setData('ui', true);
    this.storageContentsText = scene.add.text(0, 28, '', {
      ...this.getPanelTextStyle(),
      fontSize: '13px',
      wordWrap: { width: this.storagePanel.bg.width - 32 }
    });
    this.storageContentsText.setScrollFactor(0);
    this.storageContentsText.setDepth(this.depth + 1);
    this.storageContentsText.setData('ui', true);
    this.storagePanel.content.add([this.storageSummaryText, this.storageContentsText]);

    this.processButton = this.createButton('На завод', () => scene.handleProcessCrops('apple'), {
      width: 140,
      height: 32,
      pulseTarget: 'factory'
    });
    this.storagePanel.content.add(this.processButton);

    this.factoryPanel = this.createPanel(scene.scale.width - 276, 76, 260, 240, 'Завод');
    this.factoryPanel.container.setData('ui', true);
    this.factoryQueueContainer = scene.add.container(0, 0);
    this.factoryQueueContainer.setScrollFactor(0);
    this.factoryQueueContainer.setDepth(this.depth + 1);
    this.factoryPanel.content.add(this.factoryQueueContainer);

    this.selectionPanel = this.createPanel(16, scene.scale.height - 200, scene.scale.width - 32, 188, 'Управление участком');
    this.selectionPanel.container.setData('ui', true);

    this.plotSection = scene.add.container(0, 0);
    this.plotSection.setScrollFactor(0);
    this.plotSection.setDepth(this.depth + 1);
    this.treeSection = scene.add.container(0, 0);
    this.treeSection.setScrollFactor(0);
    this.treeSection.setDepth(this.depth + 1);
    this.selectionPanel.content.add([this.plotSection, this.treeSection]);

    this.plotInfoText = scene.add.text(0, 0, 'Участок не выбран', this.getPanelTextStyle());
    this.plotInfoText.setScrollFactor(0);
    this.plotInfoText.setDepth(this.depth + 1);
    this.plotInfoText.setData('ui', true);
    this.plotActions = scene.add.container(0, 74);
    this.plotActions.setScrollFactor(0);
    this.plotActions.setDepth(this.depth + 1);
    this.plotSection.add([this.plotInfoText, this.plotActions]);

    this.treeInfoText = scene.add.text(0, 0, 'Дерево не выбрано', this.getPanelTextStyle());
    this.treeInfoText.setScrollFactor(0);
    this.treeInfoText.setDepth(this.depth + 1);
    this.treeInfoText.setData('ui', true);
    this.treeActions = scene.add.container(0, 74);
    this.treeActions.setScrollFactor(0);
    this.treeActions.setDepth(this.depth + 1);
    this.treeSection.add([this.treeInfoText, this.treeActions]);

    this.helpText = scene.add.text(
      24,
      scene.scale.height - 240,
      'Управление: WASD/стрелки — камера, ПКМ — перетаскивание, колесо — зум',
      {
        fontSize: '14px',
        fontFamily: 'Segoe UI',
        color: '#f1f2f6'
      }
    );
    this.helpText.setShadow(1, 1, '#000000', 2, true, true);
    this.helpText.setScrollFactor(0);
    this.helpText.setDepth(this.depth + 1);
    this.helpText.setData('ui', true);

    this.toastContainer = scene.add.container(scene.scale.width / 2, scene.scale.height - 120);
    this.toastContainer.setScrollFactor(0);
    this.toastContainer.setDepth(this.depth + 5);
    this.toastBackground = scene.add.rectangle(0, 0, 360, 44, 0x000000, 0.78);
    this.toastBackground.setOrigin(0.5, 0.5);
    this.toastBackground.setData('ui', true);
    this.toastText = scene.add.text(0, 0, '', {
      fontSize: '16px',
      fontFamily: 'Segoe UI',
      color: '#ffffff'
    });
    this.toastText.setOrigin(0.5, 0.5);
    this.toastText.setScrollFactor(0);
    this.toastText.setDepth(this.depth + 6);
    this.toastText.setData('ui', true);
    this.toastContainer.add([this.toastBackground, this.toastText]);
    this.toastContainer.setVisible(false);

    this.settingsOverlay = scene.add.container(0, 0);
    this.settingsOverlay.setScrollFactor(0);
    this.settingsOverlay.setDepth(this.depth + 10);
    this.settingsOverlay.setVisible(false);

    this.settingsDim = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.45);
    this.settingsDim.setOrigin(0, 0);
    this.settingsDim.setData('ui', true);
    this.settingsDim.on('pointerdown', () => this.showSettings(false));

    this.settingsWindow = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);
    this.settingsWindow.setScrollFactor(0);
    this.settingsWindow.setDepth(this.depth + 11);

    const settingsBg = scene.add.rectangle(0, 0, 340, 220, 0xffffff, 0.98);
    settingsBg.setOrigin(0.5, 0.5);
    settingsBg.setStrokeStyle(2, 0x6c5ce7, 0.5);
    settingsBg.setData('ui', true);

    const settingsTitle = scene.add.text(0, -82, 'Настройки', {
      fontSize: '22px',
      fontFamily: 'Segoe UI',
      color: '#2d3436',
      fontStyle: 'bold'
    });
    settingsTitle.setOrigin(0.5, 0.5);
    settingsTitle.setScrollFactor(0);
    settingsTitle.setDepth(this.depth + 12);
    settingsTitle.setData('ui', true);

    this.debugToggleButton = this.createButton('', () => {
      const next = !this.scene.player.settings.debug;
      this.scene.handleToggleDebug(next);
      this.updateSettingsView();
    }, {
      width: 200,
      height: 40,
      fill: 0x6c5ce7,
      pulseTarget: null
    });
    this.debugToggleButton.setPosition(0, -20);

    this.debugHintText = scene.add.text(0, 40, 'Debug Mode показывает FPS и список объектов.', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#636e72',
      align: 'center',
      wordWrap: { width: 280 }
    });
    this.debugHintText.setOrigin(0.5, 0.5);
    this.debugHintText.setScrollFactor(0);
    this.debugHintText.setDepth(this.depth + 12);
    this.debugHintText.setData('ui', true);

    const closeSettingsButton = this.createButton('Закрыть', () => this.showSettings(false), {
      width: 160,
      height: 36,
      fill: 0x0984e3,
      pulseTarget: null
    });
    closeSettingsButton.setPosition(0, 88);

    this.settingsWindow.add([
      settingsBg,
      settingsTitle,
      this.debugToggleButton,
      this.debugHintText,
      closeSettingsButton
    ]);
    this.settingsOverlay.add([this.settingsDim, this.settingsWindow]);

    this.panelBackgrounds = {
      storage: this.storagePanel.bg,
      factory: this.factoryPanel.bg,
      selection: this.selectionPanel.bg
    };
  }

  registerEvents() {
    const events = this.scene.events;
    events.on('economy:changed', () => this.updateCurrency());
    events.on('storage:changed', () => this.updateStorage());
    events.on('plot:selected', (plot) => this.showPlot(plot));
    events.on('tree:selected', (tree) => this.showTree(tree));
    events.on('factory:selected', () => {
      this.flashFactoryPanel();
      this.updateFactoryQueue();
    });
    events.on('plot:changed', (plot) => {
      if (plot === this.selectedPlot) {
        this.renderPlotInfo(plot);
      }
      this.updateFactoryQueue();
    });
    events.on('plot:added', () => {
      this.updateCurrency();
    });
    events.on('factory:queue-changed', () => this.updateFactoryQueue());
    events.on('factory:job-ready', () => this.updateFactoryQueue());
    events.on('ui:toast', (msg) => this.showToast(msg));
    events.on('ui:clear-selection', () => this.clearSelection());
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.layout(width, height);
  }

  layout(width, height) {
    this.topBarBg.width = width;

    let buttonRow = 0;
    let x = 240;
    this.topButtons.forEach((button) => {
      if (x + button.buttonWidth > width - 32) {
        buttonRow += 1;
        x = 240;
      }
      button.x = x + button.buttonWidth / 2;
      button.y = 36 + buttonRow * 40;
      x += button.buttonWidth + 12;
    });

    this.topBarBg.height = 72 + buttonRow * 40;

    const topOffset = this.topBarBg.height + 12;
    this.storagePanel.container.y = topOffset;

    const factoryWidth = this.factoryPanel.bg.width;
    const panelsTotalWidth = this.storagePanel.bg.width + factoryWidth + 64;
    if (width < panelsTotalWidth) {
      this.factoryPanel.container.x = 16;
      this.factoryPanel.container.y = this.storagePanel.container.y + this.storagePanel.bg.height + 16;
    } else {
      this.factoryPanel.container.x = width - factoryWidth - 16;
      this.factoryPanel.container.y = topOffset;
    }

    this.storagePanel.container.x = 16;

    this.selectionPanel.bg.width = Math.max(340, width - 32);
    this.selectionPanel.container.x = 16;
    this.selectionPanel.container.y = height - this.selectionPanel.bg.height - 24;

    const contentWidth = this.selectionPanel.bg.width - 24;
    const halfWidth = contentWidth / 2;
    this.plotSection.x = 0;
    this.treeSection.x = halfWidth;
    this.plotInfoText.setWordWrapWidth(halfWidth - 20);
    this.treeInfoText.setWordWrapWidth(halfWidth - 20);

    this.helpText.y = Math.max(this.selectionPanel.container.y - 36, topOffset + 12);
    this.helpText.setWordWrapWidth(width - 48);

    this.processButton.x = (this.storagePanel.bg.width - 24) / 2;
    this.processButton.y = this.storagePanel.bg.height - 80;

    this.toastContainer.x = width / 2;
    this.toastContainer.y = Math.max(this.selectionPanel.container.y - 40, 120);

    this.settingsDim.setDisplaySize(width, height);
    this.settingsDim.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    this.settingsWindow.x = width / 2;
    this.settingsWindow.y = height / 2;
  }

  createPanel(x, y, width, height, title) {
    const container = this.scene.add.container(x, y);
    container.setScrollFactor(0);
    container.setDepth(this.depth);

    const bg = this.scene.add.rectangle(0, 0, width, height, 0xffffff, PANEL_ALPHA);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0xffffff, 0.25);
    bg.setData('ui', true);

    const header = this.scene.add.rectangle(0, 0, width, 36, 0x0984e3, 0.14);
    header.setOrigin(0, 0);
    header.setData('ui', true);

    const titleText = this.scene.add.text(12, 8, title, {
      fontSize: '18px',
      fontFamily: 'Segoe UI',
      color: '#2d3436',
      fontStyle: 'bold'
    });
    titleText.setScrollFactor(0);
    titleText.setDepth(this.depth + 1);
    titleText.setData('ui', true);

    const content = this.scene.add.container(12, 44);
    content.setScrollFactor(0);
    content.setDepth(this.depth + 1);

    container.add([bg, header, titleText, content]);

    return { container, bg, title: titleText, content };
  }

  getPanelTextStyle() {
    return {
      fontSize: '15px',
      fontFamily: 'Segoe UI',
      color: '#2d3436'
    };
  }

  createButton(label, onClick, options = {}) {
    const width = options.width || 150;
    const height = options.height || 34;
    const fill = options.fill ?? 0x0984e3;
    const alpha = options.alpha ?? 0.9;
    const textColor = options.textColor || '#ffffff';
    const pulseTarget = options.pulseTarget === undefined ? 'selection' : options.pulseTarget;

    const button = this.scene.add.container(0, 0);
    button.setSize(width, height);
    button.setScrollFactor(0);
    button.setDepth(this.depth + 1);

    const background = this.scene.add.rectangle(0, 0, width, height, fill, alpha);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, 0xffffff, 0.22);
    background.setData('ui', true);

    const text = this.scene.add.text(0, 0, label, {
      fontSize: options.fontSize || '14px',
      fontFamily: 'Segoe UI',
      color: textColor
    });
    text.setOrigin(0.5, 0.5);
    text.setScrollFactor(0);
    text.setDepth(this.depth + 2);
    text.setData('ui', true);

    button.add([background, text]);

    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    button.buttonEnabled = true;
    button.buttonBg = background;
    button.buttonText = text;
    button.buttonLabel = label;
    button.buttonWidth = width;
    button.buttonHeight = height;
    button.buttonFill = fill;
    button.buttonAlpha = alpha;
    button.setData('ui', true);

    button.on('pointerdown', (pointer) => {
      if (!button.buttonEnabled || !pointer.leftButtonDown()) return;
      onClick();
      if (pulseTarget) {
        this.pulsePanel(pulseTarget);
      }
    });

    button.on('pointerover', () => {
      if (button.buttonEnabled) {
        background.setFillStyle(fill, 1);
      }
    });

    button.on('pointerout', () => {
      if (button.buttonEnabled) {
        background.setFillStyle(fill, alpha);
      }
    });

    button.setEnabled = (enabled) => {
      button.buttonEnabled = enabled;
      if (enabled) {
        button.setAlpha(1);
        button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        background.setFillStyle(fill, alpha);
      } else {
        button.setAlpha(0.45);
        button.disableInteractive();
      }
    };

    button.setLabel = (value) => {
      button.buttonLabel = value;
      text.setText(value);
    };

    button.setFill = (color) => {
      button.buttonFill = color;
      background.setFillStyle(color, alpha);
    };

    return button;
  }

  updateCurrency() {
    if (!this.scene.player) return;
    const currency = Math.floor(this.scene.player.currency);
    this.currencyText.setText(`Баланс: ${currency} монет`);

    this.btnBuyPlot.setLabel(`Купить участок (${this.scene.player.calculatePlotCost()})`);
    this.btnUpgradeStorage.setLabel(`Улучшить склад (${this.scene.player.calculateStorageUpgradeCost()})`);
  }

  updateStorage() {
    if (!this.scene.player) return;
    const storage = this.scene.player.storage;
    this.storageSummaryText.setText(`Вместимость: ${storage.usedSlots}/${storage.capacity}`);

    const cropLines = [];
    if (storage.crops.length === 0) {
      cropLines.push('Урожай отсутствует.');
    } else {
      storage.crops.forEach((crop) => {
        const remaining = Math.max(0, Math.floor((crop.expiresAt - Date.now()) / 1000));
        cropLines.push(`• ${crop.type} — ${crop.value} монет (осталось ${remaining}s)`);
      });
    }

    if (storage.products.length > 0) {
      cropLines.push('Продукция:');
      storage.products.forEach((product) => {
        cropLines.push(`• ${product.type}: ${product.amount} x${product.value}`);
      });
    }

    this.storageContentsText.setText(cropLines.join('\n'));

    const recipe = FACTORY_RECIPES.apple;
    const applesAvailable = storage.crops.filter((crop) => crop.type === 'apple').length;
    this.processButton.setEnabled(applesAvailable >= recipe.input);
    this.processButton.setLabel(`На завод (${recipe.input})`);
  }

  updateFactoryQueue() {
    if (!this.scene.player) return;
    const { queue } = this.scene.player.factory;
    this.factoryQueueContainer.removeAll(true);

    if (queue.length === 0) {
      const emptyText = this.scene.add.text(0, 0, 'Очередь пуста — отправьте урожай на переработку.', {
        ...this.getPanelTextStyle(),
        fontSize: '13px',
        wordWrap: { width: this.factoryPanel.bg.width - 32 }
      });
      emptyText.setScrollFactor(0);
      emptyText.setDepth(this.depth + 1);
      emptyText.setData('ui', true);
      this.factoryQueueContainer.add(emptyText);
      return;
    }

    queue.forEach((job, index) => {
      const entry = this.scene.add.container(0, index * 52);
      entry.setScrollFactor(0);
      entry.setDepth(this.depth + 1);
      entry.setData('ui', true);

      const bg = this.scene.add.rectangle(0, 0, this.factoryPanel.bg.width - 36, 46, 0xffffff, 0.86);
      bg.setOrigin(0, 0);
      bg.setStrokeStyle(1, 0x6c5ce7, 0.3);
      bg.setData('ui', true);

      const title = this.scene.add.text(12, 6, `Партия ${job.id}`, {
        fontSize: '14px',
        fontFamily: 'Segoe UI',
        color: '#2d3436',
        fontStyle: 'bold'
      });
      title.setScrollFactor(0);
      title.setDepth(this.depth + 2);
      title.setData('ui', true);

      const progressPercent = Math.min(100, Math.round(job.progress * 100));
      const readyText = job.ready ? 'готово' : `${progressPercent}%`;
      const status = this.scene.add.text(12, 24, `${job.type} • ${readyText}`, {
        fontSize: '13px',
        fontFamily: 'Segoe UI',
        color: job.ready ? '#27ae60' : '#2d3436'
      });
      status.setScrollFactor(0);
      status.setDepth(this.depth + 2);
      status.setData('ui', true);

      entry.add([bg, title, status]);

      if (job.ready) {
        const collectBtn = this.createButton('Забрать', () => this.scene.handleCollectFactory(job.id), {
          width: 120,
          height: 28,
          fill: 0x27ae60,
          pulseTarget: 'factory'
        });
        collectBtn.setPosition(this.factoryPanel.bg.width - 180, 23);
        entry.add(collectBtn);
      }

      this.factoryQueueContainer.add(entry);
    });
  }

  showPlot(plot) {
    if (!plot) {
      this.selectedPlot = null;
      this.renderPlotInfo(null);
      return;
    }
    this.selectedPlot = plot;
    if (!this.selectedTree || this.selectedTree.plot !== plot) {
      this.renderTreeInfo(null);
    }
    this.renderPlotInfo(plot);
  }

  showTree(tree) {
    this.selectedTree = tree || null;
    if (tree) {
      this.selectedPlot = tree.plot;
      this.renderPlotInfo(tree.plot);
      this.renderTreeInfo(tree);
    } else {
      this.renderTreeInfo(null);
    }
  }

  renderPlotInfo(plot) {
    if (!plot) {
      this.plotInfoText.setText('Участок не выбран. Кликните по тайлу на карте.');
      this.plotActions.removeAll(true);
      return;
    }

    const infoLines = [
      `Участок ${plot.id}`,
      `Уровень: ${plot.level} (ёмкость ${plot.capacity})`,
      `Деревьев: ${plot.trees.length}`,
      `Автополив: ${plot.autoWater ? 'вкл' : 'выкл'}`,
      `Автосбор: ${plot.autoHarvest ? 'вкл' : 'выкл'}`
    ];
    this.plotInfoText.setText(infoLines.join('\n'));

    this.plotActions.removeAll(true);

    const actions = [];
    const upgradeCost = this.scene.player.calculatePlotUpgradeCost(plot);
    actions.push(
      this.createButton(`Улучшить (${upgradeCost})`, () => this.scene.handleUpgradePlot(plot))
    );
    actions.push(
      this.createButton(`Посадить (${this.scene.player.calculateTreeCost(plot)})`, () => this.scene.handleAddTree(plot))
    );
    actions.push(
      this.createButton(`Автополив: ${plot.autoWater ? 'вкл' : 'выкл'}`, () => this.scene.handleTogglePlotAuto(plot, 'water'), {
        width: 170
      })
    );
    actions.push(
      this.createButton(`Автосбор: ${plot.autoHarvest ? 'вкл' : 'выкл'}`, () => this.scene.handleTogglePlotAuto(plot, 'harvest'), {
        width: 170
      })
    );

    if (plot.trees.length >= plot.capacity) {
      actions[1].setEnabled(false);
    }

    actions.forEach((button, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      button.x = column * (button.buttonWidth + 12) + button.buttonWidth / 2;
      button.y = row * 44 + button.buttonHeight / 2;
      this.plotActions.add(button);
    });
  }

  renderTreeInfo(tree) {
    this.treeActions.removeAll(true);
    if (!tree) {
      this.treeInfoText.setText('Дерево не выбрано. Кликните по дереву.');
      return;
    }

    const ready = tree.canHarvest();
    const progress = Math.round(tree.growthProgress * 100);
    const lines = [
      `Дерево ${tree.id}`,
      `Уровень: ${tree.level}/${tree.maxLevel}`,
      ready ? 'Готово к сбору!' : `Прогресс роста: ${progress}%`,
      `Автополив: ${tree.autoWater ? 'вкл' : 'выкл'}`,
      `Автосбор: ${tree.autoHarvest ? 'вкл' : 'выкл'}`
    ];
    this.treeInfoText.setText(lines.join('\n'));

    const actions = [];
    const harvestButton = this.createButton('Собрать урожай', () => this.scene.handleHarvestTree(tree));
    harvestButton.setEnabled(ready);
    actions.push(harvestButton);

    actions.push(
      this.createButton(`Автополив: ${tree.autoWater ? 'вкл' : 'выкл'}`, () => this.scene.handleToggleTreeAuto(tree, 'water'), {
        width: 180
      })
    );
    actions.push(
      this.createButton(`Автосбор: ${tree.autoHarvest ? 'вкл' : 'выкл'}`, () => this.scene.handleToggleTreeAuto(tree, 'harvest'), {
        width: 180
      })
    );

    actions.forEach((button, index) => {
      button.x = index * (button.buttonWidth + 12) + button.buttonWidth / 2;
      button.y = button.buttonHeight / 2;
      this.treeActions.add(button);
    });
  }

  showSettings(visible) {
    this.settingsOverlay.setVisible(visible);
    if (visible) {
      this.settingsDim.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, this.settingsDim.displayWidth, this.settingsDim.displayHeight),
        Phaser.Geom.Rectangle.Contains
      );
      this.updateSettingsView();
    } else {
      this.settingsDim.disableInteractive();
    }
  }

  updateSettingsView() {
    if (!this.scene.player) return;
    const debugEnabled = !!this.scene.player.settings.debug;
    this.debugToggleButton.setLabel(`Debug Mode: ${debugEnabled ? 'Вкл' : 'Выкл'}`);
    const color = debugEnabled ? 0x27ae60 : 0x6c5ce7;
    this.debugToggleButton.buttonBg.setFillStyle(color, this.debugToggleButton.buttonAlpha);
  }

  showToast(message) {
    this.toastText.setText(message);
    const width = Math.max(220, this.toastText.width + 48);
    this.toastBackground.setDisplaySize(width, 48);
    this.toastContainer.setVisible(true);
    this.toastContainer.setAlpha(1);

    if (this.toastEvent) {
      this.toastEvent.remove();
    }

    this.toastEvent = this.scene.time.addEvent({
      delay: 2200,
      callback: () => {
        this.scene.tweens.add({
          targets: this.toastContainer,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            this.toastContainer.setVisible(false);
          }
        });
      }
    });
  }

  clearSelection() {
    this.selectedPlot = null;
    this.selectedTree = null;
    this.plotInfoText.setText('Участок не выбран.');
    this.plotActions.removeAll(true);
    this.treeInfoText.setText('Дерево не выбрано.');
    this.treeActions.removeAll(true);
  }

  pulsePanel(key) {
    const bg = this.panelBackgrounds[key];
    if (!bg) return;
    this.scene.tweens.killTweensOf(bg);
    bg.setAlpha(PANEL_ALPHA);
    this.scene.tweens.add({
      targets: bg,
      alpha: PANEL_ALPHA - 0.25,
      duration: 120,
      ease: 'Sine.easeOut',
      yoyo: true,
      repeat: 1
    });
  }

  flashStoragePanel() {
    this.pulsePanel('storage');
  }

  flashFactoryPanel() {
    this.pulsePanel('factory');
  }

  flashSelectionPanel() {
    this.pulsePanel('selection');
  }

  update(delta) {
    if (!this.scene.player) return;
    this.storageRefresh += delta;
    this.factoryRefresh += delta;

    if (this.storageRefresh >= 600) {
      this.storageRefresh = 0;
      this.updateStorage();
    }

    if (this.factoryRefresh >= 320) {
      this.factoryRefresh = 0;
      this.updateFactoryQueue();
    }
  }
}
