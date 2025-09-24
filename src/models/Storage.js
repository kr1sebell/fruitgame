import { STORAGE_CAPACITY, SPOIL_SECONDS } from '../gameConfig.js';

let cropCounter = 0;

export class Storage {
  constructor(scene, data) {
    this.scene = scene;
    this.level = data.level || 1;
    this.crops = data.crops || [];
    this.products = data.products || [];
  }

  get capacity() {
    return STORAGE_CAPACITY[this.level] || STORAGE_CAPACITY.at(-1);
  }

  get usedSlots() {
    const cropAmount = this.crops.reduce((acc, item) => acc + item.amount, 0);
    const productAmount = this.products.reduce((acc, item) => acc + item.amount, 0);
    return cropAmount + productAmount;
  }

  hasSpace(amount) {
    return this.usedSlots + amount <= this.capacity;
  }

  addCrop(type, amount, valuePerUnit) {
    const now = Date.now();
    for (let i = 0; i < amount; i += 1) {
      if (!this.hasSpace(1)) {
        break;
      }
      cropCounter += 1;
      this.crops.push({
        id: `crop-${cropCounter}`,
        type,
        amount: 1,
        value: valuePerUnit,
        harvestedAt: now,
        expiresAt: now + SPOIL_SECONDS * 1000
      });
    }
  }

  removeCrop(type, count) {
    const removed = [];
    this.crops = this.crops.filter((item) => {
      if (removed.length < count && item.type === type) {
        removed.push(item);
        return false;
      }
      return true;
    });
    return removed;
  }

  addProduct(type, amount, value) {
    const existing = this.products.find((p) => p.type === type);
    if (existing) {
      existing.amount += amount;
      existing.value = value;
    } else {
      this.products.push({ type, amount, value });
    }
  }

  removeProduct(type, amount) {
    const product = this.products.find((p) => p.type === type);
    if (!product || product.amount < amount) {
      return false;
    }
    product.amount -= amount;
    if (product.amount <= 0) {
      this.products = this.products.filter((p) => p.type !== type);
    }
    return true;
  }

  sellCrops(type = null) {
    let total = 0;
    this.crops = this.crops.filter((item) => {
      const expired = item.expiresAt <= Date.now();
      if (expired) {
        return false;
      }
      if (!type || item.type === type) {
        total += item.value;
        return false;
      }
      return true;
    });
    return total;
  }

  sellProducts(type = null) {
    let total = 0;
    this.products = this.products.filter((product) => {
      if (!type || product.type === type) {
        total += product.value * product.amount;
        return false;
      }
      return true;
    });
    return total;
  }

  purgeSpoiled() {
    const before = this.crops.length;
    this.crops = this.crops.filter((item) => item.expiresAt > Date.now());
    return before - this.crops.length;
  }

  upgrade() {
    this.level = Math.min(this.level + 1, STORAGE_CAPACITY.length - 1);
  }

  toJSON() {
    return {
      level: this.level,
      crops: this.crops,
      products: this.products
    };
  }
}
