import * as BABYLON from '@babylonjs/core';
import { BaseScene } from './BaseScene';
import { GameEngine } from '../engine/GameEngine';
import { calculateSmoothness } from '@/utils/scoring';
import { getSceneGridColor, getSceneWallColor } from '@/utils/themeColors';

interface SphereTrackConfig {
  targetSize: number;
  targetSpeed: number;
  duration: number;
  trackRadius: number;
  movementType: 'circular' | 'linear' | 'orbital';
}

const DEFAULT_CONFIG: SphereTrackConfig = {
  targetSize: 1.2,
  targetSpeed: 3,
  duration: 30000,
  trackRadius: 4,
  movementType: 'circular',
};

export class SphereTrackScene extends BaseScene {
  private config: SphereTrackConfig;
  private trackingTarget: BABYLON.Mesh | null = null;
  private cursorPositions: { x: number; y: number }[] = [];
  private targetPositions: { x: number; y: number }[] = [];
  private angle: number = 0;
  private trackingScore: number = 0;

  // orbital 模式：随机移动
  private randomVel: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private targetDir: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private readonly RANDOM_SPEED = 5;

  constructor(engine: GameEngine, config?: Partial<SphereTrackConfig>) {
    super(engine, 'sphere-track');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async setup() {
    this.createGround(20, 20);

    // 后墙 16x10，中心在 (0, 6, 8)
    const backWall = BABYLON.MeshBuilder.CreatePlane('backWall', { width: 16, height: 10 }, this.scene);
    backWall.position = new BABYLON.Vector3(0, 6, 8.01);
    const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = this.wallColor ?? getSceneWallColor();
    wallMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    wallMat.backFaceCulling = false;
    backWall.material = wallMat;
    this.registerWallMaterial(wallMat);

    this.createBoxWalls({ width: 16, height: 10, depth: 8, yOffset: 1 });

    this.createTrackGuide();
    this.createTrackingTarget();
  }

  update(deltaTime: number) {
    if (!this.isActive || !this.trackingTarget) return;

    this.angle += this.config.targetSpeed * deltaTime / 1000;
    const radius = this.config.trackRadius;
    let x: number;
    let y: number;
    let z: number;

    if (this.config.movementType === 'linear') {
      x = Math.sin(this.angle) * radius;
      y = 6;
      z = 8;
    } else if (this.config.movementType === 'orbital') {
      // 随机移动：平滑插值到随机目标方向
      const dt = deltaTime / 1000;

      // 每帧有概率换一个新的随机目标方向
      if (Math.random() < dt * 2) {
        this.targetDir = {
          x: Math.random() - 0.5,
          y: Math.random() - 0.5,
          z: Math.random() - 0.5,
        };
        const len = Math.sqrt(this.targetDir.x ** 2 + this.targetDir.y ** 2 + this.targetDir.z ** 2);
        if (len > 0.001) {
          this.targetDir.x /= len;
          this.targetDir.y /= len;
          this.targetDir.z /= len;
        }
      }

      // 软边界：靠近墙壁时平滑偏向中心，避免频繁反弹
      const px = this.trackingTarget.position.x;
      const py = this.trackingTarget.position.y;
      const pz = this.trackingTarget.position.z;
      const margin = 2;
      const cx = 0, cy = 6, cz = 6;
      let biasX = 0, biasY = 0, biasZ = 0;
      if (px < -7.5 + margin) biasX += (-7.5 + margin - px) / margin;
      if (px > 7.5 - margin) biasX += (px - (7.5 - margin)) / margin;
      if (py < 2 + margin) biasY += (2 + margin - py) / margin;
      if (py > 10 - margin) biasY += (py - (10 - margin)) / margin;
      if (pz < 4.5 + margin) biasZ += (4.5 + margin - pz) / margin;
      if (pz > 7.5 - margin) biasZ += (pz - (7.5 - margin)) / margin;
      if (biasX + biasY + biasZ > 0) {
        const toCenterX = cx - px, toCenterY = cy - py, toCenterZ = cz - pz;
        const toCenterLen = Math.sqrt(toCenterX ** 2 + toCenterY ** 2 + toCenterZ ** 2);
        if (toCenterLen > 0.001) {
          const strength = Math.min(biasX + biasY + biasZ, 1) * 0.5;
          this.targetDir.x = this.targetDir.x * (1 - strength) + (toCenterX / toCenterLen) * strength;
          this.targetDir.y = this.targetDir.y * (1 - strength) + (toCenterY / toCenterLen) * strength;
          this.targetDir.z = this.targetDir.z * (1 - strength) + (toCenterZ / toCenterLen) * strength;
          const len = Math.sqrt(this.targetDir.x ** 2 + this.targetDir.y ** 2 + this.targetDir.z ** 2);
          this.targetDir.x /= len;
          this.targetDir.y /= len;
          this.targetDir.z /= len;
        }
      }

      // 平滑转向目标方向
      const t = 1 - Math.pow(0.05, dt);
      this.randomVel.x += (this.targetDir.x * this.RANDOM_SPEED - this.randomVel.x) * t;
      this.randomVel.y += (this.targetDir.y * this.RANDOM_SPEED - this.randomVel.y) * t;
      this.randomVel.z += (this.targetDir.z * this.RANDOM_SPEED - this.randomVel.z) * t;

      // 归一化保持恒定速度，防止转向时减速
      const spd = Math.sqrt(this.randomVel.x ** 2 + this.randomVel.y ** 2 + this.randomVel.z ** 2);
      if (spd > 0.001) {
        this.randomVel.x = (this.randomVel.x / spd) * this.RANDOM_SPEED;
        this.randomVel.y = (this.randomVel.y / spd) * this.RANDOM_SPEED;
        this.randomVel.z = (this.randomVel.z / spd) * this.RANDOM_SPEED;
      }

      x = this.trackingTarget.position.x + this.randomVel.x * dt;
      y = this.trackingTarget.position.y + this.randomVel.y * dt;
      z = this.trackingTarget.position.z + this.randomVel.z * dt;

      // 边界约束
      if (x < -7.5 || x > 7.5 || y < 2 || y > 10 || z < 4.5 || z > 7.5) {
        x = Math.max(-7.5, Math.min(7.5, x));
        y = Math.max(2, Math.min(10, y));
        z = Math.max(4.5, Math.min(7.5, z));
        // 朝向场景中心的方向 + 随机偏移
        const cx = 0, cy = 6, cz = 6;
        let dx = (cx - x) + (Math.random() - 0.5) * 4;
        let dy = (cy - y) + (Math.random() - 0.5) * 4;
        let dz = (cz - z) + (Math.random() - 0.5) * 4;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len > 0.001) { dx /= len; dy /= len; dz /= len; } else { dx = 1; }
        this.targetDir = { x: dx, y: dy, z: dz };
        this.randomVel = { x: dx * this.RANDOM_SPEED, y: dy * this.RANDOM_SPEED, z: dz * this.RANDOM_SPEED };
      }
    } else {
      x = Math.cos(this.angle) * radius;
      y = Math.sin(this.angle) * (radius * 0.5) + 6;
      z = 8;
    }

    this.trackingTarget.position.x = x;
    this.trackingTarget.position.y = y;
    this.trackingTarget.position.z = z;

    const screenPos = this.worldToScreen(this.trackingTarget.position);
    this.targetPositions.push(screenPos);

    this.cursorPositions.push({
      x: this.scene.pointerX,
      y: this.scene.pointerY,
    });
  }

