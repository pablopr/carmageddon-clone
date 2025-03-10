/**
 * GameMenu class handles the initial game menu screen with Carmageddon-style UI
 */
export class GameMenu {
  private container: HTMLElement;
  private startCallback: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Initialize the game menu
   */
  public initialize(): void {
    this.createMenu();
  }

  /**
   * Set callback for when game starts
   */
  public onGameStart(callback: () => void): void {
    this.startCallback = callback;
  }

  /**
   * Create the menu UI elements
   */
  private createMenu(): void {
    // Clear container
    this.container.innerHTML = '';
    
    // Create menu container with Carmageddon-style
    const menuContainer = document.createElement('div');
    menuContainer.className = 'game-menu';
    
    // Game title
    const titleElement = document.createElement('h1');
    titleElement.className = 'game-title';
    titleElement.textContent = 'CARMAGEDDON CLONE';
    
    // Subtitle
    const subtitleElement = document.createElement('h2');
    subtitleElement.className = 'game-subtitle';
    subtitleElement.textContent = 'CARNAGE NEVER DIES';
    
    // Game description
    const descriptionElement = document.createElement('div');
    descriptionElement.className = 'game-description';
    descriptionElement.innerHTML = `
      <p>Welcome to the most violent driving experience!</p>
      <p>Drive through the city, earn points by hitting pedestrians, and avoid animals at all costs.</p>
      <p>The more pedestrians you hit in a row, the higher your combo multiplier!</p>
    `;
    
    // How to play section
    const howToPlayElement = document.createElement('div');
    howToPlayElement.className = 'how-to-play';
    howToPlayElement.innerHTML = `
      <h3>HOW TO PLAY</h3>
      <ul>
        <li>W / ↑ - Accelerate</li>
        <li>S / ↓ - Brake / Reverse</li>
        <li>A / ← - Steer Left</li>
        <li>D / → - Steer Right</li>
        <li>SPACE - Handbrake</li>
        <li>C - Switch Camera View (Driver / Close / Standard)</li>
      </ul>
      <p>Hit humans for points (+100). Avoid animals (-200 points)!</p>
    `;
    
    // Start button
    const startButton = document.createElement('button');
    startButton.className = 'start-button';
    startButton.textContent = 'START CARNAGE';
    startButton.addEventListener('click', () => {
      if (this.startCallback) {
        this.startCallback();
      } else {
        console.log('Game would start here, but no callback is set yet.');
      }
    });
    
    // Append all elements to menu container
    menuContainer.appendChild(titleElement);
    menuContainer.appendChild(subtitleElement);
    menuContainer.appendChild(descriptionElement);
    menuContainer.appendChild(howToPlayElement);
    menuContainer.appendChild(startButton);
    
    // Add menu to the container
    this.container.appendChild(menuContainer);
  }
} 