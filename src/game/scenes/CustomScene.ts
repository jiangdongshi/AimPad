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

  // 追踪类实时计分（与球体追踪/平移追踪一致：准星靠近目标即计分）
  private realtimeScore: number = 0;
  private readonly TRACK_THRESHOLD = 100; // 屏幕像素阈值

  // 运动相关状态
  private movementPhase: number = 0;

  // 格子占用追踪（静态点击类型使用，与 GridshotScene 逻辑一致）
  private occupiedCells = new Map<string, BABYLON.Mesh>();
  private static readonly SPAWN_COOLDOWN_MS = 50;

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
    for (let i = 0; i < this.config.spawn.maxActive; i++) {
      this.spawnRandomTarget();
    }
  }

  start() {
    this.realtimeScore = 0;
    this.resetStats();
    this.startTime = performance.now();
    this.isActive = true;
    this.lastTargetSpawnTime = this.startTime;

    // 追踪类型使用准星重叠实时计分，不启用射击逻辑
    if (this.config.category !== 'tracking') {
      this.setupShooting();
    }
  }

  protected tryShoot() {
    // 追踪类不响应点击射击，仅靠准星接近累计计分
    if (this.config.category === 'tracking') return false;
    return super.tryShoot();
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
      yOffset: 1,
    });
  }

  private createTrackGuide() {
    const gridColor = this.hexToColor3(this.config.display?.lineColor || '#333344');
    const points: BABYLON.Vector3[] = [];

    if (this.config.movement.type === 'linear') {
      // 线性运动：根据方向绘制直线轨道
      const [start, end] = this.getLinearGuideEndpoints();
      points.push(start, end);
    } else {
      // 圆形/正弦/8字运动：绘制椭圆轨道
      const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
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

  private isStaticType(): boolean {
    return this.config.movement.type === 'static';
  }

  /** 获取当前未被占用的格子列表（静态点击类型使用） */
  private getAvailableCells(rows: number, cols: number): [number, number][] {
    const cells: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!this.occupiedCells.has(`${r},${c}`)) {
          cells.push([r, c]);
        }
      }
    }
    return cells;
  }

  protected onTargetHit(mesh: BABYLON.Mesh) {
    // 静态点击类型：先释放格子占用（与 GridshotScene 逻辑一致）
    if (this.isStaticType()) {
      const cellKey = mesh.metadata?.cellKey as string | undefined;
      if (cellKey) {
        this.occupiedCells.delete(cellKey);
      }
    }
    super.onTargetHit(mesh);
    // 立即补充一个新目标，无延迟
    this.spawnRandomTarget();
  }

  update(deltaTime: number) {
    if (!this.isActive) return;

    const now = performance.now();

    // 更新移动目标位置（动态点击和跟踪类型都需要）
    if (this.isTrackingType()) {
      this.updateMovingTarget(deltaTime);
    }

    // 生成新目标
    this.handleSpawning(now);

    // 追踪类型：实时累计追踪得分（准星与目标距离越近得分越高，与球体追踪/平移追踪一致）
    if (this.config.category === 'tracking' && this.targets.length > 0) {
      const target = this.targets[0];
      const screenPos = this.worldToScreen(target.position);

      // 准星固定在屏幕中央
      const renderWidth = this.scene.getEngine().getRenderWidth();
      const renderHeight = this.scene.getEngine().getRenderHeight();
      const crosshairX = renderWidth / 2;
      const crosshairY = renderHeight / 2;

      const dx = crosshairX - screenPos.x;
      const dy = crosshairY - screenPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.TRACK_THRESHOLD) {
        const normalizedScore = 1 - distance / this.TRACK_THRESHOLD;
        this.realtimeScore += normalizedScore * (deltaTime / 1000) * 100;
      }
    }

    // 检查训练时间
    const duration = this.config.duration || 0;
    if (duration > 0 && now - this.startTime > duration) {
      this.stop();
    }
  }

  /** 根据运动类型和相位计算目标位置（用于生成和更新） */
  private getMovementPosition(phase: number): { x: number; y: number } | null {
    const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
    const type = this.config.movement.type;
    const direction = this.config.movement.direction || 'horizontal';

    const centerX = (bounds.xMin + bounds.xMax) / 2;
    const centerY = (bounds.yMin + bounds.yMax) / 2;
    const radiusX = (bounds.xMax - bounds.xMin) / 2;
    const radiusY = (bounds.yMax - bounds.yMin) / 2;

    let x: number, y: number;

    switch (type) {
      case 'circular':
        x = centerX + Math.cos(phase) * radiusX;
        y = centerY + Math.sin(phase) * radiusY;
        break;

      case 'sine':
        x = centerX + Math.cos(phase) * radiusX;
        y = centerY + Math.sin(phase * 2) * radiusY;
        break;

      case 'figure8':
        x = centerX + Math.cos(phase) * radiusX;
        y = centerY + Math.sin(phase * 2) * radiusY * 0.5;
        break;

      case 'linear': {
        const t = (phase % (2 * Math.PI)) / (2 * Math.PI);
        const offset = t < 0.5 ? t * 4 - 1 : 3 - t * 4; // -1 ~ 1 往返
        switch (direction) {
          case 'vertical':
            x = centerX;
            y = centerY + offset * radiusY;
            break;
          case 'diagonal-tl-br':
            // 左上 ↔ 右下
            x = centerX + offset * radiusX;
            y = centerY - offset * radiusY;
            break;
          case 'diagonal-tr-bl':
            // 右上 ↔ 左下
            x = centerX - offset * radiusX;
            y = centerY - offset * radiusY;
            break;
          default: // 'horizontal'
            x = centerX + offset * radiusX;
            y = centerY;
            break;
        }
        break;
      }

      default: // static / random
        return null;
    }

    return { x, y };
  }

  /** 获取线性运动的轨道起始方向向量（用于轨道指引线绘制） */
  private getLinearGuideEndpoints(): [BABYLON.Vector3, BABYLON.Vector3] {
    const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
    const direction = this.config.movement.direction || 'horizontal';
    const centerX = (bounds.xMin + bounds.xMax) / 2;
    const centerY = (bounds.yMin + bounds.yMax) / 2;
    const radiusX = (bounds.xMax - bounds.xMin) / 2;
    const radiusY = (bounds.yMax - bounds.yMin) / 2;

    switch (direction) {
      case 'vertical':
        return [
          new BABYLON.Vector3(centerX, centerY - radiusY, 8),
          new BABYLON.Vector3(centerX, centerY + radiusY, 8),
        ];
      case 'diagonal-tl-br':
        return [
          new BABYLON.Vector3(centerX - radiusX, centerY + radiusY, 8),
          new BABYLON.Vector3(centerX + radiusX, centerY - radiusY, 8),
        ];
      case 'diagonal-tr-bl':
        return [
          new BABYLON.Vector3(centerX + radiusX, centerY + radiusY, 8),
          new BABYLON.Vector3(centerX - radiusX, centerY - radiusY, 8),
        ];
      default: // 'horizontal'
        return [
          new BABYLON.Vector3(centerX - radiusX, centerY, 8),
          new BABYLON.Vector3(centerX + radiusX, centerY, 8),
        ];
    }
  }

  private updateMovingTarget(deltaTime: number) {
    if (this.targets.length === 0) return;

    const target = this.targets[0];
    const speed = this.config.movement.speed;
    const type = this.config.movement.type;
    const randomness = this.config.movement.randomness ?? 0;
    const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
    const radiusX = (bounds.xMax - bounds.xMin) / 2;
    const radiusY = (bounds.yMax - bounds.yMin) / 2;

    this.movementPhase += speed * deltaTime / 1000;

    if (type === 'random') {
      // 随机移动单独处理（需要目标当前位置状态）
      const centerX = (bounds.xMin + bounds.xMax) / 2;
      const centerY = (bounds.yMin + bounds.yMax) / 2;
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
      let rx = target.position.x + (dx / dist) * speed * deltaTime / 500;
      let ry = target.position.y + (dy / dist) * speed * deltaTime / 500;
      rx = Math.max(bounds.xMin, Math.min(bounds.xMax, rx));
      ry = Math.max(bounds.yMin, Math.min(bounds.yMax, ry));
      target.position.x = rx;
      target.position.y = ry;
      target.position.z = 8;
      return;
    }

    const pos = this.getMovementPosition(this.movementPhase);
    if (!pos) return;

    let { x, y } = pos;

    // 叠加路径噪声（随机度 > 0 时）
    if (randomness > 0) {
      const noiseScale = (randomness / 100) * Math.min(radiusX, radiusY) * 0.5;
      const time = this.movementPhase;
      const noiseX = (Math.sin(time * 1.7 + 0.3) * 0.4 + Math.sin(time * 3.1 + 1.7) * 0.3 + Math.sin(time * 5.3 + 2.9) * 0.3) * noiseScale;
      const noiseY = (Math.sin(time * 2.3 + 1.1) * 0.4 + Math.sin(time * 4.7 + 0.5) * 0.3 + Math.sin(time * 6.1 + 3.7) * 0.3) * noiseScale;
      x += noiseX;
      y += noiseY;
    }

    // 限制在边界内
    x = Math.max(bounds.xMin, Math.min(bounds.xMax, x));
    y = Math.max(bounds.yMin, Math.min(bounds.yMax, y));

    target.position.x = x;
    target.position.y = y;
    target.position.z = 8;
  }

  private handleSpawning(now: number) {
    const { maxActive } = this.config.spawn;

    // 检测场上活跃目标数量（与 GridshotScene 逻辑一致）
    const missingCount = maxActive - this.targets.length;

    // 当目标数不足时，优先补充（快速响应，无冷却延迟）
    if (missingCount > 0 && now - this.lastSpawnTime >= CustomScene.SPAWN_COOLDOWN_MS) {
      if (this.spawnRandomTarget()) {
        this.lastSpawnTime = now;
      }
      // 如果生成失败（无空格子），不更新 lastSpawnTime，下一帧会重试
    }
  }

  /** 生成目标，返回是否成功（无空格子时返回 false） */
  private spawnRandomTarget(): boolean {
    const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
    const display = this.config.display;
    const actualSize = this.config.target.size;

    if (this.isStaticType() && display) {
      // 静态点击类型：使用格子占用追踪（与 GridshotScene 逻辑一致）
      const { rows, cols } = display;
      const availableCells = this.getAvailableCells(rows, cols);

      if (availableCells.length === 0) return false;

      const [row, col] = availableCells[Math.floor(Math.random() * availableCells.length)];
      const cellWidth = 14 / cols;
      const cellHeight = display.wallHeight / rows;

      const x = (col - cols / 2 + 0.5) * cellWidth;
      const y = row * cellHeight + 2 + cellHeight / 2;

      const mesh = this.spawnTarget(new BABYLON.Vector3(x, y, 8), actualSize);
      const cellKey = `${row},${col}`;
      mesh.metadata = { ...mesh.metadata, cellKey };
      this.occupiedCells.set(cellKey, mesh);

      return true;
    } else {
      // 运动类型：根据当前运动状态计算正确位置，避免闪烁
      const pos = this.getMovementPosition(this.movementPhase);
      const x = pos ? pos.x : bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin);
      const y = pos ? pos.y : bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
      const position = new BABYLON.Vector3(x, y, 8);

      try {
        this.spawnTarget(position, actualSize);
        return true;
      } catch {
        return false;
      }
    }
  }

  protected calculateScore(): number {
    // 追踪类型使用准星接近实时累计计分
    if (this.config.category === 'tracking') {
      return Math.round(this.realtimeScore);
    }
    // 其他类型（静态点击、动态点击、目标切换、反应训练）计算准确率
    return super.calculateScore();
  }

  getStats() {
    if (this.config.category === 'tracking') {
      return {
        hits: 0,
        misses: 0,
        reactionTimes: [],
        realtimeScore: this.realtimeScore,
        isTracking: true,
      };
    }
    return super.getStats();
  }

  stop() {
    this.isActive = false;

    const avgReaction = this.reactionTimes.length > 0
      ? this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length
      : 0;

    // 追踪类型不展示命中/脱靶
    if (this.config.category === 'tracking') {
      return {
        id: `${this.taskId}-${Date.now()}`,
        taskId: this.taskId,
        timestamp: Date.now(),
        score: this.calculateScore(),
        accuracy: 0,
        reactionTime: 0,
        reactionTimes: [],
        kills: 0,
        misses: 0,
        duration: performance.now() - this.startTime,
      };
    }

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
    this.occupiedCells.clear();
    this.gridLines.forEach(l => l.dispose());
    this.trackGuide?.dispose();
    super.dispose();
  }
}
