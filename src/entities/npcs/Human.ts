import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../../core/physics/PhysicsWorld';

/**
 * Human NPC class for pedestrians
 */
export class Human {
  // NPC mesh
  private mesh: THREE.Group;
  
  // Physics body
  private body: CANNON.Body;
  
  // Movement properties
  private walkSpeed: number = 1.5;
  private direction: number = 0;
  private isWalking: boolean = false;
  private panicMode: boolean = false;
  private targetPosition: THREE.Vector3 | null = null;
  
  // Update intervals
  private nextDirectionChange: number = 0;
  private directionChangeInterval: number = 3000; // 3 seconds
  
  /**
   * Constructor
   * @param scene THREE.js scene
   * @param physicsWorld Physics world
   * @param position Initial position
   */
  constructor(
    private scene: THREE.Scene,
    private physicsWorld: PhysicsWorld,
    position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  ) {
    // Create the human mesh
    this.mesh = this.createHumanMesh();
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);
    
    // Create physics body
    this.body = this.createPhysicsBody(position);
    
    // Set default movement state
    this.startWalking();
  }
  
  /**
   * Create a simple humanoid mesh
   * @returns Human mesh
   */
  private createHumanMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Random color for clothing
    const clothingColor = new THREE.Color(
      Math.random() * 0.5 + 0.5,
      Math.random() * 0.5 + 0.5,
      Math.random() * 0.5 + 0.5
    );
    
    // Body color (skin tone)
    const skinColor = new THREE.Color(0xf5d0b0);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.7;
    group.add(head);
    
    // Torso
    const torsoGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.3);
    const torsoMaterial = new THREE.MeshStandardMaterial({ color: clothingColor });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.y = 1.2;
    group.add(torso);
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(0.15, 0.4, 0);
    group.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(-0.15, 0.4, 0);
    group.add(rightLeg);
    
    // Arms
    const armGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const armMaterial = new THREE.MeshStandardMaterial({ color: clothingColor });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(0.35, 1.2, 0);
    group.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(-0.35, 1.2, 0);
    group.add(rightArm);
    
    // Cast shadows
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    
    return group;
  }
  
  /**
   * Create physics body for collision detection
   * @param position Initial position
   * @returns Physics body
   */
  private createPhysicsBody(position: THREE.Vector3): CANNON.Body {
    // Create a capsule shape for better collision
    const radius = 0.3;
    const height = 1.8;
    
    // Using a box instead of a cylinder for better stability 
    // This avoids the rolling issue completely
    const shape = new CANNON.Box(new CANNON.Vec3(radius, height/2, radius));
    
    // Create the body
    const body = new CANNON.Body({
      mass: 70, // Average human mass in kg
      position: new CANNON.Vec3(position.x, position.y + height / 2, position.z),
      shape: shape,
      material: new CANNON.Material("humanMaterial"),
      fixedRotation: true, // This prevents the body from rotating
      angularDamping: 1  // Additional damping to prevent rotation
    });
    
    // Store identification as a custom property safely
    // We'll use a non-standard property name that's unlikely to conflict with cannon.js
    body.collisionFilterGroup = 2; // Use collision filtering group for NPCs
    (body as any)._npcType = 'human'; // Custom property for identification
    
    // Add to physics world
    this.physicsWorld.addBody(body, this.mesh);
    
    return body;
  }
  
  /**
   * Start walking randomly
   */
  private startWalking(): void {
    this.isWalking = true;
    this.chooseNewDirection();
  }
  
  /**
   * Choose a new random walking direction
   */
  private chooseNewDirection(): void {
    // Set a random direction in radians
    this.direction = Math.random() * Math.PI * 2;
    
    // Calculate a target position about 10 units away
    const distance = 5 + Math.random() * 10;
    this.targetPosition = new THREE.Vector3(
      this.mesh.position.x + Math.sin(this.direction) * distance,
      0,
      this.mesh.position.z + Math.cos(this.direction) * distance
    );
    
    // Face the new direction
    this.mesh.rotation.y = this.direction;
    
    // Set next direction change time
    this.nextDirectionChange = Date.now() + this.directionChangeInterval;
  }
  
  /**
   * Enter panic mode (run away from a target)
   * @param threatPosition Position to run away from
   */
  public panic(threatPosition: THREE.Vector3): void {
    if (this.panicMode) return; // Already panicking
    
    this.panicMode = true;
    this.walkSpeed = 5; // Run faster
    
    // Calculate direction away from threat
    const awayVector = new THREE.Vector3().subVectors(
      this.mesh.position,
      threatPosition
    ).normalize();
    
    // Set direction to run away
    this.direction = Math.atan2(awayVector.x, awayVector.z);
    this.mesh.rotation.y = this.direction;
    
    // Target position is further away in this direction
    const distance = 20;
    this.targetPosition = new THREE.Vector3(
      this.mesh.position.x + awayVector.x * distance,
      0,
      this.mesh.position.z + awayVector.z * distance
    );
    
    // Reduce direction changes when panicking
    this.directionChangeInterval = 5000; // 5 seconds
    this.nextDirectionChange = Date.now() + this.directionChangeInterval;
  }
  
  /**
   * Update NPC position and animation
   * @param deltaTime Time since last update
   */
  public update(deltaTime: number): void {
    if (!this.isWalking) return;
    
    // Check if it's time to change direction
    if (Date.now() > this.nextDirectionChange) {
      this.chooseNewDirection();
    }
    
    // Calculate movement distance
    const distance = this.walkSpeed * deltaTime;
    
    // Move in the current direction
    const movement = new THREE.Vector3(
      Math.sin(this.direction) * distance,
      0,
      Math.cos(this.direction) * distance
    );
    
    // Update position
    this.mesh.position.add(movement);
    
    // Update physics body position (keeping the body upright)
    this.body.position.x = this.mesh.position.x;
    this.body.position.z = this.mesh.position.z;
    
    // Check if reached target, if so, choose new direction
    if (this.targetPosition && 
        this.mesh.position.distanceTo(this.targetPosition) < 1) {
      this.chooseNewDirection();
    }
    
    // Simple animation - bob up and down while walking but keep the mesh upright
    // Humans should have a fixed base height to prevent rolling
    const walkCycle = Math.sin(Date.now() * 0.01) * 0.05;
    const baseHeight = 0; // Base height for the mesh (on the ground)
    this.mesh.position.y = baseHeight + walkCycle;
    
    // Keep physics body upright and properly positioned
    // The body's y position should be half the height of the body
    const bodyHeight = 1.8; // Height from createPhysicsBody
    this.body.position.y = bodyHeight / 2 + baseHeight + walkCycle;
    
    // Force the body's rotation to stay upright
    this.body.quaternion.set(0, 0, 0, 1);
    
    // Use time to animate arm swing
    // This creates a more natural walking animation
    const armSwingTime = Date.now() * 0.01;
    
    // Find arms in the mesh to animate
    this.mesh.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // Identify arms by their position relative to the body
        const isLeftArm = object.position.x > 0.3 && object.position.y > 1;
        const isRightArm = object.position.x < -0.3 && object.position.y > 1;
        
        if (isLeftArm) {
          object.rotation.x = Math.sin(armSwingTime) * 0.5;
        } else if (isRightArm) {
          object.rotation.x = Math.sin(armSwingTime + Math.PI) * 0.5;
        }
        
        // Identify legs by their position
        const isLeftLeg = object.position.x > 0.1 && object.position.y < 0.6;
        const isRightLeg = object.position.x < -0.1 && object.position.y < 0.6;
        
        if (isLeftLeg) {
          object.rotation.x = Math.sin(armSwingTime) * 0.3;
        } else if (isRightLeg) {
          object.rotation.x = Math.sin(armSwingTime + Math.PI) * 0.3;
        }
      }
    });
  }
  
  /**
   * Get the physics body
   * @returns Cannon.js body
   */
  public getBody(): CANNON.Body {
    return this.body;
  }
  
  /**
   * Get the mesh
   * @returns THREE.js mesh
   */
  public getMesh(): THREE.Group {
    return this.mesh;
  }
  
  /**
   * Get position
   * @returns Current position
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }
  
  /**
   * Remove from scene
   */
  public dispose(): void {
    this.scene.remove(this.mesh);
    this.physicsWorld.removeBody(this.body);
  }
} 