/**
 * 自定义训练场景
 * 基于 SceneConfig 配置驱动的通用场景类
 */

import * as BABYLON from '@babylonjs/core';
import { BaseScene } from './BaseScene';
import { GameEngine } from '../engine/GameEngine';
import type { SceneConfig } from '@/types/customTask';

const DEFAULT_CONFIG: SceneConfig = {
  name: 'Custom Task',
  description: 'Custom training task',
  category: 'static-clicking',
  duration: 30000,
  target: {
    shape: 'sphere',
    size: 0.8,
    color: '#ADD8E6',
    glowIntensity: 0.5,
    emissive: true,
  },
  movement: {
    type: 'static',
    speed: 3,
    bounds: { xMin: -5, xMax: 5, yMin: 3, yMax: 8 },
  },
  spawn: {
    mode: 'interval',
    interval: 800,
    maxActive: 3,
    lifetime: 0,
    staggerDelay: 0,
  },
  display: {
    rows: 3,
    cols: 5,
    showLines: true,
    lineColor: '#333344',
    wallColor: '#1a1a2e',
    wallHeight: 10,
  },
  scoring: {
    weightAccuracy: 0.4,
    weightSpeed: 0.4,
    weightConsistency: 0.2,
  },
};

export class CustomScene extends BaseScene {
  private config: SceneConfig;
  private gridLines: BABYLON.LinesMesh[] = [];
  private trackGuide: BABYLON.LinesMesh | null = null;
  private lastSpawnTime: number = 0;
  private cursorPositions: { x: number; y: number }[] = [];
  private targetPositions: { x: number; y: number }[] = [];
  private trackingScore: number = 0;

  // 运动相关状态
  private movementPhase: number = 0;

  constructor(engine: GameEngine, config: SceneConfig, taskId?: string) {
    super(engine, taskId || `custom-${Date.now()}`);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async setup() {
    // 创建地面
    this.createGround(20, 20);

    // 初始化对象池（复用 BaseScene 的池化机制，避免每次生成创建新 Mesh 造成 GC 卡顿）
    this.initTargetPool();

    // 创建显示元素（网格或轨道）
    if (this.config.display?.showLines) {
      this.createDisplayElements();
    }

    // 设置目标颜色
    if (this.config.target.color) {
      this.setTargetColor(this.config.target.color);
    }

    // 初始生成目标
    if (this.config.spawn.mode === 'continuous') {
      // continuous 模式只生成一个
      if (this.config.spawn.maxActive >= 1) {
        this.spawnInitialTarget();
      }
    } else {
      // interval/burst 模式生成多个
      for (let i = 0; i < this.config.spawn.maxActive; i++) {
        this.spawnRandomTarget();
      }
    }
  }

  private createDisplayElements() {
    const display = this.config.display!;
    const gridZ = 8;

    if (this.isTrackingType()) {
      // 跟踪类型显示轨道
      this.createTrackGuide();
    } else {
      // 网格类型显示网格线
      const gridColor = this.hexToColor3(display.lineColor);

      // 垂直线
      for (let i = 0; i <= display.cols; i++) {
        const x = (i - display.cols / 2) * (14 / display.cols);
        const line = BABYLON.MeshBuilder.CreateLines(
          `gridLineV${i}`,
          {
            points: [
              new BABYLON.Vector3(x, 2, gridZ),
              new BABYLON.Vector3(x, 2 + display.wallHeight, gridZ),
            ],
          },
          this.scene
        );
        line.color = gridColor;
        this.gridLines.push(line);
      }

      // 水平线
      for (let i = 0; i <= display.rows; i++) {
        const y = i * (display.wallHeight / display.rows) + 2;
        const line = BABYLON.MeshBuilder.CreateLines(
          `gridLineH${i}`,
          {
            points: [
              new BABYLON.Vector3(-7, y, gridZ),
              new BABYLON.Vector3(7, y, gridZ),
            ],
          },
          this.scene
        );
        line.color = gridColor;
        this.gridLines.push(line);
      }

      // 后墙背景
      const backWall = BABYLON.MeshBuilder.CreatePlane(
        'backWall',
        { width: 16, height: display.wallHeight },
        this.scene
      );
      backWall.position = new BABYLON.Vector3(0, 2 + display.wallHeight / 2, gridZ + 0.01);

      const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
      wallMat.diffuseColor = this.wallColor ?? this.hexToColor3(display.wallColor);
      wallMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
      wallMat.backFaceCulling = false;
      backWall.material = wallMat;
      this.registerWallMaterial(wallMat);
    }

    this.createBoxWalls({
      width: 16,
      height: display.wallHeight,
      depth: 8,
      yOffset: 2,
    });
  }

  private createTrackGuide() {
    const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
    const gridColor = this.hexToColor3(this.config.display?.lineColor || '#333344');
    const points: BABYLON.Vector3[] = [];
    const segments = 64;

    const centerX = (bounds.xMin + bounds.xMax) / 2;
    const centerY = (bounds.yMin + bounds.yMax) / 2;
    const radiusX = (bounds.xMax - bounds.xMin) / 2;
    const radiusY = (bounds.yMax - bounds.yMin) / 2;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new BABYLON.Vector3(
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY,
        8
      ));
    }

