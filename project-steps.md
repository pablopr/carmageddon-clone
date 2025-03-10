### Implementation Plan
Always go with the simpler version that works. No fallbacks if librarys don't work, just throw errors but never implement fallbacks.

## Phase 1: Project Initialization & Environment Setup
1. Project Initialization & Dependencies
Repository: GitHub, structured clearly (src, assets, models, textures, audio, scripts).
Bundler: Vite (for performance).
Rendering Engine: Three.js (latest stable version).
Physics Engine: Cannon.js (simpler).
Audio Library: Howler.js.

2. Project Architecture
Directory structure:
/src
  /core (Three.js, physics integration)
  /game (game logic, scoring, gameplay loop)
  /entities (vehicles, NPCs, animals)
  /ui (HUD, minimap, interactions)
  /systems (AI, physics, audio, rendering)
/assets (already exists)
  /models
  /textures
  /audio
Code structure: Modular ES6 classes, clearly defined responsibility.

3. Init Screen
The Game menu screen showing a description of the game, how to play, and a button to start. It should look like Carmageddon style

## Phase 2: Scene Creation & Asset Integration
3. Scene Setup (Three.js)
Camera: PerspectiveCamera, FOV=75°, dynamic aspect ratio.
Lighting: Directional (sunlight) and ambient light.
Rendering settings: WebGLRenderer, antialiasing=true, shadows=true.

4. Environment Assets
City Map: Medium-size urban environment (~1km²), GLTF format.
Buildings: Low-poly (~500–800 tris each), instanced.
Roads: Simple modular geometry segments with seamless textures.
Vegetation/Props: Instanced meshes, simplified collision boxes, optimized textures (max 512x512).

5. Optimization Implementation
LOD (Level of Detail): Three.js LOD system for all buildings/props.
Frustum culling: Automatic Three.js renderer settings.

## Phase 3: Vehicle Dynamics & Controls
6. Vehicle Selection & Specifications
Simplest Vehicule that moves like an arcade car.

Control Schema:
W/A/S/D or arrow keys: accelerate/brake/steer.
Spacebar: handbrake.
Camera follows vehicle from 3rd person perspective.

7. Physics Integration (Cannon.js)
Vehicle Physics:
Simplified arcade-style physics for responsiveness.

Collision Detection:
Collision events trigger scoring system and audio/visual feedback.
Use simplified bounding volumes (boxes, capsules) for performance.

## Phase 4: NPC & Animal AI Systems
8. Human NPC AI
Pathfinding:

Use navmesh-based pathfinding (Three-pathfinding or Yuka).
NPCs randomly patrol sidewalks, occasionally cross streets.
NPC Behavior Logic:

Idle, walk, run away upon detection of vehicle proximity.
Visual Identification:

Humans: bright clothing, clear walking animations.

9. Animal NPC AI
Animal Selection:

Dogs, cats (small, unpredictable), cows, deer (large, slow), birds (random flight paths).
Behavioral logic:

Random wandering patterns; sudden direction changes.
Birds triggered to fly by proximity, animals randomly move across streets.
Visual Distinction:

Animals clearly visible via distinct models/textures (neutral earth tones).

## Phase 5: Scoring and Gameplay Logic
10. Point System Definition
Human NPC hit: +100 points.
Animal NPC hit: -200 points (significant penalty to encourage avoidance).
Combo system:
Consecutive human hits without animal hit: Combo multiplier (e.g., 1.5x after 3 humans, 2x after 5).
11. Gameplay Balancing
NPC density:
Humans: high density in urban centers.
Animals: moderate, unpredictable placement.
Vehicle responsiveness and handling adjustments based on AI-driven iterative testing.

## Phase 6: User Interface (HUD) & Feedback Mechanisms
12. HUD Implementation
On-screen elements:
Score (top-center, dynamic updating).
Combo notifications (transient pop-up near score).
Penalty notifications for animal hits (red, brief).
Minimap (bottom-right corner).
13. Minimap & Navigation
Dynamic map rendering:
Player position at center.
Humans marked as white dots, animals as red dots.
Vehicle direction indicated by an arrow.

## Phase 7: Audio & Visual Effects
14. Audio Integration (Howler.js)
Sound library:
Engine revving (vehicle-specific).
Collision impacts (humans, animals, static objects).
NPC reaction sounds: screams, animal noises.
Ambiance: urban street background loop.
15. Visual Particle Effects
Collision effects:
Human collision: blood particle spray.
Animal collision: distinct particle effect (dust, fur).
Vehicle effects:
Tire smoke, skid marks, sparks upon collisions.

## Phase 8: Optimization & Performance Management
16. Benchmarking & Optimization
Performance targets:
Maintain ≥60 FPS on standard hardware (mid-range laptop).
Techniques applied:
Geometry instancing.
Texture atlases and compressed textures.
Garbage collection minimization (object pooling).

17. Memory Management & Asset Loading
Dynamic asset loading:
Implement progressive loading based on player position.
Unload distant or unused assets when memory usage exceeds thresholds.
Asset streaming:
Set up dynamic LOD system that adjusts based on performance metrics.
Implement occlusion culling for urban environments.
Memory monitoring:
Add performance monitoring tools during development.
Set memory usage budgets for models, textures, and audio.

## Phase 9: Polishing & Deployment Preparation
18. Gameplay Polishing
Adjust vehicle controls based on test feedback.
Fine-tune NPC spawning frequency and behavior unpredictability.
Ensure consistent UI and responsive feedback.
19. Final Preparations for Deployment
Set up continuous integration (CI/CD) for automatic builds and deployments.
Configure hosting platform: GitHub Pages or Netlify.

## Phase 10: Launch & Post-Launch Features
20. Public Deployment
Deploy the final stable build publicly online.
Integrate analytics for player engagement tracking.
21. Recommended Post-Launch Features
Procedural Generation:
Randomized spawning and movement patterns for NPCs and animals.
Multiplayer:
Player vs. player competitive mode.
Leaderboards for global score tracking.
Vehicle Customization & Progression:
Vehicle upgrades improving durability, speed, handling.
Cosmetic customizations (paint, decals).
