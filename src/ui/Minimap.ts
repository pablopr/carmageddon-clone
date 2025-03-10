import * as THREE from 'three';
import { Vehicle } from '../entities/vehicles/Vehicle';
import { Human } from '../entities/npcs/Human';
import { Animal } from '../entities/npcs/Animal';
import { NPCManager } from '../systems/NPCManager';

/**
 * Minimap class to render a 2D top-down view of the game world
 * - Shows player position at center
 * - Humans as white dots
 * - Animals as red dots
 * - Vehicle direction indicated by an arrow
 */
export class Minimap {
  private container: HTMLElement;
  private minimap: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private playerVehicle: Vehicle | null = null;
  private npcManager: NPCManager | null = null;
  
  // Minimap settings
  private readonly size: number = 150; // Size in pixels
  private readonly scale: number = 0.5; // Scale factor (higher = more zoomed out)
  private readonly bgColor: string = 'rgba(0, 0, 0, 0.7)'; // Background color
  private readonly playerColor: string = '#ffff00'; // Yellow for player
  private readonly humanColor: string = '#ffffff'; // White for humans
  private readonly animalColor: string = '#ff0000'; // Red for animals
  private readonly roadColor: string = '#555555'; // Grey for roads
  private readonly buildingColor: string = '#222222'; // Dark grey for buildings
  private readonly borderColor: string = '#aaaaaa'; // Border color
  
  /**
   * Constructor
   * @param container DOM element to append the minimap to
   */
  constructor(container: HTMLElement) {
    this.container = container;
    
    // Create canvas element
    this.minimap = document.createElement('canvas');
    this.minimap.width = this.size;
    this.minimap.height = this.size;
    this.minimap.style.position = 'absolute';
    this.minimap.style.bottom = '20px';
    this.minimap.style.right = '20px';
    this.minimap.style.border = `2px solid ${this.borderColor}`;
    this.minimap.style.borderRadius = '5px';
    this.minimap.style.zIndex = '1000';
    
    // Get 2D context
    const context = this.minimap.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context for minimap canvas');
    }
    this.ctx = context;
    
    // Add to container
    this.container.appendChild(this.minimap);
  }
  
  /**
   * Set the player vehicle to track
   * @param vehicle Player vehicle
   */
  public setPlayerVehicle(vehicle: Vehicle): void {
    this.playerVehicle = vehicle;
  }
  
  /**
   * Set the NPC manager to get NPCs from
   * @param npcManager NPC manager
   */
  public setNPCManager(npcManager: NPCManager): void {
    this.npcManager = npcManager;
  }
  
  /**
   * Update the minimap
   */
  public update(): void {
    if (!this.ctx || !this.playerVehicle) return;
    
    // Clear canvas
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.size, this.size);
    
    // Get player position
    const playerPosition = this.playerVehicle.getPosition();
    
    // Center of minimap
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    
    // Draw roads (simplified grid)
    this.drawRoadsGrid(centerX, centerY, playerPosition);
    
    // Draw player
    this.drawPlayer(centerX, centerY);
    
    // Draw NPCs if NPC manager is set
    if (this.npcManager) {
      this.drawNPCs(centerX, centerY, playerPosition);
    }
  }
  
  /**
   * Draw a simplified grid representing roads
   */
  private drawRoadsGrid(centerX: number, centerY: number, playerPosition: THREE.Vector3): void {
    this.ctx.strokeStyle = this.roadColor;
    this.ctx.lineWidth = 1;
    
    // Draw horizontal roads
    for (let i = -100; i <= 100; i += 20) {
      // Convert world coordinates to minimap coordinates
      const y = centerY + ((i - playerPosition.z) / this.scale);
      
      if (y >= 0 && y <= this.size) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.size, y);
        this.ctx.stroke();
      }
    }
    
    // Draw vertical roads
    for (let i = -100; i <= 100; i += 20) {
      // Convert world coordinates to minimap coordinates
      const x = centerX + ((i - playerPosition.x) / this.scale);
      
      if (x >= 0 && x <= this.size) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.size);
        this.ctx.stroke();
      }
    }
  }
  
  /**
   * Draw the player as an arrow indicating direction
   */
  private drawPlayer(centerX: number, centerY: number): void {
    if (!this.playerVehicle) return;
    
    const direction = this.playerVehicle.getDirection();
    
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(direction);
    
    // Draw arrow
    this.ctx.fillStyle = this.playerColor;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -8);  // Top point
    this.ctx.lineTo(-5, 8);  // Bottom left
    this.ctx.lineTo(5, 8);   // Bottom right
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.restore();
  }
  
  /**
   * Draw NPCs on the minimap
   */
  private drawNPCs(centerX: number, centerY: number, playerPosition: THREE.Vector3): void {
    if (!this.npcManager) return;
    
    // Get all humans and animals from NPC manager
    const humans = this.npcManager['humans'] as Human[];
    const animals = this.npcManager['animals'] as Animal[];
    
    // Draw humans as white dots
    this.ctx.fillStyle = this.humanColor;
    for (const human of humans) {
      const position = human.getPosition();
      const x = centerX + ((position.x - playerPosition.x) / this.scale);
      const y = centerY + ((position.z - playerPosition.z) / this.scale);
      
      // Only draw if within minimap bounds
      if (x >= 0 && x <= this.size && y >= 0 && y <= this.size) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    // Draw animals as red dots
    this.ctx.fillStyle = this.animalColor;
    for (const animal of animals) {
      const position = animal.getPosition();
      const x = centerX + ((position.x - playerPosition.x) / this.scale);
      const y = centerY + ((position.z - playerPosition.z) / this.scale);
      
      // Only draw if within minimap bounds
      if (x >= 0 && x <= this.size && y >= 0 && y <= this.size) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
  
  /**
   * Show the minimap
   */
  public show(): void {
    this.minimap.style.display = 'block';
  }
  
  /**
   * Hide the minimap
   */
  public hide(): void {
    this.minimap.style.display = 'none';
  }
} 