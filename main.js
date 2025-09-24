const ASSET_MANIFEST_PATH = "assets-manifest.json";
const STORAGE_KEY = "fruit-dominion-save";
const AUTO_SAVE_INTERVAL = 8000;
const FAST_FORWARD_MULTIPLIER = 8;

const CONSTANTS = {
  tile: {
    width: 128,
    height: 74,
  },
  plots: {
    baseSlots: 1,
    upgradeCostBase: 300,
  },
  trees: {
    maxLevel: 5,
    growthTime: [12, 38, 70, 110, 160], // seconds per level
    fruitCycle: 20, // seconds to spawn harvest at level >=1
    baseYield: 8,
    yieldPerLevel: 4,
    waterBoost: 1.6,
    waterDuration: 50,
    autoWaterCostPerDay: 120,
    autoHarvestCostPerDay: 160,
  },
  storage: {
    baseCapacity: 120,
    capacityPerLevel: 80,
    upgradeCostBase: 500,
    spoilTimes: {
      apples: 420,
      juice: 1200,
    },
  },
  factory: {
    baseDuration: 90,
    durationScale: 0.9,
    upgradeCostBase: 600,
    inputPerBatch: 25,
    outputPerBatch: 8,
    maxQueue: 4,
  },
  economy: {
    sellPrice: {
      apples: 4,
      juice: 12,
    },
    plotCostBase: 800,
    treeSeedCost: 150,
  }
};

const INITIAL_STATE = {
  coins: 1000,
  fastForward: false,
  lastTick: Date.now(),
  plots: [
    {
      id: "plot-1",
      level: 1,
      position: { x: 0, y: 0 },
      autoWater: false,
      autoHarvest: false,
      autoWaterPaidUntil: 0,
      autoHarvestPaidUntil: 0,
      trees: [
        {
          id: "tree-1",
          type: "apples",
          level: 1,
          growth: 0,
          fruitProgress: 0.4,
          fruitReady: 12,
          waterUntil: 0,
          lastWatered: 0,
          autoWater: false,
          autoHarvest: false,
        },
      ],
    },
  ],
  storage: {
    level: 1,
    capacity: CONSTANTS.storage.baseCapacity,
    items: {
      apples: { amount: 20, spoilProgress: 0 },
      juice: { amount: 0, spoilProgress: 0 },
    },
  },
  factory: {
    level: 1,
    queue: [],
    progress: 0,
    currentTask: null,
  },
};

const audioContext = window.AudioContext ? new AudioContext() : null;

class AssetManager {
  constructor(manifest) {
    this.manifest = manifest;
    this.images = new Map();
    this.audioBuffers = new Map();
  }

  async loadAll() {
    const imageEntries = Object.entries(this.manifest.images || {});
    await Promise.all(
      imageEntries.map(([key, path]) => this.loadImage(key, path))
    );

    if (audioContext) {
      const audioEntries = Object.entries(this.manifest.audio || {});
      for (const [key, path] of audioEntries) {
        await this.loadAudio(key, path);
      }
    }
  }

  async loadImage(key, path) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(key, img);
        resolve();
      };
      img.onerror = () => {
        this.images.set(key, this.createPlaceholderImage(key));
        resolve();
      };
      img.src = path;
    });
  }

  createPlaceholderImage(key) {
    const canvas = document.createElement("canvas");
    canvas.width = CONSTANTS.tile.width;
    canvas.height = CONSTANTS.tile.height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1f2d3d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#4fc3f7";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(key, canvas.width / 2, canvas.height / 2);
    return canvas;
  }

  async loadAudio(key, path) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error("missing audio");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(key, buffer);
    } catch (err) {
      console.warn("Audio placeholder for", key);
    }
  }

  play(key, volume = 0.4) {
    if (!audioContext) return;
    const buffer = this.audioBuffers.get(key);
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start(0);
  }

  getImage(key) {
    return this.images.get(key);
  }
}

class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.dragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.positionStart = { x: 0, y: 0 };
  }
}

class ToastManager {
  constructor(container) {
    this.container = container;
  }

  show(message, type = "info") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    this.container.appendChild(node);
    setTimeout(() => {
      node.classList.add("fade-out");
      setTimeout(() => node.remove(), 300);
    }, 3200);
  }
}

class StorageManager {
  constructor(state) {
    this.state = state;
  }

  capacity() {
    const { baseCapacity, capacityPerLevel } = CONSTANTS.storage;
    return baseCapacity + (this.state.storage.level - 1) * capacityPerLevel;
  }

  amount() {
    return Object.values(this.state.storage.items).reduce(
      (acc, item) => acc + item.amount,
      0
    );
  }

  hasSpace(amount) {
    return this.amount() + amount <= this.capacity();
  }

  add(type, amount) {
    if (!this.hasSpace(amount)) return false;
    const entry = this.state.storage.items[type] || {
      amount: 0,
      spoilProgress: 0,
    };
    entry.amount += amount;
    this.state.storage.items[type] = entry;
    return true;
  }

