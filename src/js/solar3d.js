// SolarIS 3D Sun Interactive Engine - Class Based (solar3d.js)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { activeRegions } from './db.js';

// Conversion helper: Lat/Lon (degrees) to 3D Cartesian coordinates
export function getCartesianCoords(lat, lon, radius = 4.0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta)
  );
}

export class SolarGlobe {
  constructor(containerElement, mode = 'dashboard', onRegionSelected = null) {
    this.container = containerElement;
    this.mode = mode;
    this.onRegionSelected = onRegionSelected;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.sunMesh = null;
    this.activeRegionGroups = [];
    this.flareParticles = [];
    this.loopLines = [];
    this.canvas = null;
    this.animationFrameId = null;
    this.hudElement = null;
    this.selectedRegionGroup = null;
    this.hotspotsGroup = null;

    this.mixer = null;
    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    // 1. Create Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.outline = 'none';
    this.container.appendChild(this.canvas);

    // 2. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020508, 0.015);

    // 3. Camera Setup
    const initWidth = this.container.clientWidth || 300;
    const initHeight = this.container.clientHeight || 300;
    this.camera = new THREE.PerspectiveCamera(
      45,
      initWidth / initHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 9);

    // 4. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(initWidth, initHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;

        // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight1.position.set(5, 5, 5);
    this.scene.add(dirLight1);

    // Add starfield
    this.createStarfield();

    // Create parent group for rotating hotspots and loops
    this.hotspotsGroup = new THREE.Group();
    this.scene.add(this.hotspotsGroup);

    if (this.mode === 'dashboard') {
      this.hudElement = document.getElementById('ar-target-hud');
    }

    // Load custom GLB model
    this.loadGLBModel();

    // 9. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 6.0;
    this.controls.maxDistance = 25.0;
    this.controls.enablePan = false;

    // 10. Draw Interactive Active Region Hotspots
    this.createActiveRegions(activeRegions);

    // Bind event listeners
    this.resizeCallback = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.resizeCallback);

    this.clickCallback = this.handleSunClick.bind(this);
    this.canvas.addEventListener('click', this.clickCallback);

