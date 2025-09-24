export class Crop {
  constructor({ type, value, harvestedAt, expiresAt }) {
    this.type = type;
    this.value = value;
    this.harvestedAt = harvestedAt;
    this.expiresAt = expiresAt;
  }

  get remainingSeconds() {
    return Math.max(0, Math.floor((this.expiresAt - Date.now()) / 1000));
  }
}
