import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vehicle } from '../entities/vehicles/Vehicle';
import { PhysicsWorld } from '../core/physics/PhysicsWorld';

// Enum for object types involved in collisions
export enum CollisionObjectType {
  VEHICLE = 'vehicle',
  BUILDING = 'building',
  HUMAN_NPC = 'human_npc',
  ANIMAL_NPC = 'animal_npc',
  PROP = 'prop',
  GROUND = 'ground',
  MISC = 'misc'
}

// Collision event data
export interface CollisionEvent {
  bodyA: CANNON.Body;
  bodyB: CANNON.Body;
  contact: CANNON.ContactEquation;
  target: THREE.Object3D | null;
  targetType: CollisionObjectType;
  impactVelocity: number;
  collisionPoint: THREE.Vector3;
}

// Collision callback type
export type CollisionCallback = (event: CollisionEvent) => void;

/**
 * Manages collision detection, scoring, and audio/visual feedback
 */
export class CollisionManager {
  // Reference to the player vehicle
  private vehicle: Vehicle | null = null;
  
  // Reference to the physics world
  private physicsWorld: PhysicsWorld;
  
  // Scene reference for visual effects
  private scene: THREE.Scene;
  
  // Track registered collision callbacks
  private collisionCallbacks: CollisionCallback[] = [];
  
  // Track combo system
  private consecutiveHumanHits: number = 0;
  private lastHitTime: number = 0;
  private comboTimeWindow: number = 5000; // 5 seconds to maintain combo
  
  // Score tracking
  private score: number = 0;
  
  // Object type mapping (body ID to type)
  private objectTypes: Map<number, CollisionObjectType> = new Map();
  
  // Impact sound effects (to be implemented)
  private sounds: any = {
    // Will be populated with actual sound effects
  };
  
  // Particle systems for visual feedback
  private particleSystems: Map<string, THREE.Object3D> = new Map();
  
  // Track objects that have already been hit to prevent multiple collisions
  private hitObjects: Set<number> = new Set();
  
  // Debug mode
  private debugMode: boolean = false;
  
  /**
   * Constructor
   * @param scene Scene reference
   * @param physicsWorld Physics world reference
   */
  constructor(scene: THREE.Scene, physicsWorld: PhysicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    
    // Initialize particle systems
    this.initializeParticleSystems();
    
    // Setup collision detection
    this.setupCollisionEvents();
  }
  
  /**
   * Initialize the particle systems for visual effects
   * This is disabled since we're now using the ParticleSystem class
   */
  private initializeParticleSystems(): void {
    // This method is now disabled, we're using the ParticleSystem class instead
    console.log('Old particle system initialization skipped - using new ParticleSystem class');
  }
  
  /**
   * Setup collision detection events
   */
  private setupCollisionEvents(): void {
    // Register callbacks on the physics world
    this.physicsWorld.registerCollisionCallback(this.handleCollision.bind(this));
  }
  
  /**
   * Set the player vehicle
   * @param vehicle Player vehicle
   */
  public setVehicle(vehicle: Vehicle): void {
    this.vehicle = vehicle;
    
    // Register the vehicle body
    const vehicleBody = vehicle.getBody();
    this.registerObject(vehicleBody, CollisionObjectType.VEHICLE);
  }
  
  /**
   * Register an object for collision detection
   * @param body Physics body
   * @param type Object type
   */
  public registerObject(body: CANNON.Body, type: CollisionObjectType): void {
    if (!body || typeof body.id === 'undefined') {
      console.warn('Attempted to register invalid physics body for collision detection');
      return;
    }
    
    this.objectTypes.set(body.id, type);
    
    // Debug info
    if (this.debugMode) {
      console.log(`Registered object with ID ${body.id} as ${type}`);
    }
  }
  
  /**
   * Register a callback for collision events
   * @param callback Collision callback function
   */
  public registerCollisionCallback(callback: CollisionCallback): void {
    this.collisionCallbacks.push(callback);
  }
  
