import { TREE_DATA, AUTO_COSTS } from '../gameConfig.js';

const AUTO_INTERVAL = 6 * 60 * 1000;
const PROGRESS_WIDTH = 60;
const PROGRESS_HEIGHT = 6;

export class Tree {
  constructor(scene, plot, data) {
    this.scene = scene;
    this.plot = plot;
    this.id = data.id;
    this.level = data.level ?? 0;
    this.growthProgress = Phaser.Math.Clamp(data.growthProgress ?? 0, 0, 1);
    this.isMature = data.isMature ?? this.growthProgress >= 1;
    this.autoWater = data.autoWater || false;
    this.autoHarvest = data.autoHarvest || false;
    this.lastAutoCharge = data.lastAutoCharge || Date.now();
    this.sprite = null;
    this.label = null;
    this.progressBar = null;
    this.createSprite();
  }

  createSprite() {
    if (this.sprite) {
      this.sprite.destroy();
    }
    if (this.label) {
      this.label.destroy();
    }
    if (this.progressBar) {
      this.progressBar.destroy();
    }
    const position = this.plot.getTreeIsoPosition(this);
    const stageTexture = this.getTextureKey();
    this.sprite = this.scene.add.image(position.x, position.y, stageTexture);
    this.sprite.setDepth(position.y);
    this.sprite.setData('tree', this);
    this.sprite.setData('ui', false);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      this.scene.ui?.flashSelectionPanel();
      this.scene.events.emit('tree:selected', this);
    });
    this.sprite.on('pointerover', () => {
      this.sprite.setScale(1.05);
    });
    this.sprite.on('pointerout', () => {
      this.sprite.setScale(1);
    });

    this.label = this.scene.add.text(position.x, position.y - 62, this.getLabelText(), {
      fontSize: '12px',
      fontFamily: 'Segoe UI',
      color: '#e2e8f0'
    });
    this.label.setOrigin(0.5, 1);
    this.label.setBackgroundColor('rgba(15,23,42,0.82)');
    this.label.setPadding(8, 4);
    this.label.setDepth(position.y + 45);
    this.label.setData('ui', false);

    this.progressBar = this.scene.add.graphics();
    this.progressBar.setDepth(position.y + 30);
    this.progressBar.setData('ui', false);
    this.drawProgressBar();
  }

  getTextureKey() {
    const stage = Phaser.Math.Clamp(this.level, 0, TREE_DATA.levels.length - 1);
    return `tree-stage-${stage}`;
  }

  getLabelText() {
    const autoIcons = `${this.autoWater || this.plot.autoWater ? '💧' : ''}${
      this.autoHarvest || this.plot.autoHarvest ? '🧺' : ''
    }`;
    if (!this.isMature) {
      const progress = Math.round(this.growthProgress * 100);
      const stageName = this.level <= 0 ? 'Семечко' : `L${this.level}`;
      return `${stageName}: ${progress}%${autoIcons ? ` ${autoIcons}` : ''}`;
    }
    return `Урожай готов! L${Math.max(1, this.level)}${autoIcons ? ` ${autoIcons}` : ''}`;
  }

  get maxLevel() {
    return TREE_DATA.maxLevel;
  }

  get isMaxed() {
    return this.level >= this.maxLevel;
  }

  getCurrentStageDuration() {
    const index = Phaser.Math.Clamp(this.level, 0, TREE_DATA.levels.length - 1);
    const data = TREE_DATA.levels[index];
    return (data?.growthSeconds || 60) * 1000;
  }

  update(delta) {
    const now = Date.now();
    this.chargeAuto(now);
    if (this.isMature) {
      if (this.autoHarvest || this.plot.autoHarvest) {
        this.harvest();
      }
      this.refreshVisuals();
      return;
    }

    let duration = this.getCurrentStageDuration();
    if (this.autoWater || this.plot.autoWater) {
      duration *= 1 - TREE_DATA.autoWaterBoost;
    }
    this.growthProgress = Phaser.Math.Clamp(this.growthProgress + delta / duration, 0, 1);

    if (this.growthProgress >= 1) {
      this.growthProgress = 1;
      if (this.level === 0) {
        this.level = 1;
        this.isMature = true;
        this.refreshVisuals(true);
      } else {
        this.isMature = true;
        this.refreshVisuals();
      }
      this.scene.events.emit('tree:ready', this);
      return;
    }

    this.refreshVisuals();
  }

  chargeAuto(now) {
    const autoHarvest = this.autoHarvest || this.plot.autoHarvest;
    const autoWater = this.autoWater || this.plot.autoWater;
    if (!autoHarvest && !autoWater) {
      return;
    }
    if (now - this.lastAutoCharge >= AUTO_INTERVAL) {
      const cycles = Math.floor((now - this.lastAutoCharge) / AUTO_INTERVAL);
      const totalCost = (autoWater ? AUTO_COSTS.water : 0) + (autoHarvest ? AUTO_COSTS.harvest : 0);
      const amount = totalCost * cycles;
      if (this.scene.player.currency >= amount) {
        this.scene.player.currency -= amount;
        this.lastAutoCharge += AUTO_INTERVAL * cycles;
        this.scene.events.emit('economy:changed');
      } else {
        // disable auto modes when player cannot pay
        if (this.autoWater) this.autoWater = false;
        if (this.autoHarvest) this.autoHarvest = false;
        this.plot.autoHarvest = false;
        this.plot.autoWater = false;
        this.plot.refreshBadge();
        this.scene.events.emit('plot:selected', this.plot);
      }
    }
  }

  canHarvest() {
    return this.isMature && this.level > 0;
  }

  harvest() {
    if (!this.canHarvest()) {
      return null;
    }
    const data = TREE_DATA.levels[Math.min(this.level, TREE_DATA.levels.length - 1)];
    const cropType = 'apple';
    const yieldAmount = data.yield;
    const valuePerUnit = data.value;
    if (!this.plot.scene.player.storage.hasSpace(yieldAmount)) {
      this.scene.events.emit('ui:toast', 'Склад переполнен!');
      return null;
    }
    this.plot.scene.player.storage.addCrop(cropType, yieldAmount, valuePerUnit);
    this.scene.events.emit('storage:changed');
    this.isMature = false;
    this.growthProgress = 0;
    this.refreshVisuals(true);
    this.scene.events.emit('tree:selected', this);
    return {
      type: cropType,
      amount: yieldAmount,
      value: valuePerUnit
    };
  }

  upgrade() {
    if (this.level >= this.maxLevel) {
      return false;
    }
    this.level += 1;
    this.refreshVisuals(true);
    this.scene.events.emit('tree:upgraded', this);
    return true;
  }

  refreshVisuals(recreate = false) {
    if (recreate) {
      this.createSprite();
      return;
    }
    if (this.label) {
      this.label.setText(this.getLabelText());
    }
    this.drawProgressBar();
  }

  drawProgressBar() {
    if (!this.progressBar) {
      return;
    }
    const position = this.plot.getTreeIsoPosition(this);
    this.progressBar.clear();
    this.progressBar.fillStyle(0x2d3436, 0.55);
    this.progressBar.fillRoundedRect(position.x - PROGRESS_WIDTH / 2, position.y + 28, PROGRESS_WIDTH, PROGRESS_HEIGHT, 3);
    const color = this.isMature ? 0xfacc15 : 0x38bdf8;
    const width = PROGRESS_WIDTH * (this.isMature ? 1 : this.growthProgress);
    this.progressBar.fillStyle(color, 0.95);
    this.progressBar.fillRoundedRect(
      position.x - PROGRESS_WIDTH / 2 + 1,
      position.y + 28 + 1,
      Math.max(0, width - 2),
      PROGRESS_HEIGHT - 2,
      3
    );
  }

  toJSON() {
    return {
      id: this.id,
      level: this.level,
      growthProgress: this.growthProgress,
      isMature: this.isMature,
      autoWater: this.autoWater,
      autoHarvest: this.autoHarvest,
      lastAutoCharge: this.lastAutoCharge
    };
  }
}
