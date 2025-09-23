import { PLOT_CAPACITY } from '../gameConfig.js';
import { Tree } from './Tree.js';

export class Plot {
  constructor(scene, data) {
    this.scene = scene;
    this.id = data.id;
    this.level = data.level || 1;
    this.position = data.position;
    this.autoWater = data.autoWater || false;
    this.autoHarvest = data.autoHarvest || false;
    this.lastAutoCharge = data.lastAutoCharge || Date.now();
    this.trees = [];

    this.tile = null;
    this.createTile();

    (data.trees || []).forEach((treeData) => {
      this.addTree(treeData);
    });
  }

  get capacity() {
    return PLOT_CAPACITY[this.level] || PLOT_CAPACITY.at(-1);
  }

  createTile() {
    const iso = this.scene.toIsoPoint(this.position.x, this.position.y);
    if (this.tile) {
      this.tile.destroy();
    }
    this.tile = this.scene.add.image(iso.x, iso.y, 'plot-tile');
    this.tile.setDepth(iso.y - 10);
    this.tile.setInteractive({ useHandCursor: true });
    this.tile.on('pointerdown', () => {
      this.scene.events.emit('plot:selected', this);
    });
  }

  addTree(treeData) {
    if (this.trees.length >= this.capacity) {
      return null;
    }
    const tree = new Tree(this.scene, this, treeData);
    this.trees.push(tree);
    return tree;
  }

  purchaseTree() {
    const id = `${this.id}-tree-${this.trees.length + 1}`;
    const tree = this.addTree({
      id,
      level: 0,
      growthProgress: 0,
      autoHarvest: this.autoHarvest,
      autoWater: this.autoWater,
      lastAutoCharge: Date.now()
    });
    if (tree) {
      this.scene.events.emit('plot:changed', this);
    }
    return tree;
  }

  upgrade() {
    if (this.level < PLOT_CAPACITY.length - 1) {
      this.level += 1;
      this.scene.events.emit('plot:changed', this);
    }
  }

  update(delta) {
    this.trees.forEach((tree) => tree.update(delta));
  }

  getTreeIsoPosition(tree) {
    const index = this.trees.indexOf(tree);
    const iso = this.scene.toIsoPoint(this.position.x, this.position.y);
    const offsets = [
      { x: 0, y: -16 },
      { x: 24, y: -4 },
      { x: -24, y: -4 },
      { x: 16, y: 20 },
      { x: -16, y: 20 },
      { x: 0, y: 36 }
    ];
    const offset = offsets[index] || { x: 0, y: 0 };
    return {
      x: iso.x + offset.x,
      y: iso.y + offset.y
    };
  }

  toJSON() {
    return {
      id: this.id,
      level: this.level,
      position: this.position,
      autoWater: this.autoWater,
      autoHarvest: this.autoHarvest,
      lastAutoCharge: this.lastAutoCharge,
      trees: this.trees.map((tree) => tree.toJSON())
    };
  }
}
