import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CameraController, CameraMode } from './CameraController';
import { CityGenerator } from './environment/CityGenerator';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { VehicleControls } from './controls/VehicleControls';
import { Vehicle } from '../entities/vehicles/Vehicle';
import { VehicleFactory } from '../entities/vehicles/VehicleFactory';
import { CollisionManager, CollisionObjectType } from '../systems/CollisionManager';
import { NPCManager } from '../systems/NPCManager';
import { Minimap } from '../ui/Minimap';
import { AudioManager } from '../systems/AudioManager';
import { ParticleSystem, ParticleEffectType } from '../systems/ParticleSystem';

/**
 * Core Engine class that handles the Three.js scene setup and rendering
 */
export class Engine {
  // Scene elements
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  
  // Lighting
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  
  // DOM element
  private container: HTMLElement;
  
  // Controls
  private cameraController: CameraController;
  private vehicleControls: VehicleControls;
  
  // Environment
  private cityGenerator: CityGenerator | null = null;
  
  // Physics
  private physicsWorld: PhysicsWorld;
  
  // Collision manager
  private collisionManager!: CollisionManager;
  
  // NPC manager
  private npcManager!: NPCManager;
  
  // Vehicle
  private playerVehicle: Vehicle | null = null;
  
  // Animation
  private animationFrameId: number | null = null;
  private clock: THREE.Clock;
  private lastTime: number = 0;
  
  // Loading state
  private _isInitialized = false;
  private loadingScreen: HTMLDivElement | null = null;
  
  // Game UI elements
  private scoreDisplay: HTMLDivElement | null = null;
  private npcCountDisplay: HTMLDivElement | null = null;
  private minimap: Minimap | null = null;
  
  // Performance stats
  private stats = {
    fps: 0,
    lastTime: 0,
    frames: 0
  };
  
  // Debug
  private debugPhysics: boolean = false;
  
  // Audio system
  private audioManager: AudioManager;
  
  // Particle system
  private particleSystem: ParticleSystem | null = null;
  
  // Camera switching
  private cameraSwitchListener: (event: KeyboardEvent) => void;
  
