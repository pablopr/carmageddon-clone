import * as CANNON from 'cannon-es';
import * as THREE from 'three';

/**
 * Class to manage the Cannon.js physics world
 */
export class PhysicsWorld {
  // Physics world
  private world: CANNON.World;
  
  // Object mappings (for syncing physics with rendering)
  private physicsBodies: Map<number, CANNON.Body> = new Map();
  private meshBodyMap: Map<THREE.Object3D, CANNON.Body> = new Map();
  private bodyMeshMap: Map<CANNON.Body, THREE.Object3D> = new Map();
  
  // Debug
  private debugMode: boolean = false;
  private debugMeshes: THREE.Mesh[] = [];
  private debugScene: THREE.Scene | null = null;
  
  // Collision callbacks
  private collisionCallbacks: Array<(event: any) => void> = [];
  
  /**
   * Constructor
   * @param gravity Gravity vector
   */
  constructor(gravity: { x: number; y: number; z: number } = { x: 0, y: -9.81, z: 0 }) {
    // Create the physics world
    this.world = new CANNON.World();
    
    // Set gravity
    this.world.gravity.set(gravity.x, gravity.y, gravity.z);
    
    // Set broadphase for better collision detection
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    
    // Add event listeners for collisions
    this.world.addEventListener('beginContact', this.onBeginContact.bind(this));
    this.world.addEventListener('endContact', this.onEndContact.bind(this));
    
    // Enable collision detection events in Cannon.js
    this.world.addEventListener('postStep', this.checkCollisions.bind(this));
    
    // Configure world settings
    this.world.defaultContactMaterial.friction = 0.3;
    this.world.defaultContactMaterial.restitution = 0.2;
  }
  
