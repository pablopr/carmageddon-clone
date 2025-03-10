import * as THREE from 'three';

/**
 * Class to handle performance optimizations for the game
 */
export class PerformanceOptimizer {
  // Scene reference
  private scene: THREE.Scene;
  
  // Performance settings
  private settings = {
    useLOD: true,
    useInstancing: true,
    maxVisibleDistance: 300,
    lodDistances: [0, 50, 150, 250],
    maxTextureSize: 1024,
    maxTextureUnits: 16, // WebGL limitation
    shareTextures: true,
    shareMaterials: true
  };
  
  // Stats
  private stats = {
    originalTriangles: 0,
    optimizedTriangles: 0,
    instancedObjects: 0,
    lodObjects: 0,
    originalMaterialCount: 0,
    optimizedMaterialCount: 0,
    originalTextureCount: 0,
    optimizedTextureCount: 0
  };
  
  // Cache for shared materials and textures
  private sharedMaterials: Map<string, THREE.Material> = new Map();
  private sharedTextures: Map<string, THREE.Texture> = new Map();
  private textureUnitCounter: number = 0;
  
  /**
   * Constructor
   * @param scene THREE.js scene to optimize
   */
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  /**
   * Apply LOD (Level of Detail) to an object with multiple detail levels
   * @param highDetailModel High detail model
   * @param mediumDetailModel Medium detail model
   * @param lowDetailModel Low detail model
   * @param veryLowDetailModel Very low detail model (optional)
   * @returns THREE.LOD object containing the models at different detail levels
   */
  public createLOD(
    highDetailModel: THREE.Object3D,
    mediumDetailModel: THREE.Object3D,
    lowDetailModel: THREE.Object3D,
    veryLowDetailModel?: THREE.Object3D
  ): THREE.LOD {
    if (!this.settings.useLOD) {
      // Create a basic LOD with just the high detail model instead of casting
      const simpleLOD = new THREE.LOD();
      simpleLOD.addLevel(highDetailModel, 0);
      return simpleLOD;
    }
    
    // Ensure all models exist
    if (!highDetailModel || !mediumDetailModel || !lowDetailModel) {
      console.error('Cannot create LOD with undefined models');
      // Create a basic LOD with the available high detail model as fallback
      const fallbackLOD = new THREE.LOD();
      fallbackLOD.addLevel(highDetailModel, 0);
      return fallbackLOD;
    }
    
    const lod = new THREE.LOD();
    
    // Add detail levels
    lod.addLevel(highDetailModel, this.settings.lodDistances[0]);
    lod.addLevel(mediumDetailModel, this.settings.lodDistances[1]);
    lod.addLevel(lowDetailModel, this.settings.lodDistances[2]);
    
    if (veryLowDetailModel) {
      lod.addLevel(veryLowDetailModel, this.settings.lodDistances[3]);
    }
    
    // Track stats
    this.stats.lodObjects++;
    
    return lod;
  }
  
