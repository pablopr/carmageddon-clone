import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../../core/physics/PhysicsWorld';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Vehicle class representing a Ferrari car with physics
 */
export class Vehicle {
  // Vehicle mesh
  private mesh: THREE.Mesh;
  
  // Vehicle model
  private carModel: THREE.Object3D | null = null;
  
  // Vehicle wheels (for animation)
  private wheels: THREE.Object3D[] = [];
  
  // Physics body
  private body: CANNON.Body;
  
  // Vehicle properties
  private maxSpeed: number = 55;
  private acceleration: number = 10;
  private turnSpeed: number = 0.03;
  private brakeForce: number = 15;
  
  // Current state
  private velocity: number = 0;
  private direction: number = 0;
  
  // Debug
  private lastPosition: THREE.Vector3 = new THREE.Vector3();
  private debugHelper: THREE.ArrowHelper | null = null;
  
  // Loader
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  
  // Temporary mesh used while model is loading
  private tempMesh: THREE.Mesh | null = null;
  private modelLoaded: boolean = false;
  
  /**
   * Constructor
   * @param scene THREE.js scene
   * @param physicsWorld Physics world
   * @param position Initial position
   */
  constructor(
    private scene: THREE.Scene,
    private physicsWorld: PhysicsWorld,
    position: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
  ) {
    // Initialize DRACO loader
    this.dracoLoader = new DRACOLoader();
    
    // Try local paths first for DRACO decoder
    const localDecoderPath = './node_modules/three/examples/jsm/libs/draco/';
    
    // Check if decoder files exist locally
    try {
      // Try to set local decoder path first
      this.dracoLoader.setDecoderPath(localDecoderPath);
      console.log('Using local DRACO decoder from:', localDecoderPath);
    } catch (e) {
      // If local path fails, use the remote CDN path
      console.log('Local DRACO decoder not found, using CDN version');
      this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    }
    
    this.dracoLoader.setDecoderConfig({ type: 'js' });
    
    // Initialize GLTF loader with DRACO support
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    
    // Create temporary vehicle mesh while model is loading
    this.tempMesh = this.createTemporaryMesh();
    this.tempMesh.position.copy(position);
    this.scene.add(this.tempMesh);
    
    // Create empty mesh as a placeholder (will be replaced with the model)
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.01, 0.01),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);
    
    // Load the Ferrari model
    this.loadVehicleModel(position);
    
    // Create physics body
    this.body = this.createPhysicsBody(position);
    
    // Store initial position for debugging
    this.lastPosition.copy(position);
    
    // Debug helper has been removed - we don't need it anymore
    this.debugHelper = null;
    
    // Log initial state
    console.log('Vehicle created at position:', position);
  }
  
  /**
   * Create a temporary box mesh for the vehicle while the model is loading
   * @returns Temporary vehicle mesh
   */
  private createTemporaryMesh(): THREE.Mesh {
    // Create a simple box geometry for the car
    const geometry = new THREE.BoxGeometry(2, 1, 4);
    
    // Create a simple material
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000, // Red car
      metalness: 0.5,
      roughness: 0.5
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Load the Ferrari 3D model
   * @param position Initial position
   */
  private loadVehicleModel(position: THREE.Vector3): void {
    // Define possible paths to try
    const modelPaths = [
      '/assets/models/ferrari.glb',
      'assets/models/ferrari.glb',
      './assets/models/ferrari.glb',
      '../assets/models/ferrari.glb'
    ];
    
    // Log loading attempt
    console.log('Attempting to load Ferrari model...');
    
    // Try loading with first path
    this.loadModelWithPath(modelPaths, 0, position);
  }
  
  /**
   * Recursively try different paths to load the model
   */
  private loadModelWithPath(paths: string[], index: number, position: THREE.Vector3): void {
    if (index >= paths.length) {
      console.error('Failed to load Ferrari model from all paths, creating fallback car');
      this.createFallbackCar();
      return;
    }

    const currentPath = paths[index];
    console.log(`Trying to load Ferrari model from: ${currentPath}`);
    
    // Load the Ferrari model
    this.gltfLoader.load(currentPath, 
      // Success callback
      (gltf) => {
        console.log('Ferrari model loaded successfully from:', currentPath);
        
        // Remove temporary mesh
        if (this.tempMesh) {
          this.scene.remove(this.tempMesh);
          this.tempMesh = null;
        }
        
        // Get the car model from the loaded GLTF
        this.carModel = gltf.scene.children[0];
        
        // Log the model structure to help with debugging
        console.log('Car model structure:', this.carModel);
        
        // Scale and position the model
        this.carModel.scale.set(1.0, 1.0, 1.0);
        
        // Fix the position offset - align with physics body position
        this.carModel.position.copy(this.mesh.position);
        
        // Fix the height offset - move down to ground level
        this.carModel.position.y -= 0.5; // Lower model to touch the ground
        
        // Fix rotation - rotate to match game coordinate system
        // Make the car face forward (away from camera)
        this.carModel.rotation.y = Math.PI; // Rotate 180 degrees around Y-axis
        
        // Apply materials
        const bodyMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xff0000,
          metalness: 1.0,
          roughness: 0.5,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03
        });
        
        const detailsMaterial = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 1.0,
          roughness: 0.5
        });
        
        const glassMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.25,
          roughness: 0,
          transmission: 1.0
        });
        
        // Apply materials to car parts if they exist
        if (this.carModel && this.carModel.getObjectByName('body')) {
          const bodyPart = this.carModel.getObjectByName('body');
          if (bodyPart && 'material' in bodyPart) {
            bodyPart.material = bodyMaterial;
          }
        }
        
        const rimParts = ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim'];
        rimParts.forEach(part => {
          if (this.carModel && this.carModel.getObjectByName(part)) {
            const rimPart = this.carModel.getObjectByName(part);
            if (rimPart && 'material' in rimPart) {
              rimPart.material = detailsMaterial;
            }
          }
        });
        
        if (this.carModel && this.carModel.getObjectByName('glass')) {
          const glassPart = this.carModel.getObjectByName('glass');
          if (glassPart && 'material' in glassPart) {
            glassPart.material = glassMaterial;
          }
        }
        
        // Store wheel objects for animation
        const wheelParts = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'];
        wheelParts.forEach(part => {
          if (this.carModel && this.carModel.getObjectByName(part)) {
            const wheel = this.carModel.getObjectByName(part);
            if (wheel) {
              this.wheels.push(wheel);
            }
          }
        });
        
        // Add shadow
        this.loadShadowTexture();
        
        // Add the model to the scene
        this.scene.add(this.carModel);
        
        // Model is now loaded
        this.modelLoaded = true;
      },
      
      // Progress callback
      (xhr) => {
        console.log(`Ferrari model ${Math.round(xhr.loaded / xhr.total * 100)}% loaded from ${currentPath}`);
      },
      
      // Error callback
      (error) => {
        console.warn(`Error loading Ferrari model from ${currentPath}:`, error);
        if (error instanceof Error) {
          console.warn('Error details:', error.message);
        }
        
        // Try the next path
        this.loadModelWithPath(paths, index + 1, position);
      }
    );
  }
  
  /**
   * Load the shadow texture
   */
  private loadShadowTexture(): void {
    // Define possible paths to try
    const texturePaths = [
      '/assets/models/ferrari_ao.png',
      'assets/models/ferrari_ao.png',
      './assets/models/ferrari_ao.png',
      '../assets/models/ferrari_ao.png'
    ];
    
    console.log('Attempting to load shadow texture...');
    this.loadShadowWithPath(texturePaths, 0);
  }
  
  /**
   * Recursively try different paths to load the shadow texture
   */
  private loadShadowWithPath(paths: string[], index: number): void {
    if (index >= paths.length) {
      console.error('Failed to load shadow texture from all paths');
      return;
    }

    const currentPath = paths[index];
    console.log(`Trying to load shadow texture from: ${currentPath}`);
    
    const shadowLoader = new THREE.TextureLoader();
    shadowLoader.load(
      currentPath,
      // Success callback
      (texture) => {
        console.log('Shadow texture loaded successfully from:', currentPath);
        if (!this.carModel) return;
        
        const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.655 * 6, 1.3 * 6),
          new THREE.MeshBasicMaterial({
            map: texture,
            blending: THREE.MultiplyBlending,
            toneMapped: false,
            transparent: true
          })
        );
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = -0.49; // Just above the ground
        shadowMesh.renderOrder = 2;
        this.carModel.add(shadowMesh);
      },
      // Progress callback
      undefined,
      // Error callback
      (error) => {
        console.warn(`Error loading shadow texture from ${currentPath}:`, error);
        if (error instanceof Error) {
          console.warn('Error details:', error.message);
        }
        
        // Try the next path
        this.loadShadowWithPath(paths, index + 1);
      }
    );
  }
  
  /**
   * Create physics body for the vehicle
   * @param position Initial position
   * @returns Physics body
   */
  private createPhysicsBody(position: THREE.Vector3): CANNON.Body {
    // Create a box shape
    const shape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
    
    // Create the body
    const body = new CANNON.Body({
      mass: 100, // Reduced weight for easier movement
      position: new CANNON.Vec3(position.x, position.y, position.z),
      shape: shape,
      material: new CANNON.Material("vehicleMaterial")
    });
    
    // Adjust damping (less resistance)
    body.linearDamping = 0.1; // Reduced from 0.5
    body.angularDamping = 0.1; // Reduced from 0.5
    
    // Make sure we can move in all directions
    body.fixedRotation = false;
    body.updateMassProperties();
    
    // Create contact material for better vehicle physics
    const vehicleMaterial = body.material as CANNON.Material;
    const contactMaterial = new CANNON.ContactMaterial(
      vehicleMaterial,
      this.physicsWorld.getDefaultMaterial(),
      {
        friction: 0.1,
        restitution: 0.1
      }
    );
    // Add contact material to world
    this.physicsWorld.addContactMaterial(contactMaterial);
    
    // Add to physics world
    this.physicsWorld.addBody(body, this.mesh);
    
    return body;
  }
  
  /**
   * Apply control state to vehicle
   * @param controlState Current control state
   */
  public applyControls(controlState: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    brake: boolean;
    handbrake: boolean;
  }): void {
    // Apply acceleration
    if (controlState.forward) {
      this.velocity += this.acceleration * 0.016; // Rough approximation of deltaTime
    }
    
    // Apply braking or reverse
    if (controlState.backward) {
      if (this.velocity > 0) {
        this.velocity -= this.brakeForce * 0.016;
      } else {
        this.velocity -= this.acceleration * 0.016;
      }
    }
    
    if (controlState.left) {
      this.direction += this.turnSpeed ;
    }
    
    if (controlState.right) {
      this.direction -= this.turnSpeed;
    }
    
    // Apply handbrake
    if (controlState.handbrake) {
      this.velocity *= 0.9; // Quick deceleration
    }
    
    // Apply regular brake
    if (controlState.brake) {
      if (this.velocity > 0) {
        this.velocity -= this.brakeForce * 0.016;
      } else if (this.velocity < 0) {
        this.velocity += this.brakeForce * 0.016;
      }
    }
    
    // Clamp velocity to max speed
    this.velocity = Math.max(Math.min(this.velocity, this.maxSpeed), -this.maxSpeed / 2);
    
    // Apply natural deceleration when no inputs
    if (!controlState.forward && !controlState.backward) {
      if (Math.abs(this.velocity) < 0.1) {
        this.velocity = 0;
      } else {
        this.velocity *= 0.98; // Gradual slowdown
      }
    }
  }
  
  /**
   * Update vehicle position and rotation
   * @param deltaTime Time since last update
   */
  public update(deltaTime: number): void {
    // Apply physics behavior to update the velocity based on direction
    const quaternion = new CANNON.Quaternion();
    quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.direction);
    this.body.quaternion = quaternion;
    
    // Calculate direction vector
    const directionVector = new THREE.Vector3(
      Math.sin(this.direction), 
      0, 
      Math.cos(this.direction)
    );
    
    // Scale by velocity
    directionVector.multiplyScalar(this.velocity);
    
    // Apply velocity to the physics body to make the car move
    this.body.velocity.x = directionVector.x;
    this.body.velocity.z = directionVector.z;
    
    // Make sure the body is active
    this.body.wakeUp();
    
    // Update physics position to the mesh
    const position = this.body.position;
    this.mesh.position.set(position.x, position.y, position.z);
    
    // Update model position if loaded
    if (this.carModel) {
      // Apply position from physics, but keep the y-offset fix for the model
      this.carModel.position.x = position.x;
      this.carModel.position.z = position.z;
      // Keep the y-position adjustment we made earlier (not directly copying y)
      
      // Apply rotation from physics to the model
      // But keep initial rotation offset (PI around Y axis) we applied
      const bodyQuaternion = this.body.quaternion;
      this.carModel.quaternion.set(
        bodyQuaternion.x,
        bodyQuaternion.y,
        bodyQuaternion.z,
        bodyQuaternion.w
      );
      // Apply the initial rotation offset (180 degrees around Y)
      this.carModel.rotateY(Math.PI);
      
      // Animate wheels based on velocity
      if (this.wheels.length > 0 && Math.abs(this.velocity) > 0.1) {
        const rotationSpeed = this.velocity * deltaTime * 2;
        this.wheels.forEach(wheel => {
          wheel.rotation.x += rotationSpeed;
        });
      }
    }
    
    // Update rotation from physics for the placeholder mesh
    const bodyQuaternion = this.body.quaternion;
    this.mesh.quaternion.set(
      bodyQuaternion.x,
      bodyQuaternion.y,
      bodyQuaternion.z,
      bodyQuaternion.w
    );
    
    // No longer updating debug helper since it's been removed
    
    // Calculate and log speed
    const pos = this.mesh.position;
    const dist = pos.distanceTo(this.lastPosition);
    const speed = dist / deltaTime;
    
    // Update last position
    this.lastPosition.copy(pos);
  }
  
  /**
   * Get current velocity
   * @returns Velocity in units per second
   */
  public getVelocity(): number {
    return this.velocity;
  }
  
  /**
   * Get speed (absolute value of velocity)
   * @returns Speed in units per second
   */
  public getSpeed(): number {
    return Math.abs(this.velocity);
  }
  
  /**
   * Get current direction
   * @returns Direction in radians
   */
  public getDirection(): number {
    return this.direction;
  }
  
  /**
   * Get position of the vehicle
   * @returns THREE.Vector3 position
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
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
   * @returns THREE.Mesh
   */
  public getMesh(): THREE.Mesh {
    return this.mesh;
  }
  
  /**
   * Dispose of all resources
   */
  public dispose(): void {
    if (this.carModel) {
      this.scene.remove(this.carModel);
    }
    
    if (this.tempMesh) {
      this.scene.remove(this.tempMesh);
    }
    
    this.scene.remove(this.mesh);
    
    if (this.debugHelper) {
      this.scene.remove(this.debugHelper);
    }
    
    // Dispose of loaders
    if (this.dracoLoader) {
      this.dracoLoader.dispose();
    }
    
    this.physicsWorld.removeBody(this.body);
  }
  
  /**
   * Creates a Ferrari-like car directly with Three.js geometries as a fallback
   * if the model fails to load
   */
  private createFallbackCar(): void {
    console.log('Creating fallback Ferrari car model');
    
    // Create a group to hold all car parts
    const carGroup = new THREE.Group();
    this.carModel = carGroup;
    
    // Car body - red with metallic finish
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff0000,
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    });
    
    // Create car body
    const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    body.name = 'body';
    carGroup.add(body);
    
    // Create car roof/cockpit
    const roofGeometry = new THREE.BoxGeometry(1.5, 0.4, 2);
    const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
    roof.position.y = 1.2;
    roof.position.z = -0.2;
    roof.castShadow = true;
    carGroup.add(roof);
    
    // Glass material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xaaaaff,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.9,
      transparent: true
    });
    
    // Create windshield
    const windshieldGeometry = new THREE.BoxGeometry(1.4, 0.3, 0.1);
    const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
    windshield.position.y = 1.0;
    windshield.position.z = 0.8;
    windshield.rotation.x = Math.PI / 6;
    windshield.name = 'glass';
    carGroup.add(windshield);
    
    // Wheels material
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8
    });
    
    // Rim material
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.8,
      roughness: 0.2
    });
    
    // Create wheels
    const wheelPositions = [
      { x: -0.8, y: 0.3, z: 1.2, name: 'wheel_fl' },   // Front left
      { x: 0.8, y: 0.3, z: 1.2, name: 'wheel_fr' },    // Front right
      { x: -0.8, y: 0.3, z: -1.2, name: 'wheel_rl' },  // Rear left
      { x: 0.8, y: 0.3, z: -1.2, name: 'wheel_rr' }    // Rear right
    ];
    
    wheelPositions.forEach(pos => {
      // Create tire
      const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 24);
      wheelGeometry.rotateZ(Math.PI / 2);
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(pos.x, pos.y, pos.z);
      wheel.castShadow = true;
      wheel.name = pos.name;
      carGroup.add(wheel);
      this.wheels.push(wheel);
      
      // Create rim
      const rimGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.22, 8);
      rimGeometry.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      rim.position.set(pos.x, pos.y, pos.z);
      rim.name = pos.name.replace('wheel', 'rim');
      carGroup.add(rim);
    });
    
    // Add fake shadow
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    });
    
    const shadowGeometry = new THREE.PlaneGeometry(3, 5);
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.49;
    shadow.renderOrder = 2;
    carGroup.add(shadow);
    
    // Position the car
    if (this.mesh) {
      carGroup.position.copy(this.mesh.position);
      // Fix the height offset for the fallback car too
      carGroup.position.y -= 0.5; // Lower to ground level
    }
    
    // Add the car to the scene
    this.scene.add(carGroup);
    
    // Model is now loaded
    this.modelLoaded = true;
    
    console.log('Fallback Ferrari car created successfully');
  }
}
