import { MainScene } from './src/scenes/MainScene.js';

const container = document.getElementById('game-container');

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: container,
  backgroundColor: '#74b9ff',
  pixelArt: true,
  scene: [MainScene]
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  game.scale.resize(width, height);
});
