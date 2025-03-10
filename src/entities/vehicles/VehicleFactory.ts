import * as THREE from 'three';
import { PhysicsWorld } from '../../core/physics/PhysicsWorld';
import { Vehicle } from './Vehicle';

/**
 * Factory class for creating vehicle instances
 */
export class VehicleFactory {
  /**
   * Create a vehicle
   * @param scene THREE.js scene
   * @param physicsWorld Physics world
   * @param position Initial position
   * @returns Vehicle instance
   */
  public static createVehicle(
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    position: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
  ): Vehicle {
    return new Vehicle(scene, physicsWorld, position);
  }
}