  /**
   * Handle collision detection in post-step
   */
  private checkCollisions(): void {
    // Get all active contacts
    const contacts = this.world.contacts;
    
    // Process each contact
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      // Only report significant collisions with actual contact
      if (contact.enabled) {
        // Get impact velocity
        const impactVelocity = contact.getImpactVelocityAlongNormal();
        
        // We now always pass the contact object regardless of impact velocity
        // But indicate the velocity so that handlers can decide whether to process it
        const event = {
          bodyA: contact.bi,
          bodyB: contact.bj,
          contact: contact,
          impactVelocity: impactVelocity
        };
        
        // Notify all collision callbacks
        for (const callback of this.collisionCallbacks) {
          callback(event);
        }
      }
    }
  }
  
  /**
   * Handle begin contact event
   * @param event Contact event
   */
  private onBeginContact(event: any): void {
    // Handle collision start
    // This can be expanded to handle specific collision responses
    console.debug('Physics collision started', event);
  }
  
  /**
   * Handle end contact event
   * @param event Contact event
   */
  private onEndContact(event: any): void {
    // Handle collision end
    // This can be expanded to handle specific collision responses
    console.debug('Physics collision ended', event);
  }
  
  /**
   * Register a callback for collision events
   * @param callback Function to call when collisions occur
   */
  public registerCollisionCallback(callback: (event: any) => void): void {
    this.collisionCallbacks.push(callback);
  }
  
  /**
   * Remove a collision callback
   * @param callback The callback to remove
   */
  public unregisterCollisionCallback(callback: (event: any) => void): void {
    const index = this.collisionCallbacks.indexOf(callback);
    if (index !== -1) {
      this.collisionCallbacks.splice(index, 1);
    }
  }
  
  /**
   * Create a physics body from a Three.js mesh
   * @param mesh Three.js mesh to create a physics body for
   * @param options Options for the physics body
   * @returns Cannon.js physics body
   */
  public createBodyFromMesh(
    mesh: THREE.Mesh,
    options: {
      mass?: number;
      material?: CANNON.Material;
      type?: CANNON.BodyType;
      position?: THREE.Vector3;
      rotation?: THREE.Euler;
      collisionGroup?: number;
      collisionMask?: number;
      fixedRotation?: boolean;
    } = {}
  ): CANNON.Body {
    // Set defaults
    const mass = options.mass ?? 0;
    const material = options.material ?? this.world.defaultMaterial;
    const type = options.type ?? (mass > 0 ? CANNON.BODY_TYPES.DYNAMIC : CANNON.BODY_TYPES.STATIC);
    
    // Create a physics body
    const body = new CANNON.Body({
      mass,
      material,
      type,
      position: options.position ? new CANNON.Vec3(
        options.position.x,
        options.position.y,
        options.position.z
      ) : undefined,
      fixedRotation: options.fixedRotation
    });
    
    // Set rotation if provided
    if (options.rotation) {
      const quaternion = new THREE.Quaternion().setFromEuler(options.rotation);
      body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    }
    
    // Set collision group and mask if provided
    if (options.collisionGroup !== undefined) {
      body.collisionFilterGroup = options.collisionGroup;
    }
    if (options.collisionMask !== undefined) {
      body.collisionFilterMask = options.collisionMask;
    }
    
    // Create a shape based on the mesh geometry
    const shape = this.createShapeFromMesh(mesh);
    body.addShape(shape);
    
    // Add body to the world
    this.world.addBody(body);
    
    // Store mapping between mesh and body
    this.meshBodyMap.set(mesh, body);
    this.bodyMeshMap.set(body, mesh);
    this.physicsBodies.set(body.id, body);
    
    return body;
  }
  
  /**
   * Create a Cannon.js shape from a Three.js mesh
   * @param mesh Three.js mesh
   * @returns Cannon.js shape
   */
  private createShapeFromMesh(mesh: THREE.Mesh): CANNON.Shape {
    const geometry = mesh.geometry;
    
    // Get world scale
    const scale = new THREE.Vector3();
    new THREE.Box3().setFromObject(mesh).getSize(scale);
    
    // For simple shapes, create matching Cannon shapes
    if (geometry instanceof THREE.BoxGeometry) {
      // Create a box shape
      return new CANNON.Box(new CANNON.Vec3(
        scale.x * 0.5,
        scale.y * 0.5,
        scale.z * 0.5
      ));
    } else if (geometry instanceof THREE.SphereGeometry) {
      // Create a sphere shape
      return new CANNON.Sphere(Math.max(scale.x, scale.y, scale.z) * 0.5);
    } else if (geometry instanceof THREE.CylinderGeometry) {
      // Create a cylinder shape
      return new CANNON.Cylinder(
        scale.x * 0.5,
        scale.x * 0.5,
        scale.y,
        8
      );
    } else {
      // For complex shapes, use a simplified box
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      return new CANNON.Box(new CANNON.Vec3(
        size.x * 0.5,
        size.y * 0.5,
        size.z * 0.5
      ));
    }
  }
  
  /**
   * Add a custom physics body to the world
   * @param body Cannon.js physics body
   * @param mesh Optional Three.js mesh to associate with this body
   */
  public addBody(body: CANNON.Body, mesh?: THREE.Object3D): void {
    this.world.addBody(body);
    this.physicsBodies.set(body.id, body);
    
    if (mesh) {
      this.meshBodyMap.set(mesh, body);
      this.bodyMeshMap.set(body, mesh);
    }
  }
  
  /**
   * Remove a physics body from the world
   * @param body Cannon.js physics body or Three.js mesh with associated body
   */
  public removeBody(body: CANNON.Body | THREE.Object3D): void {
    if (body instanceof CANNON.Body) {
      this.world.removeBody(body);
      this.physicsBodies.delete(body.id);
      
      const mesh = this.bodyMeshMap.get(body);
      if (mesh) {
        this.meshBodyMap.delete(mesh);
        this.bodyMeshMap.delete(body);
      }
    } else {
      const physicsBody = this.meshBodyMap.get(body);
      
      if (physicsBody) {
        this.world.removeBody(physicsBody);
        this.physicsBodies.delete(physicsBody.id);
        this.meshBodyMap.delete(body);
        this.bodyMeshMap.delete(physicsBody);
      }
    }
  }
  
  /**
   * Create a ground plane
   * @param normal Normal vector of the plane
   * @param offset Offset from the origin
   * @param material Material for the plane
   * @returns Cannon.js ground body
   */
  public createGroundPlane(
    normal: CANNON.Vec3 = new CANNON.Vec3(0, 1, 0),
    offset: number = 0,
    material: CANNON.Material = this.world.defaultMaterial
  ): CANNON.Body {
    // Create a static plane
    const groundBody = new CANNON.Body({
      mass: 0, // Static body
      material,
      type: CANNON.BODY_TYPES.STATIC
    });
    
    // Add plane shape
    groundBody.addShape(new CANNON.Plane());
    
    // Position the ground plane
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to face up
    groundBody.position.set(0, offset, 0);
    
    // Add to world
    this.world.addBody(groundBody);
    this.physicsBodies.set(groundBody.id, groundBody);
    
    return groundBody;
  }
  
  /**
   * Create a box-shaped physics body
   * @param dimensions Box dimensions (half-extents)
   * @param position Position
   * @param options Additional body options
   * @returns Cannon.js box body
   */
  public createBox(
    dimensions: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
    options: {
      mass?: number;
      material?: CANNON.Material;
      quaternion?: CANNON.Quaternion;
    } = {}
  ): CANNON.Body {
    // Set defaults
    const mass = options.mass ?? 0;
    const material = options.material ?? this.world.defaultMaterial;
    
    // Create a physics body
    const body = new CANNON.Body({
      mass,
      material
    });
    
    // Add box shape
    body.addShape(new CANNON.Box(new CANNON.Vec3(
      dimensions.x,
      dimensions.y,
      dimensions.z
    )));
    
    // Set position and quaternion
    body.position.set(position.x, position.y, position.z);
    
    if (options.quaternion) {
      body.quaternion.copy(options.quaternion);
    }
    
    // Add to world
    this.world.addBody(body);
    this.physicsBodies.set(body.id, body);
    
    return body;
  }
  
  
  /**
   * Create a contact material between two materials
   * @param material1 First material
   * @param material2 Second material
   * @param options Contact material options
   * @returns Cannon.js contact material
   */
  public createContactMaterial(
    material1: CANNON.Material,
    material2: CANNON.Material,
    options: {
      friction?: number;
      restitution?: number;
    } = {}
  ): CANNON.ContactMaterial {
    const contactMaterial = new CANNON.ContactMaterial(
      material1,
      material2,
      {
        friction: options.friction ?? 0.3,
        restitution: options.restitution ?? 0.2
      }
    );
    
    this.world.addContactMaterial(contactMaterial);
    
    return contactMaterial;
  }
  
  /**
   * Update physics world
   * @param deltaTime Time since last update
   */
  public update(deltaTime: number): void {
    if (deltaTime > 0) {
      // Step the physics world
      this.world.step(1 / 60, deltaTime, 3);
      
      // Update the meshes from their associated physics bodies
      this.bodyMeshMap.forEach((mesh, body) => {
        // Use direct property access instead of copy for type safety
        mesh.position.set(
          body.position.x,
          body.position.y,
          body.position.z
        );
        mesh.quaternion.set(
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w
        );
      });
      
      // Update debug meshes if in debug mode and debugScene exists
      if (this.debugMode && this.debugScene !== null) {
        this.updateDebugMeshes();
      }
    }
  }
  
  /**
   * Enable debug mode to visualize physics bodies
   * @param scene Three.js scene to add debug meshes to
   */
  public enableDebug(scene: THREE.Scene): void {
    this.debugMode = true;
    this.debugScene = scene;
    
    // Create debug meshes for existing bodies
    this.physicsBodies.forEach(body => {
      this.addDebugMesh(body);
    });
  }
  
  /**
   * Disable debug mode
   */
  public disableDebug(): void {
    this.debugMode = false;
    
    // Remove debug meshes from scene
    if (this.debugScene) {
      for (const mesh of this.debugMeshes) {
        this.debugScene.remove(mesh);
      }
    }
    
    this.debugMeshes = [];
    this.debugScene = null;
  }
  
  /**
   * Add debug mesh for a physics body
   * @param body Physics body to add debug mesh for
   */
  private addDebugMesh(body: CANNON.Body): void {
    // Skip if not in debug mode or no debug scene
    if (!this.debugMode || !this.debugScene) {
      return;
    }
    
    // Create a debug mesh for each shape in the body
    body.shapes.forEach((shape, i) => {
      let geometry: THREE.BufferGeometry;
      let mesh: THREE.Mesh;
      
      // Create geometry based on shape type
      switch (shape.type) {
        case CANNON.Shape.types.BOX:
          const boxShape = shape as CANNON.Box;
          geometry = new THREE.BoxGeometry(
            boxShape.halfExtents.x * 2,
            boxShape.halfExtents.y * 2,
            boxShape.halfExtents.z * 2
          );
          break;
          
        case CANNON.Shape.types.SPHERE:
          const sphereShape = shape as CANNON.Sphere;
          geometry = new THREE.SphereGeometry(sphereShape.radius, 8, 8);
          break;
          
        case CANNON.Shape.types.PLANE:
          geometry = new THREE.PlaneGeometry(10, 10, 4, 4);
          break;
          
        default:
          // Default to box for unsupported shapes
          geometry = new THREE.BoxGeometry(1, 1, 1);
          break;
      }
      
      // Create wireframe material
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      
      // Create mesh
      mesh = new THREE.Mesh(geometry, material);
      
      // Add mesh to scene and debug array
      // We know debugScene is not null here because of the check at the beginning
      this.debugScene!.add(mesh);
      this.debugMeshes.push(mesh);
      
      // Store the body for later updates
      (mesh as any).__cannonBody = body;
      (mesh as any).__cannonShapeIndex = i;
    });
  }
  
  /**
   * Update debug meshes to match physics bodies
   */
  private updateDebugMeshes(): void {
    // Skip if not in debug mode or no debug scene
    if (!this.debugMode || !this.debugScene) {
      return;
    }
    
    for (const mesh of this.debugMeshes) {
      const body = (mesh as any).__cannonBody as CANNON.Body;
      const shapeIndex = (mesh as any).__cannonShapeIndex as number;
      
      if (body) {
        // Update position and rotation using direct property assignment
        mesh.position.set(
          body.position.x,
          body.position.y,
          body.position.z
        );
        mesh.quaternion.set(
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w
        );
        
        // Apply shape offset if it exists
        if (body.shapeOffsets[shapeIndex]) {
          const offset = body.shapeOffsets[shapeIndex];
          mesh.position.x += offset.x;
          mesh.position.y += offset.y;
          mesh.position.z += offset.z;
        }
        
        // Apply shape orientation if it exists
        if (body.shapeOrientations[shapeIndex]) {
          const orientation = body.shapeOrientations[shapeIndex];
          mesh.quaternion.x = orientation.x;
          mesh.quaternion.y = orientation.y;
          mesh.quaternion.z = orientation.z;
          mesh.quaternion.w = orientation.w;
        }
      }
    }
  }
  
  /**
   * Get the Cannon.js world
   * @returns Cannon.js world
   */
  public getWorld(): CANNON.World {
    return this.world;
  }
  
  /**
   * Get the physics body associated with a mesh
   * @param mesh Three.js mesh
   * @returns Associated physics body, or null if not found
   */
  public getBodyFromMesh(mesh: THREE.Object3D): CANNON.Body | null {
    return this.meshBodyMap.get(mesh) || null;
  }
  
  /**
   * Get the mesh associated with a physics body
   * @param body Cannon.js physics body
   * @returns Associated Three.js mesh, or null if not found
   */
  public getMeshFromBody(body: CANNON.Body): THREE.Object3D | null {
    return this.bodyMeshMap.get(body) || null;
  }
  
  /**
   * Get the default material of the physics world
   * @returns Default CANNON material
   */
  public getDefaultMaterial(): CANNON.Material {
    return this.world.defaultMaterial;
  }
  
  /**
   * Add a contact material between two materials
   * @param contactMaterial The contact material to add
   */
  public addContactMaterial(contactMaterial: CANNON.ContactMaterial): void {
    this.world.addContactMaterial(contactMaterial);
  }
  
  /**
   * Get the number of bodies in the physics world
   * @returns Number of bodies
   */
  public getBodiesCount(): number {
    return this.world.bodies.length;
  }
} 