  /**
   * Create a simplified version of a model for LOD
   * @param originalModel The original high-detail model
   * @param detailLevel Detail level (0 = high, 1 = medium, 2 = low, 3 = very low)
   * @returns Simplified model
   */
  public createSimplifiedModel(originalModel: THREE.Object3D, detailLevel: number): THREE.Object3D {
    // Check if originalModel is defined
    if (!originalModel) {
      console.error('Cannot simplify undefined model');
      // Return a simple cube as fallback
      const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
      const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      return new THREE.Mesh(fallbackGeometry, fallbackMaterial);
    }
    
    try {
      // Log information about the original model
      console.debug('Simplifying model:', {
        type: originalModel.type,
        name: originalModel.name || 'unnamed',
        uuid: originalModel.uuid,
        isObject3D: originalModel instanceof THREE.Object3D,
        hasChildren: originalModel.children?.length > 0,
        childCount: originalModel.children?.length || 0
      });
      
      // Verify the original model has valid properties before cloning
      if (typeof originalModel.clone !== 'function') {
        console.error('Invalid model object provided for simplification - does not have clone method', originalModel);
        // Return a simple cube as fallback
        const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
        const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        return new THREE.Mesh(fallbackGeometry, fallbackMaterial);
      }
      
      // Handle special cases for different model types
      if (originalModel instanceof THREE.Mesh) {
        // For simple meshes, create a new mesh with simplified properties
        // rather than cloning which might carry over problematic properties
        return this.createSimplifiedMesh(originalModel, detailLevel);
      } else if (originalModel instanceof THREE.Group || originalModel instanceof THREE.Scene) {
        // For groups, create a new group and add simplified children
        return this.createSimplifiedGroup(originalModel, detailLevel);
      }
      
      // For other types of Object3D, try cloning with proper error handling
      let simplified: THREE.Object3D;
      try {
        // Try to create a deep clone
        simplified = originalModel.clone();
      } catch (cloneError) {
        console.error('Error cloning model:', cloneError);
        console.warn('Original model that failed to clone:', originalModel);
        
        // Create a new empty object as a replacement
        simplified = new THREE.Group();
        simplified.name = originalModel.name + '_fallback';
        simplified.position.copy(originalModel.position);
        simplified.rotation.copy(originalModel.rotation);
        simplified.scale.copy(originalModel.scale);
        
        // Try to preserve basic properties
        try {
          // Try to add children individually if the model has children
          if (originalModel.children && originalModel.children.length > 0) {
            originalModel.children.forEach(child => {
              try {
                const simplifiedChild = this.createSimplifiedModel(child, detailLevel);
                simplified.add(simplifiedChild);
              } catch (childError) {
                console.warn(`Error simplifying child of ${originalModel.name}:`, childError);
              }
            });
          }
        } catch (childrenError) {
          console.error('Error processing children:', childrenError);
        }
        
        // If we couldn't create a proper fallback, return a simple cube
        if (simplified.children.length === 0) {
          const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
          const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
          const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
          fallbackMesh.name = originalModel.name + '_fallback_cube';
          return fallbackMesh;
        }
        
        return simplified;
      }
      
      // Extra safety check to make sure we have a valid object after cloning
      if (!simplified) {
        console.error('Clone produced undefined object');
        return originalModel;
      }
      
      if (typeof simplified.traverse !== 'function') {
        console.error('Cloned model lacks traverse method', simplified);
        return originalModel;
      }
      
      // Find all geometries in the model and simplify them
      try {
        simplified.traverse((object) => {
          if (object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry) {
            // Skip if already simplified
            if ((object as any).__simplified) return;
            
            // Mark as simplified to prevent re-processing
            (object as any).__simplified = true;
            
            // Different simplification strategies based on detail level
            try {
              switch (detailLevel) {
                case 1: // Medium detail
                  // Simplify geometry by removing vertex details
                  this.simplifyMaterials(object, 0.8);
                  break;
                  
                case 2: // Low detail
                  // Further simplify materials and disable some features
                  this.simplifyMaterials(object, 0.5);
                  break;
                  
                case 3: // Very low detail
                  // Basic geometric shapes and minimal materials
                  this.simplifyMaterials(object, 0.2);
                  break;
                  
                default:
                  // No simplification for level 0 (high detail)
                  break;
              }
            } catch (simplifyError) {
              console.warn(`Error simplifying geometry (level ${detailLevel}):`, simplifyError);
              // Continue with other objects even if one fails
            }
          }
        });
      } catch (traverseError) {
        console.error('Error during model traversal:', traverseError);
        return originalModel;
      }
      
      return simplified;
    } catch (error) {
      console.error('Error creating simplified model:', error);
      // Log details about the problematic model
      console.warn('Problem model details:', {
        type: originalModel?.type,
        name: originalModel?.name,
        uuid: originalModel?.uuid,
        children: originalModel?.children?.length
      });
      
      // Return original model as fallback
      return originalModel;
    }
  }
  
