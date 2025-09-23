import { Plot } from './Plot.js';
import { Storage } from './Storage.js';
import { Factory } from './Factory.js';

let plotCounter = 0;

export class Player {
  constructor(scene, data) {
    this.scene = scene;
    this.currency = data.currency || 0;
    this.plots = [];
    this.storage = new Storage(scene, data.storage || {});
    this.factory = new Factory(scene, data.factory || {});
    this.settings = data.settings || {};

    (data.plots || []).forEach((plotData) => {
      const numeric = parseInt(plotData.id?.split('-')[1], 10);
      if (Number.isFinite(numeric) && numeric > plotCounter) {
        plotCounter = numeric;
      }
      this.addPlot(plotData);
    });
  }

  addPlot(plotData) {
    const plot = new Plot(this.scene, plotData);
    this.plots.push(plot);
    return plot;
  }

  purchasePlot(position) {
    plotCounter += 1;
    const id = `plot-${plotCounter}`;
    const plot = this.addPlot({
      id,
      level: 1,
      position,
      trees: []
    });
    this.scene.events.emit('plot:added', plot);
    return plot;
  }

  upgradeStorage() {
    this.storage.upgrade();
    this.scene.events.emit('storage:changed');
  }

  update(delta) {
    this.plots.forEach((plot) => plot.update(delta));
    this.factory.update(delta);
    const removed = this.storage.purgeSpoiled();
    if (removed > 0) {
      this.scene.events.emit('storage:changed');
    }
  }

  toJSON() {
    return {
      currency: this.currency,
      plots: this.plots.map((plot) => plot.toJSON()),
      storage: this.storage.toJSON(),
      factory: this.factory.toJSON(),
      settings: this.settings
    };
  }

  findPlotById(id) {
    return this.plots.find((plot) => plot.id === id);
  }

  get maxPlots() {
    return 6;
  }

  get availablePlotSlots() {
    return this.maxPlots - this.plots.length;
  }

  calculatePlotCost() {
    return 150 + this.plots.length * 75;
  }

  calculateTreeCost(plot) {
    const base = 50;
    return base + plot.trees.length * 25;
  }

  calculatePlotUpgradeCost(plot) {
    return 100 * plot.level;
  }

  calculateStorageUpgradeCost() {
    return 120 * this.storage.level;
  }

  toggleDebugMode(value) {
    this.settings.debug = value;
  }
}