    // 11. Start Animation Loop
    this.animate();
  }

  loadGLBModel() {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('/solar_system_animation (2).glb', (gltf) => {
      // Remove temporary procedural sphere fallback
      if (this.sunMesh) {
        this.scene.remove(this.sunMesh);
      }

      const model = gltf.scene;

      // Find the Sun mesh inside the GLB model (typically named "Sun", "Sol", "Sphere", or sits at center)
      let sunMesh = null;
      model.traverse((child) => {
        if (child.isMesh) {
          const name = child.name.toLowerCase();
          if (name.includes('sun') || name.includes('sol') || name.includes('star') || child.position.length() < 0.25) {
            if (!sunMesh || child.scale.length() > sunMesh.scale.length()) {
              sunMesh = child;
            }
          }
        }
      });

      // If we identified the Sun mesh, calculate size bounds to scale and center model correctly based on the Sun's size
      if (sunMesh) {
        // Calculate size bounds to scale and center model correctly based on the Sun's size
        const box = new THREE.Box3().setFromObject(sunMesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Target radius is 4.0, target diameter is 8.0
        const scale = 8.0 / maxDim;
        model.scale.set(scale, scale, scale);

        // Center Sun mesh at (0,0,0)
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center.multiplyScalar(scale));
      } else {
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 8.0 / maxDim;
        model.scale.set(scale, scale, scale);
      }

      // Initialize animation mixer if animations are present
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          this.mixer.clipAction(clip).play();
        });
      }

      this.sunMesh = model; // Store model as sunMesh for rotation
      this.scene.add(model);
      console.log('GLB Solar System model loaded and original textures colored successfully.');
    }, undefined, (err) => {
      console.warn('Failed to load GLB model, using procedural fallback:', err);
    });
  }

  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Gradient fill: Rosewood (#5A0006) to Dark Red (#920004) to Sinopia (#D92200)
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#5A0006');
    grad.addColorStop(0.3, '#920004');
    grad.addColorStop(0.6, '#D92200');
    grad.addColorStop(1.0, '#5A0006');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Convective noise cells simulation
    ctx.fillStyle = '#F3500A'; // Tangelo
    for (let i = 0; i < 180; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 256;
      const size = 3 + Math.random() * 8;
      ctx.beginPath();
      ctx.arc(rx, ry, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  createStarfield() {
    const count = 180;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Random coordinates on a shell far away
      const radius = 65 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Stars colored deep orange, red, and warm white
      const rand = Math.random();
      if (rand < 0.3) {
        colors[i * 3] = 0.95; // Sinopia red
        colors[i * 3 + 1] = 0.15;
        colors[i * 3 + 2] = 0.0;
      } else if (rand < 0.6) {
        colors[i * 3] = 0.95; // Tangelo orange
        colors[i * 3 + 1] = 0.45;
        colors[i * 3 + 2] = 0.05;
      } else {
        colors[i * 3] = 0.85; // Warm white
        colors[i * 3 + 1] = 0.75;
        colors[i * 3 + 2] = 0.65;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.82,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true
    });

    const starfield = new THREE.Points(geometry, material);
    this.scene.add(starfield);
  }

  createActiveRegions(regions) {
    // Clear existing
    if (this.hotspotsGroup) {
      while (this.hotspotsGroup.children.length > 0) {
        this.hotspotsGroup.remove(this.hotspotsGroup.children[0]);
      }
    }
    this.activeRegionGroups = [];
    this.loopLines = [];

    regions.forEach(region => {
      const pos = getCartesianCoords(region.lat, region.lon, 4.02);
      const group = new THREE.Group();
      group.position.copy(pos);

      // Define color based on threat severity (Critical -> Vibrant Cyan, High -> Electric Blue, Moderate -> Deep Blue)
      let hexColor = '#0066ff'; // Moderate: Deep Blue
      if (region.status === 'CRITICAL') {
        hexColor = '#00f0ff'; // Critical: Vibrant Cyan
      } else if (region.status === 'HIGH THREAT') {
        hexColor = '#00aaff'; // High: Electric Blue
      }

      // Hotspot click marker sphere
      const markerGeom = new THREE.SphereGeometry(0.16, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({
        color: hexColor,
        transparent: true,
        opacity: 0.9
      });
      const markerMesh = new THREE.Mesh(markerGeom, markerMat);
      markerMesh.userData = { regionId: region.id, data: region };
      group.add(markerMesh);

      // Surrounding target ring
      const ringGeom = new THREE.RingGeometry(0.24, 0.32, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: hexColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0)); // Face center of Sun
      group.add(ringMesh);

      this.hotspotsGroup.add(group);
      this.activeRegionGroups.push(group);

      if (region.id === 'AR13562') {
        this.selectedRegionGroup = group;
      }

      // Create flaring magnetic loops for High/Critical regions
      if (region.status !== 'NORMAL') {
        this.createCoronalLoop(region.lat, region.lon, hexColor);
      }
    });

    if (!this.selectedRegionGroup && this.activeRegionGroups.length > 0) {
      this.selectedRegionGroup = this.activeRegionGroups[0];
    }
  }

  createCoronalLoop(lat, lon, hexColor) {
    // Generate curved Bezier loops representing solar magnetic fields
    const start = getCartesianCoords(lat, lon, 4.02);
    const end = getCartesianCoords(lat + (Math.random() * 8 - 4), lon + (Math.random() * 12 - 6), 4.02);
    
    // Control point extending outwards representing loop height
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const height = 0.5 + Math.random() * 0.95;
    midPoint.normalize().multiplyScalar(4.02 + height);

    const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
    const points = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.65,
      linewidth: 2.0
    });

    const line = new THREE.Line(geometry, material);
    this.hotspotsGroup.add(line);
    this.loopLines.push(line);
  }

  triggerFlareEffect(lat, lon, severity) {
    // Determine colors
    let flareColor = '#00aaff'; // Electric Blue default
    if (severity === 'X') flareColor = '#00f0ff'; // Vibrant Cyan
    if (severity === 'C') flareColor = '#0066ff'; // Deep Blue

    const pos = getCartesianCoords(lat, lon, 4.05);

    // Eruption Particle Burst Simulation
    const count = 35;
    const geom = new THREE.SphereGeometry(0.04, 8, 8);
    
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: flareColor,
        transparent: true,
        opacity: 1.0
      });
      const pMesh = new THREE.Mesh(geom, mat);
      pMesh.position.copy(pos);

      // Flare velocity outward from the surface
      const normalDir = pos.clone().normalize();
      
      // Random tangential dispersion vectors
      const randomScatter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      );
      const velocity = normalDir.multiplyScalar(0.06 + Math.random() * 0.16).add(randomScatter);

      this.scene.add(pMesh);
      this.flareParticles.push({
        mesh: pMesh,
        velocity: velocity,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.02
      });
    }

    // Trigger visual loops shake
    console.log(`Eruption simulation instigated at coords: Lat ${lat}°, Lon ${lon}° (Severity: ${severity})`);
  }

  focusOnRegion(regionId) {
    const region = activeRegions.find(r => r.id === regionId);
    if (!region) return;

    const group = this.activeRegionGroups.find(g => g.children[0].userData.regionId === regionId);
    if (group) {
      this.selectedRegionGroup = group;
    }

    const targetPos = getCartesianCoords(region.lat, region.lon, 4.05);

    // Zoom camera details
    const targetCamPos = targetPos.clone().normalize().multiplyScalar(7.8);
    const startTarget = this.controls.target.clone();

    // Lerp camera and controls positions
    let steps = 0;
    const maxSteps = 45;
    const lerpCamera = () => {
      if (steps >= maxSteps) return;
      steps++;
      
      this.controls.target.lerpVectors(startTarget, targetPos, steps / maxSteps);
      this.camera.position.lerp(targetCamPos, 0.08);
      
      requestAnimationFrame(lerpCamera);
    };
    lerpCamera();
  }

  handleSunClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObjects(
      this.activeRegionGroups.flatMap(g => g.children)
    );

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      if (clickedMesh.userData && clickedMesh.userData.regionId) {
        const regionData = clickedMesh.userData.data;
        this.focusOnRegion(regionData.id);
        
        if (this.onRegionSelected) {
          this.onRegionSelected(regionData);
        }
      }
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height, false);
  }

  destroy() {
    // Clean up animation loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Remove listeners
    window.removeEventListener('resize', this.resizeCallback);
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.clickCallback);
      this.canvas.remove();
    }
    
    // Dispose resources
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  project3DTo2D(position) {
    const vector = position.clone();
    vector.project(this.camera);

    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;

    const x = (vector.x * 0.5 + 0.5) * width;
    const y = (-(vector.y * 0.5) + 0.5) * height;

    return { x, y };
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    // Automatic container resize check to handle dynamic display transitions
    if (this.container && this.renderer && this.camera) {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      const canvas = this.renderer.domElement;
      
      if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
      }
    }

    // Update GLB animations
    if (this.mixer) {
      const delta = this.clock.getDelta();
      this.mixer.update(delta);
    }

    const rotSpeed = (this.mode === 'dashboard') ? 0.0012 : 0.0003;

    if (this.sunMesh) {
      // Rotate the Sun mesh on its axis
      const sun = this.sunMesh.getObjectByName('Sun') || this.sunMesh.getObjectByName('sun') || this.sunMesh.getObjectByProperty('isMesh', true);
      if (sun) {
        sun.rotation.y += rotSpeed;
      } else {
        this.sunMesh.rotation.y += rotSpeed;
      }
    }

    // Rotate hotspots and loops to remain in sync with the Sun's rotation
    if (this.hotspotsGroup) {
      this.hotspotsGroup.rotation.y += rotSpeed;
    }

    if (this.controls) {
      this.controls.update();
    }

    // Pulse active region rings
    const time = Date.now() * 0.0035;
    this.activeRegionGroups.forEach(group => {
      if (group.children[1]) {
        const scale = 1.0 + Math.sin(time) * 0.12;
        group.children[1].scale.set(scale, scale, 1.0);
      }
    });

    // Particle simulation
    for (let i = this.flareParticles.length - 1; i >= 0; i--) {
      const p = this.flareParticles[i];
      p.mesh.position.add(p.velocity);
      p.life -= p.decay;
      p.mesh.material.opacity = p.life;
      p.mesh.scale.set(p.life, p.life, p.life);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.flareParticles.splice(i, 1);
      }
    }

    // Update target HUD overlays in screen space
    if (this.selectedRegionGroup && this.hudElement) {
      // Force update world matrices so we project the exact coordinate of the current frame
      this.selectedRegionGroup.updateMatrixWorld(true);

      const worldPos = new THREE.Vector3();
      this.selectedRegionGroup.getWorldPosition(worldPos);

      // Check if the selected region has rotated to the back hemisphere
      const normal = worldPos.clone().normalize();
      const cameraDir = this.camera.position.clone().normalize();
      const dot = normal.dot(cameraDir);

      if (dot < 0.0) {
        this.hudElement.style.display = 'none';
      } else {
        this.hudElement.style.display = 'flex';
        const screenPos = this.project3DTo2D(worldPos);
        this.hudElement.style.position = 'absolute';
        this.hudElement.style.left = `${screenPos.x}px`;
        this.hudElement.style.top = `${screenPos.y}px`;
        this.hudElement.style.right = 'auto';
        this.hudElement.style.bottom = 'auto';
        this.hudElement.style.transform = 'translate(-29px, -29px)';
      }
    } else if (this.hudElement) {
      this.hudElement.style.display = 'none';
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
