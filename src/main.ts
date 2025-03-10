import './style.css'
import { Game } from './game/Game'

// Create the app container
document.body.innerHTML = `
  <div id="app">
    <div id="game-container"></div>
  </div>
`;

// Initialize the game
const gameContainer = document.getElementById('game-container');
if (gameContainer) {
  const game = new Game(gameContainer);
  game.initialize();
} else {
  console.error('Game container not found!');
}
