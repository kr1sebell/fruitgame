import { Game } from './game.js';
import { UI } from './ui.js';

const game = new Game();
const ui = new UI(game);
ui.init();
game.start();

// Удобно для отладки из консоли
window.orangeParadise = { game };
