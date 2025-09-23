import { formatCurrency, formatDuration, CONFIG } from './config.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.currentView = 'overview';
    this.root = document.body;
    this.toastTimer = null;
    this.lastState = null;
    this.selectedPlotId = null;
    this.selectedPlantTypes = new Map();
    this.defaultTreeType = Object.keys(CONFIG.crops)[0] ?? 'orange';
    this.references = {
      navLinks: Array.from(document.querySelectorAll('[data-view]')),
      panels: Array.from(document.querySelectorAll('[data-view-panel]')),
      toast: document.querySelector('[data-bind="toast"]'),
      warehouseList: document.querySelector('[data-bind="warehouseItems"]'),
      warehouseHint: document.querySelector('[data-bind="warehouseHint"]'),
      plotsContainer: document.querySelector('.plots-browser'),
      plotsGrid: document.querySelector('[data-bind="plots"]'),
      plotDetail: document.querySelector('[data-bind="plotDetail"]'),
      plotDetailTrees: document.querySelector('[data-bind="plotTrees"]'),
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
    this.bindFormEvents();
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
        case 'openPlot':
          this.handleOpenPlot(target.closest('[data-plot-id]')?.dataset.plotId);
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
          this.handlePlantTree(target);
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
          this.game.sellProduce(target.closest('[data-item-type]')?.dataset.itemType);
          break;
        case 'process':
          this.game.processProduce(target.closest('[data-item-type]')?.dataset.itemType);
          break;
        default:
          break;
      }
    });
  }

  bindFormEvents() {
    this.root.addEventListener('change', (event) => {
      const target = event.target;
      if (target?.dataset.action === 'chooseTreeType') {
        const container = target.closest('[data-plot-id]');
        const plotId = container?.dataset.plotId;
        if (plotId) {
          this.selectedPlantTypes.set(plotId, target.value);
          if (this.lastState) {
            const plot = this.lastState.plots.find((p) => p.id === plotId);
            if (plot) {
              this.updatePlantButton(container, plot, target.value, this.lastState.player.balance);
            }
          }
        }
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
    this.lastState = state;
    this.ensureSelectedPlot(state);
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
    const hint = this.references.warehouseHint;
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
      element.dataset.itemType = item.type;
      const titleNode = element.querySelector('[data-field="title"]');
      if (titleNode) {
        titleNode.textContent = item.name;
      }
      const art = element.querySelector('[data-field="art"]');
      if (art) {
        art.textContent = item.icon ?? '📦';
      }
      const quantityNode = element.querySelector('[data-field="quantity"]');
      if (quantityNode) {
        quantityNode.textContent = `${item.quantity} ед.`;
      }
      const bar = element.querySelector('[data-field="expiryBar"] .expiry-fill');
      if (bar) {
        bar.style.width = `${Math.max(0, Math.min(100, item.percent))}%`;
      }
      const expiryText = element.querySelector('[data-field="expiryText"]');
      if (expiryText) {
        if (item.remaining <= 0) {
          expiryText.textContent = 'Партия испорчена';
        } else {
          expiryText.textContent = `Осталось: ${formatDuration(item.remaining)}`;
        }
      }
      const produceInfo = CONFIG.produce[item.type];
      const sellButton = element.querySelector('[data-action="sell"]');
      if (sellButton) {
        const saleValue = (produceInfo?.sellPrice ?? 1) * item.quantity;
        sellButton.textContent = `Продать · ${formatCurrency(saleValue)}`;
      }
      const processButton = element.querySelector('[data-action="process"]');
      if (processButton) {
        if (!produceInfo?.process) {
          processButton.disabled = true;
          processButton.textContent = 'Недоступно';
        } else {
          const resultName = CONFIG.produce[produceInfo.process.product]?.name ?? 'продукт';
          processButton.textContent = `Переработать → ${resultName}`;
          const required = produceInfo.process.ratio ?? 1;
          processButton.disabled = item.quantity < required;
        }
      }
      if (item.remaining <= 0) {
        element.querySelectorAll('button').forEach((btn) => (btn.disabled = true));
      }
      list.appendChild(element);
    });
  }

  renderPlots(state) {
    const grid = this.references.plotsGrid;
    if (!grid) return;
    grid.innerHTML = '';
    if (!state.plots.length) {
      this.selectedPlotId = null;
      if (this.references.plotDetail) {
        this.references.plotDetail.hidden = true;
      }
      this.references.plotsContainer?.classList.add('single-column');
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Пока нет участков — купите новый участок, чтобы начать развиваться.';
      grid.appendChild(empty);
      return;
    }

    state.plots.forEach((plot, index) => {
      const card = this.templates.plotCard.content.firstElementChild.cloneNode(true);
      card.dataset.plotId = plot.id;
      card.classList.toggle('active', plot.id === this.selectedPlotId);
      const title = card.querySelector('[data-field="title"]');
      if (title) {
        title.textContent = `Участок ${index + 1}`;
      }
      const subtitle = card.querySelector('[data-field="subtitle"]');
      if (subtitle) {
        subtitle.textContent = `Уровень ${plot.level}`;
      }
      const summary = card.querySelector('[data-field="summary"]');
      if (summary) {
        summary.textContent = `${plot.used}/${plot.capacity} деревьев`;
      }
      const art = card.querySelector('[data-field="art"]');
      if (art) {
        art.dataset.level = plot.level;
        const stage = plot.level > 2 ? '🌳' : plot.level > 1 ? '🌿' : '🌱';
        art.textContent = '🌾';
        art.dataset.stage = stage;
      }
      const openBtn = card.querySelector('[data-action="openPlot"]');
      if (openBtn) {
        openBtn.dataset.plotId = plot.id;
      }
      const autoWaterBtn = card.querySelector('[data-action="togglePlotAutoWater"]');
      if (autoWaterBtn) {
        autoWaterBtn.classList.toggle('active', !!plot.autoWater);
        autoWaterBtn.setAttribute('aria-pressed', plot.autoWater ? 'true' : 'false');
        autoWaterBtn.title = `Автополив участка · ${formatCurrency(CONFIG.automationCosts.plotWater)}/день`;
      }
      const autoHarvestBtn = card.querySelector('[data-action="togglePlotAutoHarvest"]');
      if (autoHarvestBtn) {
        autoHarvestBtn.classList.toggle('active', !!plot.autoHarvest);
        autoHarvestBtn.setAttribute('aria-pressed', plot.autoHarvest ? 'true' : 'false');
        autoHarvestBtn.title = `Автосбор участка · ${formatCurrency(CONFIG.automationCosts.plotHarvest)}/день`;
      }
      grid.appendChild(card);
    });

    this.renderPlotDetail(state);
  }

  renderPlotDetail(state) {
    const detail = this.references.plotDetail;
    const treeHost = this.references.plotDetailTrees;
    if (!detail || !treeHost) {
      return;
    }
    treeHost.innerHTML = '';
    if (!this.selectedPlotId) {
      detail.hidden = true;
      this.references.plotsContainer?.classList.add('single-column');
      return;
    }
    const plotIndex = state.plots.findIndex((p) => p.id === this.selectedPlotId);
    if (plotIndex === -1) {
      detail.hidden = true;
      this.references.plotsContainer?.classList.add('single-column');
      return;
    }
    const plot = state.plots[plotIndex];
    detail.hidden = false;
    this.references.plotsContainer?.classList.remove('single-column');
    detail.dataset.plotId = plot.id;

    const title = detail.querySelector('[data-field="plotTitle"]');
    if (title) {
      title.textContent = `Участок ${plotIndex + 1}`;
    }
    const subtitle = detail.querySelector('[data-field="plotSubtitle"]');
    if (subtitle) {
      subtitle.textContent = `Уровень ${plot.level}`;
    }
    const capacity = detail.querySelector('[data-field="plotCapacity"]');
    if (capacity) {
      capacity.textContent = `${plot.used}/${plot.capacity} деревьев`;
    }
    const hint = detail.querySelector('[data-field="plotHint"]');
    if (hint) {
      hint.textContent =
        plot.used >= plot.capacity
          ? 'Все слоты заняты — улучшите участок, чтобы посадить больше деревьев.'
          : 'На участке есть свободные места. Выберите дерево и посадите его.';
    }

    const autoWaterBtn = detail.querySelector('[data-action="togglePlotAutoWater"]');
    if (autoWaterBtn) {
      autoWaterBtn.classList.toggle('active', !!plot.autoWater);
      autoWaterBtn.setAttribute('aria-pressed', plot.autoWater ? 'true' : 'false');
      autoWaterBtn.title = `Автополив участка · ${formatCurrency(CONFIG.automationCosts.plotWater)}/день`;
    }
    const autoHarvestBtn = detail.querySelector('[data-action="togglePlotAutoHarvest"]');
    if (autoHarvestBtn) {
      autoHarvestBtn.classList.toggle('active', !!plot.autoHarvest);
      autoHarvestBtn.setAttribute('aria-pressed', plot.autoHarvest ? 'true' : 'false');
      autoHarvestBtn.title = `Автосбор участка · ${formatCurrency(CONFIG.automationCosts.plotHarvest)}/день`;
    }

    const upgradeBtn = detail.querySelector('[data-action="upgradePlot"]');
    if (upgradeBtn) {
      upgradeBtn.textContent = `Улучшить участок · ${formatCurrency(plot.upgradeCost)}`;
      upgradeBtn.disabled = state.player.balance < plot.upgradeCost;
    }

    const selector = detail.querySelector('[data-action="chooseTreeType"]');
    if (selector) {
      selector.innerHTML = '';
      state.treeCatalog.forEach((tree) => {
        const option = document.createElement('option');
        option.value = tree.type;
        option.textContent = `${tree.icon} ${tree.title}`;
        selector.appendChild(option);
      });
      const savedType = this.selectedPlantTypes.get(plot.id) ?? state.treeCatalog[0]?.type ?? this.defaultTreeType;
      selector.value = savedType;
      this.selectedPlantTypes.set(plot.id, selector.value);
      this.updatePlantButton(detail, plot, selector.value, state.player.balance);
    } else {
      const type = this.selectedPlantTypes.get(plot.id) ?? this.defaultTreeType;
      this.updatePlantButton(detail, plot, type, state.player.balance);
    }

    if (!plot.trees.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Деревьев пока нет — посадите семечко, чтобы начать выращивание.';
      treeHost.appendChild(empty);
      return;
    }

    plot.trees.forEach((tree) => {
      const treeCard = this.templates.treeCard.content.firstElementChild.cloneNode(true);
      treeCard.dataset.treeId = tree.id;
      treeCard.dataset.treeType = tree.type;
      treeCard.dataset.level = tree.level;
      const art = treeCard.querySelector('[data-field="art"]');
      if (art) {
        art.dataset.level = tree.level;
        art.textContent = tree.icon ?? '🌳';
        art.dataset.stage = tree.level <= 0 ? '🌱' : tree.level === 1 ? '🌿' : '🌳';
      }
      const titleNode = treeCard.querySelector('[data-field="title"]');
      if (titleNode) {
        titleNode.textContent = `${tree.produceName} · ур. ${tree.level}`;
      }
      const statusNode = treeCard.querySelector('[data-field="status"]');
      if (statusNode) {
        statusNode.textContent = tree.status;
      }
      const hydrationBar = treeCard.querySelector('[data-field="hydrationBar"] .progress-fill');
      if (hydrationBar) {
        hydrationBar.style.width = `${tree.hydrationPercent}%`;
        hydrationBar.parentElement.title = `Осталось влаги: ${formatDuration(tree.hydrationRemaining)}`;
      }
      const growthBar = treeCard.querySelector('[data-field="growthBar"] .progress-fill');
      if (growthBar) {
        growthBar.style.width = `${tree.growthPercent}%`;
        growthBar.parentElement.title = `Прогресс созревания: ${Math.round(tree.growthPercent)}%`;
      }
      const waterButton = treeCard.querySelector('[data-action="waterTree"]');
      if (waterButton) {
        waterButton.disabled = tree.hydrationPercent >= 98;
      }
      const harvestButton = treeCard.querySelector('[data-action="harvestTree"]');
      if (harvestButton) {
        harvestButton.disabled = !tree.readyToHarvest;
      }
      const upgradeButton = treeCard.querySelector('[data-action="upgradeTree"]');
      if (upgradeButton) {
        upgradeButton.textContent = `Улучшить · ${formatCurrency(tree.upgradeCost)}`;
        upgradeButton.disabled = state.player.balance < tree.upgradeCost;
      }
      const nextYield = treeCard.querySelector('[data-field="nextYield"]');
      if (nextYield) {
        nextYield.textContent = `Следующий сбор: ${tree.nextYield} ед.`;
      }
      const autoWaterTree = treeCard.querySelector('[data-action="toggleTreeAutoWater"]');
      if (autoWaterTree) {
        autoWaterTree.classList.toggle('active', !!tree.autoWater);
        autoWaterTree.setAttribute('aria-pressed', tree.autoWater ? 'true' : 'false');
        autoWaterTree.title = `Автополив дерева · ${formatCurrency(CONFIG.automationCosts.treeWater)}/день`;
      }
      const autoHarvestTree = treeCard.querySelector('[data-action="toggleTreeAutoHarvest"]');
      if (autoHarvestTree) {
        autoHarvestTree.classList.toggle('active', !!tree.autoHarvest);
        autoHarvestTree.setAttribute('aria-pressed', tree.autoHarvest ? 'true' : 'false');
        autoHarvestTree.title = `Автосбор дерева · ${formatCurrency(CONFIG.automationCosts.treeHarvest)}/день`;
      }
      treeHost.appendChild(treeCard);
    });
  }

  ensureSelectedPlot(state) {
    if (!state.plots || !state.plots.length) {
      this.selectedPlotId = null;
      return;
    }
    if (!this.selectedPlotId || !state.plots.some((plot) => plot.id === this.selectedPlotId)) {
      this.selectedPlotId = state.plots[0].id;
    }
  }

  handleOpenPlot(plotId) {
    if (!plotId) {
      return;
    }
    if (this.selectedPlotId !== plotId) {
      this.selectedPlotId = plotId;
      if (this.lastState) {
        this.renderPlots(this.lastState);
      }
    }
  }

  handlePlantTree(target) {
    const container = target.closest('[data-plot-id]');
    const plotId = container?.dataset.plotId;
    if (!plotId) {
      return;
    }
    const selector = container.querySelector('[data-action="chooseTreeType"]');
    const treeType = selector?.value || this.selectedPlantTypes.get(plotId) || this.defaultTreeType;
    this.selectedPlantTypes.set(plotId, treeType);
    this.game.plantTree(plotId, treeType);
  }

  calculatePlantCost(plot, type) {
    const crop = CONFIG.crops[type] ?? {};
    const base = crop.seedCost ?? 800;
    const multiplier = 1 + 0.15 * plot.used;
    return Math.round(base * multiplier);
  }

  updatePlantButton(container, plot, type, balance) {
    const plantBtn = container.querySelector('[data-action="plantTree"]');
    if (!plantBtn) {
      return;
    }
    const cost = this.calculatePlantCost(plot, type || this.defaultTreeType);
    plantBtn.textContent = `Посадить · ${formatCurrency(cost)}`;
    plantBtn.disabled = plot.used >= plot.capacity || balance < cost;
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
