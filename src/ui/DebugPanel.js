export class DebugPanel {
  constructor(scene) {
    this.scene = scene;
    this.root = document.createElement('div');
    this.root.id = 'debug-panel';
    this.root.innerHTML = `
      <h4>Debug</h4>
      <div id="debug-fps">FPS: 0</div>
      <div id="debug-economy"></div>
      <div id="debug-storage"></div>
      <div id="debug-plots"></div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button id="debug-money">+500 монет</button>
        <button id="debug-fast">Fast Forward</button>
      </div>
    `;
    document.body.appendChild(this.root);

    this.root.querySelector('#debug-money').addEventListener('click', () => {
      this.scene.player.currency += 500;
      this.scene.events.emit('economy:changed');
    });
    this.root.querySelector('#debug-fast').addEventListener('click', () => {
      this.scene.debugFastForward();
    });
  }

  setVisible(visible) {
    this.root.style.display = visible ? 'block' : 'none';
  }

  update() {
    if (this.root.style.display !== 'block') {
      return;
    }
    const fps = Math.round(this.scene.game.loop.actualFps);
    this.root.querySelector('#debug-fps').textContent = `FPS: ${fps}`;
    this.root.querySelector('#debug-economy').textContent = `Баланс: ${Math.floor(
      this.scene.player.currency
    )}`;

    const storage = this.scene.player.storage;
    const storageLines = [`Склад ${storage.level}: ${storage.usedSlots}/${storage.capacity}`];
    storage.crops.forEach((crop) => {
      storageLines.push(
        `- Урожай ${crop.type} (${crop.value}) осталось ${Math.max(
          0,
          Math.floor((crop.expiresAt - Date.now()) / 1000)
        )}s`
      );
    });
    storage.products.forEach((product) => {
      storageLines.push(`- Продукт ${product.type}: ${product.amount} x${product.value}`);
    });
    this.root.querySelector('#debug-storage').innerHTML = storageLines.join('<br />');

    const plotLines = this.scene.player.plots.map((plot) => {
      const treeLines = plot.trees
        .map((tree) => `-- ${tree.id} L${tree.level} ${(tree.growthProgress * 100).toFixed(0)}%`)
        .join('<br />');
      return `Участок ${plot.id} L${plot.level} (${plot.trees.length}/${plot.capacity})<br />${treeLines}`;
    });
    this.root.querySelector('#debug-plots').innerHTML = plotLines.join('<br /><br />');
  }
}