  remove(type, amount) {
    const entry = this.state.storage.items[type];
    if (!entry || entry.amount < amount) return false;
    entry.amount -= amount;
    return true;
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeTree(tree) {
  if (!tree) return null;
  return {
    id: tree.id || `tree-${Math.random().toString(36).slice(2, 6)}`,
    type: tree.type || "apples",
    level: tree.level ?? 0,
    growth: tree.growth ?? 0,
    fruitProgress: tree.fruitProgress ?? 0,
    fruitReady: tree.fruitReady ?? 0,
    waterUntil: tree.waterUntil || 0,
    lastWatered: tree.lastWatered || 0,
  };
}

function normalizeStateData(state) {
  const normalized = { ...state };
  normalized.coins = state.coins ?? INITIAL_STATE.coins;
  normalized.plots = (state.plots || []).map((plot, index) => {
    const base = INITIAL_STATE.plots[index] || INITIAL_STATE.plots[0];
    const trees = (plot.trees || []).map((tree) => normalizeTree(tree));
    const normalizedPlot = {
      id: plot.id || `plot-${index + 1}`,
      level: plot.level || base.level,
      position: plot.position
        ? { ...plot.position }
        : { ...base.position },
      autoWater: Boolean(plot.autoWater),
      autoHarvest: Boolean(plot.autoHarvest),
      autoWaterPaidUntil: plot.autoWaterPaidUntil || 0,
      autoHarvestPaidUntil: plot.autoHarvestPaidUntil || 0,
      trees,
    };
    while (trees.length < normalizedPlot.level) {
      trees.push(null);
    }
    normalizedPlot.trees = trees;
    return normalizedPlot;
  });
  if (!normalized.plots.length) {
    normalized.plots = deepClone(INITIAL_STATE.plots);
  }

  normalized.storage = normalized.storage || deepClone(INITIAL_STATE.storage);
  normalized.storage.level = normalized.storage.level || 1;
  normalized.storage.items = normalized.storage.items || {};
  for (const key of Object.keys(INITIAL_STATE.storage.items)) {
    const item = normalized.storage.items[key] || { amount: 0, spoilProgress: 0 };
    item.amount = item.amount || 0;
    item.spoilProgress = item.spoilProgress || 0;
    normalized.storage.items[key] = item;
  }

  normalized.factory = normalized.factory || deepClone(INITIAL_STATE.factory);
  normalized.factory.level = normalized.factory.level || 1;
  normalized.factory.queue = (normalized.factory.queue || []).map((job) => ({
    id: job.id || `job-${Date.now()}`,
    input: job.input || "apples",
    output: job.output || "juice",
    progress: job.progress || 0,
    duration: job.duration || CONSTANTS.factory.baseDuration,
    outputAmount: job.outputAmount || CONSTANTS.factory.outputPerBatch,
  }));
  if (normalized.factory.currentTask) {
    normalized.factory.currentTask = {
      id: normalized.factory.currentTask.id || `job-${Date.now()}`,
      input: normalized.factory.currentTask.input || "apples",
      output: normalized.factory.currentTask.output || "juice",
      progress: normalized.factory.currentTask.progress || 0,
      duration:
        normalized.factory.currentTask.duration || CONSTANTS.factory.baseDuration,
      outputAmount:
        normalized.factory.currentTask.outputAmount || CONSTANTS.factory.outputPerBatch,
    };
  } else {
    normalized.factory.currentTask = null;
  }

  return normalized;
}

class Game {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.toast = new ToastManager(document.getElementById("toast-container"));
    this.camera = new Camera();
    this.state = this.loadState();
    this.storageManager = new StorageManager(this.state);
    this.debugEnabled = false;
    this.debugFastForward = false;
    this.plotPositions = this.generatePlotPositions(4);
    this.selectionRefreshTimer = 0;
    this.hudRefreshTimer = 0;

    this.hoveredPlot = null;
    this.hoveredTree = null;
    this.selectedPlot = null;
    this.lastUpdate = performance.now();
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();

    this.bindUI();
    this.setupInput();
    this.updateHUD();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.startAutoSave();
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(INITIAL_STATE);
      const parsed = JSON.parse(raw);
      const merged = { ...deepClone(INITIAL_STATE), ...parsed };
      return normalizeStateData(merged);
    } catch (err) {
      console.warn("Save corrupted, reset.", err);
      return deepClone(INITIAL_STATE);
    }
  }

  persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  startAutoSave() {
    window.addEventListener("beforeunload", () => this.persistState());
    setInterval(() => this.persistState(), AUTO_SAVE_INTERVAL);
  }

  bindUI() {
    this.selectionPanel = document.getElementById("selection-panel");
    this.selectionTitle = document.getElementById("selection-title");
    this.selectionContent = document.getElementById("selection-content");

    document.getElementById("storage-btn").addEventListener("click", () => {
      this.openModal("modal-storage");
      this.renderStorageModal();
    });

    document.getElementById("factory-btn").addEventListener("click", () => {
      this.openModal("modal-factory");
      this.renderFactoryModal();
    });

    document.getElementById("settings-btn").addEventListener("click", () => {
      this.openModal("modal-settings");
      document.getElementById("toggle-debug").checked = this.debugEnabled;
      this.renderDebugPanel();
    });

    document.getElementById("buy-plot").addEventListener("click", () =>
      this.buyPlot()
    );

    document.getElementById("storage-upgrade").addEventListener("click", () =>
      this.upgradeStorage()
    );
    document.getElementById("factory-start").addEventListener("click", () =>
      this.startFactoryBatch()
    );
    document.getElementById("factory-upgrade").addEventListener("click", () =>
      this.upgradeFactory()
    );

    document.querySelectorAll("[data-close]").forEach((btn) =>
      btn.addEventListener("click", () => this.closeModal())
    );

    document
      .getElementById("toggle-debug")
      .addEventListener("change", (e) => {
        this.debugEnabled = e.target.checked;
        document
          .getElementById("debug-overlay")
          .classList.toggle("hidden", !this.debugEnabled);
        this.renderDebugPanel();
      });

    document
      .getElementById("debug-add-money")
      .addEventListener("click", () => {
        this.state.coins += 500;
        this.toast.show("Получено 500 монет", "success");
        this.updateHUD();
      });

    document
      .getElementById("debug-fast-forward")
      .addEventListener("click", () => {
        this.debugFastForward = !this.debugFastForward;
        document.getElementById("debug-fast-forward").textContent = this
          .debugFastForward
          ? "Остановить ускорение"
          : "Fast forward";
      });

    document.getElementById("modal-overlay").addEventListener("click", (ev) => {
      if (ev.target.id === "modal-overlay") this.closeModal();
    });
  }

