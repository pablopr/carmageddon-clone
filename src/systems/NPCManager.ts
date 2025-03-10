import * as THREE from 'three';
import { PhysicsWorld } from '../core/physics/PhysicsWorld';
import { Human } from '../entities/npcs/Human';
import { Animal, AnimalType } from '../entities/npcs/Animal';
import { CollisionManager, CollisionObjectType } from './CollisionManager';
import { Vehicle } from '../entities/vehicles/Vehicle';

/**
 * Manages NPC spawning and behavior
 */
export class NPCManager {
  // Array of active NPCs
  private humans: Human[] = [];
  private animals: Animal[] = [];
  
  // Spawn settings for humans
  private maxHumans: number = 200; // Increased from 30
  private humanSpawnInterval: number = 1500; // Reduced from 3000 to 1.5 seconds
  private lastHumanSpawnTime: number = 0;
  
  // Spawn settings for animals
  private maxAnimals: number = 150; // Increased from 15
  private animalSpawnInterval: number = 2000; // Reduced from 5000 to 2 seconds
  private lastAnimalSpawnTime: number = 0;
  
  // Animal spawn ratios
  private animalTypeRatios = {
    [AnimalType.DOG]: 0.3,    // 30% dogs
    [AnimalType.CAT]: 0.3,    // 30% cats
    [AnimalType.COW]: 0.1,    // 10% cows
    [AnimalType.DEER]: 0.2,   // 20% deer
    [AnimalType.BIRD]: 0.1    // 10% birds
  };
  
  // Panic radius (NPCs within this radius of the vehicle will panic/flee)
  private panicRadius: number = 15;
  
  // Player vehicle reference
  private playerVehicle: Vehicle | null = null;
  
  // Maximum total NPCs for performance control
  private maxTotalNPCs: number = 350; // Higher but still reasonable for performance
  
  /**
   * Constructor
   * @param scene THREE.js scene
   * @param physicsWorld Physics world
   * @param collisionManager Collision manager for registering NPCs
   */
  constructor(
    private scene: THREE.Scene,
    private physicsWorld: PhysicsWorld,
    private collisionManager: CollisionManager
  ) {}
  
  /**
   * Set the player vehicle
   * @param vehicle Player vehicle
   */
  public setPlayerVehicle(vehicle: Vehicle): void {
    this.playerVehicle = vehicle;
  }
  
  /**
   * Update all NPCs
   * @param deltaTime Time since last update
   */
  public update(deltaTime: number): void {
    const now = Date.now();
    
    // Attempt to spawn new humans at regular intervals
    if (now - this.lastHumanSpawnTime > this.humanSpawnInterval) {
      this.trySpawnHuman();
      this.lastHumanSpawnTime = now;
    }
    
    // Attempt to spawn new animals at regular intervals
    if (now - this.lastAnimalSpawnTime > this.animalSpawnInterval) {
      this.trySpawnAnimal();
      this.lastAnimalSpawnTime = now;
    }
    
    // Update all humans
    for (let i = this.humans.length - 1; i >= 0; i--) {
      const human = this.humans[i];
      
      // Update the human
      human.update(deltaTime);
      
      // Check if human is too far away, if so remove it
      const position = human.getPosition();
      if (position.length() > 150) {
        this.removeHuman(i);
        continue;
      }
      
      // Make humans panic if the player vehicle is nearby
      if (this.playerVehicle) {
        const vehiclePosition = this.playerVehicle.getPosition();
        const distanceToVehicle = position.distanceTo(vehiclePosition);
        
        if (distanceToVehicle < this.panicRadius) {
          human.panic(vehiclePosition);
        }
      }
    }
    
    // Update all animals
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i];
      
      // Update the animal
      animal.update(deltaTime);
      
      // Check if animal is too far away, if so remove it
      const position = animal.getPosition();
      if (position.length() > 150) {
        this.removeAnimal(i);
        continue;
      }
      
