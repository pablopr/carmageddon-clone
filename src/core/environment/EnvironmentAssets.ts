import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';
import { LOD } from 'three';

/**
 * Class to manage loading and organizing environment assets
 */
export class EnvironmentAssets {
  // Asset collections
  private buildingModels: THREE.Object3D[] = [];
  private roadModels: THREE.Object3D[] = [];
  private propModels: THREE.Object3D[] = [];
  
  // Textures
  private textures: Map<string, THREE.Texture> = new Map();
  
  // Shared materials to reduce texture units
  private sharedMaterials: Map<string, THREE.Material> = new Map();
  
  // Loaders
  private gltfLoader: GLTFLoader;
  private textureLoader: TextureLoader;
  
  // Loading state
  private loadingPromises: Promise<any>[] = [];
  
  /**
   * Constructor
   */
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new TextureLoader();
    this.initializeSharedMaterials();
  }
  
  /**
   * Initialize shared materials to be reused across objects
   * This helps reduce the number of unique materials and textures
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
  private getSharedMaterial(key: string): THREE.Material {
    if (this.sharedMaterials.has(key)) {
      return this.sharedMaterials.get(key)!;
    }
    
    console.warn(`Shared material '${key}' not found, using default`);
    return new THREE.MeshStandardMaterial({ color: 0x888888 });
  }
  
  /**
   * Generate a random height variation within a specified range
   * @param baseHeight Base height value
   * @param variationPercent Percentage of variation (0-1)
   * @returns Modified height value
   */
  private getRandomHeightVariation(baseHeight: number, variationPercent: number = 0.2): number {
    const minHeight = baseHeight * (1 - variationPercent);
    const maxHeight = baseHeight * (1 + variationPercent);
    return minHeight + Math.random() * (maxHeight - minHeight);
  }
  
  /**
   * Load all environment assets
   * @returns Promise that resolves when all assets are loaded
   */
  public loadAssets(): Promise<void> {
    console.log('Loading environment assets...');
    
    // Load building models
    this.loadBuildingModels();
    
    // Load prop models
    this.loadPropModels();
    
    // Return a promise that resolves when all loading is complete
    return Promise.all(this.loadingPromises).then(() => {
      console.log('All environment assets loaded successfully');
    }).catch(error => {
      console.error('Error loading environment assets:', error);
    });
  }
  
  /**
   * Load building models
   */
  private loadBuildingModels(): void {
    // Since we don't have actual GLTF models yet, let's create procedural buildings
    console.log('Creating procedural building models...');
    
    // Create different building types
    this.createOfficeBuilding();
    this.createResidentialBuilding();
    this.createSkyscraper();
    this.createSmallShop();
  }
  
  /**
   * Create a procedural office building
   */
  private createOfficeBuilding(): void {
    const building = new THREE.Group();
    
    // Create building geometry
    const width = 18;
    const height = this.getRandomHeightVariation(30, 0.3);
    const depth = 18;
    
    // Main structure
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMaterial = this.getSharedMaterial('building-concrete');
    
    const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
    buildingMesh.position.y = height / 2;
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    
    // Add windows
    const windowMaterial = this.getSharedMaterial('building-glass');
    
    // Front windows
    for (let y = 3; y < height - 3; y += 3) {
      for (let x = -width / 2 + 2; x < width / 2; x += 3) {
        const windowGeometry = new THREE.BoxGeometry(2, 1.5, 0.1);
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(x, y, depth / 2 + 0.1);
        building.add(windowMesh);
      }
    }
    
    // Back windows
    for (let y = 3; y < height - 3; y += 3) {
      for (let x = -width / 2 + 2; x < width / 2; x += 3) {
        const windowGeometry = new THREE.BoxGeometry(2, 1.5, 0.1);
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(x, y, -depth / 2 - 0.1);
        windowMesh.rotation.y = Math.PI;
        building.add(windowMesh);
      }
    }
    
    // Side windows
    for (let y = 3; y < height - 3; y += 3) {
      for (let z = -depth / 2 + 2; z < depth / 2; z += 3) {
        const windowGeometry = new THREE.BoxGeometry(0.1, 1.5, 2);
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(width / 2 + 0.1, y, z);
        building.add(windowMesh);
        
        const windowMesh2 = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh2.position.set(-width / 2 - 0.1, y, z);
        building.add(windowMesh2);
      }
    }
    
    building.add(buildingMesh);
    
    // Add to collection
    this.buildingModels.push(building);
  }
  
  /**
   * Create a procedural residential building
   */
  private createResidentialBuilding(): void {
    const building = new THREE.Group();
    
    // Create building geometry
    const width = 22;
    const height = this.getRandomHeightVariation(20, 0.25);
    const depth = 16;
    
    // Main structure
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMaterial = this.getSharedMaterial('building-concrete');
    
    const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
    buildingMesh.position.y = height / 2;
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    
    // Add windows and balconies
    const windowMaterial = this.getSharedMaterial('building-glass');
    
    const balconyMaterial = this.getSharedMaterial('building-brick');
    
    // Front windows and balconies
    for (let floor = 1; floor < 7; floor++) {
      const floorHeight = floor * 3;
      
      for (let section = 0; section < 3; section++) {
        const xPos = (section * 5) - 5;
        
        // Window
        const windowGeometry = new THREE.BoxGeometry(3, 2, 0.1);
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(xPos, floorHeight, depth / 2 + 0.1);
        building.add(windowMesh);
        
        // Balcony
        if (section !== 1 || floor % 2 === 0) {  // Skip some balconies for variety
          const balconyGeometry = new THREE.BoxGeometry(3.5, 0.2, 1.5);
          const balconyMesh = new THREE.Mesh(balconyGeometry, balconyMaterial);
          balconyMesh.position.set(xPos, floorHeight - 1.1, depth / 2 + 0.8);
          building.add(balconyMesh);
          
          // Railings
          const railingGeometry = new THREE.BoxGeometry(3.5, 1, 0.1);
          const railingMesh = new THREE.Mesh(railingGeometry, balconyMaterial);
          railingMesh.position.set(xPos, floorHeight - 0.6, depth / 2 + 1.55);
          building.add(railingMesh);
          
          // Side railings
          const sideRailingGeometry = new THREE.BoxGeometry(0.1, 1, 1.5);
          
          const leftRailing = new THREE.Mesh(sideRailingGeometry, balconyMaterial);
          leftRailing.position.set(xPos - 1.7, floorHeight - 0.6, depth / 2 + 0.8);
          building.add(leftRailing);
          
          const rightRailing = new THREE.Mesh(sideRailingGeometry, balconyMaterial);
          rightRailing.position.set(xPos + 1.7, floorHeight - 0.6, depth / 2 + 0.8);
          building.add(rightRailing);
        }
      }
    }
    
    // Back windows
    for (let floor = 1; floor < 7; floor++) {
      const floorHeight = floor * 3;
      
      for (let section = 0; section < 4; section++) {
        const xPos = (section * 4) - 6;
        
        // Window
        const windowGeometry = new THREE.BoxGeometry(2.5, 1.5, 0.1);
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(xPos, floorHeight, -depth / 2 - 0.1);
        building.add(windowMesh);
      }
    }
    
    building.add(buildingMesh);
    
    // Add to collection
    this.buildingModels.push(building);
  }
  
  /**
   * Create a procedural skyscraper
   */
  private createSkyscraper(): void {
    const building = new THREE.Group();
    
    // Create building geometries for a multi-section skyscraper
    const baseWidth = 30;
    const baseDespth = 30;
    const baseHeight = 15;
    
    const midWidth = 24;
    const midDepth = 24;
    const midHeight = 30;
    
    const topWidth = 18;
    const topDepth = 18;
    const topHeight = this.getRandomHeightVariation(25, 0.4);
    
    // Materials
    const glassMaterial = this.getSharedMaterial('building-glass');
    
    const supportMaterial = this.getSharedMaterial('building-concrete');
    
    // Base section
    const baseGeometry = new THREE.BoxGeometry(baseWidth, baseHeight, baseDespth);
    const baseMesh = new THREE.Mesh(baseGeometry, glassMaterial);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    building.add(baseMesh);
    
    // Middle section
    const midGeometry = new THREE.BoxGeometry(midWidth, midHeight, midDepth);
    const midMesh = new THREE.Mesh(midGeometry, glassMaterial);
    midMesh.position.y = baseHeight + midHeight / 2;
    midMesh.castShadow = true;
    midMesh.receiveShadow = true;
    building.add(midMesh);
    
    // Top section
    const topGeometry = new THREE.BoxGeometry(topWidth, topHeight, topDepth);
    const topMesh = new THREE.Mesh(topGeometry, glassMaterial);
    topMesh.position.y = baseHeight + midHeight + topHeight / 2;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    building.add(topMesh);
    
    // Support columns
    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        const columnGeometry = new THREE.BoxGeometry(1, baseHeight + midHeight + topHeight, 1);
        const columnMesh = new THREE.Mesh(columnGeometry, supportMaterial);
        columnMesh.position.set(
          (x * baseWidth / 2) - (x * 0.5), 
          (baseHeight + midHeight + topHeight) / 2, 
          (z * baseDespth / 2) - (z * 0.5)
        );
        columnMesh.castShadow = true;
        building.add(columnMesh);
      }
    }
    
    // Antenna
    const antennaGeometry = new THREE.CylinderGeometry(0.3, 0.3, 10, 8);
    const antennaMesh = new THREE.Mesh(antennaGeometry, supportMaterial);
    antennaMesh.position.y = baseHeight + midHeight + topHeight + 5;
    building.add(antennaMesh);
    
    // Add to collection
    this.buildingModels.push(building);
  }
  
  /**
   * Create a procedural small shop
   */
  private createSmallShop(): void {
    const building = new THREE.Group();
    
    // Create building geometry
    const width = 14;
    const height = this.getRandomHeightVariation(4, 0.15);
    const depth = 12;
    
    // Main structure
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMaterial = this.getSharedMaterial('building-concrete');
    
    const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
    buildingMesh.position.y = height / 2;
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    
    // Storefront
    const storefrontMaterial = this.getSharedMaterial('building-glass');
    
    const storefront = new THREE.Mesh(
      new THREE.BoxGeometry(width - 2, height - 1, 0.1),
      storefrontMaterial
    );
    
    storefront.position.set(0, height / 2 - 0.5, depth / 2 + 0.1);
    building.add(storefront);
    
    // Door
    const doorMaterial = this.getSharedMaterial('building-brick');
    
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.5, 0.2),
      doorMaterial
    );
    
    door.position.set(0, 1.25, depth / 2 + 0.2);
    building.add(door);
    
    // Roof overhang
    const roofGeometry = new THREE.BoxGeometry(width + 1, 0.3, depth + 1);
    const roofMaterial = this.getSharedMaterial('building-concrete');
    
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = height + 0.15;
    building.add(roof);
    
    // Sign
    const signGeometry = new THREE.BoxGeometry(width - 1, 1, 0.3);
    const signMaterial = this.getSharedMaterial('building-glass');
    
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, height + 0.8, depth / 2 - 0.5);
    building.add(sign);
    
    building.add(buildingMesh);
    
    // Add to collection
    this.buildingModels.push(building);
  }
  
  
  /**
   * Load prop models (vegetation, street furniture, etc.)
   */
  private loadPropModels(): void {
    // Add trees
    for (let i = 0; i < 50; i++) {
      const tree = this.createTree();
      this.propModels.push(tree);
    }
    
    // Add lamp posts
    for (let i = 0; i < 5; i++) {
      const lampPost = this.createLampPost();
      this.propModels.push(lampPost);
    }
    
    // Add benches
    for (let i = 0; i < 15; i++) {
      const bench = this.createBench();
      this.propModels.push(bench);
    }
    
    // Add trash cans (no LOD for simple objects)
    for (let i = 0; i < 15; i++) {
      const trashCan = this.createTrashCan();
      this.propModels.push(trashCan);
    }
    
    // Add Donald Trump statues
    for (let i = 0; i < 5; i++) {
      const trumpStatue = this.createTrumpStatue();
      this.propModels.push(trumpStatue);
    }
  }
  
  /**
   * Create a procedural tree with LOD support
   * @returns Tree object with multiple LOD levels
   */
  private createTree(): THREE.Object3D {
    const treeLOD = new THREE.LOD();
    
    // High detail version (LOD 0)
    const highDetailTree = this.createTreeGeometry(8, 3);
    treeLOD.addLevel(highDetailTree, 0);
    
    // Medium detail version (LOD 1)
    const mediumDetailTree = this.createTreeGeometry(6, 2);
    treeLOD.addLevel(mediumDetailTree, 15);
    
    // Low detail version (LOD 2)
    const lowDetailTree = this.createTreeGeometry(4, 1);
    treeLOD.addLevel(lowDetailTree, 30);
    
    // Position adjustments
    treeLOD.position.y = 0;
    
    return treeLOD;
  }
  
  /**
   * Create tree geometry with specified detail level
   * @param foliageSegments Number of segments for foliage spheres
   * @param foliageCount Number of foliage clusters
   * @returns Tree object
   */
  private createTreeGeometry(foliageSegments: number, foliageCount: number): THREE.Object3D {
    const treeObject = new THREE.Object3D();
    
    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, Math.max(6, foliageSegments - 2));
    const trunkMaterial = this.getSharedMaterial('prop-wood');
    
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 0;
    treeObject.add(trunk);
    
    // Tree foliage
    const foliageMaterial = this.getSharedMaterial('prop-foliage');
    
    // Main foliage on top
    const mainFoliage = new THREE.Mesh(
      new THREE.SphereGeometry(1, foliageSegments, foliageSegments),
      foliageMaterial
    );
    mainFoliage.position.y = 1.5;
    treeObject.add(mainFoliage);
    
    // Additional foliage clusters if detail level requires them
    if (foliageCount > 1) {
      const secondaryFoliage = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, foliageSegments, foliageSegments),
        foliageMaterial
      );
      secondaryFoliage.position.set(0.5, 1.0, 0.5);
      treeObject.add(secondaryFoliage);
      
      if (foliageCount > 2) {
        const tertiaryFoliage = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, foliageSegments, foliageSegments),
          foliageMaterial
        );
        tertiaryFoliage.position.set(-0.4, 0.8, -0.4);
        treeObject.add(tertiaryFoliage);
      }
    }
    
    return treeObject;
  }
  
  /**
   * Create a lamp post with LOD support
   * @returns Lamp post object with multiple LOD levels
   */
  private createLampPost(): THREE.Object3D {
    const lampLOD = new THREE.LOD();
    
    // High detail version (LOD 0)
    const highDetailLamp = this.createLampPostGeometry(8, true);
    lampLOD.addLevel(highDetailLamp, 0);
    
    // Low detail version (LOD 1)
    const lowDetailLamp = this.createLampPostGeometry(6, false);
    lampLOD.addLevel(lowDetailLamp, 20);
    
    // Position adjustments
    lampLOD.position.y = 0;
    
    return lampLOD;
  }
  
  /**
   * Create lamp post geometry with specified detail level
   * @param segments Number of segments for cylindrical parts
   * @param includeLight Whether to include the light bulb detail
   * @returns Lamp post object
   */
  private createLampPostGeometry(segments: number, includeLight: boolean): THREE.Object3D {
    const lampObject = new THREE.Object3D();
    
    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.15, 4, segments);
    const poleMaterial = this.getSharedMaterial('prop-metal');
    
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 0;
    lampObject.add(pole);
    
    // Arm
    const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, segments);
    const arm = new THREE.Mesh(armGeometry, poleMaterial);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.5, 1.8, 0);
    lampObject.add(arm);
    
    // Light fixture
    const fixtureGeometry = new THREE.CylinderGeometry(0.2, 0.3, 0.4, segments);
    const fixtureMaterial = this.getSharedMaterial('prop-metal');
    
    const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
    fixture.rotation.x = Math.PI / 2;
    fixture.position.set(1.0, 1.8, 0);
    lampObject.add(fixture);
    
    // Light bulb (only for high detail)
    if (includeLight) {
      const bulbGeometry = new THREE.SphereGeometry(0.1, segments, segments);
      const bulbMaterial = this.getSharedMaterial('prop-metal');
      
      const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
      bulb.position.set(1.0, 1.8, 0.1);
      lampObject.add(bulb);
    }
    
    return lampObject;
  }
  
  /**
   * Create a bench with LOD support
   * @returns Bench object with multiple LOD levels
   */
  private createBench(): THREE.Object3D {
    const benchLOD = new THREE.LOD();
    
    // High detail version (LOD 0)
    const highDetailBench = this.createBenchGeometry(true);
    benchLOD.addLevel(highDetailBench, 0);
    
    // Low detail version (LOD 1)
    const lowDetailBench = this.createBenchGeometry(false);
    benchLOD.addLevel(lowDetailBench, 25);
    
    // Position adjustments
    benchLOD.position.y = 0;
    
    return benchLOD;
  }
  
  /**
   * Create bench geometry with specified detail level
   * @param highDetail Whether to include detailed slats
   * @returns Bench object
   */
  private createBenchGeometry(highDetail: boolean): THREE.Object3D {
    const benchObject = new THREE.Object3D();
    
    // Materials
    const woodMaterial = this.getSharedMaterial('prop-wood');
    const metalMaterial = this.getSharedMaterial('prop-metal');
    
    // Seat
    let seatGeometry;
    
    if (highDetail) {
      // Detailed seat with individual slats
      for (let i = 0; i < 5; i++) {
        const slatGeometry = new THREE.BoxGeometry(1.8, 0.05, 0.15);
        const slat = new THREE.Mesh(slatGeometry, woodMaterial);
        slat.position.set(0, 0.3, -0.3 + i * 0.15);
        benchObject.add(slat);
      }
      
      // Detailed backrest with individual slats
      for (let i = 0; i < 3; i++) {
        const backSlatGeometry = new THREE.BoxGeometry(1.8, 0.15, 0.05);
        const backSlat = new THREE.Mesh(backSlatGeometry, woodMaterial);
        backSlat.position.set(0, 0.6 + i * 0.2, 0.3);
        benchObject.add(backSlat);
      }
    } else {
      // Simplified seat as a single piece
      seatGeometry = new THREE.BoxGeometry(1.8, 0.05, 0.75);
      const seat = new THREE.Mesh(seatGeometry, woodMaterial);
      seat.position.set(0, 0.3, 0);
      benchObject.add(seat);
      
      // Simplified backrest as a single piece
      const backrestGeometry = new THREE.BoxGeometry(1.8, 0.6, 0.05);
      const backrest = new THREE.Mesh(backrestGeometry, woodMaterial);
      backrest.position.set(0, 0.7, 0.3);
      benchObject.add(backrest);
    }
    
    // Legs (simplified for both LOD levels)
    const legGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.1);
    
    // Four legs
    const positions = [
      [-0.8, 0, -0.3],
      [0.8, 0, -0.3],
      [-0.8, 0, 0.3],
      [0.8, 0, 0.3]
    ];
    
    for (const [x, y, z] of positions) {
      const leg = new THREE.Mesh(legGeometry, metalMaterial);
      leg.position.set(x, 0, z);
      benchObject.add(leg);
    }
    
    return benchObject;
  }
  
  /**
   * Create a procedural trash can
   */
  private createTrashCan(): THREE.Object3D {
    const trashCan = new THREE.Group();
    
    // Can body
    const canGeometry = new THREE.CylinderGeometry(0.3, 0.25, 0.8, 8);
    const canMaterial = this.getSharedMaterial('prop-metal');
    
    const can = new THREE.Mesh(canGeometry, canMaterial);
    can.position.y = 0;
    can.castShadow = true;
    can.receiveShadow = true;
    trashCan.add(can);
    
    // Lid
    const lidGeometry = new THREE.CylinderGeometry(0.32, 0.3, 0.1, 8);
    const lidMaterial = this.getSharedMaterial('prop-metal');
    
    const lid = new THREE.Mesh(lidGeometry, lidMaterial);
    lid.position.y = 0.5;
    lid.castShadow = true;
    lid.receiveShadow = true;
    trashCan.add(lid);
    
    // Position the entire trash can at ground level
    trashCan.position.y = 0;
    
    return trashCan;
  }
  
  /**
   * Create a Donald Trump statue by loading the model
   * @returns Trump statue object
   */
  private createTrumpStatue(): THREE.Object3D {
    console.log('Creating Trump statue...');
    
    // Create a placeholder while the model loads
    const placeholder = new THREE.Group();
    
    // Add a simple box as placeholder (2x larger)
    const boxGeometry = new THREE.BoxGeometry(0.7, 1.8, 0.7); // 2x the original size
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.y = 0.9; // Position box with bottom at y=0 (move up by half height to center properly)
    box.castShadow = true;
    box.receiveShadow = true;
    placeholder.add(box);
    
    // Set user data for identification
    placeholder.userData = {
      type: 'trump_statue',
      isPlaceholder: true,
      isDestructible: true // Mark as destructible so we can handle collisions
    };
    
    // Load the actual GLTF model
    const loadingPromise = new Promise<void>((resolve) => {
      this.gltfLoader.load(
        './assets/models/donald_trump.glb',
        (gltf) => {
          // Model loaded successfully
          console.log('Trump model loaded successfully');
          
          // Process the model
          const model = gltf.scene;
          
          // Scale the model to 2x the original size (1.0 instead of 0.5)
          model.scale.set(1.0, 1.0, 1.0);
          
          // Ensure it's at ground level (y=0)
          model.position.y = 0;
          
          // Add shadows
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // Set user data
          model.userData = {
            type: 'trump_statue',
            isPlaceholder: false,
            isDestructible: true // Mark as destructible so we can handle collisions
          };
          
          // Replace placeholder with actual model
          // (In a real app, we'd want to properly handle this replacement in the scene)
          Object.assign(placeholder, model);
          
          resolve();
        },
        // Progress callback
        (xhr) => {
          console.log(`Trump model loading: ${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        // Error callback
        (error) => {
          console.error('Error loading Trump model:', error);
          resolve(); // Resolve anyway to not block loading
        }
      );
    });
    
    // Add to loading promises
    this.loadingPromises.push(loadingPromise);
    
    return placeholder;
  }
  
  /**
   * Get a random building model
   * @returns A random building model
   */
  public getRandomBuilding(): THREE.Object3D {
    const index = Math.floor(Math.random() * this.buildingModels.length);
    return this.buildingModels[index].clone();
  }
  
  /**
   * Get a specific building model by index
   * @param index Index of the building model
   * @returns The building model at the specified index
   */
  public getBuildingByIndex(index: number): THREE.Object3D {
    if (index >= 0 && index < this.buildingModels.length) {
      return this.buildingModels[index].clone();
    }
    console.warn(`Building index ${index} out of range, returning random building`);
    return this.getRandomBuilding();
  }
  
  /**
   * Get a random road model
   * @returns A random road model
   */
  public getRandomRoad(): THREE.Object3D {
    const index = Math.floor(Math.random() * this.roadModels.length);
    return this.roadModels[index].clone();
  }
  
  /**
   * Get a specific road model by index
   * @param index Index of the road model
   * @returns The road model at the specified index
   */
  public getRoadByIndex(index: number): THREE.Object3D {
    if (index >= 0 && index < this.roadModels.length) {
      return this.roadModels[index].clone();
    }
    console.warn(`Road index ${index} out of range, returning random road`);
    return this.getRandomRoad();
  }
  
  /**
   * Get a random prop model
   * @returns A random prop model
   */
  public getRandomProp(): THREE.Object3D {
    const index = Math.floor(Math.random() * this.propModels.length);
    return this.propModels[index].clone();
  }
  
  /**
   * Get a specific prop model by index
   * @param index Index of the prop model
   * @returns The prop model at the specified index
   */
  public getPropByIndex(index: number): THREE.Object3D {
    if (index >= 0 && index < this.propModels.length) {
      return this.propModels[index].clone();
    }
    console.warn(`Prop index ${index} out of range, returning random prop`);
    return this.getRandomProp();
  }
  
  /**
   * Get all building models
   * @returns Array of building models
   */
  public getAllBuildings(): THREE.Object3D[] {
    return this.buildingModels.map(building => building.clone());
  }
  
  /**
   * Get all road models
   * @returns Array of road models
   */
  public getAllRoads(): THREE.Object3D[] {
    return this.roadModels.map(road => road.clone());
  }
  
  /**
   * Get all prop models
   * @returns Array of prop models
   */
  public getAllProps(): THREE.Object3D[] {
    return this.propModels.map(prop => prop.clone());
  }
  
  /**
   * Get the number of building types available
   * @returns Number of building types
   */
  public getBuildingTypesCount(): number {
    return this.buildingModels.length;
  }
  
  /**
   * Get the number of prop types available
   * @returns Number of prop types
   */
  public getPropTypesCount(): number {
    return this.propModels.length;
  }
} 