  /**
   * Handle collision event
   * @param event Cannon.js collision event
   */
  private handleCollision(event: any): void {
    // Don't proceed if vehicle not set
    if (!this.vehicle) return;
    
    // Extract the bodies involved
    const bodyA = event.bodyA;
    const bodyB = event.bodyB;
    
    // Get impact velocity - add null check before accessing contact
    let impactVelocity = 0;
    if (event.contact) {
      impactVelocity = event.contact.getImpactVelocityAlongNormal();
    } else {
      // If no contact data, use a default velocity based on the bodies' relative velocities
      // This is an approximation for when we don't have exact contact data
      const velA = bodyA.velocity;
      const velB = bodyB.velocity;
      const relativeVelocity = new CANNON.Vec3();
      relativeVelocity.copy(velA);
      relativeVelocity.vsub(velB, relativeVelocity);
      impactVelocity = relativeVelocity.length();
    }
    
    // Only process significant collisions
    if (Math.abs(impactVelocity) < 1) return;
    
    // Determine which body is the vehicle and which is the target
    let vehicleBody: CANNON.Body | null = null;
    let targetBody: CANNON.Body | null = null;
    
    if (this.objectTypes.get(bodyA.id) === CollisionObjectType.VEHICLE) {
      vehicleBody = bodyA;
      targetBody = bodyB;
    } else if (this.objectTypes.get(bodyB.id) === CollisionObjectType.VEHICLE) {
      vehicleBody = bodyB;
      targetBody = bodyA;
    }
    
    // If neither body is the vehicle, exit
    if (!vehicleBody || !targetBody) return;
    
    // Get the target object type
    const targetType = this.objectTypes.get(targetBody.id) || CollisionObjectType.MISC;
    
    // Get the target mesh associated with the body
    const targetMesh = this.physicsWorld.getMeshFromBody(targetBody);
    
    // Skip if we've already hit this object recently
    if (this.hitObjects.has(targetBody.id)) return;
    
    // Add to hit objects to prevent multiple collisions in short time
    this.hitObjects.add(targetBody.id);
    setTimeout(() => {
      this.hitObjects.delete(targetBody.id);
    }, 1000); // Reset after 1 second
    
    // Get collision point - handle case when contact is null
    let collisionPoint: THREE.Vector3;
    if (event.contact) {
      collisionPoint = new THREE.Vector3(
        event.contact.bi.position.x + event.contact.ri.x,
        event.contact.bi.position.y + event.contact.ri.y,
        event.contact.bi.position.z + event.contact.ri.z
      );
    } else {
      // Use average of the two bodies' positions as an approximation
      collisionPoint = new THREE.Vector3(
        (bodyA.position.x + bodyB.position.x) / 2,
        (bodyA.position.y + bodyB.position.y) / 2,
        (bodyA.position.z + bodyB.position.z) / 2
      );
    }
    
    // Create collision event data
    const collisionEvent: CollisionEvent = {
      bodyA: bodyA,
      bodyB: bodyB,
      contact: event.contact,
      target: targetMesh,
      targetType: targetType,
      impactVelocity: Math.abs(impactVelocity),
      collisionPoint: collisionPoint
    };
    
    // Process the collision based on target type
    this.processCollision(collisionEvent);
    
    // Notify all registered callbacks
    this.collisionCallbacks.forEach(callback => {
      callback(collisionEvent);
    });
  }
  
  /**
   * Process collision based on target type
   * @param event Collision event
   */
  private processCollision(event: CollisionEvent): void {
    // Apply scoring rules based on target type
    switch (event.targetType) {
      case CollisionObjectType.HUMAN_NPC:
        this.processHumanCollision(event);
        break;
        
      case CollisionObjectType.ANIMAL_NPC:
        this.processAnimalCollision(event);
        break;
        
      case CollisionObjectType.BUILDING:
        this.processBuildingCollision(event);
        break;
        
      case CollisionObjectType.PROP:
        this.processPropCollision(event);
        break;
        
      default:
        // Generic collision handling
        this.createDebrisEffect(event.collisionPoint, event.impactVelocity);
        break;
    }
  }
  
  /**
   * Handle human NPC collision
   * @param event Collision event data
   */
  private processHumanCollision(event: CollisionEvent): void {
    // Check if already handled this collision
    if (this.hitObjects.has(event.bodyB.id)) return;
    
    // Add to hit objects
    this.hitObjects.add(event.bodyB.id);
    
    // Calculate score based on speed (higher speed = more points)
    const scoreBase = 100;
    const speedMultiplier = Math.min(3, event.impactVelocity / 5);
    let scoreGain = Math.round(scoreBase * speedMultiplier);
    
    // Apply combo multiplier if active
    const now = Date.now();
    this.consecutiveHumanHits++;
    this.lastHitTime = now;
    
    // Start with combo of 2x after 3 consecutive hits
    if (this.consecutiveHumanHits >= 3) {
      const comboMultiplier = Math.min(3, 1 + (this.consecutiveHumanHits - 2) * 0.5);
      scoreGain = Math.round(scoreGain * comboMultiplier);
      
      // Display combo feedback
      this.showComboPopup(this.consecutiveHumanHits, comboMultiplier);
    }
    
    // Add to total score
    this.score += scoreGain;
    
    // Show score gain
    this.showScorePopup(event.collisionPoint, `+${scoreGain.toFixed(0)}`, 0xff0000);
    
    // Blood effect handled by ParticleSystem now
    // this.createBloodEffect(event.collisionPoint, event.impactVelocity);
    
    if (this.debugMode) {
      console.log(`Human collision! Score: ${this.score}, Combo: ${this.consecutiveHumanHits}`);
    }
  }
  
