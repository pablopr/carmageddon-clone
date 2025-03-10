import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../../core/physics/PhysicsWorld';

// Define animal types with their properties
export enum AnimalType {
  DOG = 'dog',
  CAT = 'cat',
  COW = 'cow',
  DEER = 'deer',
  BIRD = 'bird'
}

// Properties for each animal type
interface AnimalProperties {
  scale: number;
  speed: number;
  mass: number;
  color: THREE.Color;
  flightCapable: boolean;
  unpredictability: number; // 0-1 scale of how erratic movement is
}

// Map of animal types to their properties
const animalProperties: Record<AnimalType, AnimalProperties> = {
  [AnimalType.DOG]: {
    scale: 0.4,
    speed: 2.5,
    mass: 30,
    color: new THREE.Color(0x8B4513), // Brown
    flightCapable: false,
    unpredictability: 0.7 // Dogs move somewhat erratically
  },
  [AnimalType.CAT]: {
    scale: 0.3,
    speed: 3,
    mass: 10,
    color: new THREE.Color(0x808080), // Grey
    flightCapable: false,
    unpredictability: 0.9 // Cats are very unpredictable
  },
  [AnimalType.COW]: {
    scale: 1.2,
    speed: 1,
    mass: 600,
    color: new THREE.Color(0xFFFFFF), // White with black spots
    flightCapable: false,
    unpredictability: 0.3 // Cows move slowly and predictably
  },
  [AnimalType.DEER]: {
    scale: 1,
    speed: 3.5,
    mass: 200,
    color: new THREE.Color(0xD2B48C), // Tan
    flightCapable: false,
    unpredictability: 0.5 // Deer move quickly but somewhat predictably
  },
  [AnimalType.BIRD]: {
    scale: 0.2,
    speed: 4,
    mass: 1,
    color: new THREE.Color(0x000000), // Black
    flightCapable: true,
    unpredictability: 0.8 // Birds fly erratically
  }
};

/**
 * Animal NPC class for various animal types
 */
export class Animal {
  // Animal mesh
  private mesh: THREE.Group;
  
  // Physics body
  private body: CANNON.Body;
  
  // Animal properties
  private animalType: AnimalType;
  private properties: AnimalProperties;
  private movementSpeed: number;
  private direction: number = 0;
  private isMoving: boolean = false;
  private flightMode: boolean = false;
  private flightHeight: number = 0;
  private targetPosition: THREE.Vector3 | null = null;
  
  // Update intervals
  private nextDirectionChange: number = 0;
  private directionChangeInterval: number = 2000; // 2 seconds base value
  
  /**
   * Constructor
   * @param scene THREE.js scene
   * @param physicsWorld Physics world
   * @param animalType Type of animal to create
   * @param position Initial position
   */
  constructor(
    private scene: THREE.Scene,
    private physicsWorld: PhysicsWorld,
    animalType: AnimalType = AnimalType.DOG,
    position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  ) {
    this.animalType = animalType;
    this.properties = animalProperties[animalType];
    this.movementSpeed = this.properties.speed;
    
    // Create the animal mesh
    this.mesh = this.createAnimalMesh();
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);
    
    // Create physics body
    this.body = this.createPhysicsBody(position);
    
    // Set default movement state
    this.startMoving();
    
