import * as THREE from 'three';
import { PerformanceOptimizer } from './PerformanceOptimizer';
import { EnvironmentAssets } from '../environment/EnvironmentAssets';

/**
 * Manager class to handle optimization of environment assets
 */
export class OptimizationManager {
  private scene: THREE.Scene;
  private optimizer: PerformanceOptimizer;
  private environmentAssets: EnvironmentAssets;
  
  // LOD models cache
  private lodBuildings: Map<number, THREE.LOD> = new Map();
  private lodProps: Map<number, THREE.LOD> = new Map();
  
  // Material optimization
  private sharedMaterials: Map<string, THREE.Material> = new Map();
  private textureCount: number = 0;
  private materialCount: number = 0;
  
  // Optimization flags
  private isOptimized: boolean = false;
  private isPartiallyOptimized: boolean = false;
  private optimizableObjectsCount: number = 0;
  
  /**
   * Constructor
   * @param scene THREE.js scene to optimize
   * @param environmentAssets Environment assets to optimize
   */
  constructor(scene: THREE.Scene, environmentAssets: EnvironmentAssets) {
    this.scene = scene;
    this.environmentAssets = environmentAssets;
    this.optimizer = new PerformanceOptimizer(scene);
    this.initializeSharedMaterials();
  }
  
  /**
   * Initialize shared materials to reduce texture units
   */
  private initializeSharedMaterials(): void {
    // Building materials
    this.sharedMaterials.set('building-glass', new THREE.MeshStandardMaterial({
      color: 0x6688aa,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.8
    }));
    
    this.sharedMaterials.set('building-concrete', new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.2
    }));
    
    this.sharedMaterials.set('building-brick', new THREE.MeshStandardMaterial({
      color: 0xaa6644,
      roughness: 0.8,
      metalness: 0.1
    }));
    
    // Prop materials
    this.sharedMaterials.set('prop-wood', new THREE.MeshStandardMaterial({
      color: 0x8B4513, // SaddleBrown
      roughness: 0.9,
      metalness: 0.1
    }));
    
    this.sharedMaterials.set('prop-foliage', new THREE.MeshStandardMaterial({
      color: 0x228B22, // ForestGreen
      roughness: 0.8,
      metalness: 0.1
    }));
    
    this.sharedMaterials.set('prop-metal', new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.3,
      metalness: 0.8
    }));
    
    // Road materials
    this.sharedMaterials.set('road-asphalt', new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.1
    }));
  }
  
  /**
   * Get a shared material by key
   * @param key Material key
   * @returns The shared material or a new default material if not found
   */
  public getSharedMaterial(key: string): THREE.Material {
    if (this.sharedMaterials.has(key)) {
      return this.sharedMaterials.get(key)!;
    }
    
    console.warn(`Shared material '${key}' not found, using default`);
    return new THREE.MeshStandardMaterial({ color: 0x888888 });
  }
  
  /**
   * Optimize the entire scene and all environment assets
   */
  public optimizeEnvironment(): void {
    try {
      console.log('Optimizing environment...');
      
      // Optimize materials and textures
      this.optimizeMaterialsAndTextures();
      
      // Mark objects that can be optimized
      this.markOptimizableObjects();
      
      // Create LOD versions of buildings
      this.createLODBuildings();
      
      // Create LOD versions of props
      this.createLODProps();
      
      // Apply all performance optimizations
      this.optimizer.applyAllOptimizations();
      
      this.isOptimized = true;
      
      console.log(`Environment optimization complete. Processed ${this.optimizableObjectsCount} objects.`);
    } catch (error) {
      console.error('Error during environment optimization:', error);
      console.warn('Continuing without optimization');
    }
  }
  
  /**
   * Optimize materials and textures to reduce texture units
   */
  private optimizeMaterialsAndTextures(): void {
    console.log('Optimizing materials and textures to reduce texture units...');
    
    const uniqueMaterials = new Set<THREE.Material>();
    const uniqueTextures = new Set<THREE.Texture>();
    
    // First pass: count materials and textures
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (Array.isArray(object.material)) {
          // Multi-material object
          object.material.forEach(material => {
            if (material) {
              uniqueMaterials.add(material);
              this.collectTexturesFromMaterial(material, uniqueTextures);
            }
          });
        } else if (object.material) {
          // Single material object
          uniqueMaterials.add(object.material);
          this.collectTexturesFromMaterial(object.material, uniqueTextures);
        }
      }
    });
    
    this.materialCount = uniqueMaterials.size;
    this.textureCount = uniqueTextures.size;
    
    console.log(`Found ${this.materialCount} unique materials and ${this.textureCount} unique textures.`);
    
    // If we have too many textures, we need to consolidate materials
    if (this.textureCount > 14) { // Keep a safety margin below 16
      console.warn(`Too many textures (${this.textureCount}), applying aggressive material optimization.`);
      
      // Second pass: replace materials with shared materials
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (Array.isArray(object.material)) {
            // Multi-material object
            for (let i = 0; i < object.material.length; i++) {
              // Determine best shared material type
              const material = object.material[i];
              if (material) {
                const sharedMaterialKey = this.determineMaterialType(material, object);
                object.material[i] = this.getSharedMaterial(sharedMaterialKey);
              }
            }
          } else if (object.material) {
            // Single material object
            const sharedMaterialKey = this.determineMaterialType(object.material, object);
            object.material = this.getSharedMaterial(sharedMaterialKey);
          }
        }
      });
      
      console.log('Material optimization complete, using shared materials.');
    } else {
      console.log('Texture count within limits, no need for aggressive optimization.');
    }
  }
  
  /**
   * Collect all textures from a material
   * @param material The material to process
   * @param textureSet The set to collect unique textures
   */
  private collectTexturesFromMaterial(material: THREE.Material, textureSet: Set<THREE.Texture>): void {
    // For MeshStandardMaterial
    if (material instanceof THREE.MeshStandardMaterial) {
      if (material.map) textureSet.add(material.map);
      if (material.normalMap) textureSet.add(material.normalMap);
      if (material.roughnessMap) textureSet.add(material.roughnessMap);
      if (material.metalnessMap) textureSet.add(material.metalnessMap);
      if (material.emissiveMap) textureSet.add(material.emissiveMap);
      if (material.aoMap) textureSet.add(material.aoMap);
    }
    // For MeshPhongMaterial
    else if (material instanceof THREE.MeshPhongMaterial) {
      if (material.map) textureSet.add(material.map);
      if (material.specularMap) textureSet.add(material.specularMap);
      if (material.normalMap) textureSet.add(material.normalMap);
      if (material.emissiveMap) textureSet.add(material.emissiveMap);
    }
    // For MeshBasicMaterial
    else if (material instanceof THREE.MeshBasicMaterial) {
      if (material.map) textureSet.add(material.map);
    }
  }
  
  /**
   * Determine the best material type for an object based on its properties
   * @param material The current material
   * @param object The mesh object
   * @returns Key for the best shared material
   */
  private determineMaterialType(material: THREE.Material, object: THREE.Object3D): string {
    // Check if it's a tree part
    if (object.name.toLowerCase().includes('trunk') || 
        object.parent?.name.toLowerCase().includes('tree')) {
      return 'prop-wood';
    }
    
    // Check if it's tree foliage
    if (object.name.toLowerCase().includes('foliage') || 
        object.name.toLowerCase().includes('leaf')) {
      return 'prop-foliage';
    }
    
    // Check if it's a metal part
    if (object.name.toLowerCase().includes('metal') || 
        object.name.toLowerCase().includes('pole') ||
        object.name.toLowerCase().includes('light')) {
      return 'prop-metal';
    }
    
    // Check if it's glass or window
    if (object.name.toLowerCase().includes('glass') || 
        object.name.toLowerCase().includes('window')) {
      return 'building-glass';
    }
    
    // Check if it's a road
    if (object.name.toLowerCase().includes('road') || 
        object.name.toLowerCase().includes('asphalt') ||
        object.name.toLowerCase().includes('street')) {
      return 'road-asphalt';
    }
    
    // Check if it's a building
    if (object.name.toLowerCase().includes('building') || 
        object.name.toLowerCase().includes('wall') ||
        object.name.toLowerCase().includes('structure')) {
      
      // Different building materials
      if (material instanceof THREE.MeshStandardMaterial || 
          material instanceof THREE.MeshPhongMaterial) {
        // Use color to determine brick vs concrete
        if (material.color) {
          const color = material.color as THREE.Color;
          // If reddish, likely brick
          if (color.r > 0.6 && color.g < 0.5) {
            return 'building-brick';
          }
        }
      }
      
      return 'building-concrete';
    }
    
    // Default fallback
    return 'building-concrete';
  }
  
  /**
   * Mark objects that can be optimized in the scene
   */
  private markOptimizableObjects(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // Mark object as optimizable
        object.userData.isOptimizable = true;
        this.optimizableObjectsCount++;
        
        // Determine which optimizations can be applied
        
        // Can this object be instanced?
        // Simple props like trees, streetlights, benches can be instanced
        const canInstance = this.isSimpleProp(object);
        object.userData.canInstance = canInstance;
        
        // Can this object be merged with others?
        // Small decorative elements can often be merged
        const canMerge = this.isSmallDecorative(object);
        object.userData.canMerge = canMerge;
        
        // Should materials be optimized?
        // Almost all objects can have materials optimized
        object.userData.optimizeMaterials = true;
        
        // Should this object be culled when distant?
        // Large or important objects might not be culled
        const noCull = this.isLargeOrImportant(object);
        object.userData.noCull = noCull;
      }
    });
  }
  
  /**
   * Check if an object is a simple prop that can be instanced
   * @param object Object to check
   * @returns Whether the object is a simple prop
   */
  private isSimpleProp(object: THREE.Object3D): boolean {
    // Simple heuristic: check if the object's name contains prop-like keywords
    const name = object.name.toLowerCase();
    return name.includes('tree') || 
           name.includes('light') || 
           name.includes('bench') || 
           name.includes('trash') ||
           name.includes('lamp');
  }
  
  /**
   * Check if an object is a small decorative element that can be merged
   * @param object Object to check
   * @returns Whether the object is a small decorative element
   */
  private isSmallDecorative(object: THREE.Object3D): boolean {
    // Check if the object is small enough to be merged
    if (object instanceof THREE.Mesh) {
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      // If all dimensions are small, it's likely decorative
      return size.x < 2 && size.y < 2 && size.z < 2;
    }
    
    return false;
  }
  
  /**
   * Check if an object is large or important and should not be culled
   * @param object Object to check
   * @returns Whether the object is large or important
   */
  private isLargeOrImportant(object: THREE.Object3D): boolean {
    // Large objects like ground and sky should not be culled
    if (object instanceof THREE.Mesh) {
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      // Large objects
      if (size.x > 100 || size.y > 100 || size.z > 100) {
        return true;
      }
      
      // Road segments are important
      const name = object.name.toLowerCase();
      if (name.includes('road') || name.includes('ground') || name.includes('terrain')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Create LOD (Level of Detail) versions of all buildings
   */
  private createLODBuildings(): void {
    try {
      // Get number of building types safely
      const buildingTypesCount = this.environmentAssets.getBuildingTypesCount();
      if (!buildingTypesCount || buildingTypesCount <= 0) {
        console.warn('No building types found for LOD creation');
        return;
      }
      
      console.log(`Creating LOD versions for ${buildingTypesCount} building types`);
      
      // Process each building type
      for (let i = 0; i < buildingTypesCount; i++) {
        try {
          console.log(`Processing building type ${i}...`);
          
          // Get the original high-detail building
          let highDetail = null;
          try {
            highDetail = this.environmentAssets.getBuildingByIndex(i);
            
            if (!highDetail) {
              console.warn(`Building type ${i} not found, creating placeholder`);
              // Create a simple placeholder building
              const placeholderGeometry = new THREE.BoxGeometry(5, 10, 5);
              const placeholderMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
              highDetail = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
              highDetail.name = `Building_${i}_Placeholder`;
            }
          } catch (getDetailError) {
            console.error(`Error getting building type ${i}:`, getDetailError);
            // Create a simple placeholder if we cannot get the original
            const placeholderGeometry = new THREE.BoxGeometry(5, 10, 5);
            const placeholderMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            highDetail = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
            highDetail.name = `Building_${i}_ErrorPlaceholder`;
          }
          
          // Clone the model to avoid modifying the original
          let highDetailClone = null;
          try {
            console.log(`Cloning building type ${i}...`);
            highDetailClone = highDetail.clone();
            console.log(`Successfully cloned building type ${i}`);
          } catch (cloneError) {
            console.error(`Error cloning building type ${i}:`, cloneError);
            console.log(`Using original building type ${i} directly`);
            // Use the original as fallback (not ideal but prevents failure)
            highDetailClone = highDetail;
          }
          
          // Verify the clone is valid
          if (!this.isValidObject3D(highDetailClone)) {
            console.error(`Invalid highDetailClone for building ${i}, creating replacement`);
            const placeholderGeometry = new THREE.BoxGeometry(5, 10, 5);
            const placeholderMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            highDetailClone = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
            highDetailClone.name = `Building_${i}_CloneErrorReplacement`;
          }
          
          // Create simplified versions for each LOD level with proper error handling
          console.log(`Creating medium detail for building type ${i}...`);
          let mediumDetail = null;
          try {
            mediumDetail = this.optimizer.createSimplifiedModel(highDetailClone, 1);
            console.log(`Successfully created medium detail for building type ${i}`);
          } catch (error) {
            console.error(`Error creating medium detail for building ${i}:`, error);
            console.log(`Creating fallback medium detail for building ${i}`);
            // Create a simplified fallback
            const size = this.getApproximateSize(highDetailClone);
            const fallbackGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
            const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
            mediumDetail = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            mediumDetail.name = `Building_${i}_MediumDetail_Fallback`;
          }
          
          console.log(`Creating low detail for building type ${i}...`);
          let lowDetail = null;
          try {
            lowDetail = this.optimizer.createSimplifiedModel(highDetailClone, 2);
            console.log(`Successfully created low detail for building type ${i}`);
          } catch (error) {
            console.error(`Error creating low detail for building ${i}:`, error);
            
            if (this.isValidObject3D(mediumDetail)) {
              console.log(`Using medium detail as fallback for low detail (building ${i})`);
              try {
                lowDetail = mediumDetail.clone();
              } catch (cloneError) {
                console.error(`Error cloning medium detail for building ${i}:`, cloneError);
                lowDetail = mediumDetail; // Use the medium detail directly
              }
            } else {
              console.log(`Creating simple low detail fallback for building ${i}`);
              // Create a more simplified fallback
              const size = this.getApproximateSize(highDetailClone);
              const fallbackGeometry = new THREE.BoxGeometry(size.x, size.y * 0.8, size.z);
              const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x999999 });
              lowDetail = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
              lowDetail.name = `Building_${i}_LowDetail_Fallback`;
            }
          }
          
          console.log(`Creating very low detail for building type ${i}...`);
          let veryLowDetail = null;
          try {
            veryLowDetail = this.optimizer.createSimplifiedModel(highDetailClone, 3);
            console.log(`Successfully created very low detail for building type ${i}`);
          } catch (error) {
            console.error(`Error creating very low detail for building ${i}:`, error);
            
            if (this.isValidObject3D(lowDetail)) {
              console.log(`Using low detail as fallback for very low detail (building ${i})`);
              try {
                veryLowDetail = lowDetail.clone();
              } catch (cloneError) {
                console.error(`Error cloning low detail for building ${i}:`, cloneError);
                veryLowDetail = lowDetail; // Use the low detail directly
              }
            } else {
              console.log(`Creating simple very low detail fallback for building ${i}`);
              // Create a very simplified fallback
              const size = this.getApproximateSize(highDetailClone);
              const fallbackGeometry = new THREE.BoxGeometry(size.x * 0.9, size.y * 0.7, size.z * 0.9);
              const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
              veryLowDetail = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
              veryLowDetail.name = `Building_${i}_VeryLowDetail_Fallback`;
            }
          }
          
          // Ensure all models are valid before creating LOD
          if (!this.isValidObject3D(mediumDetail)) {
            console.warn(`Invalid medium detail model for building ${i}, creating fallback`);
            const size = this.getApproximateSize(highDetailClone);
            const fallbackGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
            const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0xdddddd });
            mediumDetail = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            mediumDetail.name = `Building_${i}_MediumDetail_EmergencyFallback`;
          }
          
          if (!this.isValidObject3D(lowDetail)) {
            console.warn(`Invalid low detail model for building ${i}, creating fallback`);
            const size = this.getApproximateSize(highDetailClone);
            const fallbackGeometry = new THREE.BoxGeometry(size.x, size.y * 0.8, size.z);
            const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
            lowDetail = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            lowDetail.name = `Building_${i}_LowDetail_EmergencyFallback`;
          }
          
          if (!this.isValidObject3D(veryLowDetail)) {
            console.warn(`Invalid very low detail model for building ${i}, creating fallback`);
            const size = this.getApproximateSize(highDetailClone);
            const fallbackGeometry = new THREE.BoxGeometry(size.x * 0.9, size.y * 0.7, size.z * 0.9);
            const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x777777 });
            veryLowDetail = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            veryLowDetail.name = `Building_${i}_VeryLowDetail_EmergencyFallback`;
          }
          
          // Create LOD object
          console.log(`Creating LOD for building type ${i}...`);
          let lodObject;
          try {
            lodObject = this.optimizer.createLOD(
              highDetailClone,
              mediumDetail,
              lowDetail,
              veryLowDetail
            );
            console.log(`Successfully created LOD for building type ${i}`);
          } catch (lodError) {
            console.error(`Error creating LOD object for building ${i}:`, lodError);
            console.log(`Creating fallback LOD for building ${i}`);
            
            // Create a fallback LOD with just the high detail model at all levels
            const fallbackLOD = new THREE.LOD();
            fallbackLOD.name = `Building_${i}_FallbackLOD`;
            
            // Add each level, with fallbacks if needed
            try {
              fallbackLOD.addLevel(highDetailClone, 0);
              fallbackLOD.addLevel(this.isValidObject3D(mediumDetail) ? mediumDetail : highDetailClone, 100);
              fallbackLOD.addLevel(this.isValidObject3D(lowDetail) ? lowDetail : highDetailClone, 200);
              fallbackLOD.addLevel(this.isValidObject3D(veryLowDetail) ? veryLowDetail : highDetailClone, 300);
            } catch (levelError) {
              console.error(`Error adding levels to fallback LOD for building ${i}:`, levelError);
              
              // Last resort - create an emergency LOD with just a cube at each level
              try {
                const size = this.getApproximateSize(highDetailClone);
                
                const emergencyHighDetail = new THREE.Mesh(
                  new THREE.BoxGeometry(size.x, size.y, size.z),
                  new THREE.MeshBasicMaterial({ color: 0xff8800 })
                );
                emergencyHighDetail.name = `Building_${i}_Emergency_HighDetail`;
                
                const emergencyMediumDetail = new THREE.Mesh(
                  new THREE.BoxGeometry(size.x, size.y * 0.9, size.z),
                  new THREE.MeshBasicMaterial({ color: 0xff8800 })
                );
                emergencyMediumDetail.name = `Building_${i}_Emergency_MediumDetail`;
                
                const emergencyLowDetail = new THREE.Mesh(
                  new THREE.BoxGeometry(size.x * 0.9, size.y * 0.8, size.z * 0.9),
                  new THREE.MeshBasicMaterial({ color: 0xff8800 })
                );
                emergencyLowDetail.name = `Building_${i}_Emergency_LowDetail`;
                
                fallbackLOD.addLevel(emergencyHighDetail, 0);
                fallbackLOD.addLevel(emergencyMediumDetail, 100);
                fallbackLOD.addLevel(emergencyLowDetail, 200);
              } catch (emergencyError) {
                console.error(`Error creating emergency LOD for building ${i}:`, emergencyError);
                // At this point, we can't do much more
              }
            }
            
            lodObject = fallbackLOD;
          }
          
          // Cache LOD object for this building type
          this.lodBuildings.set(i, lodObject);
          
          console.log(`Completed LOD creation for building type ${i}`);
        } catch (buildingError) {
          // Catch any errors processing a specific building to prevent breaking the entire loop
          console.error(`Error processing building type ${i}:`, buildingError);
        }
      }
      
      // Replace buildings in the scene with LOD versions
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh && 
            object.userData.buildingType !== undefined && 
            object.userData.isOptimizable) {
          
          try {
            const buildingType = object.userData.buildingType as number;
            
            if (this.lodBuildings.has(buildingType)) {
              // Get LOD version
              const lodObject = this.lodBuildings.get(buildingType)!.clone();
              
              // Copy position, rotation, and scale
              lodObject.position.copy(object.position);
              lodObject.rotation.copy(object.rotation);
              lodObject.scale.copy(object.scale);
              
              // Copy user data
              lodObject.userData = { ...object.userData };
              
              // Replace in scene
              if (object.parent) {
                const parent = object.parent;
                const index = parent.children.indexOf(object);
                if (index !== -1) {
                  parent.children[index] = lodObject;
                  lodObject.parent = parent;
                }
              }
            }
          } catch (error) {
            console.error('Error replacing building with LOD version:', error);
          }
        }
      });
    } catch (error) {
      console.error('Failed to create LOD buildings:', error);
    }
  }
  
  /**
   * Get the approximate size of an object by examining its geometry or bounding box
   * @param object The object to measure
   * @returns Vector3 with approximate dimensions
   */
  private getApproximateSize(object: THREE.Object3D): THREE.Vector3 {
    const size = new THREE.Vector3(10, 15, 10); // Default size
    
    try {
      // Get bounding box if available
      const bbox = new THREE.Box3().setFromObject(object);
      const dimensions = new THREE.Vector3();
      bbox.getSize(dimensions);
      
      // If we got valid dimensions, use them
      if (dimensions.x > 0 && dimensions.y > 0 && dimensions.z > 0) {
        return dimensions;
      }
      
      // If object is a mesh with geometry, try to get size from geometry
      if (object instanceof THREE.Mesh && object.geometry) {
        object.geometry.computeBoundingBox();
        const geomBbox = object.geometry.boundingBox;
        
        if (geomBbox) {
          const geomSize = new THREE.Vector3();
          geomBbox.getSize(geomSize);
          
          // Apply object's scale
          geomSize.multiply(object.scale);
          
          if (geomSize.x > 0 && geomSize.y > 0 && geomSize.z > 0) {
            return geomSize;
          }
        }
      }
      
      // If we have children, try to estimate size from them
      if (object.children && object.children.length > 0) {
        const allBbox = new THREE.Box3();
        
        object.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            allBbox.expandByObject(child);
          }
        });
        
        const childrenSize = new THREE.Vector3();
        allBbox.getSize(childrenSize);
        
        if (childrenSize.x > 0 && childrenSize.y > 0 && childrenSize.z > 0) {
          return childrenSize;
        }
      }
    } catch (error) {
      console.warn('Error calculating object size:', error);
    }
    
    // Return default size if all else fails
    return size;
  }
  
  /**
   * Helper method to check if an object is a valid Three.js Object3D
   * @param object The object to check
   * @returns True if the object is valid
   */
  private isValidObject3D(object: any): boolean {
    return object && 
           object instanceof THREE.Object3D && 
           typeof object.traverse === 'function';
  }
  
  /**
   * Create LOD (Level of Detail) versions of all props
   */
  private createLODProps(): void {
    try {
      // Get number of prop types safely
      const propTypesCount = this.environmentAssets.getPropTypesCount();
      if (!propTypesCount || propTypesCount <= 0) {
        console.warn('No prop types found for LOD creation');
        return;
      }
      
      console.log(`Creating LOD versions for ${propTypesCount} prop types`);
      
      // Process each prop type
      for (let i = 0; i < propTypesCount; i++) {
        try {
          // Get the original high-detail prop
          const highDetail = this.environmentAssets.getPropByIndex(i);
          
          // Skip if prop is undefined
          if (!highDetail) {
            console.warn(`Prop type ${i} not found, skipping LOD creation`);
            continue;
          }
          
          // Clone the model to avoid modifying the original
          const highDetailClone = highDetail.clone();
          
          // Create simplified versions for each LOD level
          const mediumDetail = this.optimizer.createSimplifiedModel(highDetailClone, 1);
          const lowDetail = this.optimizer.createSimplifiedModel(highDetailClone, 2);
          
          // Create LOD object
          const lodObject = this.optimizer.createLOD(
            highDetailClone,
            mediumDetail,
            lowDetail
          );
          
          // Cache LOD object for this prop type
          this.lodProps.set(i, lodObject);
          
          console.log(`Created LOD for prop type ${i}`);
        } catch (error) {
          console.error(`Error creating LOD for prop type ${i}:`, error);
        }
      }
      
      // Replace props in the scene with LOD versions
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh && 
            object.userData.propType !== undefined && 
            object.userData.isOptimizable) {
          
          try {
            const propType = object.userData.propType as number;
            
            if (this.lodProps.has(propType)) {
              // Get LOD version
              const lodObject = this.lodProps.get(propType)!.clone();
              
              // Copy position, rotation, and scale
              lodObject.position.copy(object.position);
              lodObject.rotation.copy(object.rotation);
              lodObject.scale.copy(object.scale);
              
              // Copy user data
              lodObject.userData = { ...object.userData };
              
              // Replace in scene
              if (object.parent) {
                const parent = object.parent;
                const index = parent.children.indexOf(object);
                if (index !== -1) {
                  parent.children[index] = lodObject;
                  lodObject.parent = parent;
                }
              }
            }
          } catch (error) {
            console.error('Error replacing prop with LOD version:', error);
          }
        }
      });
    } catch (error) {
      console.error('Error in LOD creation for props:', error);
    }
  }
  
  /**
   * Update optimizations on each frame
   * @param camera THREE.js camera for distance-based optimizations
   */
  public update(camera: THREE.Camera): void {
    if (this.isOptimized) {
      try {
        this.optimizer.update(camera);
        
        // Update LOD levels based on camera position
        this.scene.traverse((object) => {
          if (object instanceof THREE.LOD) {
            object.update(camera);
          }
        });
      } catch (error) {
        console.error('Error updating optimizations:', error);
      }
    }
  }
  
  /**
   * Mark the optimization as partially successful
   * Used when some parts of the optimization process failed
   */
  public markPartialOptimization(): void {
    this.isPartiallyOptimized = true;
    this.isOptimized = true; // Still consider it optimized for update purposes
    console.log('Optimization manager marked as partially optimized');
  }
} 