    this.trackGuide = BABYLON.MeshBuilder.CreateLines(
      'trackGuide',
      { points },
      this.scene
    );
    this.trackGuide.color = gridColor;
  }

  private isTrackingType(): boolean {
    return ['circular', 'sine', 'figure8', 'linear'].includes(this.config.movement.type);
  }

  update(deltaTime: number) {
    if (!this.isActive) return;

    const now = performance.now();

    // 检查过期目标
    this.checkExpiredTargets();

    // 更新移动目标位置
    if (this.isTrackingType()) {
      this.updateMovingTarget(deltaTime);
    }

    // 生成新目标
    this.handleSpawning(now);

    // 记录跟踪数据
    if (this.isTrackingType() && this.targets.length > 0) {
      const target = this.targets[0];
      const screenPos = this.worldToScreen(target.position);
      this.targetPositions.push(screenPos);
      this.cursorPositions.push({
        x: this.scene.pointerX,
        y: this.scene.pointerY,
      });
    }

    // 检查训练时间
    const duration = this.config.duration || 0;
    if (duration > 0 && now - this.startTime > duration) {
      this.stop();
    }
  }

  private updateMovingTarget(deltaTime: number) {
    if (this.targets.length === 0) return;

    const target = this.targets[0];
    const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
    const speed = this.config.movement.speed;
    const type = this.config.movement.type;

    this.movementPhase += speed * deltaTime / 1000;

    let x: number, y: number;
    const centerX = (bounds.xMin + bounds.xMax) / 2;
    const centerY = (bounds.yMin + bounds.yMax) / 2;
    const radiusX = (bounds.xMax - bounds.xMin) / 2;
    const radiusY = (bounds.yMax - bounds.yMin) / 2;

    switch (type) {
      case 'circular':
        x = centerX + Math.cos(this.movementPhase) * radiusX;
        y = centerY + Math.sin(this.movementPhase) * radiusY;
        break;

      case 'sine':
        x = centerX + Math.cos(this.movementPhase) * radiusX;
        y = centerY + Math.sin(this.movementPhase * 2) * radiusY;
        break;

      case 'figure8':
        x = centerX + Math.cos(this.movementPhase) * radiusX;
        y = centerY + Math.sin(this.movementPhase * 2) * radiusY * 0.5;
        break;

      case 'linear':
        // 左右往返
        const range = radiusX;
        const t = (this.movementPhase % (2 * Math.PI)) / (2 * Math.PI);
        x = centerX + (t < 0.5 ? t * 4 - 1 : 3 - t * 4) * range;
        y = centerY;
        break;

      case 'random':
        // 随机移动（简化版）
        if (!target.metadata?.targetX) {
          target.metadata.targetX = centerX + (Math.random() - 0.5) * radiusX * 2;
          target.metadata.targetY = centerY + (Math.random() - 0.5) * radiusY * 2;
        }
        const dx = target.metadata.targetX - target.position.x;
        const dy = target.metadata.targetY - target.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.3) {
          target.metadata.targetX = centerX + (Math.random() - 0.5) * radiusX * 2;
          target.metadata.targetY = centerY + (Math.random() - 0.5) * radiusY * 2;
        }
        x = target.position.x + (dx / dist) * speed * deltaTime / 500;
        y = target.position.y + (dy / dist) * speed * deltaTime / 500;
        break;

      default: // static
        return;
    }

    target.position.x = x;
    target.position.y = y;
    target.position.z = 8;
  }

  private handleSpawning(now: number) {
    const { mode, maxActive, interval } = this.config.spawn;

    if (mode === 'continuous') {
      // continuous 模式只有一个目标，不重新生成
      return;
    }

    // 检查是否需要补充目标
    if (this.targets.length >= maxActive) return;

    // 检查间隔
    if (now - this.lastSpawnTime < interval) return;

    // 生成新目标
    this.spawnRandomTarget();
    this.lastSpawnTime = now;
  }

  private spawnInitialTarget() {
    const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
    const centerX = (bounds.xMin + bounds.xMax) / 2;
    const centerY = (bounds.yMin + bounds.yMax) / 2;

    const position = new BABYLON.Vector3(centerX, centerY, 8);
    this.spawnTarget(position, this.config.target.size);
  }

  private spawnRandomTarget() {
    const { type } = this.config.movement;
    const bounds = this.config.movement.bounds || { xMin: -5, xMax: 5, yMin: 3, yMax: 8 };
    const display = this.config.display;

    let position: BABYLON.Vector3;

    if (type === 'static' && display) {
      // 网格中随机位置
      const { rows, cols } = display;
      const cellWidth = 14 / cols;
      const cellHeight = display.wallHeight / rows;

      const row = Math.floor(Math.random() * rows);
      const col = Math.floor(Math.random() * cols);

      const x = (col - cols / 2 + 0.5) * cellWidth;
      const y = row * cellHeight + 2 + cellHeight / 2;
      position = new BABYLON.Vector3(x, y, 8);
    } else {
      // 运动范围内随机位置
      const x = bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin);
      const y = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
      position = new BABYLON.Vector3(x, y, 8);
    }

    const actualSize = this.config.target.size * this.targetSizeMultiplier;
    this.spawnTarget(position, actualSize);
  }

  protected calculateScore(): number {
    if (this.isTrackingType()) {
      // 跟踪类型计算平滑度
      if (this.cursorPositions.length < 3) return 0;
      return Math.round(this.trackingScore * 100);
    } else {
      // 静态类型计算准确率
      return super.calculateScore();
    }
  }

  stop() {
    this.isActive = false;

    if (this.isTrackingType() && this.cursorPositions.length >= 3) {
      this.trackingScore = this.calculateTrackingSmoothness();
    }

    const avgReaction = this.reactionTimes.length > 0
      ? this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length
      : 0;

    return {
      id: `${this.taskId}-${Date.now()}`,
      taskId: this.taskId,
      timestamp: Date.now(),
      score: this.calculateScore(),
      accuracy: this.hits + this.misses > 0
        ? (this.hits / (this.hits + this.misses)) * 100
        : 0,
      reactionTime: avgReaction,
      reactionTimes: this.reactionTimes,
      kills: this.hits,
      misses: this.misses,
      duration: performance.now() - this.startTime,
    };
  }

  private calculateTrackingSmoothness(): number {
    if (this.cursorPositions.length < 3 || this.targetPositions.length < 3) return 0;

    // 计算 jerk（加加速度）
    let totalJerk = 0;
    const minLen = Math.min(this.cursorPositions.length, this.targetPositions.length);

    for (let i = 2; i < minLen; i++) {
      const dx1 = this.cursorPositions[i - 1].x - this.cursorPositions[i - 2].x;
      const dy1 = this.cursorPositions[i - 1].y - this.cursorPositions[i - 2].y;
      const dx2 = this.cursorPositions[i].x - this.cursorPositions[i - 1].x;
      const dy2 = this.cursorPositions[i].y - this.cursorPositions[i - 1].y;
      const jerk = Math.sqrt((dx2 - dx1) ** 2 + (dy2 - dy1) ** 2);
      totalJerk += jerk;
    }

    // 计算跟踪误差
    let totalError = 0;
    for (let i = 0; i < minLen; i++) {
      const dx = this.cursorPositions[i].x - this.targetPositions[i].x;
      const dy = this.cursorPositions[i].y - this.targetPositions[i].y;
      totalError += Math.sqrt(dx * dx + dy * dy);
    }
    const avgError = totalError / minLen;

    // 计算平滑度分数
    return Math.max(0, 100 / (1 + totalJerk * 0.1 + avgError * 0.05));
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

  private hexToColor3(hex: string): BABYLON.Color3 {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new BABYLON.Color3(r, g, b);
  }

  dispose() {
    this.gridLines.forEach(l => l.dispose());
    this.trackGuide?.dispose();
    super.dispose();
  }
}