  setupInput() {
    const rect = () => this.canvas.getBoundingClientRect();
    const pointer = { x: 0, y: 0 };
    const updatePointer = (ev) => {
      const bounds = rect();
      const scaleX = this.canvas.width / bounds.width;
      const scaleY = this.canvas.height / bounds.height;
      pointer.x = (ev.clientX - bounds.left) * scaleX;
      pointer.y = (ev.clientY - bounds.top) * scaleY;
    };

    this.canvas.addEventListener("mousedown", (ev) => {
      updatePointer(ev);
      if (ev.button === 1 || ev.button === 2 || ev.shiftKey) {
        this.camera.dragging = true;
        this.camera.dragStart = { x: ev.clientX, y: ev.clientY };
        this.camera.positionStart = { x: this.camera.x, y: this.camera.y };
      } else {
        const hit = this.pickAt(pointer.x, pointer.y);
        if (hit.plot) {
          this.selectPlot(hit.plot);
          if (
            hit.treeIndex !== null &&
            hit.plot.trees[hit.treeIndex] &&
            hit.plot.trees[hit.treeIndex].fruitReady > 0
          ) {
            this.handlePlotAction(hit.plot, "harvest", hit.treeIndex);
          }
          this.playSound("click");
        } else {
          this.selectPlot(null);
        }
        this.canvas.style.cursor = this.computeCursor(hit);
      }
    });

    window.addEventListener("mouseup", () => {
      this.camera.dragging = false;
    });

    window.addEventListener("mousemove", (ev) => {
      updatePointer(ev);
      if (this.camera.dragging) {
        const dx = ev.clientX - this.camera.dragStart.x;
        const dy = ev.clientY - this.camera.dragStart.y;
        this.camera.x = this.camera.positionStart.x + dx;
        this.camera.y = this.camera.positionStart.y + dy;
      }
      const hit = this.pickAt(pointer.x, pointer.y);
      this.hoveredPlot = hit.plot;
      this.hoveredTree =
        hit.plot && hit.treeIndex !== null
          ? { plotId: hit.plot.id, index: hit.treeIndex }
          : null;
      this.canvas.style.cursor = this.computeCursor(hit);
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.hoveredPlot = null;
      this.hoveredTree = null;
      this.canvas.style.cursor = "default";
    });

    this.canvas.addEventListener("wheel", (ev) => {
      updatePointer(ev);
      const oldZoom = this.camera.zoom;
      const zoomFactor = ev.deltaY < 0 ? 1.1 : 0.9;
      this.camera.zoom = Math.min(2.5, Math.max(0.5, this.camera.zoom * zoomFactor));
      const scale = this.camera.zoom / oldZoom;
      this.camera.x = pointer.x - scale * (pointer.x - this.camera.x);
      this.camera.y = pointer.y - scale * (pointer.y - this.camera.y);
    });
  }

  pickAt(x, y) {
    const { width, height } = this.canvas;
    const worldX = (x - width / 2 - this.camera.x) / this.camera.zoom;
    const worldY = (y - height / 2 - this.camera.y) / this.camera.zoom;
    let bestPlot = null;
    let bestDist = Infinity;
    let bestLocal = { x: 0, y: 0 };
    for (const plot of this.state.plots) {
      const screen = this.plotScreenPosition(plot.position.x, plot.position.y);
      const localX = worldX - screen.x;
      const localY = worldY - screen.y;
      const tileW = CONSTANTS.tile.width / 2;
      const tileH = CONSTANTS.tile.height / 2;
      const inside =
        Math.abs(localX) / tileW + Math.abs(localY) / tileH <= 1.05;
      if (inside) {
        const dist = Math.abs(localX) + Math.abs(localY);
        if (dist < bestDist) {
          bestPlot = plot;
          bestDist = dist;
          bestLocal = { x: localX, y: localY };
        }
      }
    }
    if (!bestPlot) {
      return { plot: null, treeIndex: null };
    }
    const treeIndex = this.pickTreeIndex(bestPlot, bestLocal.x, bestLocal.y);
    return { plot: bestPlot, treeIndex, localX: bestLocal.x, localY: bestLocal.y };
  }

  pickTreeIndex(plot, localX, localY) {
    const radiusX = CONSTANTS.tile.width * 0.22;
    const radiusY = CONSTANTS.tile.height * 0.28;
    let bestIndex = null;
    let bestDist = Infinity;
    plot.trees.forEach((tree, index) => {
      const offset = this.treeOffset(index);
      const dx = localX - offset.x;
      const dy = localY - offset.y;
      const dist = Math.sqrt(dx * dx + ((dy * CONSTANTS.tile.width) / (CONSTANTS.tile.height * 1.1)) ** 2);
      const inEllipse = Math.abs(dx) <= radiusX && Math.abs(dy) <= radiusY;
      if (inEllipse && dist < bestDist) {
        bestIndex = index;
        bestDist = dist;
      }
    });
    return bestIndex;
  }

  computeCursor(hit) {
    if (!hit.plot) return "default";
    if (hit.treeIndex !== null) {
      const tree = hit.plot.trees[hit.treeIndex];
      if (tree) {
        return tree.fruitReady > 0 ? "grab" : "pointer";
      }
      return "crosshair";
    }
    return "pointer";
  }

  selectPlot(plot) {
    this.selectedPlot = plot;
    if (!plot) {
      this.selectionPanel.classList.add("hidden");
      return;
    }
    this.selectionPanel.classList.remove("hidden");
    this.selectionRefreshTimer = 0;
    this.renderSelectionPanel();
  }