  /**
   * Process animal NPC collision
   * @param event Collision event
   */
  private processAnimalCollision(event: CollisionEvent): void {
    // Check if already handled this collision
    if (this.hitObjects.has(event.bodyB.id)) return;
    
    // Add to hit objects
    this.hitObjects.add(event.bodyB.id);
    
    // Animals give negative points!
    this.score -= 200;
    
    // Reset combo
    this.consecutiveHumanHits = 0;
    
    // Show negative score popup
    this.showScorePopup(event.collisionPoint, '-200', 0xff0000);
    
    // Animal impact effect
    const intensity = Math.min(2.0, event.impactVelocity / 5);
    
    // Get particle system from scene if available
    const particleSystem = this.scene.getObjectByName('particleSystem') as any;
    if (particleSystem && particleSystem.createEffect) {
      particleSystem.createEffect(
        'animal_impact',
        event.collisionPoint,
        new THREE.Vector3(0, 1, 0),
        intensity
      );
    }
    
    // Play animal collision sound
    const audioManager = (window as any).audioManager;
    if (audioManager) {
      // Play generic animal collision sound
      audioManager.playCollisionSound('animal', 1.0);
      
      // Determine which specific animal sound to play based on the collision
      const animalType = (event.bodyB as any)._animalType;
      if (animalType) {
        switch (animalType) {
          case 'cow':
            audioManager.playNPCSound('cow_moo');
            break;
          case 'dog':
            audioManager.playNPCSound('dog_bark');
            break;
          case 'cat':
            audioManager.playNPCSound('cat_meow');
            break;
          case 'deer':
            audioManager.playNPCSound('deer_sound');
            break;
          default:
            // No specific sound for this animal type
            break;
        }
      }
    }
    
    if (this.debugMode) {
      console.log(`Animal collision! Score: ${this.score}`);
    }
  }
  
  /**
   * Process building collision
   * @param event Collision event
   */
  private processBuildingCollision(event: CollisionEvent): void {
    // Create debris effect
    this.createDebrisEffect(event.collisionPoint, event.impactVelocity);
    
    // TODO: Play crash sound based on impact velocity
  }
  
  /**
   * Process prop collision
   * @param event Collision event
   */
  private processPropCollision(event: CollisionEvent): void {
    // Create debris effect scaled by impact velocity
    this.createDebrisEffect(event.collisionPoint, event.impactVelocity);
    
    // TODO: Play prop hit sound
  }
  
  /**
   * Create blood particle effect
   * @param position Position to create effect
   * @param intensity Impact intensity for scaling effect
   */
  private createBloodEffect(position: THREE.Vector3, intensity: number): void {
    // Create a new particle system instance
    const bloodSystem = this.particleSystems.get('blood')?.clone();
    if (!bloodSystem) return;
    
    // Calculate number of particles based on intensity
    const particleCount = Math.min(Math.floor(intensity * 10), 50);
    
    // Create particles
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      // Random position within a small sphere around impact point
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      );
      
      // Set position
      positions[i * 3] = position.x + offset.x;
      positions[i * 3 + 1] = position.y + offset.y;
      positions[i * 3 + 2] = position.z + offset.z;
      