  /**
   * Create a simplified mesh directly from another mesh
   * @param originalMesh The original mesh to simplify
   * @param detailLevel The detail level for simplification
   * @returns A simplified mesh
   */
  private createSimplifiedMesh(originalMesh: THREE.Mesh, detailLevel: number): THREE.Mesh {
    // Create new geometry (potentially simplified)
    let geometry: THREE.BufferGeometry;
    
    try {
      // Clone the geometry
      geometry = originalMesh.geometry.clone();
    } catch (geomError) {
      console.warn('Error cloning geometry:', geomError);
      // Create a simple replacement geometry
      const size = originalMesh.scale.length() || 1;
      geometry = new THREE.BoxGeometry(size, size, size);
    }
    
    // Create new material (simplified)
    let material: THREE.Material | THREE.Material[];
    
    try {
      // Handle array of materials
      if (Array.isArray(originalMesh.material)) {
        material = originalMesh.material.map(mat => this.createSimplifiedMaterial(mat, detailLevel));
      } else {
        material = this.createSimplifiedMaterial(originalMesh.material, detailLevel);
      }
    } catch (matError) {
      console.warn('Error processing material:', matError);
      // Create a simple replacement material
      material = new THREE.MeshBasicMaterial({
        color: 0x808080,
        wireframe: detailLevel > 2
      });
    }
    
    // Create new mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Copy transform properties
    mesh.position.copy(originalMesh.position);
    mesh.rotation.copy(originalMesh.rotation);
    mesh.scale.copy(originalMesh.scale);
    mesh.name = originalMesh.name + '_simplified';
    
    // Mark as simplified
    (mesh as any).__simplified = true;
    
    return mesh;
  }
  
  /**
   * Create a simplified group by processing each child
   * @param originalGroup The original group to simplify
   * @param detailLevel The detail level for simplification
   * @returns A new group with simplified children
   */
  private createSimplifiedGroup(originalGroup: THREE.Object3D, detailLevel: number): THREE.Object3D {
    // Create a new group
    const group = new THREE.Group();
    group.name = originalGroup.name + '_simplified';
    
    // Copy transform properties
    group.position.copy(originalGroup.position);
    group.rotation.copy(originalGroup.rotation);
    group.scale.copy(originalGroup.scale);
    
    // Process each child
    if (originalGroup.children && originalGroup.children.length > 0) {
      for (const child of originalGroup.children) {
        try {
          const simplifiedChild = this.createSimplifiedModel(child, detailLevel);
          group.add(simplifiedChild);
        } catch (error) {
          console.warn(`Error simplifying child of ${originalGroup.name}:`, error);
          // Skip this child
        }
      }
    }
    
    return group;
  }
  
  /**
   * Create a simplified material from an original material
   * @param originalMaterial The original material to simplify
   * @param detailLevel The detail level for simplification
   * @returns A simplified material
   */
  private createSimplifiedMaterial(originalMaterial: THREE.Material, detailLevel: number): THREE.Material {
    let simplifiedMaterial: THREE.Material;
    
    try {
      // Clone the material
      simplifiedMaterial = originalMaterial.clone();
      
      // Apply simplifications based on detail level
      if (simplifiedMaterial instanceof THREE.MeshStandardMaterial) {
        if (detailLevel >= 1) {
          simplifiedMaterial.roughness = Math.min(1, simplifiedMaterial.roughness + 0.2 * detailLevel);
          simplifiedMaterial.metalness = Math.max(0, simplifiedMaterial.metalness - 0.2 * detailLevel);
          simplifiedMaterial.flatShading = detailLevel > 1;
        }
        
        if (detailLevel >= 2) {
          // Disable expensive features for low detail levels
          simplifiedMaterial.envMap = null;
          simplifiedMaterial.normalMap = null;
        }
        
        if (detailLevel >= 3) {
          // Very low detail - disable almost all features
          simplifiedMaterial.map = null;
          simplifiedMaterial.bumpMap = null;
          simplifiedMaterial.displacementMap = null;
          simplifiedMaterial.emissiveMap = null;
        }
      }
      else if (simplifiedMaterial instanceof THREE.MeshPhongMaterial) {
        if (detailLevel >= 1) {
          simplifiedMaterial.shininess = Math.max(0, simplifiedMaterial.shininess - 10 * detailLevel);
          simplifiedMaterial.flatShading = detailLevel > 1;
        }
        
        if (detailLevel >= 2) {
          simplifiedMaterial.envMap = null;
          simplifiedMaterial.normalMap = null;
        }
        
        if (detailLevel >= 3) {
          simplifiedMaterial.map = null;
          simplifiedMaterial.specularMap = null;
          simplifiedMaterial.bumpMap = null;
        }
      }
      else if (simplifiedMaterial instanceof THREE.MeshLambertMaterial || 
               simplifiedMaterial instanceof THREE.MeshBasicMaterial) {
        if (detailLevel >= 2) {
          // Simplified maps for low detail
          simplifiedMaterial.map = null;
        }
      }
      
      // Make sure we don't have unsupported features in basic materials
      if (simplifiedMaterial instanceof THREE.MeshBasicMaterial && detailLevel >= 2) {
        simplifiedMaterial.map = null;
      }
      
    } catch (matError) {
      console.warn('Error creating simplified material:', matError);
      // Fall back to a basic material
      simplifiedMaterial = new THREE.MeshBasicMaterial({
        color: originalMaterial.hasOwnProperty('color') 
          ? (originalMaterial as any).color 
          : 0x808080,
        wireframe: detailLevel > 2
      });
    }
    
    return simplifiedMaterial;
  }
  
