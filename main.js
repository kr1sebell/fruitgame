import { MainScene } from './src/scenes/MainScene.js';

const container = document.getElementById('game-container');

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: Math.floor(window.innerHeight * 0.68),
  parent: container,
  backgroundColor: '#74b9ff',
  scene: [MainScene]
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = Math.floor(window.innerHeight * 0.68);
  game.scale.resize(width, height);
});
