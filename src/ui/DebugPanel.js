const PANEL_ALPHA = 0.72;

export class DebugPanel {
  constructor(scene) {
    this.scene = scene;
    this.width = 280;
    this.visible = false;

    this.container = scene.add.container(scene.scale.width - this.width - 16, 16);
    this.container.setScrollFactor(0);
    this.container.setDepth(1500);
    this.container.setVisible(false);

    this.background = scene.add.rectangle(0, 0, this.width, 420, 0x000000, PANEL_ALPHA);
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(1, 0xffffff, 0.12);
    this.background.setData('ui', true);

    this.titleText = scene.add.text(12, 12, 'DEBUG MODE', {
      fontSize: '16px',
      fontFamily: 'Segoe UI',
      color: '#f5f6fa',
      fontStyle: 'bold'
    });
    this.titleText.setScrollFactor(0);
    this.titleText.setDepth(1501);
    this.titleText.setData('ui', true);

    this.fpsText = scene.add.text(12, 40, 'FPS: 0', this.getTextStyle('#dfe6e9'));
    this.economyText = scene.add.text(12, 60, '', this.getTextStyle('#dfe6e9'));
    this.storageText = scene.add.text(12, 92, '', {
      ...this.getTextStyle('#b2bec3'),
      wordWrap: { width: this.width - 24 }
    });
    this.objectsText = scene.add.text(12, 200, '', {
      ...this.getTextStyle('#b2bec3'),
      wordWrap: { width: this.width - 24 }
    });

    [this.fpsText, this.economyText, this.storageText, this.objectsText].forEach((text) => {
      text.setScrollFactor(0);
      text.setDepth(1501);
      text.setData('ui', true);
    });

    this.buttonsContainer = scene.add.container(12, 340);
    this.buttonsContainer.setScrollFactor(0);
    this.buttonsContainer.setDepth(1502);

    this.moneyButton = this.createButton('+500 монет', () => {
      this.scene.player.currency += 500;
      this.scene.events.emit('economy:changed');
    });
    this.fastButton = this.createButton('Fast forward', () => this.scene.debugFastForward(), 130);

    this.fastButton.x = this.moneyButton.buttonWidth + 16;
    this.buttonsContainer.add([this.moneyButton, this.fastButton]);

    this.container.add([
      this.background,
      this.titleText,
      this.fpsText,
      this.economyText,
      this.storageText,
      this.objectsText,
      this.buttonsContainer
    ]);

    this.scene.scale.on('resize', this.handleResize, this);
  }

  getTextStyle(color) {
    return {
      fontSize: '13px',
      fontFamily: 'Segoe UI',
      color
    };
  }

  handleResize(gameSize) {
    this.container.x = gameSize.width - this.width - 16;
  }

  createButton(label, callback, width = 120) {
    const button = this.scene.add.container(0, 0);
    button.setScrollFactor(0);
    button.setDepth(1502);
    button.setSize(width, 28);

    const bg = this.scene.add.rectangle(0, 0, width, 28, 0x6c5ce7, 0.85);
    bg.setOrigin(0, 0);
    bg.setData('ui', true);

    const text = this.scene.add.text(width / 2, 14, label, {
      fontSize: '13px',
      fontFamily: 'Segoe UI',
      color: '#ffffff'
    });
    text.setOrigin(0.5, 0.5);
    text.setScrollFactor(0);
    text.setDepth(1503);
    text.setData('ui', true);

    button.add([bg, text]);
    button.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, 28), Phaser.Geom.Rectangle.Contains);
    if (button.input) {
      button.input.cursor = 'pointer';
    }
    button.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      callback();
    });
    button.on('pointerover', () => bg.setFillStyle(0x8c7ae6, 0.95));
    button.on('pointerout', () => bg.setFillStyle(0x6c5ce7, 0.85));

    button.buttonWidth = width;
    return button;
  }

  setVisible(flag) {
    this.visible = flag;
    this.container.setVisible(flag);
  }

  update() {
    if (!this.visible) {
      return;
    }
    const fps = Math.round(this.scene.game.loop.actualFps || 0);
    this.fpsText.setText(`FPS: ${fps}`);
    this.economyText.setText(`Баланс: ${Math.floor(this.scene.player.currency)} монет`);

    const storage = this.scene.player.storage;
    const cropLines = storage.crops.map((crop) => {
      const remaining = Math.max(0, Math.floor((crop.expiresAt - Date.now()) / 1000));
      return `• ${crop.type} (${crop.value}) — ${remaining}s`;
    });
    const productLines = storage.products.map((product) => `• ${product.type}: ${product.amount} x${product.value}`);
    const storageLines = [`Склад ${storage.level}: ${storage.usedSlots}/${storage.capacity}`];
    if (cropLines.length === 0) {
      storageLines.push('  урожая нет');
    } else {
      storageLines.push(...cropLines);
    }
    if (productLines.length > 0) {
      storageLines.push('Продукция:');
      storageLines.push(...productLines);
    }
    this.storageText.setText(storageLines.join('\n'));

    const plotLines = this.scene.player.plots.map((plot) => {
      const autoFlags = [];
      if (plot.autoWater) autoFlags.push('💧');
      if (plot.autoHarvest) autoFlags.push('🧺');
      const plotHeader = `Участок ${plot.id} L${plot.level} (${plot.trees.length}/${plot.capacity})${
        autoFlags.length ? ` ${autoFlags.join(' ')}` : ''
      }`;
      const trees = plot.trees
        .map((tree) => {
          const treeFlags = `${tree.autoWater || plot.autoWater ? '💧' : ''}${
            tree.autoHarvest || plot.autoHarvest ? '🧺' : ''
          }`;
          const flags = treeFlags ? ` ${treeFlags}` : '';
          return `    ${tree.id}: L${tree.level} ${(tree.growthProgress * 100).toFixed(0)}%${flags}`;
        })
        .join('\n');
      return trees ? `${plotHeader}\n${trees}` : plotHeader;
    });
    this.objectsText.setText(plotLines.join('\n\n'));
  }
}
