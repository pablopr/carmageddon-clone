import * as THREE from 'three';

// Types of particle effects
export enum ParticleEffectType {
  BLOOD = 'blood',
  ANIMAL_IMPACT = 'animal_impact',
  DEBRIS = 'debris',
  TIRE_SMOKE = 'tire_smoke',
  SKID_MARK = 'skid_mark',
  SPARKS = 'sparks'
}

// Configuration interface for particle effects
interface ParticleEffectConfig {
  count: number;           // Number of particles
  size: number;            // Size of each particle
  lifetime: number;        // Lifetime in seconds
  speed: number;           // Emission speed
  spread: number;          // Emission spread
  color: THREE.Color;      // Particle color
  gravity: THREE.Vector3;  // Gravity vector
  texture?: string;        // Optional texture path
  opacity?: number;        // Starting opacity
  fadeOut?: boolean;       // Whether to fade out
}

/**
 * Manages particle effects for the game
 */
export class ParticleSystem {
  // Scene reference
  private scene: THREE.Scene;
  
  // Particle groups (one for each effect type)
  private particleGroups: Map<ParticleEffectType, THREE.Group> = new Map();
  
  // Particle configurations
  private configs: Map<ParticleEffectType, ParticleEffectConfig> = new Map();
  
  // Textures for particles
  private textures: Map<string, THREE.Texture> = new Map();
  
  // Particle pools (to avoid constant creation/deletion)
  private particlePools: Map<ParticleEffectType, THREE.Points[]> = new Map();
  
  // Active particles
  private activeParticles: Map<number, {
    points: THREE.Points;
    type: ParticleEffectType;
    startTime: number;
    lifetime: number;
    velocities: THREE.Vector3[];
  }> = new Map();
  
  // Next particle ID
  private nextParticleId: number = 0;
  
  // Permanent mesh objects (like skid marks)
  private permanentMeshes: THREE.Object3D[] = [];
  
  // Loader for textures
  private textureLoader: THREE.TextureLoader;
  
  /**
   * Constructor
   * @param scene THREE.js scene
   */
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.textureLoader = new THREE.TextureLoader();
    
    // Initialize particle configurations
    this.initConfigurations();
    
    // Preload textures
    this.preloadTextures();
    
    // Create particle groups
    this.createParticleGroups();
    
