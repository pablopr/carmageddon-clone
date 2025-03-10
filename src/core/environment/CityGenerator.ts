import * as THREE from 'three';
import { EnvironmentAssets } from './EnvironmentAssets';
import { OptimizationManager } from '../optimization/OptimizationManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CollisionManager, CollisionObjectType } from '../../systems/CollisionManager';
import * as CANNON from 'cannon-es';

/**
 * Class to generate a simplified city environment layout
 */
export class CityGenerator {
  private assets: EnvironmentAssets;
  private scene: THREE.Scene;
  private optimizationManager: OptimizationManager | null = null;
  private physicsWorld: PhysicsWorld;
  private collisionManager: CollisionManager;
  
  // City parameters
  private citySize: number = 500;
  private buildingDensity: number = 0.3; // Reduced from 0.5 to 0.3 - fewer buildings
  private propDensity: number = 0.3; // Reduced from 0.4 to 0.3 - fewer props
  
  // Track building positions for collision detection
  private buildingPositions: Array<{
    position: THREE.Vector3;
    width: number;
    depth: number;
    rotation: number;
  }> = [];
  

  
  /**
   * Constructor
   * @param scene Three.js scene
   * @param physicsWorld Physics world for collisions
   * @param collisionManager Collision manager for object registration
   */
  constructor(
    scene: THREE.Scene, 
    physicsWorld: PhysicsWorld,
    collisionManager: CollisionManager
  ) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.collisionManager = collisionManager;
    this.assets = new EnvironmentAssets();
  }
  
  /**
   * Initialize and load assets
   * @returns Promise that resolves when assets are loaded
   */
  public async initialize(): Promise<void> {
    return this.assets.loadAssets();
  }
  
  /**
   * Generate a simplified city
   * @param optimize Whether to apply performance optimizations
   */
  public generateCity(optimize: boolean = false): void {
    console.log('Generating simplified city...');
    
    // Create ground
    this.createGround();
    
    // Create perimeter walls to prevent cars from exiting the map
    this.createPerimeterWalls();
    
    // Skip road generation completely
    
    // Place buildings
    this.placeBuildings();
    
    // Place props
    this.placePropsInOpenSpaces();
    
    // Apply optimizations if requested
    if (optimize) {
      this.optimizeCity();
    }
    
    console.log('City generation complete');
  }
  
  /**
   * Create the ground plane
   */
  private createGround(): void {
    // Create a large ground plane
    const groundGeometry = new THREE.PlaneGeometry(this.citySize * 1.5, this.citySize * 1.5);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x557755,
      roughness: 0.8,
      metalness: 0.1
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.position.y = 0;
    ground.receiveShadow = true;
    ground.name = 'ground';
    
    this.scene.add(ground);
  }
  
  /**
   * Create red walls around the perimeter of the city to prevent cars from exiting the map
   */
  private createPerimeterWalls(): void {
    console.log('Creating perimeter walls...');
    
    const wallHeight = 15; // Height of the walls
    const wallThickness = 2; // Thickness of the walls
    const halfCitySize = this.citySize / 2;
    
    // Create a material for the red walls
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000, // Bright red color
      roughness: 0.7,
      metalness: 0.3,
      emissive: 0x330000, // Slight glow effect
    });
    
    // Create the four walls for each side of the perimeter
    const walls = [
      // North wall
      {
        position: { x: 0, y: wallHeight / 2, z: -halfCitySize - wallThickness / 2 },
        dimensions: { x: this.citySize + wallThickness * 2, y: wallHeight, z: wallThickness }
      },
      // South wall
      {
        position: { x: 0, y: wallHeight / 2, z: halfCitySize + wallThickness / 2 },
        dimensions: { x: this.citySize + wallThickness * 2, y: wallHeight, z: wallThickness }
      },
      // East wall
      {
        position: { x: halfCitySize + wallThickness / 2, y: wallHeight / 2, z: 0 },
        dimensions: { x: wallThickness, y: wallHeight, z: this.citySize }
      },
      // West wall
      {
        position: { x: -halfCitySize - wallThickness / 2, y: wallHeight / 2, z: 0 },
        dimensions: { x: wallThickness, y: wallHeight, z: this.citySize }
      }
    ];
    
    // Create each wall and add it to the scene with physics
    walls.forEach((wall, index) => {
      // Create the visual mesh
      const wallGeometry = new THREE.BoxGeometry(
        wall.dimensions.x,
        wall.dimensions.y, 
        wall.dimensions.z
      );
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      wallMesh.position.set(wall.position.x, wall.position.y, wall.position.z);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallMesh.name = `perimeter-wall-${index}`;
      
      // Add the wall to the scene
      this.scene.add(wallMesh);
      
      // Create a physics body for the wall
      const physicsBody = this.physicsWorld.createBox(
        { 
          x: wall.dimensions.x / 2, 
          y: wall.dimensions.y / 2, 
          z: wall.dimensions.z / 2 
        },
        { 
          x: wall.position.x, 
          y: wall.position.y, 
          z: wall.position.z 
        },
        { mass: 0 } // Static body (mass = 0)
      );
      
      // Register with physics world and associate with the wall mesh
      this.physicsWorld.addBody(physicsBody, wallMesh);
      
      // Register with collision manager
      this.collisionManager.registerObject(physicsBody, CollisionObjectType.BUILDING);
    });
    
    console.log('Perimeter walls created');
  }
  
  /**
   * Place buildings around the city
   */
  private placeBuildings(): void {
    console.log('Placing buildings...');
    
    const cityRadius = this.citySize / 2;
    
    // Create a grid of potential building positions with more spacing
    for (let x = -cityRadius + 20; x <= cityRadius - 20; x += 20) {
      for (let z = -cityRadius + 20; z <= cityRadius - 20; z += 20) {
        // Add some randomness to position
        const posX = x + (Math.random() * 10 - 5);
        const posZ = z + (Math.random() * 10 - 5);
        
        // Skip based on building density
        if (Math.random() > this.buildingDensity) continue;
        
        // Select a random building type, avoiding skyscrapers (index 2)
        // This helps fit more buildings by having more small ones
        let buildingIndex;
        const buildingTypeRoll = Math.random();
        if (buildingTypeRoll < 0.5) {
          buildingIndex = 3; // 50% small shops
        } else if (buildingTypeRoll < 0.9) {
          buildingIndex = 0; // 40% office buildings
        } else {
          buildingIndex = 1; // 10% residential buildings
        }
        
        // Get building dimensions
        const width = this.getBuildingWidth(buildingIndex);
        const depth = this.getBuildingDepth(buildingIndex);
        
        // Random rotation aligned with grid
        const rotation = Math.floor(Math.random() * 4) * (Math.PI / 2);
        
        // Position checking
        const position = new THREE.Vector3(posX, 0, posZ);
        
        // Check collision with other buildings
        let validPosition = true;
        for (const existingBuilding of this.buildingPositions) {
          const distance = position.distanceTo(existingBuilding.position);
          // Minimum distance between buildings
          const minDistance = Math.max(width, depth) / 2 + Math.max(existingBuilding.width, existingBuilding.depth) / 2 + 2;
          
          if (distance < minDistance) {
            validPosition = false;
            break;
          }
        }
        
        if (!validPosition) continue;
        
        // Create and place the building
        const building = this.assets.getBuildingByIndex(buildingIndex);
        building.position.copy(position);
        building.rotation.y = rotation;
        building.name = `building-${buildingIndex}`;
        
        // Add to scene and tracking
        this.scene.add(building);
        this.buildingPositions.push({
          position: position.clone(),
          width,
          depth,
          rotation
        });
        
        // Create a physics body for the building
        // Use a fixed height for buildings
        const height = 4; // Fixed height - a bit shorter to ensure we don't overshoot
        
        // Create a simple box physics body for the building
        // Position the physics body with its bottom at y=0
        const physicsBody = this.physicsWorld.createBox(
          { x: width/2, y: height/2, z: depth/2 },
          { x: position.x, y: 0, z: position.z },
          { mass: 0 } // Static body (mass = 0)
        );
        
        // Apply the same rotation as the visual model
        const quaternion = new THREE.Quaternion();
        quaternion.setFromEuler(new THREE.Euler(0, rotation, 0));
        physicsBody.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        
        // Register with physics world and associate with the building
        this.physicsWorld.addBody(physicsBody, building);
        
        // Register with collision manager
        this.collisionManager.registerObject(physicsBody, CollisionObjectType.BUILDING);
      }
    }
    
    console.log(`Placed ${this.buildingPositions.length} buildings`);
  }
  
  /**
   * Place props in open spaces
   */
  private placePropsInOpenSpaces(): void {
    console.log('Placing props in open spaces...');
    
    const propCount = Math.floor(this.citySize * this.propDensity);
    
    // Place random props
    for (let i = 0; i < propCount; i++) {
      // Get random position within city limits
      const posX = Math.random() * this.citySize - this.citySize / 2;
      const posZ = Math.random() * this.citySize - this.citySize / 2;
      
      const position = new THREE.Vector3(posX, 0, posZ);
      
      // Check for collisions with buildings
      if (!this.checkPropCollisions(position, 5)) {
        // Random prop type
        const propIndex = Math.floor(Math.random() * this.assets.getPropTypesCount());
        
        // Create prop
        const prop = this.assets.getPropByIndex(propIndex);
        prop.position.copy(position);
        
        // Random rotation
        prop.rotation.y = Math.random() * Math.PI * 2;
        
        // Name for identification
        prop.name = `prop-${propIndex}-${i}`;
        
        // Add to scene
        this.scene.add(prop);
        
        // Add physics body for the prop
        let isTree = prop.name.includes('tree') || 
                    (propIndex === 0) || // Assuming index 0 is trees based on loadPropModels
                    prop.userData.type === 'tree';
        
        let physicsBody: CANNON.Body;
        
        if (isTree) {
          // For trees, create a cylindrical physics body with smaller dimensions
          const treeRadius = 0.5;
          const treeHeight = 3;
          
          // Create the body with its bottom at y=0
          physicsBody = new CANNON.Body({
            mass: 0, // Static body
            position: new CANNON.Vec3(position.x, treeHeight/2, position.z),
            shape: new CANNON.Cylinder(treeRadius, treeRadius, treeHeight, 8)
          });
        } else {
          // For other props, create a simple box with smaller dimensions
          const propWidth = 1;
          const propHeight = 1;
          const propDepth = 1;
          
          // Position the physics body with its bottom at y=0
          physicsBody = this.physicsWorld.createBox(
            { x: propWidth/2, y: propHeight/2, z: propDepth/2 },
            { x: position.x, y: propHeight/2, z: position.z },
            { mass: 0 } // Static body
          );
        }
        
        // Apply the same rotation as the visual model
        const quaternion = new THREE.Quaternion();
        quaternion.setFromEuler(new THREE.Euler(0, prop.rotation.y, 0));
        physicsBody.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        
        // Register with physics world and associate with the prop
        this.physicsWorld.addBody(physicsBody, prop);
        
        // Register with collision manager
        this.collisionManager.registerObject(physicsBody, CollisionObjectType.PROP);
      }
    }
  }
  
  /**
   * Check if a prop position collides with any building
   */
  private checkPropCollisions(position: THREE.Vector3, minDistance: number): boolean {
    // Check collision with buildings
    for (const building of this.buildingPositions) {
      const distance = position.distanceTo(building.position);
      if (distance < minDistance) {
        return true; // Collision
      }
    }
    
    return false; // No collision
  }
  
  /**
   * Apply optimizations to improve performance
   */
  private optimizeCity(): void {
    // Create optimization manager with the scene
    this.optimizationManager = new OptimizationManager(this.scene, this.assets);
    
    // Call the correct optimization method
    this.optimizationManager.optimizeEnvironment();
  }
  
  /**
   * Update the city based on camera position (for optimization)
   */
  public update(camera: THREE.Camera): void {
    if (this.optimizationManager) {
      this.optimizationManager.update(camera);
    }
  }
  
  /**
   * Get the width of a building by index
   */
  private getBuildingWidth(buildingIndex: number): number {
    switch (buildingIndex) {
      case 0: return 18; // Office building
      case 1: return 20; // Residential building
      case 3: return 14; // Small shop
      default: return 15;
    }
  }
  
  /**
   * Get the depth of a building by index
   */
  private getBuildingDepth(buildingIndex: number): number {
    switch (buildingIndex) {
      case 0: return 18; // Office building
      case 1: return 15; // Residential building
      case 3: return 12; // Small shop
      default: return 15;
    }
  }
} 