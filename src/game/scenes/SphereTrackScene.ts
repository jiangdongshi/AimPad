import * as BABYLON from '@babylonjs/core';
import { BaseScene } from './BaseScene';
import { GameEngine } from '../engine/GameEngine';
import { calculateSmoothness } from '@/utils/scoring';

interface SphereTrackConfig {
  targetSize: number;
  targetSpeed: number;
  duration: number;
  trackRadius: number;
}

const DEFAULT_CONFIG: SphereTrackConfig = {
  targetSize: 1.2,
  targetSpeed: 3,
  duration: 30000,
  trackRadius: 4,
};

export class SphereTrackScene extends BaseScene {
  private config: SphereTrackConfig;
  private trackingTarget: BABYLON.Mesh | null = null;
  private cursorPositions: { x: number; y: number }[] = [];
  private targetPositions: { x: number; y: number }[] = [];
  private angle: number = 0;
  private trackingScore: number = 0;

  constructor(engine: GameEngine, config?: Partial<SphereTrackConfig>) {
    super(engine, 'sphere-track');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async setup() {
    // 创建训练场地面
    this.createGround(20, 20);

    // 创建圆形轨道参考线
    this.createTrackGuide();

    // 创建跟踪目标
    this.createTrackingTarget();
  }

  update(deltaTime: number) {
    if (!this.isActive || !this.trackingTarget) return;

    const now = performance.now();

    // 更新目标位置（圆形运动）
    this.angle += this.config.targetSpeed * deltaTime / 1000;
    const radius = this.config.trackRadius;
    const x = Math.cos(this.angle) * radius;
    const y = Math.sin(this.angle) * (radius * 0.6) + 4;
    const z = 8;

    this.trackingTarget.position.x = x;
    this.trackingTarget.position.y = y;
    this.trackingTarget.position.z = z;

    // 记录位置用于计算平滑度
    const screenPos = this.worldToScreen(this.trackingTarget.position);
    this.targetPositions.push(screenPos);

    // 记录准星位置
    this.cursorPositions.push({
      x: this.scene.pointerX,
      y: this.scene.pointerY,
    });

    // 检查训练时间
    if (now - this.startTime > this.config.duration) {
      this.stop();
    }
  }

  private createTrackingTarget() {
    this.trackingTarget = BABYLON.MeshBuilder.CreateSphere(
      'trackTarget',
      { diameter: this.config.targetSize },
      this.scene
    );
    this.trackingTarget.position = new BABYLON.Vector3(0, 4, 8);

    // 跟踪目标材质（绿色）
    const material = new BABYLON.StandardMaterial('trackTargetMat', this.scene);
    material.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
    material.diffuseColor = new BABYLON.Color3(0, 0.8, 0.3);
    material.alpha = 0.8;
    this.trackingTarget.material = material;

    // 光晕
    const glowLayer = new BABYLON.GlowLayer('glow', this.scene);
    glowLayer.intensity = 0.3;
  }

  private createTrackGuide() {
    const points: BABYLON.Vector3[] = [];
    const segments = 64;
    const radius = this.config.trackRadius;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new BABYLON.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * (radius * 0.6) + 4,
        8
      ));
    }

    const trackLine = BABYLON.MeshBuilder.CreateLines(
      'trackGuide',
      { points },
      this.scene
    );
    trackLine.color = new BABYLON.Color3(0.15, 0.15, 0.2);
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
