import { Howl, Howler } from 'howler';

/**
 * Manages all audio for the game using Howler.js
 */
export class AudioManager {
  // Static instances for singleton management
  private static instance: AudioManager;
  
  // Sound categories
  private vehicleSounds: Map<string, Howl> = new Map();
  private npcSounds: Map<string, Howl> = new Map();
  private collisionSounds: Map<string, Howl> = new Map();
  private uiSounds: Map<string, Howl> = new Map();
  private ambientSounds: Map<string, Howl> = new Map();
  
  // Engine sound specific variables
  private engineSound: Howl | null = null;
  private engineVolume: number = 0.5;
  private enginePitch: number = 1.0;
  
  // State
  private muted: boolean = false;
  private masterVolume: number = 0.7;
  private soundEnabled: boolean = true;
  
  // IDs for looping sounds
  private ambientSoundId: number | null = null;
  private engineSoundId: number | null = null;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Set global Howler settings
    Howler.volume(this.masterVolume);
    
    // Initialize sound library
    this.initializeSounds();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  /**
   * Initialize all game sounds
   */
  private initializeSounds(): void {
    // Load vehicle sounds
    this.vehicleSounds.set('engine', new Howl({
      src: ['assets/audio/vehicle/engine.mp3'],
      loop: true,
      volume: this.engineVolume
    }));
    
    this.vehicleSounds.set('brake', new Howl({
      src: ['assets/audio/vehicle/brake.mp3'],
      volume: 0.6
    }));
    
    this.vehicleSounds.set('horn', new Howl({
      src: ['assets/audio/vehicle/horn.mp3'],
      volume: 0.7
    }));
    
    // Cache engine sound for frequent access
    this.engineSound = this.vehicleSounds.get('engine') || null;
    
    // Load collision sounds
    this.collisionSounds.set('human', new Howl({
      src: ['assets/audio/collision/human.mp3'],
      volume: 0.8
    }));
    
    this.collisionSounds.set('animal', new Howl({
      src: ['assets/audio/collision/animal.mp3'],
      volume: 0.7
    }));
    
    this.collisionSounds.set('building', new Howl({
      src: ['assets/audio/collision/building.mp3'],
      volume: 0.9
    }));
    
    this.collisionSounds.set('prop', new Howl({
      src: ['assets/audio/collision/prop.mp3'],
      volume: 0.6
    }));
    
    // Load NPC sounds
    this.npcSounds.set('human_scream', new Howl({
      src: ['assets/audio/npc/human_scream.mp3'],
      volume: 0.75
    }));
    
    this.npcSounds.set('dog_bark', new Howl({
      src: ['assets/audio/npc/dog_bark.mp3'],
      volume: 0.65
    }));
    
    this.npcSounds.set('cat_meow', new Howl({
      src: ['assets/audio/npc/cat_meow.mp3'],
      volume: 0.6
    }));
    
    this.npcSounds.set('cow_moo', new Howl({
      src: ['assets/audio/npc/cow_moo.mp3'],
      volume: 0.7
    }));
    
    this.npcSounds.set('deer_sound', new Howl({
      src: ['assets/audio/npc/deer_sound.mp3'],
      volume: 0.6
    }));
    
    // Load UI sounds
    this.uiSounds.set('click', new Howl({
      src: ['assets/audio/ui/click.mp3'],
      volume: 0.5
    }));
    
    this.uiSounds.set('score', new Howl({
      src: ['assets/audio/ui/score.mp3'],
      volume: 0.6
    }));
    
    this.uiSounds.set('combo', new Howl({
      src: ['assets/audio/ui/combo.mp3'],
      volume: 0.7
    }));
    
    // Load ambient sounds
    this.ambientSounds.set('city', new Howl({
      src: ['assets/audio/ambient/city.mp3'],
      loop: true,
      volume: 0.3
    }));
  }
  
