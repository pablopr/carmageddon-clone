import { Engine } from '../core/Engine';
import { GameMenu } from '../ui/GameMenu';

/**
 * Main game class that manages the game state and connects the engine with the UI
 */
export class Game {
  private engine: Engine | null = null;
  private gameMenu: GameMenu;
  private container: HTMLElement;
  private isGameRunning: boolean = false;
  private isGameInitializing: boolean = false;

  /**
   * Constructor
   * @param container DOM element to render the game in
   */
  constructor(container: HTMLElement) {
    this.container = container;
    this.gameMenu = new GameMenu(container);
    
    // Setup game menu start callback
    this.gameMenu.onGameStart(() => {
      this.startGame();
    });
    
    // Listen for back to menu event
    window.addEventListener('backToMenu', this.handleBackToMenu.bind(this));
  }

  /**
   * Initialize the game
   */
  public initialize(): void {
    // Show the game menu first
    this.gameMenu.initialize();
  }

  /**
   * Start the game after menu
   */
  private async startGame(): Promise<void> {
    if (this.isGameRunning || this.isGameInitializing) return;
    this.isGameInitializing = true;
    
    // Show simple loading indicator
    this.showLoadingIndicator();
    
    // Clear container from menu
    this.container.innerHTML = '';
    
    try {
      // Create the 3D engine
      this.engine = new Engine(this.container);
      
      // Initialize and generate city (async operation)
      await this.engine.initialize();
      
      // Start the engine
      this.engine.start();
      
      this.isGameRunning = true;
      this.isGameInitializing = false;
      
      // Log game start
      console.log('Game started!');
    } catch (error) {
      console.error('Error starting game:', error);
      
      // If there's an error, go back to menu
      this.isGameInitializing = false;
      this.showMenu();
    }
  }
  
  /**
   * Show a simple loading indicator during initialization
   */
  private showLoadingIndicator(): void {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.style.position = 'absolute';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.color = '#ffffff';
    loadingDiv.style.fontSize = '24px';
    loadingDiv.style.fontFamily = 'Arial, sans-serif';
    loadingDiv.textContent = 'Loading game environment...';
    
    this.container.appendChild(loadingDiv);
  }

  /**
   * Stop the game
   */
  public stopGame(): void {
    if (!this.isGameRunning || !this.engine) return;
    
    this.engine.stop();
    this.isGameRunning = false;
    
    // Show menu again
    this.showMenu();
    
    console.log('Game stopped!');
  }
  
  /**
   * Show the menu
   */
  private showMenu(): void {
    // Clear container
    this.container.innerHTML = '';
    
    // Initialize menu
    this.gameMenu = new GameMenu(this.container);
    this.gameMenu.initialize();
    this.gameMenu.onGameStart(() => {
      this.startGame();
    });
  }
  
  /**
   * Handle back to menu event
   */
  private handleBackToMenu(): void {
    this.stopGame();
  }
} 