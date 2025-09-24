import { FACTORY_RECIPES, FACTORY_PROCESS_TIME } from '../gameConfig.js';

let batchCounter = 0;

export class Factory {
  constructor(scene, data) {
    this.scene = scene;
    this.level = data.level || 1;
    this.queue = (data.queue || []).map((job) => ({ ...job }));
    this.sprite = null;
  }

  createSprite(position) {
    if (this.sprite) {
      this.sprite.destroy();
    }
    this.sprite = this.scene.add.image(position.x, position.y, 'factory');
    this.sprite.setOrigin(0.5, 0.8);
    this.sprite.setDepth(position.y + 10);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.setData('factory', this);
    this.sprite.setData('ui', false);
    this.sprite.on('pointerdown', (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      this.scene.ui?.flashFactoryPanel();
      this.scene.events.emit('factory:selected', this);
    });
    this.sprite.on('pointerover', () => {
      this.sprite.setTint(0xffd180);
    });
    this.sprite.on('pointerout', () => {
      this.sprite.clearTint();
    });
  }

  enqueue(type) {
    const recipe = FACTORY_RECIPES[type];
    if (!recipe) {
      return false;
    }
    batchCounter += 1;
    this.queue.push({
      id: `batch-${batchCounter}`,
      type,
      progress: 0,
      ready: false
    });
    this.scene.events.emit('factory:queue-changed');
    return true;
  }

  update(delta) {
    this.queue.forEach((job) => {
      if (job.ready) return;
      job.progress += delta / (FACTORY_PROCESS_TIME * 1000);
      if (job.progress >= 1) {
        job.progress = 1;
        job.ready = true;
        this.scene.events.emit('factory:job-ready', job);
      }
    });
  }

  collect(jobId) {
    const job = this.queue.find((item) => item.id === jobId);
    if (!job || !job.ready) {
      return false;
    }
    const recipe = FACTORY_RECIPES[job.type];
    if (!recipe) {
      return false;
    }
    const canStore = this.scene.player.storage.hasSpace(recipe.output.amount);
    if (!canStore) {
      this.scene.events.emit('ui:toast', 'Нет места на складе для продукции');
      return false;
    }
    this.scene.player.storage.addProduct(
      recipe.output.type,
      recipe.output.amount,
      recipe.output.value
    );
    this.queue = this.queue.filter((item) => item.id !== jobId);
    this.scene.events.emit('factory:queue-changed');
    return true;
  }

  toJSON() {
    return {
      level: this.level,
      queue: this.queue
    };
  }
}