  private createTrackingTarget() {
    this.trackingTarget = BABYLON.MeshBuilder.CreateSphere(
      'trackTarget',
      { diameter: this.config.targetSize * this.targetSizeMultiplier, segments: 16 },
      this.scene
    );
    this.trackingTarget.position = new BABYLON.Vector3(0, 6, 8);

    // 初始化随机速度和目标方向
    this.targetDir = {
      x: Math.random() - 0.5,
      y: Math.random() - 0.5,
      z: Math.random() - 0.5,
    };
    const len = Math.sqrt(this.targetDir.x ** 2 + this.targetDir.y ** 2 + this.targetDir.z ** 2);
    this.targetDir.x /= len;
    this.targetDir.y /= len;
    this.targetDir.z /= len;
    this.randomVel = {
      x: this.targetDir.x * this.RANDOM_SPEED,
      y: this.targetDir.y * this.RANDOM_SPEED,
      z: this.targetDir.z * this.RANDOM_SPEED,
    };

    const material = new BABYLON.StandardMaterial('trackTargetMat', this.scene);
    material.diffuseColor = this.targetColor;
    material.emissiveColor = this.targetColor;
    material.specularColor = BABYLON.Color3.Black();
    material.disableLighting = true;
    this.trackingTarget.material = material;
  }

  private createTrackGuide() {
    if (this.config.movementType === 'orbital') return;

    const points: BABYLON.Vector3[] = [];
    const segments = 64;
    const radius = this.config.trackRadius;

    if (this.config.movementType === 'circular') {
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new BABYLON.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * (radius * 0.5) + 6,
          8
        ));
      }
    }

    if (points.length > 0) {
      const trackLine = BABYLON.MeshBuilder.CreateLines(
        'trackGuide',
        { points },
        this.scene
      );
      trackLine.color = getSceneGridColor();
    }
  }

  private worldToScreen(worldPos: BABYLON.Vector3): { x: number; y: number } {
    const engine = this.scene.getEngine();
    const viewport = this.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const screenPos = BABYLON.Vector3.Project(
      worldPos,
      BABYLON.Matrix.Identity(),
      this.scene.getTransformMatrix(),
      viewport
    );
    return { x: screenPos.x, y: screenPos.y };
  }

  protected calculateScore(): number {
    if (this.cursorPositions.length < 3) return 0;
    this.trackingScore = calculateSmoothness(this.cursorPositions, this.targetPositions);
    return Math.round(this.trackingScore * 100);
  }

  stop() {
    this.isActive = false;
    return {
      id: `sphere-track-${Date.now()}`,
      taskId: this.taskId,
      timestamp: Date.now(),
      score: this.calculateScore(),
      accuracy: this.trackingScore,
      reactionTime: 0,
      reactionTimes: [],
      kills: 0,
      misses: 0,
      duration: performance.now() - this.startTime,
    };
  }

  dispose() {
    this.trackingTarget?.dispose();
    super.dispose();
  }
}