  /**
   * Constructor
   * @param container DOM element to render the scene in
   */
  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create camera (FOV=75°, dynamic aspect ratio)
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 5, 10); // Initial camera position
    this.camera.lookAt(0, 0, 0);
    
    // Create renderer (antialiasing=true, shadows=true)
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    
    // Create camera controller
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);
    
    // Create vehicle controls
    this.vehicleControls = new VehicleControls();
    
    // Create physics world
    this.physicsWorld = new PhysicsWorld();
    
    // Create collision manager
    this.collisionManager = new CollisionManager(this.scene, this.physicsWorld);
    
    // Create lighting
    // Ambient light for general illumination
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(this.ambientLight);
    
    // Directional light (sunlight)
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.directionalLight.position.set(50, 200, 100); // Position light like sun
    this.directionalLight.castShadow = true;
    
    // Configure shadow properties for better quality
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 500;
    
    // Set shadow camera frustum to cover large area
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    
    this.scene.add(this.directionalLight);
    
    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Initialize audio manager 
    this.audioManager = AudioManager.getInstance();
    
    // Make it globally accessible for other systems like CollisionManager
    (window as any).audioManager = this.audioManager;
    
    // Set up camera switch event listener
    this.cameraSwitchListener = this.handleCameraSwitch.bind(this);
    document.addEventListener('keydown', this.cameraSwitchListener);
  }
  
  /**
   * Initialize the scene with city environment
   */
  public async initialize(): Promise<void> {
    // Show loading screen
    this.showLoadingScreen();
    
    try {
      // Create city generator
      this.cityGenerator = new CityGenerator(this.scene, this.physicsWorld, this.collisionManager);
      
      // Initialize and load assets
      await this.cityGenerator.initialize();
      
      // Generate the city with a fallback mechanism
      try {
        this.cityGenerator.generateCity(true); // Apply optimizations
      } catch (error) {
        console.error('Error generating city with optimizations:', error);
        console.log('Retrying without optimizations...');
        // Retry without optimizations
        this.cityGenerator.generateCity(false);
      }
      
      // Create physics ground plane
      const groundBody = this.physicsWorld.createGroundPlane();
      
      // Register ground with collision system
      this.collisionManager.registerObject(groundBody, CollisionObjectType.GROUND);
      
      // Set up collision effects
      this.setupCollisionEffects();
      
      // Create player vehicle
      this.createPlayerVehicle();
      
      // Setup vehicle camera
      this.setupVehicleCamera();
      
      // Create NPC manager
      this.npcManager = new NPCManager(this.scene, this.physicsWorld, this.collisionManager);
      if (this.playerVehicle) {
        this.npcManager.setPlayerVehicle(this.playerVehicle);
      }
      
      // Set camera to a good position to view the city
      this.camera.position.set(50, 30, 50);
      this.cameraController.setTarget(new THREE.Vector3(0, 0, 0));
      
      // Add information overlay
      this.addInfoOverlay();
      
      // Enable debug visualizations if needed
      if (this.debugPhysics) {
        this.physicsWorld.enableDebug(this.scene);
      }
      
      // Create the minimap
      this.minimap = new Minimap(this.container);
      
      // After creating player vehicle, set it in the minimap
      if (this.minimap && this.playerVehicle) {
        this.minimap.setPlayerVehicle(this.playerVehicle);
      }
      
      // After creating NPC manager, set it in the minimap
      if (this.minimap && this.npcManager) {
        this.minimap.setNPCManager(this.npcManager);
      }
      
      // Create particle system
      this.particleSystem = new ParticleSystem(this.scene);
      
      // Start ambient sound
      this.audioManager.startAmbientSound('city');
      
      // Mark as initialized
      this._isInitialized = true;
      
      // Hide loading screen
      this.hideLoadingScreen();
    } catch (error) {
      console.error('Error initializing engine:', error);
    }
  }
  
  
  /**
   * Show loading screen
   */
  private showLoadingScreen(): void {
    // Create loading screen element
    this.loadingScreen = document.createElement('div');
    this.loadingScreen.style.position = 'absolute';
    this.loadingScreen.style.top = '0';
    this.loadingScreen.style.left = '0';
    this.loadingScreen.style.width = '100%';
    this.loadingScreen.style.height = '100%';
    this.loadingScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.loadingScreen.style.display = 'flex';
    this.loadingScreen.style.flexDirection = 'column';
    this.loadingScreen.style.justifyContent = 'center';
    this.loadingScreen.style.alignItems = 'center';
    this.loadingScreen.style.color = 'white';
    this.loadingScreen.style.fontFamily = 'Arial, sans-serif';
    this.loadingScreen.style.fontSize = '24px';
    this.loadingScreen.style.zIndex = '1000';
    
    // Loading text
    const loadingText = document.createElement('div');
    loadingText.textContent = 'LOADING CITY...';
    loadingText.style.marginBottom = '20px';
    loadingText.style.color = '#ff0000';
    loadingText.style.fontWeight = 'bold';
    loadingText.style.fontSize = '32px';
    loadingText.style.textShadow = '2px 2px 4px #000000';
    
    // Loading spinner
    const spinner = document.createElement('div');
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.border = '5px solid #333';
    spinner.style.borderTop = '5px solid #ff0000';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'spin 1s linear infinite';
    
    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    // Add elements to loading screen
    this.loadingScreen.appendChild(loadingText);
    this.loadingScreen.appendChild(spinner);
    
    // Add to container
    this.container.appendChild(this.loadingScreen);
  }
  
  /**
   * Hide loading screen
   */
  private hideLoadingScreen(): void {
    if (this.loadingScreen) {
      // Fade out animation
      this.loadingScreen.style.transition = 'opacity 0.5s ease-in-out';
      this.loadingScreen.style.opacity = '0';
      
      // Remove after animation
      setTimeout(() => {
        if (this.loadingScreen && this.loadingScreen.parentNode) {
          this.loadingScreen.parentNode.removeChild(this.loadingScreen);
          this.loadingScreen = null;
        }
      }, 500);
    }
  }
  
  /**
   * Create player vehicle
   */
  private createPlayerVehicle(): void {
    try {
      // Create player vehicle at a starting position
      const startPosition = new THREE.Vector3(0, 2, 0);
      this.playerVehicle = VehicleFactory.createVehicle(this.scene, this.physicsWorld, startPosition);
      
      // Initialize vehicle controls
      this.vehicleControls.initialize(this.playerVehicle);
      
      // Register vehicle with collision manager
      this.collisionManager.setVehicle(this.playerVehicle);
      
      console.log('Player vehicle created');
    } catch (error) {
      console.error('Error creating player vehicle:', error);
      throw error;
    }
  }
  
  /**
   * Register ground plane for collision detection
   */
  private registerGroundForCollisions(groundBody: CANNON.Body): void {
    this.collisionManager.registerObject(groundBody, CollisionObjectType.GROUND);
  }
  
  /**
   * Add information overlay to the scene
   */
  private addInfoOverlay(): void {
    const infoDiv = document.createElement('div');
    infoDiv.style.position = 'absolute';
    infoDiv.style.top = '10px';
    infoDiv.style.left = '10px';
    infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    infoDiv.style.color = 'white';
    infoDiv.style.padding = '10px';
    infoDiv.style.borderRadius = '5px';
    infoDiv.style.fontFamily = 'Arial, sans-serif';
    infoDiv.style.fontSize = '14px';
    infoDiv.style.maxWidth = '300px';
    infoDiv.style.zIndex = '1000';
    
    infoDiv.innerHTML = `
      <h3>Vehicle Controls</h3>
      <p>W/↑ - Accelerate</p>
      <p>S/↓ - Brake/Reverse</p>
      <p>A/← - Steer Left</p>
      <p>D/→ - Steer Right</p>
      <p>SPACE - Handbrake</p>
      <p>C - Switch Camera View</p>
      <div id="camera-mode">Camera: Standard View</div>
      <div id="speed-display">Speed: 0 km/h</div>
      <div id="score-display">Score: 0</div>
      <div id="health-display">Health: 100%</div>
      <div id="npc-count">NPCs: 0</div>
      <p>FPS: <span id="fps-counter">0</span></p>
      <button id="back-to-menu">Back to Menu</button>
    `;
    
    this.container.appendChild(infoDiv);
    
    // Store references to UI elements
    this.scoreDisplay = document.getElementById('score-display') as HTMLDivElement;
    this.npcCountDisplay = document.getElementById('npc-count') as HTMLDivElement;

    // Add back to menu button functionality
    const backButton = document.getElementById('back-to-menu');
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.stop();
        // Dispatch custom event for the Game class to handle
        const event = new CustomEvent('backToMenu');
        window.dispatchEvent(event);
      });
    }
  }
  
  /**
   * Update vehicle information in the overlay
   */
  private updateVehicleInfo(): void {
    if (!this.playerVehicle) return;
    
    // Update speed display
    const speedDisplay = document.getElementById('speed-display');
    if (speedDisplay) {
      // Convert speed to km/h (assuming units are meters per second)
      const speedKmh = Math.round(this.playerVehicle.getSpeed() * 3.6);
      speedDisplay.textContent = `Speed: ${speedKmh} km/h`;
    }
    
    // Update score display
    if (this.scoreDisplay && this.collisionManager) {
      const score = this.collisionManager.getScore();
      this.scoreDisplay.textContent = `Score: ${score}`;
      
      // Add color based on score
      if (score > 0) {
        this.scoreDisplay.style.color = '#00ff00'; // Green for positive score
      } else if (score < 0) {
        this.scoreDisplay.style.color = '#ff3333'; // Red for negative score
      } else {
        this.scoreDisplay.style.color = '#ffffff'; // White for zero
      }
    }
    
    // Update NPC count display
    if (this.npcCountDisplay && this.npcManager) {
      const humanCount = this.npcManager.getHumanCount();
      this.npcCountDisplay.textContent = `NPCs: ${humanCount}`;
    }
    
    // Update health display
    const healthDisplay = document.getElementById('health-display');
    if (healthDisplay) {
      // Our simple implementation doesn't have health, so we'll show 100%
      const health = 100;
      healthDisplay.textContent = `Health: ${health}%`;
    }
  }
  
  /**
   * Update FPS counter
   */
  private updateFPSCounter(): void {
    const now = performance.now();
    
    // Update frame count
    this.stats.frames++;
    
    // Update FPS every second
    if (now >= this.stats.lastTime + 1000) {
      // Calculate FPS
      this.stats.fps = Math.round(
        (this.stats.frames * 1000) / (now - this.stats.lastTime)
      );
      
      // Update FPS counter in UI
      const fpsCounter = document.getElementById('fps-counter');
      if (fpsCounter) {
        fpsCounter.textContent = this.stats.fps.toString();
      }
      
      // Reset counter
      this.stats.frames = 0;
      this.stats.lastTime = now;
    }
  }
  
  /**
   * Start the animation loop
   */
  public start(): void {
    if (!this.animationFrameId) {
      // Initialize FPS counter and clock
      this.stats.lastTime = performance.now();
      this.stats.frames = 0;
      this.lastTime = 0;
      this.clock.start();
      
      this.animate();
      
      // Start engine sound
      this.audioManager.startEngineSound();
    }
  }
  
  /**
   * Stop the animation loop
   */
  public stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.clock.stop();
      
      // Clean up vehicle controls
      this.vehicleControls.dispose();
      
      // Clean up NPCs
      if (this.npcManager) {
        this.npcManager.clear();
      }
      
      // Hide the minimap if it exists
      if (this.minimap) {
        this.minimap.hide();
      }
      
      // Stop engine sound
      this.audioManager.stopEngineSound();
      
      // Stop ambient sound
      this.audioManager.stopAmbientSound();
      
      // Dispose of particle system
      if (this.particleSystem) {
        this.particleSystem.dispose();
        this.particleSystem = null;
      }
      
      // Clean up event listeners
      document.removeEventListener('keydown', this.cameraSwitchListener);
    }
  }
  
  /**
   * Handle window resize
   */
  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    // Update camera aspect ratio
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    // Update renderer size
    this.renderer.setSize(width, height);
  }
  
  /**
   * Animation loop
   */
  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    
    // Calculate delta time
    const time = this.clock.getElapsedTime();
    const delta = time - this.lastTime;
    this.lastTime = time;
    
    // Update FPS counter
    this.updateFPSCounter();
    
    try {
      // Update physics simulation
      this.physicsWorld.update(delta);
      
      // Update collision manager
      if (this.collisionManager) {
        this.collisionManager.update(delta);
      }
      
      // Update NPC manager
      if (this.npcManager) {
        this.npcManager.update(delta);
      }
      
      // Log physics world state occasionally
      if (Date.now() % 3000 < 20) {
        console.log('Physics bodies count:', this.physicsWorld.getBodiesCount());
        
        // Log vehicle state
        if (this.playerVehicle) {
          const body = this.playerVehicle.getBody();
          console.log('Vehicle body:', {
            position: body.position,
            velocity: body.velocity,
            mass: body.mass,
            isActive: !body.sleepState,
            forces: body.force
          });
        }
      }
      
      // Update vehicle controls
      this.vehicleControls.update();
      
      // Update player vehicle
      if (this.playerVehicle) {
        this.playerVehicle.update(delta);
        this.updateVehicleInfo();
        this.updateVehicleCamera();
      }
      
      // Update city optimizations if city generator exists
      if (this.cityGenerator) {
        this.cityGenerator.update(this.camera);
      }
      
      // Update minimap
      if (this.minimap) {
        this.minimap.update();
      }
      
      // Create vehicle effects
      this.createTireSmoke();
      
      // Update audio
      this.updateEngineSound();
      
      // Update particle systems
      if (this.particleSystem) {
        this.particleSystem.update(delta);
      }
      
      // Render the scene
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('Error in animation loop:', error);
      // Continue rendering even if updates fail
      this.renderer.render(this.scene, this.camera);
    }
  }
  
  /**
   * Get the scene object
   */
  public getScene(): THREE.Scene {
    return this.scene;
  }
  
  /**
   * Get the camera object
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
  
  /**
   * Get the renderer object
   */
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
  
  /**
   * Setup camera to follow the vehicle
   */
  private setupVehicleCamera(): void {
    if (!this.playerVehicle) return;
    
    // Get vehicle position and direction
    const vehiclePosition = this.playerVehicle.getPosition();
    const vehicleDirection = this.playerVehicle.getDirection();
    
    // Set initial camera position behind the vehicle based on direction
    const cameraDistance = 10;
    const cameraHeight = 5;
    const cameraPosition = new THREE.Vector3(
      vehiclePosition.x - Math.sin(vehicleDirection) * cameraDistance,
      vehiclePosition.y + cameraHeight,
      vehiclePosition.z - Math.cos(vehicleDirection) * cameraDistance
    );
    
    // Position the camera
    this.camera.position.copy(cameraPosition);
    
    // Look ahead of the vehicle
    const lookAtOffset = new THREE.Vector3(
      Math.sin(vehicleDirection) * 5,
      0,
      Math.cos(vehicleDirection) * 5
    );
    const targetPosition = vehiclePosition.clone().add(lookAtOffset);
    this.camera.lookAt(targetPosition);
    
    // Disable CameraController's automatic position updates and input
    this.cameraController.disablePositionUpdate();
    this.cameraController.disableInput(); // Disable user control of camera while in vehicle follow mode
    this.cameraController.setTarget(targetPosition);
    
    // Set initial camera mode to standard follow
    this.cameraController.setCameraMode(CameraMode.STANDARD_FOLLOW);
    this.updateCameraModeDisplay(CameraMode.STANDARD_FOLLOW);
    
    console.log('Vehicle camera setup complete');
  }
  
  /**
   * Update camera to follow the vehicle
   */
  private updateVehicleCamera(): void {
    if (!this.playerVehicle) return;
    
    const currentMode = this.cameraController.getCameraMode();
    
    // For standard follow mode, use the existing smooth follow logic
    if (currentMode === CameraMode.STANDARD_FOLLOW) {
      // Get vehicle position and direction
      const vehiclePosition = this.playerVehicle.getPosition();
      const vehicleDirection = this.playerVehicle.getDirection();
      const vehicleSpeed = this.playerVehicle.getSpeed();
      
      // Calculate camera position based on vehicle direction
      // Scale camera distance based on speed
      const minDistance = 10;
      const maxDistance = 15;
      const speedFactor = Math.min(1.0, vehicleSpeed / 30); // Normalize speed against a max of 30
      const cameraDistance = minDistance + (maxDistance - minDistance) * speedFactor;
      
      const cameraHeight = 5;  // Slightly higher for better view
      
      // Position the camera behind the vehicle based on vehicle's direction
      const cameraOffset = new THREE.Vector3(
        -Math.sin(vehicleDirection) * cameraDistance,
        cameraHeight,
        -Math.cos(vehicleDirection) * cameraDistance
      );
      
      // Target position (slightly ahead of the vehicle)
      const lookAtOffset = new THREE.Vector3(
        Math.sin(vehicleDirection) * 5,
        0,
        Math.cos(vehicleDirection) * 5
      );
      const targetPosition = vehiclePosition.clone().add(lookAtOffset);
      
      // Adjust lerp factor based on speed - faster speed needs faster camera movement
      const minLerp = 0.05;
      const maxLerp = 0.15;
      const lerpFactor = minLerp + (maxLerp - minLerp) * speedFactor;
      
      const newCameraPosition = vehiclePosition.clone().add(cameraOffset);
      this.camera.position.lerp(newCameraPosition, lerpFactor);
      
      // Set camera to look at a point slightly ahead of the vehicle
      this.camera.lookAt(targetPosition);
      
      // Update camera controller's target for consistency, but don't let it recalculate position
      this.cameraController.disablePositionUpdate();
      this.cameraController.setTarget(targetPosition);
    } else if (currentMode === CameraMode.DRIVER_VIEW) {
      // Update first-person view
      this.applyDriverCameraView(
        this.playerVehicle.getPosition(),
        this.playerVehicle.getDirection()
      );
    } else if (currentMode === CameraMode.CLOSE_FOLLOW) {
      // Update close follow view
      this.applyCloseFollowCameraView(
        this.playerVehicle.getPosition(),
        this.playerVehicle.getDirection()
      );
    }
  }
  
  /**
   * Set up first-person driver view camera
   * @param vehiclePosition Vehicle position
   * @param vehicleDirection Vehicle direction
   */
  private applyDriverCameraView(vehiclePosition: THREE.Vector3, vehicleDirection: number): void {
    // Position camera at driver position (slightly elevated and forward)
    const driverOffset = new THREE.Vector3(
      0,  // No sideways offset (centered)
      1.0, // Driver eye height
      -0.5 // Slightly forward from car center
    );
    
    // Rotate the offset based on vehicle's direction
    const rotatedOffset = driverOffset.clone();
    rotatedOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicleDirection);
    
    // Set camera position
    this.camera.position.copy(vehiclePosition).add(rotatedOffset);
    
    // Look in the direction the vehicle is facing
    const lookAtOffset = new THREE.Vector3(
      Math.sin(vehicleDirection) * 10,
      0,
      Math.cos(vehicleDirection) * 10
    );
    const targetPosition = vehiclePosition.clone().add(lookAtOffset);
    this.camera.lookAt(targetPosition);
  }
  
  /**
   * Set up close follow camera (third-person close view)
   * @param vehiclePosition Vehicle position
   * @param vehicleDirection Vehicle direction
   */
  private applyCloseFollowCameraView(vehiclePosition: THREE.Vector3, vehicleDirection: number): void {
    // Position the camera closer to the vehicle than standard follow
    const cameraDistance = 5; // Closer distance
    const cameraHeight = 3;   // Lower height for a more sporty view
    
    // Calculate camera position behind the vehicle
    const cameraOffset = new THREE.Vector3(
      -Math.sin(vehicleDirection) * cameraDistance,
      cameraHeight,
      -Math.cos(vehicleDirection) * cameraDistance
    );
    
    // Set camera position
    this.camera.position.copy(vehiclePosition).add(cameraOffset);
    
    // Look at the vehicle with slight forward offset
    const lookAheadFactor = 3; // Less look-ahead than standard view
    const lookAtOffset = new THREE.Vector3(
      Math.sin(vehicleDirection) * lookAheadFactor,
      0,
      Math.cos(vehicleDirection) * lookAheadFactor
    );
    const targetPosition = vehiclePosition.clone().add(lookAtOffset);
    this.camera.lookAt(targetPosition);
  }
  
  /**
   * Set up standard follow camera (current behavior)
   */
  private applyStandardFollowCameraView(): void {
    // Let the camera controller handle this with its default behavior
    this.cameraController.enablePositionUpdate();
    this.updateVehicleCamera(); // Call once to update position
  }
  
  /**
   * Set up collision callbacks to trigger audio and visual effects
   */
  private setupCollisionEffects(): void {
    // Register callbacks for different collision types
    this.collisionManager.registerCollisionCallback((event) => {
      // Only handle human collisions for now to debug the blood effect
      if (event.targetType === CollisionObjectType.HUMAN_NPC) {
        // Play human collision sound
        this.audioManager.playCollisionSound('human');
        this.audioManager.playNPCSound('human_scream');
        
        // Create blood particle effect
        if (this.particleSystem) {
          // Create a simple upward direction
          const direction = new THREE.Vector3(0, 1, 0);
          
          // Create blood effect with high intensity to make it visible
          this.particleSystem.createEffect(
            ParticleEffectType.BLOOD,
            event.collisionPoint,
            direction,
            2.0 // Higher intensity for visibility
          );
        }
      }
    });
  }
  
  /**
   * Create tire smoke effect
   */
  private createTireSmoke(): void {
    if (!this.particleSystem || !this.playerVehicle) return;
    
    // Only create tire smoke if:
    // 1. Vehicle is moving fast enough
    // 2. Vehicle is turning sharply or braking hard
    const speed = this.playerVehicle.getSpeed();
    const controlState = this.vehicleControls.getControlState();
    const isTurning = controlState.left || controlState.right;
    const isBraking = controlState.brake || controlState.handbrake;
    
    if (speed > 5 && (isTurning || isBraking)) {
      // Get vehicle position
      const position = this.playerVehicle.getPosition();
      
      // Get vehicle direction
      const direction = new THREE.Vector3(0, 1, 0); // Up
      
      // Create smoke at rear wheels (approximate positions)
      const vehicleLength = 2.0; // Based on vehicle size
      const vehicleWidth = 1.0;
      const vehicleDirection = this.playerVehicle.getDirection();
      
      // Calculate wheel positions relative to vehicle center
      const backLeftWheel = new THREE.Vector3(
        position.x - Math.cos(vehicleDirection + Math.PI/4) * vehicleWidth/2,
        position.y - 0.4, // Slightly below vehicle
        position.z - Math.sin(vehicleDirection + Math.PI/4) * vehicleWidth/2
      );
      
      const backRightWheel = new THREE.Vector3(
        position.x - Math.cos(vehicleDirection - Math.PI/4) * vehicleWidth/2,
        position.y - 0.4,
        position.z - Math.sin(vehicleDirection - Math.PI/4) * vehicleWidth/2
      );
      
      // Intensity based on speed and turn/brake input
      const intensity = Math.min(1.0, speed / 20) * 
                        (isBraking ? 1.2 : 1.0) *
                        (isTurning ? 1.3 : 1.0);
      
      // Create smoke effect at each wheel
      this.particleSystem.createEffect(
        ParticleEffectType.TIRE_SMOKE,
        backLeftWheel,
        direction,
        intensity * 0.6
      );
      
      this.particleSystem.createEffect(
        ParticleEffectType.TIRE_SMOKE,
        backRightWheel,
        direction,
        intensity * 0.6
      );
      
      // Create skid marks when braking hard or turning sharply at high speed
      if ((isBraking && speed > 8) || (isTurning && speed > 12)) {
        this.particleSystem.createEffect(
          ParticleEffectType.SKID_MARK,
          new THREE.Vector3(
            (backLeftWheel.x + backRightWheel.x) / 2,
            backLeftWheel.y + 0.05, // Just above ground
            (backLeftWheel.z + backRightWheel.z) / 2
          ),
          new THREE.Vector3(
            Math.cos(vehicleDirection),
            0,
            Math.sin(vehicleDirection)
          ),
          intensity * 0.8
        );
      }
      
      // Play tire screech sound occasionally (not every frame)
      if (Math.random() < 0.05) {
        this.audioManager.playVehicleSound('brake');
      }
    }
  }
  
  /**
   * Update engine sound based on vehicle speed
   */
  private updateEngineSound(): void {
    if (!this.playerVehicle) return;
    
    // Get current speed and normalize it to a 0-1 range (assuming max speed around 20)
    const speed = this.playerVehicle.getSpeed();
    const normalizedSpeed = Math.min(1.0, speed / 20);
    
    // Update engine sound parameters based on speed
    this.audioManager.updateEngineSound(normalizedSpeed);
  }
  
  /**
   * Handle camera switch with 'C' key
   * @param event Keyboard event
   */
  private handleCameraSwitch(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'c') {
      if (this.playerVehicle && this.cameraController) {
        const newMode = this.cameraController.cycleCameraMode();
        this.applyCameraMode(newMode);
        console.log('Camera mode switched to:', newMode);
        
        // Update UI to show current camera mode
        this.updateCameraModeDisplay(newMode);
      }
    }
  }
  
  /**
   * Apply the selected camera mode settings
   * @param mode Camera mode to apply
   */
  private applyCameraMode(mode: CameraMode): void {
    if (!this.playerVehicle) return;
    
    const vehiclePosition = this.playerVehicle.getPosition();
    const vehicleDirection = this.playerVehicle.getDirection();
    
    switch (mode) {
      case CameraMode.DRIVER_VIEW:
        // First-person driver view
        this.applyDriverCameraView(vehiclePosition, vehicleDirection);
        break;
      
      case CameraMode.CLOSE_FOLLOW:
        // Close follow camera (third-person, but closer)
        this.applyCloseFollowCameraView(vehiclePosition, vehicleDirection);
        break;
        
      case CameraMode.STANDARD_FOLLOW:
        // Standard follow camera (current behavior)
        this.applyStandardFollowCameraView();
        break;
    }
  }
  
  /**
   * Update camera mode display in the UI
   * @param mode Current camera mode
   */
  private updateCameraModeDisplay(mode: CameraMode): void {
    const cameraModeElement = document.getElementById('camera-mode');
    if (cameraModeElement) {
      let modeText = 'Camera: ';
      
      switch (mode) {
        case CameraMode.DRIVER_VIEW:
          modeText += 'Driver View';
          break;
        case CameraMode.CLOSE_FOLLOW:
          modeText += 'Close Follow';
          break;
        case CameraMode.STANDARD_FOLLOW:
          modeText += 'Standard View';
          break;
      }
      
      cameraModeElement.textContent = modeText;
    }
  }
} 