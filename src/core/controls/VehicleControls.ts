import { Vehicle } from '../../entities/vehicles/Vehicle';

/**
 * Class to handle vehicle control inputs
 */
export class VehicleControls {
  // Control state
  private controlState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
    handbrake: false
  };
  
  // Key bindings
  private keyBindings = {
    forward: ['w', 'ArrowUp'],
    backward: ['s', 'ArrowDown'],
    left: ['a', 'ArrowLeft'],
    right: ['d', 'ArrowRight'],
    brake: ['b'],
    handbrake: [' '] // Space
  };
  
  // The vehicle to control
  private vehicle: Vehicle | null = null;
  
  // Event listeners
  private keyDownListener: (event: KeyboardEvent) => void;
  private keyUpListener: (event: KeyboardEvent) => void;
  
  /**
   * Constructor
   */
  constructor() {
    // Create event listeners
    this.keyDownListener = this.handleKeyDown.bind(this);
    this.keyUpListener = this.handleKeyUp.bind(this);
  }
  
  /**
   * Initialize controls for a vehicle
   * @param vehicle The vehicle to control
   */
  public initialize(vehicle: Vehicle): void {
    this.vehicle = vehicle;
    
    // Add event listeners
    document.addEventListener('keydown', this.keyDownListener);
    document.addEventListener('keyup', this.keyUpListener);
  }
  
  /**
   * Clean up event listeners
   */
  public dispose(): void {
    // Remove event listeners
    document.removeEventListener('keydown', this.keyDownListener);
    document.removeEventListener('keyup', this.keyUpListener);
    
    this.vehicle = null;
  }
  
  /**
   * Handle key down events
   * @param event Keyboard event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    
    // Check against key bindings
    for (const [action, keys] of Object.entries(this.keyBindings)) {
      if (keys.includes(key)) {
        // Set control state for this action
        this.controlState[action as keyof typeof this.controlState] = true;
        
        // Prevent default behavior for control keys
        event.preventDefault();
      }
    }
  }
  
  /**
   * Handle key up events
   * @param event Keyboard event
   */
  private handleKeyUp(event: KeyboardEvent): void {
    const key = event.key;
    
    // Check against key bindings
    for (const [action, keys] of Object.entries(this.keyBindings)) {
      if (keys.includes(key)) {
        // Clear control state for this action
        this.controlState[action as keyof typeof this.controlState] = false;
        
        // Prevent default behavior for control keys
        event.preventDefault();
      }
    }
  }
  
  /**
   * Update vehicle controls
   */
  public update(): void {
    if (this.vehicle) {
      // Apply current control state to the vehicle
      this.vehicle.applyControls(this.controlState);
    }
  }
  
  /**
   * Get the current control state
   * @returns Current control state
   */
  public getControlState(): typeof this.controlState {
    return { ...this.controlState };
  }
  
  /**
   * Manually set a control state
   * @param control Control to set
   * @param state State to set (true/false)
   */
  public setControlState(
    control: keyof typeof this.controlState,
    state: boolean
  ): void {
    this.controlState[control] = state;
  }
  
  /**
   * Reset all controls to inactive
   */
  public resetControls(): void {
    for (const key of Object.keys(this.controlState)) {
      this.controlState[key as keyof typeof this.controlState] = false;
    }
  }
  
  /**
   * Check if any control is active
   * @returns Whether any control is active
   */
  public isAnyControlActive(): boolean {
    return Object.values(this.controlState).some(state => state);
  }
  
  /**
   * Get the vehicle being controlled
   * @returns The controlled vehicle or null
   */
  public getVehicle(): Vehicle | null {
    return this.vehicle;
  }
  
  /**
   * Set custom key bindings
   * @param bindings New key bindings
   */
  public setKeyBindings(bindings: Partial<typeof this.keyBindings>): void {
    // Merge new bindings with existing ones
    this.keyBindings = {
      ...this.keyBindings,
      ...bindings
    };
  }
} 