    // If bird, start flying
    if (this.properties.flightCapable) {
      this.flightMode = true;
      this.flightHeight = 5 + Math.random() * 5; // Random height between 5-10 units
    }
  }
  
  /**
   * Create a mesh based on animal type
   * @returns Animal mesh
   */
  private createAnimalMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Common base color for the animal
    const baseColor = this.properties.color;
    
    // Create different geometries based on animal type
    switch (this.animalType) {
      case AnimalType.DOG:
        this.createDogMesh(group, baseColor);
        break;
      case AnimalType.CAT:
        this.createCatMesh(group, baseColor);
        break;
      case AnimalType.COW:
        this.createCowMesh(group, baseColor);
        break;
      case AnimalType.DEER:
        this.createDeerMesh(group, baseColor);
        break;
      case AnimalType.BIRD:
        this.createBirdMesh(group, baseColor);
        break;
    }
    
    // Scale the entire animal based on properties
    group.scale.set(
      this.properties.scale,
      this.properties.scale,
      this.properties.scale
    );
    
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
   * Create a dog mesh
   */
  private createDogMesh(group: THREE.Group, color: THREE.Color): void {
    // Body
    const bodyGeometry = new THREE.BoxGeometry(1, 0.6, 1.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    group.add(body);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const headMaterial = new THREE.MeshStandardMaterial({ color });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.9, 0.7);
    group.add(head);
    
    // Muzzle
    const muzzleGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.4);
    const muzzleMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.8) });
    const muzzle = new THREE.Mesh(muzzleGeometry, muzzleMaterial);
    muzzle.position.set(0, 0.75, 1.1);
    group.add(muzzle);
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.2);
    const legMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.9) });
    
    // Front legs
    const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontLeftLeg.position.set(0.3, 0.25, 0.5);
    group.add(frontLeftLeg);
    
    const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    frontRightLeg.position.set(-0.3, 0.25, 0.5);
    group.add(frontRightLeg);
    
    // Back legs
    const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
    backLeftLeg.position.set(0.3, 0.25, -0.5);
    group.add(backLeftLeg);
    
    const backRightLeg = new THREE.Mesh(legGeometry, legMaterial);
    backRightLeg.position.set(-0.3, 0.25, -0.5);
    group.add(backRightLeg);
    
    // Tail
    const tailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const tailMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.9) });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.7, -0.8);
    tail.rotation.x = Math.PI / 4; // Tail sticks up a bit
    group.add(tail);
  }
  
  /**
   * Create a cat mesh
   */
  private createCatMesh(group: THREE.Group, color: THREE.Color): void {
    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.7, 0.5, 1.2);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.4;
    group.add(body);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.7, 0.6);
    group.add(head);
    
    // Ears
    const earGeometry = new THREE.ConeGeometry(0.15, 0.3, 4);
    const earMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.9) });
    
    const leftEar = new THREE.Mesh(earGeometry, earMaterial);
    leftEar.position.set(0.2, 1, 0.6);
    leftEar.rotation.x = -Math.PI / 4;
    group.add(leftEar);
    
    const rightEar = new THREE.Mesh(earGeometry, earMaterial);
    rightEar.position.set(-0.2, 1, 0.6);
    rightEar.rotation.x = -Math.PI / 4;
    group.add(rightEar);
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    const legMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.9) });
    
    // All legs
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      const x = i % 2 === 0 ? 0.25 : -0.25;
      const z = i < 2 ? 0.4 : -0.4;
      leg.position.set(x, 0.2, z);
      group.add(leg);
    }
    
    // Tail
    const tailGeometry = new THREE.CylinderGeometry(0.05, 0.1, 0.8, 8);
    const tailMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.9) });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.5, -0.7);
    tail.rotation.x = Math.PI / 2.5; // Tail sticks up
    group.add(tail);
  }
  
  /**
   * Create a cow mesh
   */
  private createCowMesh(group: THREE.Group, color: THREE.Color): void {
    // Body
    const bodyGeometry = new THREE.BoxGeometry(1.2, 1.2, 2.2);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6; // Lower the body position to have the cow standing on the ground
    group.add(body);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 1);
    const headMaterial = new THREE.MeshStandardMaterial({ color });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.0, 1.3); // Lower the head to match the body
    group.add(head);
    
    // Add black spots to the cow (just for fun)
    if (this.animalType === AnimalType.COW) {
      const spotMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
      
      // Add a few spots randomly
      for (let i = 0; i < 5; i++) {
        const spotSize = 0.3 + Math.random() * 0.4;
        const spotGeometry = new THREE.SphereGeometry(spotSize, 8, 8);
        const spot = new THREE.Mesh(spotGeometry, spotMaterial);
        
        // Random position on the body
        const spotX = (Math.random() - 0.5) * 1;
        const spotY = 0.6 + (Math.random() - 0.5) * 0.5; // Lower spot positions to match body
        const spotZ = (Math.random() - 0.5) * 1.8;
        
        spot.position.set(spotX, spotY, spotZ);
        // Slightly flatten the spot and make it hug the body
        spot.scale.y = 0.3;
        group.add(spot);
      }
    }
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const legMaterial = new THREE.MeshStandardMaterial({ color });
    
    // Front left leg
    const legFL = new THREE.Mesh(legGeometry, legMaterial);
    legFL.position.set(-0.4, 0, 0.8);
    group.add(legFL);
    
    // Front right leg
    const legFR = new THREE.Mesh(legGeometry, legMaterial);
    legFR.position.set(0.4, 0, 0.8);
    group.add(legFR);
    
    // Back left leg
    const legBL = new THREE.Mesh(legGeometry, legMaterial);
    legBL.position.set(-0.4, 0, -0.8);
    group.add(legBL);
    
    // Back right leg
    const legBR = new THREE.Mesh(legGeometry, legMaterial);
    legBR.position.set(0.4, 0, -0.8);
    group.add(legBR);
    
    // Udder for cows
    const udderGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const udderMaterial = new THREE.MeshStandardMaterial({ color: 0xffcccc });
    const udder = new THREE.Mesh(udderGeometry, udderMaterial);
    udder.position.set(0, 0.1, -0.8);
    udder.scale.y = 0.5;
    group.add(udder);
  }
  
  /**
   * Create a deer mesh
   */
  private createDeerMesh(group: THREE.Group, color: THREE.Color): void {
    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.8, 1, 1.8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.2;
    group.add(body);
    
    // Neck
    const neckGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.6);
    const neckMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.95) });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.set(0, 1.6, 0.9);
    neck.rotation.x = -Math.PI / 6; // Angle the neck down a bit
    group.add(neck);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.8);
    const headMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.9) });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.8, 1.3);
    group.add(head);
    
    // Antlers (only for male deer)
    if (Math.random() > 0.5) { // 50% chance of being male with antlers
      const antlerMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      
      // Create antler base stems
      const leftStemGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.6, 8);
      const leftStem = new THREE.Mesh(leftStemGeometry, antlerMaterial);
      leftStem.position.set(0.2, 2.2, 1.2);
      leftStem.rotation.x = -Math.PI / 12;
      leftStem.rotation.z = -Math.PI / 6;
      group.add(leftStem);
      
      const rightStemGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.6, 8);
      const rightStem = new THREE.Mesh(rightStemGeometry, antlerMaterial);
      rightStem.position.set(-0.2, 2.2, 1.2);
      rightStem.rotation.x = -Math.PI / 12;
      rightStem.rotation.z = Math.PI / 6;
      group.add(rightStem);
      
      // Create antler tines
      for (let i = 0; i < 3; i++) {
        const tineGeometry = new THREE.CylinderGeometry(0.02, 0.04, 0.3, 8);
        
        // Left tines
        const leftTine = new THREE.Mesh(tineGeometry, antlerMaterial);
        leftTine.position.set(0.3 + i * 0.08, 2.3 + i * 0.1, 1.2 - i * 0.05);
        leftTine.rotation.z = -Math.PI / 3;
        group.add(leftTine);
        
        // Right tines
        const rightTine = new THREE.Mesh(tineGeometry, antlerMaterial);
        rightTine.position.set(-0.3 - i * 0.08, 2.3 + i * 0.1, 1.2 - i * 0.05);
        rightTine.rotation.z = Math.PI / 3;
        group.add(rightTine);
      }
    }
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(0.2, 1.2, 0.2);
    const legMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.85) });
    
    // All legs
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      const x = i % 2 === 0 ? 0.3 : -0.3;
      const z = i < 2 ? 0.7 : -0.7;
      leg.position.set(x, 0.6, z);
      group.add(leg);
    }
    
    // Tail
    const tailGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.3);
    const tailMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 1.2, -1);
    group.add(tail);
  }
  
  /**
   * Create a bird mesh
   */
  private createBirdMesh(group: THREE.Group, color: THREE.Color): void {
    // Body
    const bodyGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.3;
    body.scale.z = 1.5; // Elongate the body
    group.add(body);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.5, 0.4);
    group.add(head);
    
    // Beak
    const beakGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
    const beakMaterial = new THREE.MeshStandardMaterial({ color: 0xFFA500 });
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0, 0.5, 0.6);
    beak.rotation.x = -Math.PI / 2;
    group.add(beak);
    
    // Wings
    const wingGeometry = new THREE.BoxGeometry(0.8, 0.05, 0.4);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.9) });
    
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(0.4, 0.4, 0);
    group.add(leftWing);
    
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(-0.4, 0.4, 0);
    group.add(rightWing);
    
    // Tail
    const tailGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.4);
    const tailMaterial = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.8) });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.3, -0.4);
    group.add(tail);
  }
  
  /**
   * Create physics body for collision detection
   * @param position Initial position
   * @returns Physics body
   */
  private createPhysicsBody(position: THREE.Vector3): CANNON.Body {
    let shape: CANNON.Shape;
    let bodyPosition = new CANNON.Vec3(position.x, position.y, position.z);
    
    // Different shapes for different animals
    if (this.animalType === AnimalType.COW) {
      // Bigger box for cows
      shape = new CANNON.Box(new CANNON.Vec3(0.6 * this.properties.scale, 0.6 * this.properties.scale, 1.1 * this.properties.scale));
      // Adjust physics body position to match visual model for cows
      bodyPosition.y = position.y + 0.6; // Raise the physics body to match the visual model's center
    } else if (this.animalType === AnimalType.BIRD) {
      // Small sphere for birds
      shape = new CANNON.Sphere(0.3 * this.properties.scale);
    } else {
      // General box for other animals
      shape = new CANNON.Box(new CANNON.Vec3(
        0.4 * this.properties.scale,
        0.4 * this.properties.scale,
        0.8 * this.properties.scale
      ));
    }
    
    // Create the body
    const body = new CANNON.Body({
      mass: this.properties.mass,
      position: bodyPosition,
      shape: shape,
      material: new CANNON.Material("animalMaterial")
    });
    
    // Store identification as a custom property
    body.collisionFilterGroup = 3; // Use collision filtering group for animal NPCs
    (body as any)._npcType = 'animal';
    (body as any)._animalType = this.animalType;
    
    // Add to physics world
    this.physicsWorld.addBody(body, this.mesh);
    
    return body;
  }
  
  /**
   * Start moving
   */
  private startMoving(): void {
    this.isMoving = true;
    this.chooseNewDirection();
  }
  
  /**
   * Choose a new random direction
   */
  private chooseNewDirection(): void {
    // Set a random direction in radians
    this.direction = Math.random() * Math.PI * 2;
    
    // Calculate a target position
    // More unpredictable animals have shorter target distances to enable more frequent changes
    const distanceFactor = 1 - this.properties.unpredictability;
    const distance = 5 + Math.random() * 10 * distanceFactor;
    
    // Birds have a chance to change flight height
    if (this.flightMode) {
      this.flightHeight = 3 + Math.random() * 7; // Random height between 3-10 units
    }
    
    // Set target position
    this.targetPosition = new THREE.Vector3(
      this.mesh.position.x + Math.sin(this.direction) * distance,
      this.flightMode ? this.flightHeight : 0,
      this.mesh.position.z + Math.cos(this.direction) * distance
    );
    
    // Face the new direction
    this.mesh.rotation.y = this.direction;
    
    // Set next direction change time
    // More unpredictable animals change direction more frequently
    const baseInterval = 2000; // 2 seconds
    const randomFactor = 1000 + Math.random() * 3000; // Random 1-4 seconds
    this.directionChangeInterval = baseInterval + randomFactor * (1 - this.properties.unpredictability);
    
    // Set next direction change
    this.nextDirectionChange = Date.now() + this.directionChangeInterval;
  }
  
  /**
   * Make the animal run away from a threat
   * @param threatPosition Position to run away from
   */
  public flee(threatPosition: THREE.Vector3): void {
    // Birds might fly away when threatened
    if (this.animalType === AnimalType.BIRD && !this.flightMode) {
      this.flightMode = true;
      this.flightHeight = 10; // Fly high to escape
    }
    
    // Calculate direction away from threat
    const awayVector = new THREE.Vector3().subVectors(
      this.mesh.position,
      threatPosition
    ).normalize();
    
    // Set direction to run away
    this.direction = Math.atan2(awayVector.x, awayVector.z);
    this.mesh.rotation.y = this.direction;
    
    // Target position is further away in this direction
    const distance = 30; // Run far away
    this.targetPosition = new THREE.Vector3(
      this.mesh.position.x + awayVector.x * distance,
      this.flightMode ? this.flightHeight : 0,
      this.mesh.position.z + awayVector.z * distance
    );
    
    // Speed up when fleeing
    this.movementSpeed = this.properties.speed * 1.5;
    
    // Reset direction change timer
    this.nextDirectionChange = Date.now() + 5000; // Don't change direction for 5 seconds
  }
  
  /**
   * Update animal position and animation
   * @param deltaTime Time since last update
   */
  public update(deltaTime: number): void {
    if (!this.isMoving) return;
    
    // Check if it's time to change direction
    if (Date.now() > this.nextDirectionChange) {
      this.chooseNewDirection();
      
      // Unpredictable animals have a chance to make sudden direction changes
      if (Math.random() < this.properties.unpredictability) {
        this.direction += (Math.random() - 0.5) * Math.PI; // Add up to ±90 degrees
        this.mesh.rotation.y = this.direction;
      }
    }
    
    // Calculate movement distance
    const distance = this.movementSpeed * deltaTime;
    
    // Move in the current direction
    const movement = new THREE.Vector3(
      Math.sin(this.direction) * distance,
      0, // Always maintain zero y-movement to prevent flying/jumping
      Math.cos(this.direction) * distance
    );
    
    // Update position - only X and Z components for ground animals
    if (this.animalType === AnimalType.BIRD && this.flightMode) {
      // Birds can move in all directions
      this.mesh.position.add(movement);
      
      // Smoothly move toward target flight height
      const currentHeight = this.mesh.position.y;
      const heightDiff = this.flightHeight - currentHeight;
      this.mesh.position.y += heightDiff * 0.02; // Move 2% of the way there each frame
    } else {
      // Ground animals stay on the ground
      this.mesh.position.x += movement.x;
      this.mesh.position.z += movement.z;
      
      // Explicitly keep on ground - don't rely on physics for Y position
      this.mesh.position.y = 0;
      
      // Add slight bobbing for walking animation but keep it minimal
      if (this.animalType !== AnimalType.COW) {
        // Smaller animals can have slight bobbing motion
        const walkCycle = Math.sin(Date.now() * 0.005) * 0.05;
        this.mesh.position.y = Math.max(0, walkCycle);
      }
    }
    
    // Update physics body position
    const position = this.mesh.position;
    
    // For cows, keep the physics body strictly aligned with visual model
    if (this.animalType === AnimalType.COW) {
      // Update X and Z, keep Y fixed at ground level + half height for physics
      this.body.position.set(position.x, 0.6, position.z);
      
      // Prevent any velocity in Y direction for cows
      this.body.velocity.set(0, 0, 0);
      
      // Apply extra downward force to keep cows grounded
      this.body.force.set(0, -500, 0);
      
      // Disable rotation for cows to keep them upright
      this.body.angularVelocity.set(0, 0, 0);
    } else if (this.flightMode) {
      // Flying birds need vertical movement
      this.body.position.set(position.x, position.y, position.z);
    } else {
      // Other animals - keep on ground
      this.body.position.set(position.x, position.y, position.z);
      
      // Prevent vertical velocity for ground animals
      this.body.velocity.y = 0;
    }
    
    // Set body rotation
    this.body.quaternion.setFromEuler(0, this.direction, 0);
  }
  
  /**
   * Get the animal's physics body
   * @returns Physics body
   */
  public getBody(): CANNON.Body {
    return this.body;
  }
  
  /**
   * Get the animal's mesh
   * @returns THREE.js mesh
   */
  public getMesh(): THREE.Group {
    return this.mesh;
  }
  
  /**
   * Get the animal's position
   * @returns Position vector
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }
  
  /**
   * Get the animal type
   * @returns Animal type
   */
  public getAnimalType(): AnimalType {
    return this.animalType;
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    // Remove from scene
    this.scene.remove(this.mesh);
    
    // Remove from physics world
    this.physicsWorld.removeBody(this.body);
    
    // Dispose geometries and materials
    this.mesh.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });
  }
} 