      // Random velocity outward from impact
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * intensity * 2,
        Math.random() * intensity * 4, // Mostly upward
        (Math.random() - 0.5) * intensity * 2
      );
      
      // Store velocity for animation
      velocities[i * 3] = velocity.x;
      velocities[i * 3 + 1] = velocity.y;
      velocities[i * 3 + 2] = velocity.z;
    }
    
    // Set the geometry
    (bloodSystem as THREE.Points).geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    
    // Store velocities as user data
    bloodSystem.userData.velocities = velocities;
    bloodSystem.userData.lifetime = 0;
    bloodSystem.userData.maxLifetime = 60; // 60 frames ~ 1 second at 60fps
    
    // Add to scene
    this.scene.add(bloodSystem);
    
    // Setup auto-removal after animation
    setTimeout(() => {
      this.scene.remove(bloodSystem);
    }, 2000);
  }
  
  /**
   * Create debris particle effect
   * @param position Position to create effect
   * @param intensity Impact intensity for scaling effect
   */
  private createDebrisEffect(position: THREE.Vector3, intensity: number): void {
    // Similar to blood effect, but different parameters
    const debrisSystem = this.particleSystems.get('debris')?.clone();
    if (!debrisSystem) return;
    
    // Calculate number of particles based on intensity
    const particleCount = Math.min(Math.floor(intensity * 15), 75);
    
    // Create particles
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      // Random position within a small sphere around impact point
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      );
      
      // Set position
      positions[i * 3] = position.x + offset.x;
      positions[i * 3 + 1] = position.y + offset.y;
      positions[i * 3 + 2] = position.z + offset.z;
      
      // Random velocity outward from impact
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * intensity * 3,
        Math.random() * intensity * 3, // Upward with gravity
        (Math.random() - 0.5) * intensity * 3
      );
      
      // Store velocity for animation
      velocities[i * 3] = velocity.x;
      velocities[i * 3 + 1] = velocity.y;
      velocities[i * 3 + 2] = velocity.z;
    }
    
    // Set the geometry
    (debrisSystem as THREE.Points).geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    
    // Store velocities as user data
    debrisSystem.userData.velocities = velocities;
    debrisSystem.userData.lifetime = 0;
    debrisSystem.userData.maxLifetime = 45; // 45 frames ~ 0.75 seconds at 60fps
    
    // Add to scene
    this.scene.add(debrisSystem);
    
    // Setup auto-removal after animation
    setTimeout(() => {
      this.scene.remove(debrisSystem);
    }, 1500);
  }
  
  /**
   * Show score popup at a position
   * @param position World position
   * @param text Text to display
   * @param color Text color
   */
  private showScorePopup(position: THREE.Vector3, text: string, color: number): void {
    // Create text sprite for score popup
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Configure canvas
    canvas.width = 256;
    canvas.height = 128;
    
    // Draw text
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 80px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.position.y += 2; // Position above the collision point
    sprite.scale.set(4, 2, 1);
    
    // Add to scene
    this.scene.add(sprite);
    
    // Animate and remove
    let age = 0;
    const animate = () => {
      age++;
      
      // Move upward
      sprite.position.y += 0.05;
      
      // Fade out
      if (age > 30) {
        sprite.material.opacity -= 0.05;
      }
      
      if (age < 60 && sprite.material.opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        this.scene.remove(sprite);
      }
    };
    
    animate();
  }
  
  /**
   * Show combo popup
   * @param comboCount Number of hits in combo
   * @param multiplier Score multiplier
   */
  private showComboPopup(comboCount: number, multiplier: number): void {
    // Create DOM element for combo display
    const comboDiv = document.createElement('div');
    comboDiv.style.position = 'absolute';
    comboDiv.style.top = '50%';
    comboDiv.style.left = '50%';
    comboDiv.style.transform = 'translate(-50%, -50%)';
    comboDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    comboDiv.style.color = 'white';
    comboDiv.style.padding = '20px';
    comboDiv.style.borderRadius = '10px';
    comboDiv.style.fontSize = '24px';
    comboDiv.style.fontWeight = 'bold';
    comboDiv.style.zIndex = '1000';
    comboDiv.style.textAlign = 'center';
    comboDiv.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.8)';
    comboDiv.style.textShadow = '2px 2px 4px #000000';
    comboDiv.innerHTML = `
      COMBO x${comboCount}<br>
      ${multiplier}x POINTS
    `;
    
    // Add to DOM
    document.body.appendChild(comboDiv);
    
    // Animate and remove
    let opacity = 1;
    const duration = 2000; // 2 seconds
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1) {
        opacity = 1 - progress;
        comboDiv.style.opacity = opacity.toString();
        comboDiv.style.transform = `translate(-50%, -${50 + progress * 20}%)`;
        requestAnimationFrame(animate);
      } else {
        document.body.removeChild(comboDiv);
      }
    };
    
    animate();
  }
  
  /**
   * Update the collision manager
   * @param deltaTime Time since last update
   */
  public update(deltaTime: number): void {
    try {
      // We've moved particle effects to the new ParticleSystem class
      // No need to traverse scene objects here

      // Check for combo timeouts
      const now = Date.now();
      if (this.lastHitTime > 0 && now - this.lastHitTime > this.comboTimeWindow) {
        // Reset combo if window expired
        this.consecutiveHumanHits = 0;
      }
      
      // Clear hit objects every so often to allow re-hitting the same objects
      if (now % 1000 < 20) {
        this.hitObjects.clear();
      }
    } catch (error) {
      console.error('Error updating collision manager:', error);
    }
  }
  
  /**
   * Get the current score
   * @returns Current game score
   */
  public getScore(): number {
    return this.score;
  }
  
  /**
   * Reset the score system
   */
  public reset(): void {
    this.score = 0;
    this.consecutiveHumanHits = 0;
    this.lastHitTime = 0;
    this.hitObjects.clear();
  }
  
  /**
   * Enable or disable debug mode
   * @param enabled Debug mode state
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Handle static object collision (buildings, props)
   * @param event Collision event
   */
  private handleStaticCollision(event: CollisionEvent): void {
    // Static objects don't affect score
    
    // Debris effects now handled by ParticleSystem
    // this.createDebrisEffect(event.collisionPoint, event.impactVelocity);
    
    // TODO: Play collision sound based on material
  }
} 