  /**
   * Play a vehicle sound
   * @param sound Sound name
   */
  public playVehicleSound(sound: string): void {
    if (!this.soundEnabled) return;
    
    const soundObj = this.vehicleSounds.get(sound);
    if (soundObj) {
      soundObj.play();
    }
  }
  
  /**
   * Play a collision sound
   * @param type Collision type
   * @param volume Optional volume override
   */
  public playCollisionSound(type: string, volume?: number): void {
    if (!this.soundEnabled) return;
    
    const soundObj = this.collisionSounds.get(type);
    if (soundObj) {
      if (volume !== undefined) {
        soundObj.volume(volume);
      }
      soundObj.play();
    }
  }
  
  /**
   * Play an NPC sound
   * @param type NPC sound type
   */
  public playNPCSound(type: string): void {
    if (!this.soundEnabled) return;
    
    const soundObj = this.npcSounds.get(type);
    if (soundObj) {
      soundObj.play();
    }
  }
  
  /**
   * Play a UI sound
   * @param sound UI sound name
   */
  public playUISound(sound: string): void {
    if (!this.soundEnabled) return;
    
    const soundObj = this.uiSounds.get(sound);
    if (soundObj) {
      soundObj.play();
    }
  }
  
  /**
   * Start ambient sound
   * @param sound Ambient sound name
   */
  public startAmbientSound(sound: string): void {
    if (!this.soundEnabled) return;
    
    // Stop current ambient sound if playing
    this.stopAmbientSound();
    
    const soundObj = this.ambientSounds.get(sound);
    if (soundObj) {
      this.ambientSoundId = soundObj.play();
    }
  }
  
  /**
   * Stop ambient sound
   */
  public stopAmbientSound(): void {
    if (this.ambientSoundId !== null) {
      this.ambientSounds.forEach(sound => {
        sound.stop();
      });
      this.ambientSoundId = null;
    }
  }
  
  /**
   * Start engine sound
   */
  public startEngineSound(): void {
    if (!this.soundEnabled || !this.engineSound) return;
    
    // Stop if already playing
    this.stopEngineSound();
    
    // Start new sound
    this.engineSoundId = this.engineSound.play();
  }
  
  /**
   * Stop engine sound
   */
  public stopEngineSound(): void {
    if (this.engineSoundId !== null && this.engineSound) {
      this.engineSound.stop();
      this.engineSoundId = null;
    }
  }
  
  /**
   * Update engine sound parameters based on vehicle speed
   * @param speed Current vehicle speed, normalized 0-1
   */
  public updateEngineSound(speed: number): void {
    if (!this.soundEnabled || this.engineSoundId === null || !this.engineSound) return;
    
    // Map speed to pitch range (0.8 - 1.5)
    const pitch = 0.8 + (speed * 0.7);
    this.enginePitch = pitch;
    
    // Map speed to volume range (0.3 - 1.0)
    const volume = 0.3 + (speed * 0.7);
    this.engineVolume = volume;
    
    // Apply changes
    this.engineSound.rate(this.enginePitch, this.engineSoundId);
    this.engineSound.volume(this.engineVolume, this.engineSoundId);
  }
  
  /**
   * Set master volume
   * @param volume Volume level (0.0 - 1.0)
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.masterVolume);
  }
  
  /**
   * Toggle sound on/off
   * @param enabled Whether sound is enabled
   */
  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    
    if (!enabled) {
      // Mute all sounds
      Howler.mute(true);
      this.muted = true;
    } else {
      // Unmute
      Howler.mute(false);
      this.muted = false;
    }
  }
  
  /**
   * Clean up and stop all sounds
   */
  public dispose(): void {
    // Stop all sounds
    this.stopEngineSound();
    this.stopAmbientSound();
    
    // Unload all sounds to free memory
    this.vehicleSounds.forEach(sound => sound.unload());
    this.npcSounds.forEach(sound => sound.unload());
    this.collisionSounds.forEach(sound => sound.unload());
    this.uiSounds.forEach(sound => sound.unload());
    this.ambientSounds.forEach(sound => sound.unload());
  }
} 