import { formatCurrency, formatDuration, CONFIG } from './config.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.currentView = 'overview';
    this.root = document.body;
    this.toastTimer = null;
    this.references = {
      navLinks: Array.from(document.querySelectorAll('[data-view]')),
      panels: Array.from(document.querySelectorAll('[data-view-panel]')),
      toast: document.querySelector('[data-bind="toast"]'),
      warehouseList: document.querySelector('[data-bind="warehouseItems"]'),
      plotsList: document.querySelector('[data-bind="plots"]'),
    };
    this.templates = {
      warehouseItem: document.getElementById('warehouse-item-template'),
      plotCard: document.getElementById('plot-card-template'),
      treeCard: document.getElementById('tree-card-template'),
    };
  }

  init() {
    this.bindNavigation();
    this.bindActions();
    this.switchView(this.currentView);
    this.game.onChange((state) => this.render(state));
    this.render(this.game.getState());
  }

  bindNavigation() {
    this.root.addEventListener('click', (event) => {
      const target = event.target.closest('[data-view]');
      if (target) {
        event.preventDefault();
        this.switchView(target.dataset.view);
      }
    });
  }

  bindActions() {
    this.root.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      switch (action) {
        case 'openPlots':
          this.switchView('plots');
          break;
        case 'openWarehouse':
          this.switchView('warehouse');
          break;
        case 'upgradeWarehouse':
          this.game.upgradeWarehouse();
          break;
        case 'buyPlot':
          this.game.buyPlot();
          break;
        case 'upgradePlot':
          this.game.upgradePlot(target.closest('[data-plot-id]')?.dataset.plotId);
          break;
        case 'plantTree':
          this.game.plantTree(target.closest('[data-plot-id]')?.dataset.plotId);
          break;
        case 'togglePlotAutoWater':
          this.game.togglePlotAutomation(
            target.closest('[data-plot-id]')?.dataset.plotId,
            'water'
          );
          break;
        case 'togglePlotAutoHarvest':
          this.game.togglePlotAutomation(
            target.closest('[data-plot-id]')?.dataset.plotId,
            'harvest'
          );
          break;
        case 'toggleTreeAutoWater':
          this.game.toggleTreeAutomation(target.closest('[data-tree-id]')?.dataset.treeId, 'water');
          break;
        case 'toggleTreeAutoHarvest':
          this.game.toggleTreeAutomation(target.closest('[data-tree-id]')?.dataset.treeId, 'harvest');
          break;
        case 'waterTree':
          if (!target.disabled) {
            this.game.waterTree(target.closest('[data-tree-id]')?.dataset.treeId);
          }
          break;
        case 'harvestTree':
          if (!target.disabled) {
            this.game.harvestTree(target.closest('[data-tree-id]')?.dataset.treeId);
          }
          break;
        case 'upgradeTree':
          this.game.upgradeTree(target.closest('[data-tree-id]')?.dataset.treeId);
          break;
        case 'sell':
          this.game.sellItem(target.closest('[data-item-id]')?.dataset.itemId);
          break;
        case 'process':
          this.game.processItem(target.closest('[data-item-id]')?.dataset.itemId);
          break;
        default:
          break;
      }
    });
  }

  switchView(view) {
    if (!view) return;
    this.currentView = view;
    this.references.navLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.view === view);
    });
    this.references.panels.forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== view;
    });
  }

  render(state) {
    if (!state) return;
    this.updateHeader(state);
    this.renderWarehouse(state);
    this.renderPlots(state);
    this.updateProfile(state);
    this.updateButtons(state);
    this.showMessages(state.messages);
  }

  updateHeader(state) {
    const bindings = document.querySelectorAll('[data-bind="balance"]');
    bindings.forEach((node) => {
      node.textContent = formatCurrency(state.player.balance);
    });
    const treeCounts = document.querySelectorAll('[data-bind="treeCount"]');
    treeCounts.forEach((node) => {
      node.textContent = state.totals.treeCount;
    });
    const plotCounts = document.querySelectorAll('[data-bind="plotCount"]');
    plotCounts.forEach((node) => {
      node.textContent = state.totals.plotCount;
    });
    const warehouseCapacity = document.querySelectorAll('[data-bind="warehouseCapacity"]');
    warehouseCapacity.forEach((node) => {
      node.textContent = state.warehouse.capacity;
    });
    const warehouseUsage = document.querySelector('[data-bind="warehouseUsage"]');
    if (warehouseUsage) {
      warehouseUsage.textContent = state.warehouse.used;
    }
    const warehouseLevel = document.querySelector('[data-bind="warehouseLevel"]');
    if (warehouseLevel) {
      warehouseLevel.textContent = state.warehouse.level;
    }
  }

  renderWarehouse(state) {
    const list = this.references.warehouseList;
    if (!list) return;
    list.innerHTML = '';
    const hint = document.querySelector('[data-bind="warehouseHint"]');
    if (!state.warehouse.items.length) {
      if (hint) {
        hint.textContent = 'Склад пуст — соберите урожай или переработайте продукцию.';
      }
      return;
    }
    if (hint) {
      hint.textContent = 'Следите за сроками годности — просроченные партии удаляются автоматически.';
    }
    state.warehouse.items.forEach((item) => {
      const element = this.templates.warehouseItem.content.firstElementChild.cloneNode(true);
      element.dataset.itemId = item.id;
      element.querySelector('[data-field="title"]').textContent = item.name;
      element.querySelector('[data-field="quantity"]').textContent = `${item.quantity} ед.`;
      const bar = element.querySelector('[data-field="expiryBar"] .expiry-fill');
      bar.style.width = `${Math.max(0, Math.min(100, item.percent))}%`;
      if (item.remaining <= 0) {
        element.querySelector('[data-field="expiryText"]').textContent = 'Партия испорчена';
      } else {
        element.querySelector('[data-field="expiryText"]').textContent = `Осталось: ${formatDuration(
          item.remaining
        )}`;
      }
      const produceInfo = CONFIG.produce[item.type];
      const processButton = element.querySelector('[data-action="process"]');
      if (!produceInfo?.process) {
        processButton.disabled = true;
        processButton.textContent = 'Недоступно';
      }
      if (item.remaining <= 0) {
        element.querySelectorAll('button').forEach((btn) => (btn.disabled = true));
      }
      list.appendChild(element);
    });
  }

  renderPlots(state) {
    const container = this.references.plotsList;
    if (!container) return;
    container.innerHTML = '';
    state.plots.forEach((plot, index) => {
      const card = this.templates.plotCard.content.firstElementChild.cloneNode(true);
      card.dataset.plotId = plot.id;
      card.querySelector('[data-field="title"]').textContent = `Участок ${index + 1} · ур. ${plot.level}`;
      card.querySelector('[data-field="capacity"]').textContent = `Вместимость: ${plot.used}/${plot.capacity}`;
      const treesHost = card.querySelector('[data-field="trees"]');
      const upgradeBtn = card.querySelector('[data-action="upgradePlot"]');
      upgradeBtn.textContent = `Улучшить участок · ${formatCurrency(plot.upgradeCost)}`;
      upgradeBtn.disabled = state.player.balance < plot.upgradeCost;
      const plantBtn = card.querySelector('[data-action="plantTree"]');
      const plantCost = Math.round(CONFIG.tree.baseCost * (1 + 0.15 * plot.used));
      plantBtn.textContent = `Посадить дерево · ${formatCurrency(plantCost)}`;
      plantBtn.disabled = plot.used >= plot.capacity || state.player.balance < plantCost;
      const autoWaterBtn = card.querySelector('[data-action="togglePlotAutoWater"]');
      const autoHarvestBtn = card.querySelector('[data-action="togglePlotAutoHarvest"]');
      autoWaterBtn.classList.toggle('active', !!plot.autoWater);
      autoHarvestBtn.classList.toggle('active', !!plot.autoHarvest);
      autoWaterBtn.setAttribute('aria-pressed', plot.autoWater ? 'true' : 'false');
      autoHarvestBtn.setAttribute('aria-pressed', plot.autoHarvest ? 'true' : 'false');
      autoWaterBtn.title = `Автополив участка · ${formatCurrency(CONFIG.automationCosts.plotWater)}/день`;
      autoHarvestBtn.title = `Автосбор участка · ${formatCurrency(CONFIG.automationCosts.plotHarvest)}/день`;
      if (!plot.trees.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'Посадите дерево, чтобы участок начал работать.';
        treesHost.appendChild(empty);
      }
      plot.trees.forEach((tree) => {
        const treeCard = this.templates.treeCard.content.firstElementChild.cloneNode(true);
        treeCard.dataset.treeId = tree.id;
        treeCard.querySelector('[data-field="title"]').textContent = `${tree.produceName} · ур. ${tree.level}`;
        treeCard.querySelector('[data-field="status"]').textContent = tree.status;
        const hydrationBar = treeCard.querySelector('[data-field="hydrationBar"] .progress-fill');
        hydrationBar.style.width = `${tree.hydrationPercent}%`;
        hydrationBar.parentElement.title = `Осталось влаги: ${formatDuration(tree.hydrationRemaining)}`;
        const growthBar = treeCard.querySelector('[data-field="growthBar"] .progress-fill');
        growthBar.style.width = `${tree.growthPercent}%`;
        growthBar.parentElement.title = `Прогресс созревания: ${Math.round(tree.growthPercent)}%`;
        const waterButton = treeCard.querySelector('[data-action="waterTree"]');
        waterButton.disabled = tree.hydrationPercent >= 98;
        const harvestButton = treeCard.querySelector('[data-action="harvestTree"]');
        harvestButton.disabled = !tree.readyToHarvest;
        const upgradeButton = treeCard.querySelector('[data-action="upgradeTree"]');
        upgradeButton.textContent = `Улучшить · ${formatCurrency(tree.upgradeCost)}`;
        upgradeButton.disabled = state.player.balance < tree.upgradeCost;
        treeCard.querySelector('[data-field="nextYield"]').textContent = `Следующий сбор: ${tree.nextYield} ед.`;
        const autoWaterTree = treeCard.querySelector('[data-action="toggleTreeAutoWater"]');
        const autoHarvestTree = treeCard.querySelector('[data-action="toggleTreeAutoHarvest"]');
        autoWaterTree.classList.toggle('active', !!tree.autoWater);
        autoHarvestTree.classList.toggle('active', !!tree.autoHarvest);
        autoWaterTree.setAttribute('aria-pressed', tree.autoWater ? 'true' : 'false');
        autoHarvestTree.setAttribute('aria-pressed', tree.autoHarvest ? 'true' : 'false');
        autoWaterTree.title = `Автополив дерева · ${formatCurrency(CONFIG.automationCosts.treeWater)}/день`;
        autoHarvestTree.title = `Автосбор дерева · ${formatCurrency(CONFIG.automationCosts.treeHarvest)}/день`;
        treesHost.appendChild(treeCard);
      });
      container.appendChild(card);
    });
  }

  updateProfile(state) {
    const balanceNodes = document.querySelectorAll('[data-bind="balance"]');
    balanceNodes.forEach((node) => {
      node.textContent = formatCurrency(state.player.balance);
    });
  }

  updateButtons(state) {
    const buyPlotBtn = document.querySelector('[data-action="buyPlot"]');
    if (buyPlotBtn) {
      buyPlotBtn.textContent = `Приобрести участок · ${formatCurrency(state.nextPlotCost)}`;
      buyPlotBtn.disabled = state.player.balance < state.nextPlotCost;
    }
    const upgradeWarehouseBtn = document.querySelector('[data-action="upgradeWarehouse"]');
    if (upgradeWarehouseBtn) {
      upgradeWarehouseBtn.textContent = `Улучшить склад · ${formatCurrency(
        state.warehouse.upgradeCost
      )}`;
      upgradeWarehouseBtn.disabled = state.player.balance < state.warehouse.upgradeCost;
    }
  }

  showMessages(messages) {
    if (!messages || !messages.length) return;
    const toast = this.references.toast;
    if (!toast) return;
    const message = messages[messages.length - 1];
    toast.textContent = message.text;
    toast.dataset.type = message.type ?? 'info';
    toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4000);
  }
}
