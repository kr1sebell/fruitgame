import { TREE_DATA, AUTO_COSTS } from '../gameConfig.js';

const AUTO_INTERVAL = 5 * 60 * 1000; // 5 real minutes ~ in-game day

export class Tree {
  constructor(scene, plot, data) {
    this.scene = scene;
    this.plot = plot;
    this.id = data.id;
    this.level = data.level ?? 0;
    this.growthProgress = data.growthProgress ?? 0;
    this.autoWater = data.autoWater || false;
    this.autoHarvest = data.autoHarvest || false;
    this.lastAutoCharge = data.lastAutoCharge || Date.now();
    this.sprite = null;
    this.createSprite();
  }

  createSprite() {
    if (this.sprite) {
      this.sprite.destroy();
    }
    const position = this.plot.getTreeIsoPosition(this);
    const stageTexture = `tree-stage-${this.level}`;
    this.sprite = this.scene.add.image(position.x, position.y, stageTexture);
    this.sprite.setDepth(position.y);
    this.sprite.setData('tree', this);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => {
      this.scene.events.emit('tree:selected', this);
    });
  }

  get maxLevel() {
    return TREE_DATA.maxLevel;
  }

  get isMaxed() {
    return this.level >= this.maxLevel;
  }

  getCurrentStageDuration() {
    const base = TREE_DATA.baseGrowthSeconds * 1000;
    const multiplier = 1 + this.level * 0.4;
    return base * multiplier;
  }

  update(delta) {
    const now = Date.now();
    this.chargeAuto(now);
    if (this.level >= this.maxLevel) {
      if (this.autoHarvest || this.plot.autoHarvest) {
        this.harvest();
      }
      return;
    }
    let duration = this.getCurrentStageDuration();
    const autoWater = this.autoWater || this.plot.autoWater;
    if (autoWater) {
      duration *= 0.7;
    }
    this.growthProgress += delta / duration;
    if (this.growthProgress >= 1) {
      this.level += 1;
      this.growthProgress = 0;
      this.createSprite();
      this.scene.events.emit('tree:leveled', this);
    }

    const shouldAutoHarvest = this.autoHarvest || this.plot.autoHarvest;
    if (shouldAutoHarvest && this.canHarvest() && this.growthProgress >= 0.85) {
      this.harvest();
    }
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
        this.scene.events.emit('plot:selected', this.plot);
      }
    }
  }

  canHarvest() {
    return this.level > 0;
  }

  harvest() {
    if (!this.canHarvest()) {
      return null;
    }
    const data = TREE_DATA.levels[Math.min(this.level, TREE_DATA.levels.length - 1)];
    const cropType = 'apple';
    const yieldAmount = data.yield;
    const valuePerUnit = data.value;
    this.level = Math.max(1, this.level);
    if (!this.plot.scene.player.storage.hasSpace(yieldAmount)) {
      this.scene.events.emit('ui:toast', 'Склад переполнен!');
      return null;
    }
    this.plot.scene.player.storage.addCrop(cropType, yieldAmount, valuePerUnit);
    this.scene.events.emit('storage:changed');
    if (this.autoHarvest || this.plot.autoHarvest) {
      // After auto harvest, tree loses one level but keeps some progress to simulate regrowth
      this.level = Math.max(1, this.level - 1);
    } else {
      this.level = 1; // reset to level 1 when manually harvested
    }
    this.growthProgress = 0;
    this.createSprite();
    this.scene.events.emit('tree:selected', this);
    return {
      type: cropType,
      amount: yieldAmount,
      value: valuePerUnit
    };
  }

  toJSON() {
    return {
      id: this.id,
      level: this.level,
      growthProgress: this.growthProgress,
      autoWater: this.autoWater,
      autoHarvest: this.autoHarvest,
      lastAutoCharge: this.lastAutoCharge
    };
  }
}
