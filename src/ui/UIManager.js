export class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.root = document.getElementById('ui-root');
    this.toastTimeout = null;
    this.selectedPlot = null;
    this.selectedTree = null;

    this.buildLayout();
    this.registerEvents();
  }

  buildLayout() {
    this.root.innerHTML = '';

    this.topRow = document.createElement('div');
    this.topRow.className = 'ui-row';

    this.playerPanel = document.createElement('div');
    this.playerPanel.className = 'panel';
    this.playerPanel.innerHTML = `
      <h3>Игрок</h3>
      <div id="currency">Баланс: 0</div>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        <button id="buy-plot">Купить участок</button>
        <button id="upgrade-storage">Улучшить склад</button>
        <button id="open-settings">Настройки</button>
        <button id="sell-crops">Продать урожай</button>
      </div>
    `;

    this.storagePanel = document.createElement('div');
    this.storagePanel.className = 'panel';
    this.storagePanel.innerHTML = `
      <h3>Склад</h3>
      <div id="storage-capacity"></div>
      <table class="table" id="storage-table"></table>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button id="process-apples">На завод</button>
        <button id="sell-products">Продать продукцию</button>
      </div>
    `;

    this.topRow.appendChild(this.playerPanel);
    this.topRow.appendChild(this.storagePanel);

    this.bottomRow = document.createElement('div');
    this.bottomRow.className = 'ui-row';

    this.plotPanel = document.createElement('div');
    this.plotPanel.className = 'panel';
    this.plotPanel.innerHTML = `
      <h3>Участок</h3>
      <div id="plot-info">Выберите участок</div>
      <div id="plot-actions" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;"></div>
    `;

    this.treePanel = document.createElement('div');
    this.treePanel.className = 'panel';
    this.treePanel.innerHTML = `
      <h3>Дерево</h3>
      <div id="tree-info">Выберите дерево</div>
      <div id="tree-actions" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;"></div>
    `;

    this.factoryPanel = document.createElement('div');
    this.factoryPanel.className = 'panel';
    this.factoryPanel.innerHTML = `
      <h3>Завод</h3>
      <div id="factory-queue"></div>
    `;

    this.bottomRow.appendChild(this.plotPanel);
    this.bottomRow.appendChild(this.treePanel);
    this.bottomRow.appendChild(this.factoryPanel);

    this.root.appendChild(this.topRow);
    this.root.appendChild(this.bottomRow);

    this.settingsModal = document.createElement('div');
    this.settingsModal.style.display = 'none';
    this.settingsModal.style.position = 'absolute';
    this.settingsModal.style.left = '50%';
    this.settingsModal.style.top = '50%';
    this.settingsModal.style.transform = 'translate(-50%, -50%)';
    this.settingsModal.style.background = 'rgba(255,255,255,0.95)';
    this.settingsModal.style.padding = '16px';
    this.settingsModal.style.borderRadius = '12px';
    this.settingsModal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    this.settingsModal.style.minWidth = '240px';
    this.settingsModal.innerHTML = `
      <h3>Настройки</h3>
      <label style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <input type="checkbox" id="toggle-debug" /> Debug режим
      </label>
      <button id="close-settings">Закрыть</button>
    `;
    document.body.appendChild(this.settingsModal);

    this.toast = document.createElement('div');
    this.toast.style.position = 'absolute';
    this.toast.style.bottom = '80px';
    this.toast.style.left = '50%';
    this.toast.style.transform = 'translateX(-50%)';
    this.toast.style.padding = '12px 18px';
    this.toast.style.background = 'rgba(0, 0, 0, 0.75)';
    this.toast.style.color = '#fff';
    this.toast.style.borderRadius = '20px';
    this.toast.style.display = 'none';
    this.toast.style.zIndex = '2000';
    document.body.appendChild(this.toast);

    this.currencyEl = this.playerPanel.querySelector('#currency');
    this.capacityEl = this.storagePanel.querySelector('#storage-capacity');
    this.storageTable = this.storagePanel.querySelector('#storage-table');
    this.plotInfo = this.plotPanel.querySelector('#plot-info');
    this.plotActions = this.plotPanel.querySelector('#plot-actions');
    this.treeInfo = this.treePanel.querySelector('#tree-info');
    this.treeActions = this.treePanel.querySelector('#tree-actions');
    this.factoryQueue = this.factoryPanel.querySelector('#factory-queue');

    this.playerPanel.querySelector('#buy-plot').addEventListener('click', () => {
      this.scene.handleBuyPlot();
    });
    this.playerPanel.querySelector('#upgrade-storage').addEventListener('click', () => {
      this.scene.handleUpgradeStorage();
    });
    this.playerPanel.querySelector('#open-settings').addEventListener('click', () => {
      this.showSettings(true);
    });
    this.playerPanel.querySelector('#sell-crops').addEventListener('click', () => {
      this.scene.handleSellCrops();
    });

    this.storagePanel.querySelector('#process-apples').addEventListener('click', () => {
      this.scene.handleProcessCrops('apple');
    });
    this.storagePanel.querySelector('#sell-products').addEventListener('click', () => {
      this.scene.handleSellProducts();
    });

    this.settingsModal.querySelector('#close-settings').addEventListener('click', () => {
      this.showSettings(false);
    });
    this.settingsModal.querySelector('#toggle-debug').addEventListener('change', (e) => {
      this.scene.handleToggleDebug(e.target.checked);
    });
  }

  registerEvents() {
    const events = this.scene.events;
    events.on('economy:changed', () => this.updateCurrency());
    events.on('storage:changed', () => this.updateStorage());
    events.on('plot:selected', (plot) => this.showPlot(plot));
    events.on('tree:selected', (tree) => this.showTree(tree));
    events.on('factory:selected', (factory) => this.showFactory(factory));
    events.on('plot:changed', (plot) => {
      if (plot === this.selectedPlot) {
        this.showPlot(plot);
      }
      this.updateFactoryQueue();
    });
    events.on('plot:added', () => this.updateCurrency());
    events.on('factory:queue-changed', () => this.updateFactoryQueue());
    events.on('factory:job-ready', () => this.updateFactoryQueue());
    events.on('ui:toast', (msg) => this.showToast(msg));
  }

  updateCurrency() {
    const cost = this.scene.player.calculatePlotCost();
    const upgradeCost = this.scene.player.calculateStorageUpgradeCost();
    this.currencyEl.textContent = `Баланс: ${Math.floor(this.scene.player.currency)} монет`;
    this.playerPanel.querySelector('#buy-plot').textContent = `Купить участок (${cost})`;
    this.playerPanel.querySelector('#upgrade-storage').textContent = `Улучшить склад (${upgradeCost})`;
  }

  updateStorage() {
    const storage = this.scene.player.storage;
    this.capacityEl.textContent = `Вместимость: ${storage.usedSlots}/${storage.capacity}`;
    const rows = [];
    if (storage.crops.length === 0) {
      rows.push('<tr><td colspan="3">Урожая нет</td></tr>');
    } else {
      rows.push('<tr><th>Тип</th><th>Цена</th><th>До порчи</th></tr>');
      storage.crops.forEach((crop) => {
        const remaining = Math.max(0, Math.floor((crop.expiresAt - Date.now()) / 1000));
        rows.push(`<tr><td>${crop.type}</td><td>${crop.value}</td><td>${remaining}s</td></tr>`);
      });
    }

    if (storage.products.length > 0) {
      rows.push('<tr><th colspan="3">Продукция</th></tr>');
      storage.products.forEach((product) => {
        rows.push(`<tr><td>${product.type}</td><td>${product.value} x${product.amount}</td><td>-</td></tr>`);
      });
    }
    this.storageTable.innerHTML = rows.join('');
  }

  showPlot(plot) {
    this.selectedPlot = plot;
    this.selectedTree = null;
    this.treeInfo.textContent = 'Выберите дерево';
    this.treeActions.innerHTML = '';

    const plotCost = this.scene.player.calculatePlotUpgradeCost(plot);
    this.plotInfo.innerHTML = `
      Участок ${plot.id}<br />
      Уровень: ${plot.level} (ёмкость ${plot.capacity})<br />
      Деревьев: ${plot.trees.length}
    `;

    this.plotActions.innerHTML = '';
    const upgradeBtn = this.createButton(`Улучшить (${plotCost})`, () => this.scene.handleUpgradePlot(plot));
    const addTreeBtn = this.createButton(`Посадить дерево (${this.scene.player.calculateTreeCost(plot)})`, () => this.scene.handleAddTree(plot));
    const autoWaterBtn = this.createButton(plot.autoWater ? 'Автополив: Вкл' : 'Автополив: Выкл', () => this.scene.handleTogglePlotAuto(plot, 'water'));
    const autoHarvestBtn = this.createButton(plot.autoHarvest ? 'Автосбор: Вкл' : 'Автосбор: Выкл', () => this.scene.handleTogglePlotAuto(plot, 'harvest'));

    if (plot.level >= this.scene.player.storage.level && plot.level >= 4) {
      upgradeBtn.disabled = true;
    }
    if (plot.trees.length >= plot.capacity) {
      addTreeBtn.disabled = true;
    }

    this.plotActions.appendChild(upgradeBtn);
    this.plotActions.appendChild(addTreeBtn);
    this.plotActions.appendChild(autoWaterBtn);
    this.plotActions.appendChild(autoHarvestBtn);
  }

  showTree(tree) {
    this.selectedTree = tree;
    this.selectedPlot = tree.plot;
    const progress = Math.round(tree.growthProgress * 100);
    this.treeInfo.innerHTML = `
      Дерево ${tree.id}<br />Уровень: ${tree.level}/${tree.maxLevel}<br />Прогресс роста: ${progress}%
    `;
    this.treeActions.innerHTML = '';
    const harvestBtn = this.createButton('Собрать', () => this.scene.handleHarvestTree(tree));
    harvestBtn.disabled = !tree.canHarvest();
    const autoWaterBtn = this.createButton(tree.autoWater ? 'Автополив: Вкл' : 'Автополив: Выкл', () => this.scene.handleToggleTreeAuto(tree, 'water'));
    const autoHarvestBtn = this.createButton(tree.autoHarvest ? 'Автосбор: Вкл' : 'Автосбор: Выкл', () => this.scene.handleToggleTreeAuto(tree, 'harvest'));

    this.treeActions.appendChild(harvestBtn);
    this.treeActions.appendChild(autoWaterBtn);
    this.treeActions.appendChild(autoHarvestBtn);
    this.showPlot(tree.plot);
  }

  showFactory(factory) {
    this.updateFactoryQueue();
  }

  updateFactoryQueue() {
    const queue = this.scene.player.factory.queue;
    if (queue.length === 0) {
      this.factoryQueue.innerHTML = 'Очередь пуста';
      return;
    }
    const rows = queue
      .map(
        (job) => `
        <div style="margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            Партия ${job.id}<br />${job.type} — ${(job.progress * 100).toFixed(0)}%
            ${job.ready ? '<span class="badge">Готово</span>' : ''}
          </div>
          ${
            job.ready
              ? `<button data-job="${job.id}" class="collect-btn">Забрать</button>`
              : ''
          }
        </div>`
      )
      .join('');
    this.factoryQueue.innerHTML = rows;
    this.factoryQueue.querySelectorAll('.collect-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.scene.handleCollectFactory(btn.dataset.job);
      });
    });
  }

  showSettings(visible) {
    this.settingsModal.style.display = visible ? 'block' : 'none';
    if (visible) {
      const checkbox = this.settingsModal.querySelector('#toggle-debug');
      checkbox.checked = this.scene.player.settings.debug;
    }
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.style.display = 'block';
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.style.display = 'none';
    }, 2000);
  }

  createButton(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }
}
