import * as THREE from 'three';

/**
 * Camera mode enum for the different view positions
 */
export enum CameraMode {
  DRIVER_VIEW = 0,      // First-person view from driver position
  CLOSE_FOLLOW = 1,     // Close third-person view
  STANDARD_FOLLOW = 2   // Standard third-person view (current behavior)
}

/**
 * Simple camera controller to orbit around a target point
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private element: HTMLElement;
  
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private radius: number = 8;
  private theta: number = 0;
  private phi: number = Math.PI / 4; // 45 degrees
  
  private isDragging: boolean = false;
  private previousMousePosition: { x: number, y: number } = { x: 0, y: 0 };
  
  private zoomSpeed: number = 0.1;
  private rotationSpeed: number = 0.005;
  
  // Controls whether the controller updates the camera position
  private positionUpdateEnabled: boolean = true;
  
  // Controls whether user input is enabled
  private inputEnabled: boolean = true;
  
  // Current camera mode
  private cameraMode: CameraMode = CameraMode.STANDARD_FOLLOW;
  
  // Saved camera positions for different modes
  private savedTheta: number = 0;
  private savedPhi: number = Math.PI / 4;
  private savedRadius: number = 8;
  
  /**
   * Constructor
   * @param camera The camera to control
   * @param element The DOM element to attach event listeners to
   */
  constructor(camera: THREE.PerspectiveCamera, element: HTMLElement) {
    this.camera = camera;
    this.element = element;
    
    // Initialize camera position
    this.updateCameraPosition();
    
    // Add event listeners
    this.addEventListeners();
  }
  
  /**
   * Add event listeners for mouse and touch interaction
   */
  private addEventListeners(): void {
    // Mouse events
    this.element.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.element.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.element.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.element.addEventListener('wheel', this.onMouseWheel.bind(this));
    
    // Touch events (simplified for now)
    this.element.addEventListener('touchstart', this.onTouchStart.bind(this));
    this.element.addEventListener('touchmove', this.onTouchMove.bind(this));
    this.element.addEventListener('touchend', this.onTouchEnd.bind(this));
  }
  
  /**
   * Update camera position based on spherical coordinates
   */
  private updateCameraPosition(): void {
    // Skip position update if disabled
    if (!this.positionUpdateEnabled) return;
    
    // Calculate camera position using spherical coordinates
    const x = this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }
  
  /**
   * Mouse down event handler
   */
  private onMouseDown(event: MouseEvent): void {
    if (!this.inputEnabled) return;
    
    this.isDragging = true;
    this.previousMousePosition.x = event.clientX;
    this.previousMousePosition.y = event.clientY;
  }
  
  /**
   * Mouse move event handler
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.inputEnabled || !this.isDragging) return;
    
    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;
    
    this.theta -= deltaX * this.rotationSpeed;
    this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi - deltaY * this.rotationSpeed));
    
    this.updateCameraPosition();
    
    this.previousMousePosition.x = event.clientX;
    this.previousMousePosition.y = event.clientY;
  }
  
  /**
   * Mouse up event handler
   */
  private onMouseUp(): void {
    this.isDragging = false;
  }
  
  /**
   * Mouse wheel event handler for zooming
   */
  private onMouseWheel(event: WheelEvent): void {
    if (!this.inputEnabled) return;
    
    event.preventDefault();
    
    // Adjust radius based on wheel delta
    this.radius += event.deltaY * this.zoomSpeed;
    
    // Clamp radius to reasonable values
    this.radius = Math.max(2, Math.min(100, this.radius));
    
    this.updateCameraPosition();
  }
  
  /**
   * Touch start event handler
   */
  private onTouchStart(event: TouchEvent): void {
    if (!this.inputEnabled) return;
    
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.previousMousePosition.x = event.touches[0].clientX;
      this.previousMousePosition.y = event.touches[0].clientY;
    }
  }
  
  /**
   * Touch move event handler
   */
  private onTouchMove(event: TouchEvent): void {
    if (!this.inputEnabled || !this.isDragging || event.touches.length !== 1) return;
    
    const deltaX = event.touches[0].clientX - this.previousMousePosition.x;
    const deltaY = event.touches[0].clientY - this.previousMousePosition.y;
    
    this.theta -= deltaX * this.rotationSpeed;
    this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi - deltaY * this.rotationSpeed));
    
    this.updateCameraPosition();
    
    this.previousMousePosition.x = event.touches[0].clientX;
    this.previousMousePosition.y = event.touches[0].clientY;
  }
  
  /**
   * Touch end event handler
   */
  private onTouchEnd(): void {
    this.isDragging = false;
  }
  
  /**
   * Set target point to orbit around
   */
  public setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
    this.updateCameraPosition();
  }
  
  /**
   * Set camera distance from target
   */
  public setRadius(radius: number): void {
    this.radius = radius;
    this.updateCameraPosition();
  }
  
  /**
   * Disable automatic camera position updates
   * Used when manually controlling the camera (e.g., for vehicle following)
   */
  public disablePositionUpdate(): void {
    this.positionUpdateEnabled = false;
  }
  
  /**
   * Enable automatic camera position updates
   */
  public enablePositionUpdate(): void {
    this.positionUpdateEnabled = true;
    this.updateCameraPosition();
  }
  
  /**
   * Disable user input for camera control
   */
  public disableInput(): void {
    this.inputEnabled = false;
  }
  
  /**
   * Enable user input for camera control
   */
  public enableInput(): void {
    this.inputEnabled = true;
  }
  
  /**
   * Get current camera mode
   * @returns Current camera mode
   */
  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }
  
  /**
   * Set specific camera mode
   * @param mode Camera mode to set
   */
  public setCameraMode(mode: CameraMode): void {
    // Save current camera settings if we're in standard mode
    if (this.cameraMode === CameraMode.STANDARD_FOLLOW) {
      this.savedTheta = this.theta;
      this.savedPhi = this.phi;
      this.savedRadius = this.radius;
    }
    
    this.cameraMode = mode;
    
    // Restore saved settings if we're returning to standard mode
    if (mode === CameraMode.STANDARD_FOLLOW) {
      this.theta = this.savedTheta;
      this.phi = this.savedPhi;
      this.radius = this.savedRadius;
      this.enablePositionUpdate();
    } else {
      // For other modes, position update is handled by the engine
      this.disablePositionUpdate();
    }
  }
  
  /**
   * Cycle to the next camera mode
   * @returns The new camera mode
   */
  public cycleCameraMode(): CameraMode {
    const nextMode = (this.cameraMode + 1) % 3;
    this.setCameraMode(nextMode as CameraMode);
    return nextMode as CameraMode;
  }
} 