    // Initialize particle pools
    this.initializeParticlePools();
  }
  
  /**
   * Initialize particle effect configurations
   */
  private initConfigurations(): void {
    // Blood splatter effect (for human NPC collisions)
    this.configs.set(ParticleEffectType.BLOOD, {
      count: 100,           // More particles
      size: 0.5,            // Larger particles
      lifetime: 2.0,        // Longer lifetime
      speed: 5,             // Faster movement
      spread: 1.0,          // Wider spread
      color: new THREE.Color(0xff0000), // Red
      gravity: new THREE.Vector3(0, -5, 0), // Less gravity
      texture: 'assets/textures/particles/blood.png',
      opacity: 1.0,         // Full opacity
      fadeOut: true
    });
    
    // Animal impact effect (fur, dust, etc.)
    this.configs.set(ParticleEffectType.ANIMAL_IMPACT, {
      count: 40,
      size: 0.25,
      lifetime: 1.2,
      speed: 2.5,
      spread: 0.7,
      color: new THREE.Color(0xbca382), // Brownish
      gravity: new THREE.Vector3(0, -8, 0),
      texture: 'assets/textures/particles/fur.png',
      opacity: 0.8,
      fadeOut: true
    });
    
    // Debris effect (for buildings, props)
    this.configs.set(ParticleEffectType.DEBRIS, {
      count: 35,
      size: 0.3,
      lifetime: 2.0,
      speed: 4,
      spread: 1.0,
      color: new THREE.Color(0xaaaaaa), // Grey
      gravity: new THREE.Vector3(0, -15, 0),
      texture: 'assets/textures/particles/debris.png',
      opacity: 1.0,
      fadeOut: true
    });
    
    // Tire smoke effect
    this.configs.set(ParticleEffectType.TIRE_SMOKE, {
      count: 20,
      size: 0.5,
      lifetime: 1.0,
      speed: 1.5,
      spread: 0.3,
      color: new THREE.Color(0xeeeeee), // White/grey
      gravity: new THREE.Vector3(0, 0.2, 0), // Slight upward drift
      texture: 'assets/textures/particles/smoke.png',
      opacity: 0.6,
      fadeOut: true
    });
    
    // Skid mark effect (these are more like decals than particles)
    this.configs.set(ParticleEffectType.SKID_MARK, {
      count: 1,
      size: 0.6,
      lifetime: 10.0, // Skid marks stay longer
      speed: 0,
      spread: 0,
      color: new THREE.Color(0x222222), // Black
      gravity: new THREE.Vector3(0, 0, 0),
      texture: 'assets/textures/particles/skid.png',
      opacity: 0.8,
      fadeOut: false
    });
    
    // Spark effect
    this.configs.set(ParticleEffectType.SPARKS, {
      count: 30,
      size: 0.15,
      lifetime: 0.7,
      speed: 5,
      spread: 0.5,
      color: new THREE.Color(0xffcc00), // Yellow/orange
      gravity: new THREE.Vector3(0, -5, 0),
      texture: 'assets/textures/particles/spark.png',
      opacity: 1.0,
      fadeOut: true
    });
  }
  
  /**
   * Preload textures
   */
  private preloadTextures(): void {
    // Load actual texture files instead of generating them with canvas
    const textureLoader = new THREE.TextureLoader();
    
    // Load blood texture
    textureLoader.load('assets/textures/particles/blood.png', (texture) => {
      this.textures.set('assets/textures/particles/blood.png', texture);
    });
    
    // Load fur texture
    textureLoader.load('assets/textures/particles/fur.png', (texture) => {
      this.textures.set('assets/textures/particles/fur.png', texture);
    });
    
    // Load debris texture
    textureLoader.load('assets/textures/particles/debris.png', (texture) => {
      this.textures.set('assets/textures/particles/debris.png', texture);
    });
    
    // Load smoke texture
    textureLoader.load('assets/textures/particles/smoke.png', (texture) => {
      this.textures.set('assets/textures/particles/smoke.png', texture);
    });
    
    // Load skid texture
    textureLoader.load('assets/textures/particles/skid.png', (texture) => {
      this.textures.set('assets/textures/particles/skid.png', texture);
    });
    
    // Load spark texture
    textureLoader.load('assets/textures/particles/spark.png', (texture) => {
      this.textures.set('assets/textures/particles/spark.png', texture);
    });
    
    // Create a default texture in case any of the above fail to load
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context for particle textures');
      return;
    }
    
    // Create a default circle texture
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    
    // Create texture from canvas
    const defaultTexture = new THREE.CanvasTexture(canvas);
    this.textures.set('default', defaultTexture);
  }
  
  /**
   * Create particle groups
   */
  private createParticleGroups(): void {
    // Create a group for each particle effect type
    Object.values(ParticleEffectType).forEach(type => {
      const group = new THREE.Group();
      group.name = `particle-group-${type}`;
      this.scene.add(group);
      this.particleGroups.set(type as ParticleEffectType, group);
    });
  }
  
  /**
   * Initialize particle pools
   */
  private initializeParticlePools(): void {
    // Create initial pool for each particle type
    Object.values(ParticleEffectType).forEach(type => {
      this.particlePools.set(type as ParticleEffectType, []);
    });
  }
  
  /**
   * Create a particle effect
   * @param type Particle effect type
   * @param position World position
   * @param direction Optional direction vector
   * @param intensity Optional intensity multiplier
   * @returns ID of the created particle system
   */
  public createEffect(
    type: ParticleEffectType,
    position: THREE.Vector3,
    direction: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
    intensity: number = 1.0
  ): number {
    console.log(`Creating particle effect: ${type} at position:`, position, `with intensity: ${intensity}`);
    
    const config = this.configs.get(type);
    if (!config) {
      console.warn(`Particle effect type not found: ${type}`);
      return -1;
    }
    
    // Get the particle group
    const group = this.particleGroups.get(type);
    if (!group) {
      console.warn(`Particle group not found: ${type}`);
      return -1;
    }
    
    // Special case for skid marks
    if (type === ParticleEffectType.SKID_MARK) {
      return this.createSkidMark(position, direction, intensity);
    }
    
    // For other particle types
    let points: THREE.Points;
    
    // Try to get a particle system from the pool
    const pool = this.particlePools.get(type) || [];
    if (pool.length > 0) {
      points = pool.pop()!;
      console.log(`Reusing particle system from pool for ${type}`);
    } else {
      // Create a new particle system if pool is empty
      points = this.createParticleSystem(config);
      console.log(`Created new particle system for ${type}`);
    }
    
    // Get the geometry for manipulation
    const geometry = points.geometry as THREE.BufferGeometry;
    const particleCount = Math.floor(config.count * intensity);
    console.log(`Creating ${particleCount} particles`);
    
    // Create position and velocity arrays
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    
    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      // Randomize positions slightly around the impact point
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * config.spread,
        (Math.random() - 0.5) * config.spread,
        (Math.random() - 0.5) * config.spread
      );
      
      const particlePos = position.clone().add(offset);
      
      // Set position
      positions[i * 3] = particlePos.x;
      positions[i * 3 + 1] = particlePos.y;
      positions[i * 3 + 2] = particlePos.z;
      
      // Calculate velocity based on direction and random spread
      const velocity = direction.clone().normalize()
        .multiplyScalar(config.speed * (0.5 + Math.random() * 0.5))
        .add(offset.multiplyScalar(0.5));
        
      velocities.push(velocity);
    }
    
    // Update the geometry
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Add to scene
    group.add(points);
    
    // Generate particle ID
    const particleId = this.nextParticleId++;
    
    // Store in active particles
    this.activeParticles.set(particleId, {
      points,
      type,
      startTime: performance.now(),
      lifetime: config.lifetime * 1000, // Convert to milliseconds
      velocities
    });
    
    return particleId;
  }
  
  /**
   * Create a skid mark (special case particle)
   */
  private createSkidMark(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    intensity: number
  ): number {
    // Create a plane aligned with the ground
    const width = 0.3 * intensity;
    const length = 2.0 * intensity;
    
    const geometry = new THREE.PlaneGeometry(width, length);
    
    const config = this.configs.get(ParticleEffectType.SKID_MARK);
    const material = new THREE.MeshBasicMaterial({
      color: config?.color || 0x222222,
      transparent: true,
      opacity: config?.opacity || 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the skid mark just above the ground to avoid z-fighting
    mesh.position.copy(position);
    mesh.position.y += 0.02;
    
    // Rotate to align with direction
    mesh.lookAt(position.clone().add(direction));
    mesh.rotateX(-Math.PI / 2); // Align with ground
    
    // Add to scene
    const group = this.particleGroups.get(ParticleEffectType.SKID_MARK);
    if (group) {
      group.add(mesh);
    }
    
    // Add to permanent meshes
    this.permanentMeshes.push(mesh);
    
    // Limit the number of skid marks (remove oldest when too many)
    const maxSkidMarks = 100;
    if (this.permanentMeshes.length > maxSkidMarks) {
      const oldest = this.permanentMeshes.shift();
      if (oldest) {
        oldest.parent?.remove(oldest);
      }
    }
    
    return -1; // No need to track skid marks for animation
  }
  
  /**
   * Create a new particle system
   */
  private createParticleSystem(config: ParticleEffectConfig): THREE.Points {
    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Get texture
    const texture = config.texture ? 
      this.textures.get(config.texture) || this.textures.get('default') :
      this.textures.get('default');
    
    // Create material
    const material = new THREE.PointsMaterial({
      size: config.size,
      color: config.color,
      map: texture,
      transparent: true,
      opacity: config.opacity || 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    
    // Create points
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false; // Ensure particles are always rendered
    
    return points;
  }
  
  /**
   * Update all particle systems
   * @param deltaTime Time since last update in seconds
   */
  public update(deltaTime: number): void {
    if (this.activeParticles.size > 0) {
      console.log(`Updating ${this.activeParticles.size} active particle systems`);
    }
    
    const now = performance.now();
    
    // Update each active particle system
    this.activeParticles.forEach((particleData, id) => {
      const { points, startTime, lifetime, velocities, type } = particleData;
      
      // Get elapsed time
      const elapsed = now - startTime;
      const normalizedLife = Math.min(elapsed / lifetime, 1.0);
      
      // Check if the particle system has expired
      if (elapsed >= lifetime) {
        console.log(`Particle system ${id} (${type}) expired after ${elapsed}ms`);
        // Remove from scene
        points.parent?.remove(points);
        
        // Return to pool
        const pool = this.particlePools.get(type);
        if (pool) {
          pool.push(points);
        }
        
        // Remove from active particles
        this.activeParticles.delete(id);
        return;
      }
      
      // Get configuration
      const config = this.configs.get(type);
      if (!config) return;
      
      // Update positions based on velocity and gravity
      const positions = points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const posArray = positions.array as Float32Array;
      
      for (let i = 0; i < velocities.length; i++) {
        const velocity = velocities[i];
        
        // Apply gravity
        velocity.add(config.gravity.clone().multiplyScalar(deltaTime));
        
        // Update position
        posArray[i * 3] += velocity.x * deltaTime;
        posArray[i * 3 + 1] += velocity.y * deltaTime;
        posArray[i * 3 + 2] += velocity.z * deltaTime;
      }
      
      // Mark the attribute as needing update
      positions.needsUpdate = true;
      
      // Update opacity if fading out
      if (config.fadeOut) {
        const material = points.material as THREE.PointsMaterial;
        material.opacity = (config.opacity || 1.0) * (1.0 - normalizedLife);
      }
    });
  }
  
  /**
   * Clean up and remove all particles
   */
  public dispose(): void {
    // Remove all active particles
    this.activeParticles.forEach(({ points }) => {
      points.parent?.remove(points);
    });
    this.activeParticles.clear();
    
    // Remove all particle groups
    this.particleGroups.forEach(group => {
      this.scene.remove(group);
    });
    this.particleGroups.clear();
    
    // Remove all permanent meshes
    this.permanentMeshes.forEach(mesh => {
      mesh.parent?.remove(mesh);
    });
    this.permanentMeshes = [];
    
    // Dispose of all textures
    this.textures.forEach(texture => {
      texture.dispose();
    });
    this.textures.clear();
  }
} 