  renderSelectionPanel() {
    const plot = this.selectedPlot;
    this.selectionTitle.textContent = `Участок #${plot.id}`;
    this.selectionContent.innerHTML = "";

    const infoLevel = this.createStatRow("Уровень участка", plot.level);
    const treeCount = plot.trees.filter(Boolean).length;
    const infoTrees = this.createStatRow(
      "Деревьев",
      `${treeCount}/${plot.trees.length}`
    );

    this.selectionContent.appendChild(infoLevel);
    this.selectionContent.appendChild(infoTrees);

    const services = document.createElement("div");
    services.className = "service-buttons";
    const autoWaterBtn = this.createActionButton(
      "secondary",
      `${plot.autoWater ? "Выключить" : "Включить"} автополив`,
      () => this.handlePlotAction(plot, "autoWater")
    );
    if (plot.autoWater) autoWaterBtn.classList.add("active");
    const autoHarvestBtn = this.createActionButton(
      "secondary",
      `${plot.autoHarvest ? "Выключить" : "Включить"} автосбор`,
      () => this.handlePlotAction(plot, "autoHarvest")
    );
    if (plot.autoHarvest) autoHarvestBtn.classList.add("active");
    services.appendChild(autoWaterBtn);
    services.appendChild(autoHarvestBtn);
    this.selectionContent.appendChild(services);

    const treeList = document.createElement("div");
    treeList.className = "tree-list";

    const seedCost = CONSTANTS.economy.treeSeedCost;
    plot.trees.forEach((tree, index) => {
      const card = document.createElement("div");
      card.className = "tree-card";
      card.innerHTML = `<div class="tree-card-title">Ячейка ${index + 1}</div>`;

      if (!tree) {
        card.classList.add("empty");
        const emptyInfo = document.createElement("div");
        emptyInfo.className = "tree-card-info";
        emptyInfo.innerHTML = `<span>Свободно</span><span>${seedCost} монет</span>`;
        card.appendChild(emptyInfo);
        const plantBtn = this.createActionButton(
          "primary",
          `Посадить семечко`,
          () => this.handlePlotAction(plot, "plant", index)
        );
        if (this.state.coins < seedCost) {
          plantBtn.disabled = true;
          plantBtn.title = "Недостаточно монет";
        }
        card.appendChild(plantBtn);
      } else {
        const now = Date.now();
        const ready = tree.fruitReady > 0;
        const watered = tree.waterUntil > now;
        if (ready) {
          card.classList.add("ready");
        }
        card.appendChild(
          this.createStatRow("Уровень", tree.level, "tree-card-info")
        );
        const growthLabel =
          tree.level >= CONSTANTS.trees.maxLevel
            ? "Макс"
            : `${Math.min(100, Math.round(tree.growth * 100))}%`;
        card.appendChild(
          this.createStatRow("Рост", growthLabel, "tree-card-info")
        );
        const fruitRow = this.createStatRow(
          "Урожай",
          `${tree.fruitReady} шт.`,
          "tree-card-info"
        );
        if (ready) {
          fruitRow.classList.add("yield-ready");
        }
        card.appendChild(fruitRow);
        const btnRow = document.createElement("div");
        btnRow.className = "tree-card-actions";
        const waterBtn = this.createActionButton("secondary", "Полить", () =>
          this.handlePlotAction(plot, "water", index)
        );
        if (watered) {
          waterBtn.disabled = true;
          waterBtn.textContent = "Полито";
        }
        btnRow.appendChild(waterBtn);
        const harvestBtn = this.createActionButton(
          "secondary",
          ready ? `Собрать (${tree.fruitReady})` : "Собрать",
          () => this.handlePlotAction(plot, "harvest", index)
        );
        if (!ready) {
          harvestBtn.disabled = true;
          harvestBtn.title = "Урожай еще не готов";
        }
        btnRow.appendChild(harvestBtn);
        card.appendChild(btnRow);
      }
      treeList.appendChild(card);
    });

    this.selectionContent.appendChild(treeList);

    const upgradeBtn = this.createActionButton("secondary", "Улучшить участок", () =>
      this.handlePlotAction(plot, "upgrade")
    );
    this.selectionContent.appendChild(upgradeBtn);
  }