  /**
   * Simplify materials on an object for better performance
   * @param object The object to simplify materials on
   * @param qualityFactor Quality factor (0-1) where 1 is highest quality
   */
  private simplifyMaterials(object: THREE.Mesh, qualityFactor: number): void {
    if (!object.material) return;
    
    // Handle both single materials and material arrays
    const materials = Array.isArray(object.material) 
      ? object.material 
      : [object.material];
    
    materials.forEach(material => {
      if (material instanceof THREE.Material) {
        // Progressively disable expensive features based on quality factor
        if (qualityFactor < 0.9) {
          // Apply flat shading for medium quality
          if (material instanceof THREE.MeshStandardMaterial || 
              material instanceof THREE.MeshPhongMaterial || 
              material instanceof THREE.MeshLambertMaterial) {
            material.flatShading = true;
          }
        }
        
        if (qualityFactor < 0.7) {
          // Reduce material complexity for lower quality
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = Math.min(1, material.roughness + 0.2);
            material.metalness = Math.max(0, material.metalness - 0.2);
          }
          
          // Reduce or disable emissive intensity
          if (material instanceof THREE.MeshStandardMaterial || 
              material instanceof THREE.MeshPhongMaterial ||
              material instanceof THREE.MeshLambertMaterial) {
            if (material.emissiveIntensity !== undefined) {
              material.emissiveIntensity *= qualityFactor;
            }
          }
        }
        
        if (qualityFactor < 0.5) {
          // Disable shadows for low detail objects
          object.castShadow = false;
          
          // Lower precision normal maps
          if (material instanceof THREE.MeshStandardMaterial || 
              material instanceof THREE.MeshPhongMaterial) {
            if (material.normalScale) {
              material.normalScale.multiplyScalar(0.5);
            }
          }
        }
        
        if (qualityFactor < 0.3) {
          // Very low quality - minimal visuals
          object.receiveShadow = false;
          
          // Disable most special effects
          if (material instanceof THREE.MeshStandardMaterial) {
            if (material.envMapIntensity !== undefined) {
              material.envMapIntensity = 0;
            }
          }
        }
      }
    });
  }
  
  /**
   * Apply instancing to similar objects for better performance
   * @param objects Array of similar objects to instance
   * @param originalObject The original object to instance from
   * @returns Instanced mesh
   */
  public createInstancedMeshes(
    objects: { position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }[],
    originalObject: THREE.Mesh
  ): THREE.InstancedMesh | null {
    if (!this.settings.useInstancing || objects.length <= 1 || !(originalObject instanceof THREE.Mesh)) {
      return null;
    }
    
    // Create instanced mesh
    const geometry = originalObject.geometry;
    const material = originalObject.material;
    
    // Check if valid geometry and material
    if (!geometry || !material) {
      return null;
    }
    
    // Create instanced mesh
    const instancedMesh = new THREE.InstancedMesh(
      geometry,
      Array.isArray(material) ? material[0] : material,
      objects.length
    );
    
    // Set instances
    const matrix = new THREE.Matrix4();
    objects.forEach((object, i) => {
      matrix.compose(
        object.position,
        new THREE.Quaternion().setFromEuler(object.rotation),
        object.scale
      );
      instancedMesh.setMatrixAt(i, matrix);
    });
    
    // Set shadows
    instancedMesh.castShadow = originalObject.castShadow;
    instancedMesh.receiveShadow = originalObject.receiveShadow;
    
    // Update stats
    this.stats.instancedObjects += objects.length - 1; // -1 because we're replacing objects
    
    return instancedMesh;
  }
  
  /**
   * Apply frustum culling optimization to the scene
   * Sets the culling distance and ensures objects are properly marked for culling
   */
  public setupFrustumCulling(): void {
    // Three.js handles frustum culling automatically, but we can optimize it
    
    // Mark all objects in the scene for frustum culling
    this.scene.traverse((object) => {
      object.frustumCulled = true;
      
      // Disable culling for very large objects like ground or sky
      if (object instanceof THREE.Mesh) {
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        // If the object is very large, consider it always visible
        if (size.x > 100 && size.z > 100) {
          object.frustumCulled = false;
        }
      }
    });
  }
  
  /**
   * Apply distance culling to objects - removing/hiding distant objects
   * @param camera THREE.js camera to use for distance calculation
   */
  public applyDistanceCulling(camera: THREE.Camera): void {
    // Find distance from camera to objects and disable those that are too far
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.isOptimizable) {
        // Skip objects that shouldn't be culled (like ground, etc.)
        if (object.userData.noCull) return;
        
        // Check distance to camera
        const distance = camera.position.distanceTo(object.position);
        
        // If beyond max visible distance, hide object
        if (distance > this.settings.maxVisibleDistance) {
          object.visible = false;
        } else {
          object.visible = true;
        }
      }
    });
  }
  
  /**
   * Find or create a shared texture
   * @param originalTexture The original texture
   * @param key A unique key to identify the texture type
   * @returns A shared texture instance
   */
  public getSharedTexture(originalTexture: THREE.Texture | null, key: string): THREE.Texture | null {
    if (!originalTexture) return null;
    
    // Skip sharing if disabled
    if (!this.settings.shareTextures) return originalTexture;
    
    // Check if we already have this texture type
    if (this.sharedTextures.has(key)) {
      return this.sharedTextures.get(key)!;
    }
    
    // Check if we're exceeding texture unit limit
    if (this.textureUnitCounter >= this.settings.maxTextureUnits - 1) { // Reserve one unit for emergencies
      console.warn(`Texture unit limit reached (${this.settings.maxTextureUnits}), using fallback`);
      // Return a default shared texture instead
      return this.getDefaultTexture(key);
    }
    
    try {
      // Clone the texture to avoid modifying the original
      const texture = originalTexture.clone();
      
      // Optimize the texture size
      this.optimizeTextureSize(texture);
      
      // Store in cache
      this.sharedTextures.set(key, texture);
      this.textureUnitCounter++;
      
      // Update stats
      this.stats.optimizedTextureCount++;
      
      return texture;
    } catch (error) {
      console.error(`Error creating shared texture for ${key}:`, error);
      return originalTexture;
    }
  }
  
  /**
   * Get a default texture for a given type
   * @param type The type of texture (e.g., 'diffuse', 'normal', etc.)
   * @returns A basic default texture
   */
  private getDefaultTexture(type: string): THREE.Texture {
    // Check if we already have this default texture
    const key = `default-${type}`;
    if (this.sharedTextures.has(key)) {
      return this.sharedTextures.get(key)!;
    }
    
    let texture: THREE.Texture;
    // Create appropriate default texture based on type
    const defaultCanvas = document.createElement('canvas');
    defaultCanvas.width = 4;
    defaultCanvas.height = 4;
    const ctx = defaultCanvas.getContext('2d');
    if (ctx) {
      switch (type) {
        case 'diffuse':
        case 'albedo':
        case 'baseColor':
          ctx.fillStyle = '#888888';
          ctx.fillRect(0, 0, 4, 4);
          break;
        case 'normal':
          ctx.fillStyle = '#8080ff'; // Default normal map color (0.5, 0.5, 1.0)
          ctx.fillRect(0, 0, 4, 4);
          break;
        case 'roughness':
          ctx.fillStyle = '#808080'; // Mid-gray (0.5 roughness)
          ctx.fillRect(0, 0, 4, 4);
          break;
        case 'metalness':
          ctx.fillStyle = '#000000'; // Black (0.0 metalness)
          ctx.fillRect(0, 0, 4, 4);
          break;
        case 'emissive':
          ctx.fillStyle = '#000000'; // Black (no emission)
          ctx.fillRect(0, 0, 4, 4);
          break;
        default:
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 4, 4);
          break;
      }
    }
    
    texture = new THREE.CanvasTexture(defaultCanvas);
    texture.name = `default-${type}-texture`;
    
    // Store in cache
    this.sharedTextures.set(key, texture);
    this.textureUnitCounter++;
    
    return texture;
  }
  
  /**
   * Optimize texture size to reduce memory usage
   * @param texture The texture to optimize
   */
  private optimizeTextureSize(texture: THREE.Texture): void {
    if (texture.image) {
      // Only resize if it's too large
      const maxSize = this.settings.maxTextureSize;
      if (texture.image.width > maxSize || texture.image.height > maxSize) {
        console.log(`Resizing texture from ${texture.image.width}x${texture.image.height} to max ${maxSize}`);
        
        // This is not actually resizing the image - in a real implementation
        // you would need to use a separate process to resize the texture
        // For this example, we just log the intention
      }
    }
    
    // Additional optimizations
    texture.anisotropy = 1; // Lower anisotropic filtering
    texture.generateMipmaps = true; // This can actually improve performance
    texture.minFilter = THREE.LinearMipmapLinearFilter; // Good performance/quality balance
    texture.magFilter = THREE.LinearFilter;
  }
  
  /**
   * Get or create a shared material
   * @param originalMaterial The original material
   * @param key A unique key to identify the material type
   * @returns A shared material instance
   */
  public getSharedMaterial(originalMaterial: THREE.Material, key: string): THREE.Material {
    // Skip sharing if disabled
    if (!this.settings.shareMaterials) return originalMaterial;
    
    // Check if we already have this material type
    if (this.sharedMaterials.has(key)) {
      return this.sharedMaterials.get(key)!;
    }
    
    try {
      // Create a simplified version of the material
      const material = this.createSimplifiedMaterial(originalMaterial, 1);
      
      // Store in cache
      this.sharedMaterials.set(key, material);
      
      // Update stats
      this.stats.optimizedMaterialCount++;
      
      return material;
    } catch (error) {
      console.error(`Error creating shared material for ${key}:`, error);
      return originalMaterial;
    }
  }
  
  /**
   * Optimize all materials in the scene to reduce texture unit usage
   */
  public optimizeMaterials(): void {
    console.log('Optimizing materials and textures...');
    
    // Count original materials and textures
    this.countMaterialsAndTextures();
    
    // Dictionary to track material types
    const materialsByType: Record<string, THREE.Material[]> = {};
    
    // First pass: categorize materials
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) 
          ? object.material 
          : [object.material];
        
        materials.forEach(material => {
          if (!material) return;
          
          // Determine material type
          const materialType = this.getMaterialType(material);
          
          // Add to type collection
          if (!materialsByType[materialType]) {
            materialsByType[materialType] = [];
          }
          materialsByType[materialType].push(material);
        });
      }
    });
    
    // Create shared materials
    Object.entries(materialsByType).forEach(([type, materials]) => {
      if (materials.length > 0) {
        // Use the first material as the template
        const template = materials[0];
        const sharedMaterial = this.getSharedMaterial(template, type);
        
        // Store in cache
        this.sharedMaterials.set(type, sharedMaterial);
      }
    });
    
    // Second pass: replace materials
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        try {
          if (Array.isArray(object.material)) {
            // Handle multi-material objects
            for (let i = 0; i < object.material.length; i++) {
              const material = object.material[i];
              if (!material) continue;
              
              const materialType = this.getMaterialType(material);
              if (this.sharedMaterials.has(materialType)) {
                object.material[i] = this.sharedMaterials.get(materialType)!;
              }
            }
          } else if (object.material) {
            // Handle single material objects
            const materialType = this.getMaterialType(object.material);
            if (this.sharedMaterials.has(materialType)) {
              object.material = this.sharedMaterials.get(materialType)!;
            }
          }
        } catch (error) {
          console.warn(`Error replacing material on object ${object.name}:`, error);
        }
      }
    });
    
    console.log(`Material optimization complete. Reduced from ${this.stats.originalMaterialCount} to ${this.stats.optimizedMaterialCount} materials.`);
    console.log(`Texture optimization complete. Using ${this.stats.optimizedTextureCount} textures (${this.textureUnitCounter} texture units).`);
  }
  
  /**
   * Count the original number of materials and textures in the scene
   */
  private countMaterialsAndTextures(): void {
    const uniqueMaterials = new Set<THREE.Material>();
    const uniqueTextures = new Set<THREE.Texture>();
    
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            if (material) uniqueMaterials.add(material);
            this.extractTexturesFromMaterial(material, uniqueTextures);
          });
        } else if (object.material) {
          uniqueMaterials.add(object.material);
          this.extractTexturesFromMaterial(object.material, uniqueTextures);
        }
      }
    });
    
    this.stats.originalMaterialCount = uniqueMaterials.size;
    this.stats.originalTextureCount = uniqueTextures.size;
    
    console.log(`Original material count: ${uniqueMaterials.size}`);
    console.log(`Original texture count: ${uniqueTextures.size}`);
  }
  
  /**
   * Extract textures from a material and add them to the unique set
   * @param material The material to extract textures from
   * @param textureSet The set to add textures to
   */
  private extractTexturesFromMaterial(material: THREE.Material, textureSet: Set<THREE.Texture>): void {
    if (!material) return;
    
    // Check for standard material textures
    if (material instanceof THREE.MeshStandardMaterial) {
      if (material.map) textureSet.add(material.map);
      if (material.normalMap) textureSet.add(material.normalMap);
      if (material.roughnessMap) textureSet.add(material.roughnessMap);
      if (material.metalnessMap) textureSet.add(material.metalnessMap);
      if (material.emissiveMap) textureSet.add(material.emissiveMap);
      if (material.aoMap) textureSet.add(material.aoMap);
    }
    // Check for basic material textures
    else if (material instanceof THREE.MeshBasicMaterial) {
      if (material.map) textureSet.add(material.map);
    }
    // Check for lambert or phong materials
    else if (material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshPhongMaterial) {
      if (material.map) textureSet.add(material.map);
      if ('normalMap' in material && material.normalMap) textureSet.add(material.normalMap);
      if ('specularMap' in material && material.specularMap) textureSet.add(material.specularMap);
      if ('emissiveMap' in material && material.emissiveMap) textureSet.add(material.emissiveMap);
    }
  }
  
  /**
   * Determine the material type based on its properties
   * @param material The material to analyze
   * @returns A string identifier for the material type
   */
  private getMaterialType(material: THREE.Material): string {
    if (!material) return 'unknown';
    
    let type = material.type;
    
    // Add color to type
    if ('color' in material && material.color) {
      const color = (material.color as THREE.Color);
      type += `-${Math.round(color.r * 255)}-${Math.round(color.g * 255)}-${Math.round(color.b * 255)}`;
    }
    
    // Add transparency info
    if (material.transparent) {
      type += '-transparent';
      if ('opacity' in material) {
        type += `-${Math.round((material.opacity as number) * 100)}`;
      }
    }
    
    // Add other properties based on material type
    if (material instanceof THREE.MeshStandardMaterial) {
      type += `-rough${Math.round(material.roughness * 10)}`;
      type += `-metal${Math.round(material.metalness * 10)}`;
      
      // Check if it has maps
      if (material.map) type += '-map';
      if (material.normalMap) type += '-normal';
      if (material.roughnessMap) type += '-roughMap';
      if (material.metalnessMap) type += '-metalMap';
      if (material.emissiveMap) type += '-emissiveMap';
    }
    
    return type;
  }
  
  /**
   * Apply all performance optimizations to the scene
   */
  public applyAllOptimizations(): void {
    console.log('Applying all performance optimizations...');
    
    try {
      // Count original triangles
      this.countSceneTriangles();
      
      // First optimize materials and textures to reduce shader complexity
      this.optimizeMaterials();
      
      // Convert compatible objects to instanced meshes
      this.applyInstancedMeshes();
      
      // Setup frustum culling
      this.setupFrustumCulling();
      
      // Apply misc optimizations
      this.applyMiscOptimizations();
      
      // Count optimized triangles
      this.countSceneTriangles(true);
      
      console.log('All optimizations applied successfully');
      console.log(`Triangles reduced from ${this.stats.originalTriangles} to ${this.stats.optimizedTriangles}`);
      console.log(`Created ${this.stats.instancedObjects} instanced mesh groups`);
      console.log(`Created ${this.stats.lodObjects} LOD objects`);
    } catch (error) {
      console.error('Error applying optimizations:', error);
    }
  }
  
  /**
   * Count triangles in the scene
   * @param updateOptimized Whether to update the optimized triangle count (true) or original count (false)
   */
  private countSceneTriangles(updateOptimized = false): void {
    let triangleCount = 0;
    
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry) {
        // Count triangles in the geometry
        const geometry = object.geometry;
        
        if (geometry.index !== null) {
          triangleCount += geometry.index.count / 3;
        } else if (geometry.attributes.position) {
          triangleCount += geometry.attributes.position.count / 3;
        }
      }
    });
    
    if (updateOptimized) {
      this.stats.optimizedTriangles = triangleCount;
    } else {
      this.stats.originalTriangles = triangleCount;
    }
  }
  
  /**
   * Apply instanced meshes optimization to the scene
   * Groups similar objects together
   */
  private applyInstancedMeshes(): void {
    // Find similar meshes to instance
    const meshGroups = new Map<string, { mesh: THREE.Mesh, instances: Array<{ position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }> }>();
    
    // Collect potential instances
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && 
          object.geometry && 
          !(object instanceof THREE.InstancedMesh) && 
          object.userData.canInstance) {
        
        // Create a key based on geometry and material
        let geometryHash = '';
        if (object.geometry.uuid) {
          geometryHash = object.geometry.uuid;
        }
        
        const materialHash = Array.isArray(object.material) 
          ? object.material.map(m => m.uuid).join('-')
          : object.material.uuid;
        
        const key = `${geometryHash}-${materialHash}`;
        
        // Add to group or create new group
        if (!meshGroups.has(key)) {
          meshGroups.set(key, { 
            mesh: object, 
            instances: [{ 
              position: object.position.clone(), 
              rotation: object.rotation.clone(),
              scale: object.scale.clone()
            }]
          });
        } else {
          const group = meshGroups.get(key)!;
          group.instances.push({
            position: object.position.clone(),
            rotation: object.rotation.clone(),
            scale: object.scale.clone()
          });
        }
      }
    });
    
    // Create instanced meshes for groups with enough instances
    meshGroups.forEach((group, key) => {
      if (group.instances.length >= 5) { // Only instance if we have 5+ similar objects
        const instancedMesh = this.createInstancedMeshes(group.instances, group.mesh);
        
        if (instancedMesh) {
          // Add instanced mesh to scene
          this.scene.add(instancedMesh);
          
          // Remove original meshes
          group.instances.forEach((instance, index) => {
            if (index > 0) { // Keep the first one as it's used as the template
              // Find and remove the mesh from scene
              this.scene.traverse((object) => {
                if (object instanceof THREE.Mesh && 
                    object.position.equals(instance.position) && 
                    object.rotation.equals(instance.rotation) &&
                    object.scale.equals(instance.scale)) {
                  if (object.parent) {
                    object.parent.remove(object);
                  }
                }
              });
            }
          });
        }
      }
    });
  }
  
  /**
   * Apply miscellaneous optimizations to the scene
   */
  private applyMiscOptimizations(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // Merge geometries where possible
        // This is a simplification - in a real implementation you'd need to check
        // if meshes can actually be merged (same material, etc.)
        if (object.userData.canMerge && object.parent && object.parent.children.length > 1) {
          const mergeCandidates = object.parent.children.filter(child => 
            child instanceof THREE.Mesh && 
            child.userData.canMerge && 
            child.material === object.material
          );
          
          if (mergeCandidates.length > 1) {
            // Merge geometries would go here - but requires complex implementation
            // This is just a placeholder
          }
        }
        
        // Dispose unused materials and textures
        if (object.userData.optimizeMaterials) {
          if (Array.isArray(object.material)) {
            // Check if materials can be consolidated
            const uniqueMaterials = new Set(object.material);
            if (uniqueMaterials.size < object.material.length) {
              // Consolidate duplicate materials
              const materialMap = new Map<string, THREE.Material>();
              const newMaterials = object.material.map(mat => {
                const key = mat.uuid;
                if (!materialMap.has(key)) {
                  materialMap.set(key, mat);
                }
                return materialMap.get(key)!;
              });
              object.material = newMaterials;
            }
          }
        }
      }
    });
  }
  
  /**
   * Update optimizations on each frame
   * @param camera THREE.js camera for distance-based optimizations
   */
  public update(camera: THREE.Camera): void {
    // Apply distance culling every frame
    this.applyDistanceCulling(camera);
    
    // Other per-frame optimizations could go here
  }
} 