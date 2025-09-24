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
    this.badgeContainer = null;
    this.badgeBackground = null;
    this.badgeText = null;
    this.badgeIcons = null;
    this.createTile();
    this.createBadge();

    (data.trees || []).forEach((treeData) => {
      this.addTree(treeData);
    });

    this.refreshBadge();
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
    this.tile.setData('plot', this);
    this.tile.setData('ui', false);
    this.tile.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      this.scene.ui?.flashSelectionPanel();
      this.scene.events.emit('plot:selected', this);
    });
    this.tile.on('pointerover', () => {
      this.tile.setTint(0xfff9c4);
    });
    this.tile.on('pointerout', () => {
      this.tile.clearTint();
    });
  }

  createBadge() {
    const iso = this.scene.toIsoPoint(this.position.x, this.position.y);
    if (this.badgeContainer) {
      this.badgeContainer.destroy(true);
    }
    this.badgeContainer = this.scene.add.container(iso.x, iso.y - 58);
    this.badgeContainer.setDepth(iso.y + 80);
    this.badgeContainer.setData('ui', false);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0f172a, 0.85);
    bg.fillRoundedRect(-58, -22, 116, 44, 18);
    bg.lineStyle(2, 0xffffff, 0.2);
    bg.strokeRoundedRect(-58, -22, 116, 44, 18);
    bg.setData('ui', false);

    const label = this.scene.add.text(0, -4, '', {
      fontSize: '14px',
      fontFamily: 'Segoe UI',
      color: '#e2e8f0',
      fontStyle: 'bold'
    });
    label.setOrigin(0.5);
    label.setData('ui', false);

    const icons = this.scene.add.text(0, 14, '', {
      fontSize: '12px',
      fontFamily: 'Segoe UI',
      color: '#bae6fd'
    });
    icons.setOrigin(0.5);
    icons.setData('ui', false);

    this.badgeContainer.add([bg, label, icons]);
    this.badgeBackground = bg;
    this.badgeText = label;
    this.badgeIcons = icons;
  }

  addTree(treeData) {
    if (this.trees.length >= this.capacity) {
      return null;
    }
    const tree = new Tree(this.scene, this, treeData);
    this.trees.push(tree);
    this.refreshBadge();
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
    this.refreshBadge();
    return tree;
  }

  upgrade() {
    if (this.level < PLOT_CAPACITY.length - 1) {
      this.level += 1;
      this.scene.events.emit('plot:changed', this);
      this.refreshBadge();
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

  refreshBadge() {
    if (!this.badgeContainer) {
      return;
    }
    const hasAuto = this.autoWater || this.autoHarvest;
    if (this.badgeBackground) {
      this.badgeBackground.clear();
      this.badgeBackground.fillStyle(hasAuto ? 0x1d4ed8 : 0x0f172a, hasAuto ? 0.88 : 0.85);
      this.badgeBackground.fillRoundedRect(-58, -22, 116, 44, 18);
      this.badgeBackground.lineStyle(2, hasAuto ? 0x38bdf8 : 0xffffff, hasAuto ? 0.4 : 0.2);
      this.badgeBackground.strokeRoundedRect(-58, -22, 116, 44, 18);
    }
    const label = `L${this.level} · ${this.trees.length}/${this.capacity}`;
    this.badgeText?.setText(label);
    const icons = `${this.autoWater ? '💧' : ''}${this.autoHarvest ? '🧺' : ''}`;
    this.badgeIcons?.setText(icons);
    this.badgeIcons?.setVisible(Boolean(icons));
  }
}