      // Make animals flee if the player vehicle is nearby
      if (this.playerVehicle) {
        const vehiclePosition = this.playerVehicle.getPosition();
        const distanceToVehicle = position.distanceTo(vehiclePosition);
        
        if (distanceToVehicle < this.panicRadius) {
          animal.flee(vehiclePosition);
        }
      }
    }
  }
  
  /**
   * Try to spawn a new human NPC
   */
  private trySpawnHuman(): void {
    // Check if we've reached the maximum number of NPCs
    if (this.humans.length >= this.maxHumans) return;
    
    // Get the current number of NPCs in the scene
    if (this.getTotalNPCCount() > this.maxTotalNPCs) {
      console.log('Too many NPCs, skipping human spawn');
      return; // Too many NPCs, could cause performance issues
    }
    
    // Create multiple humans at once to populate the scene faster
    const spawnCount = Math.min(3, this.maxHumans - this.humans.length);
    
    for (let i = 0; i < spawnCount; i++) {
      // Choose a spawn position on a sidewalk near the road but not too close to the player
      const spawnPosition = this.findSpawnPosition(true); // true for urban area
      if (!spawnPosition) continue;
      
      // Create a new human NPC
      const human = new Human(this.scene, this.physicsWorld, spawnPosition);
      
      // Register with collision manager - add safety checks
      try {
        const body = human.getBody();
        if (body) {
          this.collisionManager.registerObject(
            body,
            CollisionObjectType.HUMAN_NPC
          );
        }
      } catch (error) {
        console.error('Error registering human NPC for collision detection:', error);
      }
      
      // Add to active humans list
      this.humans.push(human);
    }
  }
  
  /**
   * Try to spawn a new animal NPC
   */
  private trySpawnAnimal(): void {
    // Check if we've reached the maximum number of animals
    if (this.animals.length >= this.maxAnimals) return;
    
    // Get the current number of NPCs in the scene
    if (this.getTotalNPCCount() > this.maxTotalNPCs) {
      console.log('Too many NPCs, skipping animal spawn');
      return; // Too many NPCs, could cause performance issues
    }
    
    // Create multiple animals at once to populate the scene faster
    const spawnCount = Math.min(2, this.maxAnimals - this.animals.length);
    
    for (let i = 0; i < spawnCount; i++) {
      // Choose an animal type based on probabilities
      const animalType = this.selectRandomAnimalType();
      
      // Choose a spawn position based on animal type
      // For urban animals (dogs, cats, birds) spawn in urban areas
      // For rural animals (cows, deer) spawn in less urban areas
      const isUrban = animalType === AnimalType.DOG || 
                      animalType === AnimalType.CAT || 
                      animalType === AnimalType.BIRD;
      const spawnPosition = this.findSpawnPosition(isUrban);
      if (!spawnPosition) continue;
      
      // Birds can start at a higher position
      if (animalType === AnimalType.BIRD) {
        spawnPosition.y = 3 + Math.random() * 7; // Random height between 3-10 units
      }
      
      // Create a new animal NPC
      const animal = new Animal(this.scene, this.physicsWorld, animalType, spawnPosition);
      
      // Register with collision manager
      try {
        const body = animal.getBody();
        if (body) {
          this.collisionManager.registerObject(
            body,
            CollisionObjectType.ANIMAL_NPC
          );
        }
      } catch (error) {
        console.error('Error registering animal NPC for collision detection:', error);
      }
      
      // Add to active animals list
      this.animals.push(animal);
    }
  }
  
  /**
   * Select a random animal type based on configured ratios
   */
  private selectRandomAnimalType(): AnimalType {
    const random = Math.random();
    let cumulativeProb = 0;
    
    // Go through each animal type and its probability
    for (const [type, probability] of Object.entries(this.animalTypeRatios)) {
      cumulativeProb += probability;
      if (random < cumulativeProb) {
        return type as AnimalType;
      }
    }
    
    // Default to dog if something goes wrong
    return AnimalType.DOG;
  }
  
  /**
   * Find a valid spawn position for an NPC
   * @param urbanArea Whether to spawn in an urban area (true) or rural area (false)
   * @returns Spawn position or null if none found
   */
  private findSpawnPosition(urbanArea: boolean = true): THREE.Vector3 | null {
    // If we have a player vehicle, use its position as a reference
    const basePosition = this.playerVehicle ? 
      this.playerVehicle.getPosition().clone() : 
      new THREE.Vector3(0, 0, 0);
    
    // Spawn parameters
    let minDistance: number;
    let maxDistance: number;
    
    if (urbanArea) {
      // Urban areas - closer to player, closer to roads
      minDistance = 50;
      maxDistance = 100;
    } else {
      // Rural areas - further from player, near edges of map
      minDistance = 80;
      maxDistance = 150;
    }
    
    // Try several positions until we find a valid one
    for (let i = 0; i < 10; i++) {
      // Generate a random angle and distance
      const angle = Math.random() * Math.PI * 2;
      const distance = minDistance + Math.random() * (maxDistance - minDistance);
      
      // Calculate position
      const posX = basePosition.x + Math.sin(angle) * distance;
      const posZ = basePosition.z + Math.cos(angle) * distance;
      const position = new THREE.Vector3(posX, 0, posZ);
      
      // Check if the position is valid (not colliding with buildings, etc.)
      if (this.isValidSpawnPosition(position)) {
        return position;
      }
    }
    
    // Couldn't find a valid position
    return null;
  }
  
  /**
   * Check if a position is valid for spawning an NPC
   * @param position Position to check
   * @returns True if valid
   */
  private isValidSpawnPosition(position: THREE.Vector3): boolean {
    // Check distance to other NPCs
    for (const human of this.humans) {
      if (human.getPosition().distanceTo(position) < 5) {
        return false; // Too close to another human
      }
    }
    
    for (const animal of this.animals) {
      if (animal.getPosition().distanceTo(position) < 5) {
        return false; // Too close to another animal
      }
    }
    
    // We would ideally check for collisions with buildings, etc.
    // But for simplicity, we'll assume it's valid if not too close to other NPCs
    return true;
  }
  
  /**
   * Remove a human by index
   * @param index Index in the humans array
   */
  private removeHuman(index: number): void {
    const human = this.humans[index];
    human.dispose();
    this.humans.splice(index, 1);
  }
  
  /**
   * Remove an animal by index
   * @param index Index in the animals array
   */
  private removeAnimal(index: number): void {
    const animal = this.animals[index];
    animal.dispose();
    this.animals.splice(index, 1);
  }
  
  /**
   * Clear all NPCs
   */
  public clear(): void {
    // Remove all humans
    for (const human of this.humans) {
      human.dispose();
    }
    this.humans = [];
    
    // Remove all animals
    for (const animal of this.animals) {
      animal.dispose();
    }
    this.animals = [];
  }
  
  /**
   * Get the number of active humans
   * @returns Number of active human NPCs
   */
  public getHumanCount(): number {
    return this.humans.length;
  }
  
  /**
   * Get the number of active animals
   * @returns Number of active animal NPCs
   */
  public getAnimalCount(): number {
    return this.animals.length;
  }
  
  /**
   * Get the total number of NPCs
   * @returns Total number of NPCs
   */
  public getTotalNPCCount(): number {
    return this.humans.length + this.animals.length;
  }
} 