  createStatRow(label, value, extraClass = "") {
    const row = document.createElement("div");
    row.className = `stat-row ${extraClass}`.trim();
    const left = document.createElement("span");
    left.textContent = label;
    const right = document.createElement("span");
    right.textContent = value;
    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  createActionButton(style, text, handler) {
    const button = document.createElement("button");
    button.className = style;
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", handler);
    return button;
  }

  handlePlotAction(plot, action, treeIndex = null) {
    const tree =
      treeIndex !== null && treeIndex !== undefined ? plot.trees[treeIndex] : null;
    let changed = false;
    switch (action) {
      case "plant":
        if (tree) {
          this.toast.show("На ячейке уже есть дерево", "error");
          this.playSound("error");
          return;
        }
        if (this.state.coins < CONSTANTS.economy.treeSeedCost) {
          this.toast.show("Недостаточно монет для семечка", "error");
          this.playSound("error");
          return;
        }
        this.state.coins -= CONSTANTS.economy.treeSeedCost;
        plot.trees[treeIndex] = this.createTree();
        this.toast.show("Семечко посажено", "success");
        this.playSound("success");
        changed = true;
        break;
      case "water":
        if (!tree) {
          this.toast.show("Нечего поливать", "error");
          return;
        }
        tree.waterUntil = Date.now() + CONSTANTS.trees.waterDuration * 1000;
        tree.lastWatered = Date.now();
        this.toast.show("Дерево полито", "success");
        this.playSound("success");
        changed = true;
        break;
      case "harvest":
        if (!tree || tree.fruitReady <= 0) {
          this.toast.show("Урожай еще не готов", "error");
          this.playSound("error");
          return;
        }
        if (!this.storageManager.hasSpace(tree.fruitReady)) {
          this.toast.show("Недостаточно места на складе", "error");
          this.playSound("error");
          return;
        }
        this.storageManager.add("apples", tree.fruitReady);
        tree.fruitReady = 0;
        this.toast.show("Урожай собран", "success");
        this.playSound("success");
        changed = true;
        break;
      case "autoWater":
        changed = this.toggleAutoService(plot, "autoWater") || changed;
        break;
      case "autoHarvest":
        changed = this.toggleAutoService(plot, "autoHarvest") || changed;
        break;
      case "upgrade":
        changed = this.upgradePlot(plot) || changed;
        break;
    }
    this.updateHUD();
    this.renderSelectionPanel();
    if (changed) {
      if (this.debugEnabled) {
        this.renderDebugPanel();
      }
      this.persistState();
    }
  }

  toggleAutoService(plot, key) {
    const price =
      key === "autoWater"
        ? CONSTANTS.trees.autoWaterCostPerDay
        : CONSTANTS.trees.autoHarvestCostPerDay;
    const untilKey = key === "autoWater" ? "autoWaterPaidUntil" : "autoHarvestPaidUntil";
    if (!plot[key]) {
      if (this.state.coins < price) {
        this.toast.show("Недостаточно монет для услуги", "error");
        this.playSound("error");
        return false;
      }
      plot[key] = true;
      this.state.coins -= price;
      plot[untilKey] = Date.now() + 24 * 60 * 60 * 1000;
      this.toast.show("Услуга активирована", "success");
      this.playSound("success");
      return true;
    }
    plot[key] = false;
    plot[untilKey] = Date.now();
    this.toast.show("Услуга отключена", "info");
    return true;
  }

  upgradePlot(plot) {
    const cost = CONSTANTS.plots.upgradeCostBase * plot.level;
    if (this.state.coins < cost) {
      this.toast.show("Недостаточно монет", "error");
      this.playSound("error");
      return false;
    }
    plot.level += 1;
    this.state.coins -= cost;
    if (plot.trees.length < plot.level) {
      plot.trees.push(null);
    }
    this.toast.show("Участок улучшен", "success");
    this.playSound("success");
    return true;
  }

  buyPlot() {
    const ownedSet = new Set(
      this.state.plots.map((plot) => `${plot.position.x},${plot.position.y}`)
    );
    const nextPos = this.plotPositions.find(
      (pos) => !ownedSet.has(`${pos.x},${pos.y}`)
    );
    if (!nextPos) {
      this.toast.show("Нет свободных участков", "error");
      return;
    }
    const cost = CONSTANTS.economy.plotCostBase * this.state.plots.length;
    if (this.state.coins < cost) {
      this.toast.show(`Нужно ${cost} монет для покупки участка`, "error");
      return;
    }
    this.state.coins -= cost;
    const newPlot = {
      id: `plot-${this.state.plots.length + 1}`,
      level: 1,
      position: { ...nextPos },
      autoWater: false,
      autoHarvest: false,
      autoWaterPaidUntil: 0,
      autoHarvestPaidUntil: 0,
      trees: [null],
    };
    this.state.plots.push(newPlot);
    this.toast.show("Новый участок приобретен", "success");
    this.playSound("success");
    this.updateHUD();
    this.renderDebugPanel();
    this.persistState();
  }

  createTree() {
    return {
      id: `tree-${Math.random().toString(36).slice(2, 6)}`,
      type: "apples",
      level: 0,
      growth: 0,
      fruitProgress: 0,
      fruitReady: 0,
      waterUntil: 0,
      lastWatered: 0,
    };
  }

  upgradeStorage() {
    const cost = CONSTANTS.storage.upgradeCostBase * this.state.storage.level;
    if (this.state.coins < cost) {
      this.toast.show("Недостаточно монет для улучшения склада", "error");
      return;
    }
    this.state.coins -= cost;
    this.state.storage.level += 1;
    this.toast.show("Склад улучшен", "success");
    this.playSound("success");
    this.updateHUD();
    this.renderStorageModal();
    this.persistState();
  }

  upgradeFactory() {
    const cost = CONSTANTS.factory.upgradeCostBase * this.state.factory.level;
    if (this.state.coins < cost) {
      this.toast.show("Не хватает монет на улучшение", "error");
      return;
    }
    this.state.coins -= cost;
    this.state.factory.level += 1;
    this.toast.show("Завод улучшен", "success");
    this.playSound("success");
    this.renderFactoryModal();
    this.persistState();
  }

  startFactoryBatch() {
    const queue = this.state.factory.queue;
    if (queue.length >= CONSTANTS.factory.maxQueue) {
      this.toast.show("Очередь завода переполнена", "error");
      return;
    }
    const needed = CONSTANTS.factory.inputPerBatch;
    if (!this.storageManager.remove("apples", needed)) {
      this.toast.show("Недостаточно яблок", "error");
      return;
    }
    const duration =
      CONSTANTS.factory.baseDuration *
      Math.pow(CONSTANTS.factory.durationScale, this.state.factory.level - 1);
    queue.push({
      id: `job-${Date.now()}`,
      input: "apples",
      output: "juice",
      progress: 0,
      duration,
      outputAmount:
        CONSTANTS.factory.outputPerBatch + (this.state.factory.level - 1) * 2,
    });
    this.toast.show("Производство запущено", "success");
    this.playSound("success");
    this.renderFactoryModal();
    this.persistState();
  }

  renderStorageModal() {
    const container = document.getElementById("storage-inventory");
    container.innerHTML = "";
    const storage = this.state.storage;
    const cap = this.storageManager.capacity();
    const amount = this.storageManager.amount();
    const info = document.createElement("div");
    info.innerHTML = `<p>Вместимость: ${amount}/${cap}</p>`;
    container.appendChild(info);
    const list = document.createElement("div");
    list.className = "scrollable";
    Object.entries(storage.items).forEach(([type, entry]) => {
      const row = document.createElement("div");
      row.className = "stat-row";
      row.innerHTML = `<span>${type}</span><span>${entry.amount}</span>`;
      const buttons = document.createElement("div");
      buttons.style.display = "flex";
      buttons.style.gap = "6px";
      const sellBtn = document.createElement("button");
      sellBtn.textContent = "Продать";
      sellBtn.className = "secondary";
      sellBtn.addEventListener("click", () => {
        if (entry.amount <= 0) return;
        const price = CONSTANTS.economy.sellPrice[type] || 1;
        this.state.coins += entry.amount * price;
        entry.amount = 0;
        this.toast.show("Товар продан", "success");
        this.playSound("success");
        this.renderStorageModal();
        this.updateHUD();
        this.persistState();
      });
      buttons.appendChild(sellBtn);
      row.appendChild(buttons);
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  renderFactoryModal() {
    const queueContainer = document.getElementById("factory-queue");
    queueContainer.innerHTML = "";
    const queue = this.state.factory.queue;
    if (queue.length === 0 && !this.state.factory.currentTask) {
      queueContainer.innerHTML = "<p>Очередь пуста.</p>";
      return;
    }
    const active = this.state.factory.currentTask;
    if (active) {
      const progress = Math.min(1, active.progress / active.duration);
      const el = document.createElement("div");
      el.innerHTML = `<p>В работе: ${active.output} (${Math.round(
        progress * 100
      )}%)</p>`;
      queueContainer.appendChild(el);
    }
    queue.forEach((job, idx) => {
      const el = document.createElement("div");
      el.innerHTML = `<p>#${idx + 1} → ${job.output}</p>`;
      queueContainer.appendChild(el);
    });
  }

  renderDebugPanel() {
    const panel = document.getElementById("debug-panel");
    if (!this.debugEnabled) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    const storage = this.state.storage.items;
    const plots = this.state.plots
      .map((plot) => `Plot ${plot.id}: trees=${plot.trees.length}`)
      .join("<br/>");
    panel.innerHTML = `
      <p>Баланс: ${this.state.coins}</p>
      <p>Склад: ${Object.entries(storage)
        .map(([t, v]) => `${t}:${v.amount}`)
        .join(", ")}</p>
      <div>${plots}</div>
    `;
  }

  openModal(id) {
    const overlay = document.getElementById("modal-overlay");
    overlay.classList.remove("hidden");
    overlay.querySelectorAll(".modal").forEach((modal) => modal.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
  }

  closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
  }

  updateHUD() {
    document.getElementById("balance-value").textContent = `${this.state.coins} монет`;
    document.getElementById("storage-status").textContent = `${this.storageManager.amount()}/${this.storageManager.capacity()}`;
    const queue = this.state.factory.queue.length;
    const running = this.state.factory.currentTask ? "В работе" : "Простой";
    document.getElementById("factory-status").textContent = `${running}, очередь: ${queue}`;
  }

  loop(now) {
    const delta = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    this.update(delta);
    this.render();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
    this.frameCount++;
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    const multiplier = this.debugFastForward ? FAST_FORWARD_MULTIPLIER : 1;
    const scaledDt = dt * multiplier;
    this.updatePlots(scaledDt);
    this.updateStorage(scaledDt);
    this.updateFactory(scaledDt);
    this.updateAutoServices();
    if (this.selectedPlot) {
      this.selectionRefreshTimer -= dt;
      if (this.selectionRefreshTimer <= 0) {
        this.selectionRefreshTimer = 0.5;
        this.renderSelectionPanel();
      }
    }
    this.hudRefreshTimer -= dt;
    if (this.hudRefreshTimer <= 0) {
      this.hudRefreshTimer = 0.5;
      this.updateHUD();
    }
    if (this.debugEnabled) {
      this.renderDebugOverlay();
    }
  }

  updatePlots(dt) {
    const now = Date.now();
    let changed = false;
    for (const plot of this.state.plots) {
      for (const tree of plot.trees) {
        if (!tree) continue;
        const watered = tree.waterUntil > now || plot.autoWater;
        const growthRate = watered ? CONSTANTS.trees.waterBoost : 1;
        const maxLevel = CONSTANTS.trees.maxLevel;
        if (tree.level < maxLevel) {
          const duration = CONSTANTS.trees.growthTime[Math.min(tree.level, CONSTANTS.trees.growthTime.length - 1)];
          tree.growth += (dt / duration) * growthRate;
          while (tree.growth >= 1 && tree.level < maxLevel) {
            tree.level += 1;
            tree.growth -= 1;
            this.toast.show(
              `Дерево ${tree.id} выросло до уровня ${tree.level}`,
              "info"
            );
            changed = true;
          }
          if (tree.level >= maxLevel) {
            tree.growth = 0;
          }
        }

        if (tree.level >= 1) {
          const fruitRate = growthRate * (1 + tree.level * 0.1);
          tree.fruitProgress += (dt / CONSTANTS.trees.fruitCycle) * fruitRate;
          if (tree.fruitProgress >= 1) {
            const yieldAmount =
              CONSTANTS.trees.baseYield + tree.level * CONSTANTS.trees.yieldPerLevel;
            const batches = Math.floor(tree.fruitProgress);
            tree.fruitReady += yieldAmount * batches;
            tree.fruitProgress -= batches;
            if (batches > 0) {
              changed = true;
            }
          }
        }
        if (plot.autoHarvest && tree.fruitReady > 0) {
          if (this.storageManager.hasSpace(tree.fruitReady)) {
            this.storageManager.add("apples", tree.fruitReady);
            tree.fruitReady = 0;
            changed = true;
          }
        }
        if (plot.autoWater && tree.waterUntil < now) {
          tree.waterUntil = now + CONSTANTS.trees.waterDuration * 1000;
          changed = true;
        }
      }
    }
    if (changed) {
      if (this.debugEnabled) {
        this.renderDebugPanel();
      }
      this.persistState();
    }
  }

  updateStorage(dt) {
    const items = this.state.storage.items;
    let changed = false;
    for (const [type, entry] of Object.entries(items)) {
      const spoilTime = CONSTANTS.storage.spoilTimes[type];
      if (!spoilTime || entry.amount <= 0) continue;
      entry.spoilProgress += (dt * entry.amount) / spoilTime;
      while (entry.spoilProgress >= 1 && entry.amount > 0) {
        entry.amount -= 1;
        entry.spoilProgress -= 1;
        this.toast.show(`${type} частично испортился`, "info");
        changed = true;
      }
    }
    if (changed) {
      this.updateHUD();
      if (this.debugEnabled) {
        this.renderDebugPanel();
      }
      this.persistState();
    }
  }

  updateFactory(dt) {
    const factory = this.state.factory;
    let changed = false;
    let refreshUI = false;
    if (!factory.currentTask && factory.queue.length > 0) {
      factory.currentTask = factory.queue.shift();
      factory.currentTask.progress = 0;
      changed = true;
      refreshUI = true;
    }
    if (factory.currentTask) {
      factory.currentTask.progress += dt;
      if (factory.currentTask.progress >= factory.currentTask.duration) {
        if (this.storageManager.hasSpace(factory.currentTask.outputAmount)) {
          this.storageManager.add("juice", factory.currentTask.outputAmount);
          this.toast.show("Партия товара готова", "success");
          this.playSound("success");
        } else {
          this.toast.show("Нет места для готовой продукции", "error");
          factory.currentTask.progress = 0;
          factory.queue.unshift(factory.currentTask);
        }
        factory.currentTask = null;
        changed = true;
        refreshUI = true;
      }
    }
    if (refreshUI) {
      this.renderFactoryModal();
    }
    if (changed) {
      this.updateHUD();
      if (this.debugEnabled) {
        this.renderDebugPanel();
      }
      this.persistState();
    }
  }

  updateAutoServices() {
    const now = Date.now();
    let changed = false;
    for (const plot of this.state.plots) {
      if (plot.autoWater && now > plot.autoWaterPaidUntil) {
        if (this.state.coins >= CONSTANTS.trees.autoWaterCostPerDay) {
          this.state.coins -= CONSTANTS.trees.autoWaterCostPerDay;
          plot.autoWaterPaidUntil = now + 24 * 60 * 60 * 1000;
          changed = true;
        } else {
          plot.autoWater = false;
          this.toast.show("Автополив отключен из-за нехватки монет", "error");
          changed = true;
        }
      }
      if (plot.autoHarvest && now > plot.autoHarvestPaidUntil) {
        if (this.state.coins >= CONSTANTS.trees.autoHarvestCostPerDay) {
          this.state.coins -= CONSTANTS.trees.autoHarvestCostPerDay;
          plot.autoHarvestPaidUntil = now + 24 * 60 * 60 * 1000;
          changed = true;
        } else {
          plot.autoHarvest = false;
          this.toast.show("Автосбор отключен из-за нехватки монет", "error");
          changed = true;
        }
      }
    }
    if (changed) {
      this.updateHUD();
      if (this.debugEnabled) {
        this.renderDebugPanel();
      }
      this.persistState();
    }
  }

  renderDebugOverlay() {
    const overlay = document.getElementById("debug-overlay");
    overlay.classList.toggle("hidden", !this.debugEnabled);
    if (!this.debugEnabled) return;
    const stats = document.getElementById("debug-stats");
    const storage = this.state.storage.items;
    const plotInfo = this.state.plots
      .map((plot) => {
        const treeInfo = plot.trees
          .map((tree) => `${tree.id}: lvl ${tree.level} fruit ${tree.fruitReady}`)
          .join(", ");
        return `${plot.id} lvl ${plot.level} [${treeInfo}]`;
      })
      .join("<br/>");
    stats.innerHTML = `
      <div>FPS: ${this.fps}</div>
      <div>Баланс: ${this.state.coins}</div>
      <div>Склад: ${Object.entries(storage)
        .map(([t, v]) => `${t}:${v.amount}`)
        .join(", ")}</div>
      <div>${plotInfo}</div>
    `;
  }

  render() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2 + this.camera.x, height / 2 + this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    this.renderGrid();
    this.renderAvailablePlots();
    for (const plot of this.state.plots) {
      this.renderPlot(plot);
    }

    ctx.restore();
  }

  renderAvailablePlots() {
    const ownedSet = new Set(
      this.state.plots.map((plot) => `${plot.position.x},${plot.position.y}`)
    );
    for (const pos of this.plotPositions) {
      if (ownedSet.has(`${pos.x},${pos.y}`)) continue;
      const screen = this.plotScreenPosition(pos.x, pos.y);
      this.drawAvailableTile(screen.x, screen.y);
    }
  }

  renderGrid() {
    const ctx = this.ctx;
    const size = 6;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = -size; x <= size; x++) {
      for (let y = -size; y <= size; y++) {
        const screen = this.plotScreenPosition(x, y);
        this.drawDiamond(screen.x, screen.y, CONSTANTS.tile.width, CONSTANTS.tile.height, "rgba(255,255,255,0.03)");
      }
    }
  }

  renderPlot(plot) {
    const ctx = this.ctx;
    const screen = this.plotScreenPosition(plot.position.x, plot.position.y);
    const isHovered = this.hoveredPlot && this.hoveredPlot.id === plot.id;
    const isSelected = this.selectedPlot && this.selectedPlot.id === plot.id;
    this.drawTile(screen.x, screen.y, { hovered: isHovered, selected: isSelected });

    let offsetIndex = 0;
    for (const tree of plot.trees) {
      const offset = this.treeOffset(offsetIndex);
      const hovered =
        this.hoveredTree &&
        this.hoveredTree.plotId === plot.id &&
        this.hoveredTree.index === offsetIndex;
      this.drawTree(screen.x + offset.x, screen.y + offset.y, tree, hovered);
      offsetIndex++;
    }

    if (plot.autoWater || plot.autoHarvest) {
      ctx.save();
      ctx.translate(screen.x, screen.y - CONSTANTS.tile.height / 2 - 18);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "14px sans-serif";
      const text = `${plot.autoWater ? "💧" : ""}${plot.autoHarvest ? "🤖" : ""}`;
      ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
      ctx.restore();
    }
  }

  drawTile(x, y, state = {}) {
    const ctx = this.ctx;
    const width = CONSTANTS.tile.width;
    const height = CONSTANTS.tile.height;
    const halfW = width / 2;
    const halfH = height / 2;
    const baseImg = this.assets.getImage("tile");
    const selectedImg = this.assets.getImage("tile_selected");

    const drawDiamondOverlay = (color) => {
      ctx.beginPath();
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, 0);
      ctx.lineTo(0, halfH);
      ctx.lineTo(-halfW, 0);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    ctx.save();
    ctx.translate(x, y);

    if (baseImg || selectedImg) {
      const sprite = state.selected && selectedImg ? selectedImg : baseImg;
      if (sprite) {
        ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
      } else if (baseImg) {
        ctx.drawImage(baseImg, -width / 2, -height / 2, width, height);
      }
      if (!state.selected) {
        drawDiamondOverlay("rgba(0, 0, 0, 0.22)");
      }
      if (state.hovered && !state.selected) {
        drawDiamondOverlay("rgba(126, 214, 223, 0.35)");
      }
      if (state.selected) {
        drawDiamondOverlay("rgba(255, 189, 74, 0.45)");
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, 0);
      ctx.lineTo(0, halfH);
      ctx.lineTo(-halfW, 0);
      ctx.closePath();
      ctx.fillStyle = "#244033";
      ctx.fill();
      ctx.strokeStyle = "#0d1c16";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (state.selected) {
        ctx.fillStyle = "rgba(255, 189, 74, 0.65)";
        ctx.fill();
      } else if (state.hovered) {
        ctx.fillStyle = "rgba(126, 214, 223, 0.55)";
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawAvailableTile(x, y) {
    const ctx = this.ctx;
    const width = CONSTANTS.tile.width;
    const height = CONSTANTS.tile.height;
    const halfW = width / 2;
    const halfH = height / 2;
    const baseImg = this.assets.getImage("tile");
    ctx.save();
    ctx.translate(x, y);
    if (baseImg) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(baseImg, -width / 2, -height / 2, width, height);
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, 0);
      ctx.lineTo(0, halfH);
      ctx.lineTo(-halfW, 0);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
      gradient.addColorStop(0, "rgba(120, 190, 255, 0.15)");
      gradient.addColorStop(1, "rgba(60, 100, 180, 0.1)");
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(halfW, 0);
    ctx.lineTo(0, halfH);
    ctx.lineTo(-halfW, 0);
    ctx.closePath();
    ctx.strokeStyle = "rgba(132, 196, 255, 0.5)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawDiamond(x, y, w, h, color) {
    const ctx = this.ctx;
    const halfW = w / 2;
    const halfH = h / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(halfW, 0);
    ctx.lineTo(0, halfH);
    ctx.lineTo(-halfW, 0);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  drawTree(x, y, tree, highlight = false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    const ready = Boolean(tree && tree.fruitReady > 0);
    ctx.save();
    ctx.scale(1, 0.55);
    ctx.beginPath();
    let ringRadius = 16;
    let ringColor = "rgba(0, 0, 0, 0.28)";
    if (!tree) {
      ringRadius = highlight ? 20 : 18;
      ringColor = highlight
        ? "rgba(255, 189, 74, 0.45)"
        : "rgba(255, 255, 255, 0.12)";
    } else if (ready || highlight) {
      ringRadius = highlight ? 22 : 18;
      ringColor = highlight
        ? "rgba(255, 210, 102, 0.55)"
        : "rgba(255, 210, 102, 0.28)";
    }
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.fillStyle = ringColor;
    ctx.fill();
    ctx.restore();

    if (!tree) {
      ctx.fillStyle = highlight ? "rgba(255, 220, 140, 0.9)" : "rgba(255, 255, 255, 0.45)";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", 0, -2);
      ctx.restore();
      return;
    }

    const spriteKey = this.treeSpriteKey(tree);
    const sprite = spriteKey ? this.assets.getImage(spriteKey) : null;

    if (sprite) {
      const maxWidth = CONSTANTS.tile.width * 0.9;
      const width = maxWidth;
      const height = sprite.height * (width / sprite.width);
      const baseOffset = CONSTANTS.tile.height * 0.43;
      if (highlight || ready) {
        const canopyCenterY = -height + baseOffset + height * 0.35;
        ctx.save();
        ctx.globalAlpha = highlight ? 0.45 : 0.32;
        ctx.fillStyle = "rgba(255, 210, 102, 0.6)";
        ctx.beginPath();
        ctx.ellipse(0, canopyCenterY, width * 0.45, height * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.drawImage(sprite, -width / 2, -height + baseOffset, width, height);
    } else {
      ctx.save();
      ctx.translate(0, -32);
      ctx.scale(0.9, 0.9);
      if (highlight || ready) {
        ctx.shadowColor = "rgba(255, 210, 102, 0.4)";
        ctx.shadowBlur = highlight ? 26 : 14;
        ctx.shadowOffsetY = 4;
      }
      ctx.fillStyle = "#543a2d";
      ctx.fillRect(-6, 0, 12, 34);
      const canopyColors = ["#42562f", "#4d7c2d", "#64a338", "#7fc14a", "#92d35d"];
      const color = canopyColors[Math.min(tree.level, canopyColors.length - 1)];
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(0, -16, 26 + tree.level * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (tree.fruitReady > 0) {
      ctx.save();
      ctx.translate(0, -58);
      ctx.fillStyle = "rgba(12, 18, 12, 0.82)";
      ctx.fillRect(-30, -12, 60, 20);
      ctx.strokeStyle = "rgba(255, 210, 102, 0.6)";
      ctx.strokeRect(-30, -12, 60, 20);
      ctx.fillStyle = "#ffd45c";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`🍎${tree.fruitReady}`, 0, -2);
      ctx.restore();
    }

    ctx.restore();
  }

  treeSpriteKey(tree) {
    if (!tree) return null;
    if (tree.level <= 0) return "tree_seed";
    if (tree.level === 1) return "tree_sapling";
    if (tree.level === 2) return "tree_sapling";
    return "tree_mature";
  }

  treeOffset(index) {
    const baseOffsets = [
      { x: 0, y: -8 },
      { x: -26, y: 8 },
      { x: 26, y: 8 },
      { x: 0, y: 24 },
      { x: -34, y: -18 },
      { x: 34, y: -18 },
    ];
    if (index < baseOffsets.length) {
      return baseOffsets[index];
    }
    const extra = index - baseOffsets.length;
    const row = Math.floor(extra / 2) + 1;
    const dir = extra % 2 === 0 ? -1 : 1;
    return {
      x: dir * (30 + row * 6),
      y: 24 + row * 14,
    };
  }

  plotScreenPosition(x, y) {
    const tileW = CONSTANTS.tile.width / 2;
    const tileH = CONSTANTS.tile.height / 2;
    return {
      x: (x - y) * tileW,
      y: (x + y) * tileH,
    };
  }

  generatePlotPositions(radius) {
    const positions = [];
    for (let r = 0; r <= radius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -r; y <= r; y++) {
          if (Math.abs(x) !== r && Math.abs(y) !== r) continue;
          positions.push({ x, y });
        }
      }
    }
    const unique = [];
    const seen = new Set();
    for (const pos of positions) {
      const key = `${pos.x},${pos.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(pos);
    }
    unique.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    if (!unique.find((pos) => pos.x === 0 && pos.y === 0)) {
      unique.unshift({ x: 0, y: 0 });
    }
    return unique;
  }

  playSound(key) {
    this.assets.play(key);
  }
}

async function main() {
  const manifest = await fetch(ASSET_MANIFEST_PATH).then((r) => r.json());
  const assets = new AssetManager(manifest);
  await assets.loadAll();
  const canvas = document.getElementById("game-canvas");
  new Game(canvas, assets);
}

document.addEventListener("DOMContentLoaded", () => {
  if (audioContext) {
    window.addEventListener(
      "click",
      () => {
        if (audioContext.state === "suspended") audioContext.resume();
      },
      { once: true }
    );
  }
  main();
});
