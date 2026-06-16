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
    hitsToBreak: 1,
    breakMode: 'hits' as const,
    hitTimeMs: 0,
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

    // 设置击破方式
    this.hitsToBreak = Math.max(1, this.config.spawn.hitsToBreak ?? 1);
    this.breakMode = this.config.spawn.breakMode ?? 'hits';
    this.hitTimeMs = this.config.spawn.hitTimeMs ?? 0;

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
    const gridZ = 7.98;

    if (this.isTrackingType()) {
      // 跟踪类型不显示轨道线
    } else {
      // 网格类型显示网格线（与 GridshotScene 完全一致：14×8 网格区域，x∈[-7,7], y∈[2,10]）
      const gridColor = this.hexToColor3(display.lineColor);
      const gridWidth = 14;   // 与 GridshotScene 一致
      const gridHeight = 8;   // 与 GridshotScene 一致
      const gridLeft = -7;    // gridWidth/2
      const gridBottom = 2;   // 与 GridshotScene 一致

      // 垂直线
      for (let i = 0; i <= display.cols; i++) {
        const x = (i - display.cols / 2) * (gridWidth / display.cols);
        const line = BABYLON.MeshBuilder.CreateLines(
          `gridLineV${i}`,
          {
            points: [
              new BABYLON.Vector3(x, gridBottom, gridZ),
              new BABYLON.Vector3(x, gridBottom + gridHeight, gridZ),
            ],
          },
          this.scene
        );
        line.color = gridColor;
        this.gridLines.push(line);
      }

      // 水平线
      for (let i = 0; i <= display.rows; i++) {
        const y = i * (gridHeight / display.rows) + gridBottom;
        const line = BABYLON.MeshBuilder.CreateLines(
          `gridLineH${i}`,
          {
            points: [
              new BABYLON.Vector3(gridLeft, y, gridZ),
              new BABYLON.Vector3(gridLeft + gridWidth, y, gridZ),
            ],
          },
          this.scene
        );
        line.color = gridColor;
        this.gridLines.push(line);
      }

      // 后墙背景（覆盖房间盒子完整高度）
      const backWallHeight = display.wallHeight + 2;
      const backWall = BABYLON.MeshBuilder.CreatePlane(
        'backWall',
        { width: 16, height: backWallHeight },
        this.scene
      );
      backWall.position = new BABYLON.Vector3(0, backWallHeight / 2 - 1, gridZ + 0.03);

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
    // 先记录击中（父类根据 hitsToBreak 决定是否移除目标）
    const cellKey = this.isStaticType() ? (mesh.metadata?.cellKey as string | undefined) : undefined;
    super.onTargetHit(mesh);
    // 如果目标被移除，释放格子
    if (cellKey && !this.targets.includes(mesh)) {
      this.occupiedCells.delete(cellKey);
    }
  }

  protected onTargetBroken(_mesh: BABYLON.Mesh) {
    // 目标被击破后补充新目标
    this.spawnRandomTarget();
  }

  update(deltaTime: number) {
    if (!this.isActive) return;

    const now = performance.now();

    // 更新移动目标位置（动态点击和跟踪类型都需要，random 类型也需要）
    if (this.isTrackingType() || this.config.movement.type === 'random') {
      this.updateMovingTarget(deltaTime);
    }

    // 生成新目标
    this.handleSpawning(now);

    // 追踪类型：实时累计追踪得分 + 受击时间检测
    if (this.config.category === 'tracking' && this.targets.length > 0) {
      const target = this.targets[0];
      const screenPos = this.worldToScreen(target.position);

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

        // 受击时间累积
        if (this.breakMode === 'time') {
          this.checkHitTime(target, deltaTime);
        }
      }
    }

    // 目标切换类型（时间模式）：检测准星落在哪个目标上，累积受击时间
    if (this.config.category === 'target-switching' && this.breakMode === 'time' && this.targets.length > 0) {
      const renderWidth = this.scene.getEngine().getRenderWidth();
      const renderHeight = this.scene.getEngine().getRenderHeight();
      const crosshairX = renderWidth / 2;
      const crosshairY = renderHeight / 2;
      const threshold = this.TRACK_THRESHOLD * 0.8; // 比追踪稍严格

      for (const target of this.targets) {
        const screenPos = this.worldToScreen(target.position);
        const dx = crosshairX - screenPos.x;
        const dy = crosshairY - screenPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < threshold) {
          if (this.checkHitTime(target, deltaTime)) break; // 击破一个就停止检查
        }
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

  private updateMovingTarget(deltaTime: number) {
    if (this.targets.length === 0) return;

    const speed = this.config.movement.speed;
    const type = this.config.movement.type;
    const randomness = this.config.movement.randomness ?? 0;
    const bounds = this.config.movement.bounds || { xMin: -4, xMax: 4, yMin: 4, yMax: 8 };
    const radiusX = (bounds.xMax - bounds.xMin) / 2;
    const radiusY = (bounds.yMax - bounds.yMin) / 2;

    this.movementPhase += speed * deltaTime / 1000;

    // 非追踪类型（动态点击）：所有目标各自独立移动，使用不同相位偏移
    if (this.config.category === 'dynamic-clicking' && type === 'linear') {
      const direction = this.config.movement.direction || 'horizontal';
      for (let i = 0; i < this.targets.length; i++) {
        const target = this.targets[i];
        // 每个目标有独立的相位偏移，使它们在不同位置
        const phaseOffset = (target.metadata?.phaseOffset as number) ?? (i * Math.PI * 2 / this.targets.length);
        const pos = this.getMovementPosition(this.movementPhase + phaseOffset);
        if (!pos) continue;

        let { x, y } = pos;

        // 水平移动时使用独立 y 偏移；垂直移动时使用独立 x 偏移
        if (direction === 'horizontal') {
          y = target.metadata?.baseY ?? y;
        } else if (direction === 'vertical') {
          x = target.metadata?.baseX ?? x;
        }

        x = Math.max(bounds.xMin, Math.min(bounds.xMax, x));
        y = Math.max(bounds.yMin, Math.min(bounds.yMax, y));

        target.position.x = x;
        target.position.y = y;
        target.position.z = 8;
      }
      return;
    }

    // 动态点击 + 随机：所有目标各自独立随机移动
    if (this.config.category === 'dynamic-clicking' && type === 'random') {
      const centerX = (bounds.xMin + bounds.xMax) / 2;
      const centerY = (bounds.yMin + bounds.yMax) / 2;
      const randomMode = this.config.movement.randomMode || 'full';
      const ratio = this.config.movement.randomLinearRatio ?? 0.5;
      const cycleDuration = 2000 / speed;
      const randomDuration = cycleDuration * ratio;
      const linearDuration = cycleDuration * (1 - ratio);
      const targetSize = this.config.target.size;
      const waypointMinDist = targetSize * 3;

      const pickSeparatedWaypoint = (current: BABYLON.Mesh): { wx: number; wy: number } => {
        const maxRetries = 10;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const wx = centerX + (Math.random() - 0.5) * radiusX * 2;
          const wy = centerY + (Math.random() - 0.5) * radiusY * 2;
          let tooClose = false;
          for (const other of this.targets) {
            if (other === current) continue;
            const otx = (other.metadata?.targetX as number) ?? other.position.x;
            const oty = (other.metadata?.targetY as number) ?? other.position.y;
            const d = Math.sqrt((wx - otx) ** 2 + (wy - oty) ** 2);
            if (d < waypointMinDist) { tooClose = true; break; }
          }
          if (!tooClose) return { wx, wy };
        }
        return { wx: centerX + (Math.random() - 0.5) * radiusX * 2, wy: centerY + (Math.random() - 0.5) * radiusY * 2 };
      };

      for (const target of this.targets) {
        if (!target.metadata) target.metadata = {};

        if (randomMode === 'brief') {
          // 短暂随机：随机移动 ↔ 直线移动交替
          const phase = (target.metadata.randomPhase as string) || 'random';
          const elapsed = (target.metadata.randomPhaseElapsed as number) || 0;
          const newElapsed = elapsed + deltaTime;

          if (phase === 'random') {
            // 随机阶段：waypoint-chasing
            if (!target.metadata.targetX) {
              const wp = pickSeparatedWaypoint(target);
              target.metadata.targetX = wp.wx;
              target.metadata.targetY = wp.wy;
            }
            const dx = (target.metadata.targetX as number) - target.position.x;
            const dy = (target.metadata.targetY as number) - target.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.3) {
              const wp = pickSeparatedWaypoint(target);
              target.metadata.targetX = wp.wx;
              target.metadata.targetY = wp.wy;
            }
            if (dist > 0.01) {
              target.position.x += (dx / dist) * speed * deltaTime / 500;
              target.position.y += (dy / dist) * speed * deltaTime / 500;
            }

            if (newElapsed >= randomDuration) {
              const dirDist = dist > 0.01 ? dist : 1;
              target.metadata.linearDirX = dx / dirDist;
              target.metadata.linearDirY = dy / dirDist;
              target.metadata.randomPhase = 'linear';
              target.metadata.randomPhaseElapsed = 0;
            } else {
              target.metadata.randomPhaseElapsed = newElapsed;
            }
          } else {
            // 直线阶段：沿固定方向匀速移动
            const ldx = (target.metadata.linearDirX as number) || 1;
            const ldy = (target.metadata.linearDirY as number) || 0;
            target.position.x += ldx * speed * deltaTime / 500;
            target.position.y += ldy * speed * deltaTime / 500;

            if (newElapsed >= linearDuration) {
              const wp = pickSeparatedWaypoint(target);
              target.metadata.targetX = wp.wx;
              target.metadata.targetY = wp.wy;
              target.metadata.randomPhase = 'random';
              target.metadata.randomPhaseElapsed = 0;
            } else {
              target.metadata.randomPhaseElapsed = newElapsed;
            }
          }
        } else {
          // 完全随机：纯 waypoint-chasing
          if (!target.metadata.targetX) {
            const wp = pickSeparatedWaypoint(target);
            target.metadata.targetX = wp.wx;
            target.metadata.targetY = wp.wy;
          }
          const dx = (target.metadata.targetX as number) - target.position.x;
          const dy = (target.metadata.targetY as number) - target.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.3) {
            const wp = pickSeparatedWaypoint(target);
            target.metadata.targetX = wp.wx;
            target.metadata.targetY = wp.wy;
          }
          if (dist > 0.01) {
            target.position.x += (dx / dist) * speed * deltaTime / 500;
            target.position.y += (dy / dist) * speed * deltaTime / 500;
          }
        }

        // 叠加路径噪声（随机度 > 0 时）
        if (randomness > 0) {
          const noiseScale = (randomness / 100) * Math.min(radiusX, radiusY) * 0.5;
          const noiseTime = this.movementPhase + ((target.metadata?.phaseOffset as number) ?? 0);
          const noiseX = (Math.sin(noiseTime * 1.7 + 0.3) * 0.4 + Math.sin(noiseTime * 3.1 + 1.7) * 0.3 + Math.sin(noiseTime * 5.3 + 2.9) * 0.3) * noiseScale;
          const noiseY = (Math.sin(noiseTime * 2.3 + 1.1) * 0.4 + Math.sin(noiseTime * 4.7 + 0.5) * 0.3 + Math.sin(noiseTime * 6.1 + 3.7) * 0.3) * noiseScale;
          target.position.x += noiseX;
          target.position.y += noiseY;
        }

        // 限制在边界内
        target.position.x = Math.max(bounds.xMin, Math.min(bounds.xMax, target.position.x));
        target.position.y = Math.max(bounds.yMin, Math.min(bounds.yMax, target.position.y));
        target.position.z = 8;
      }
      return;
    }

    const target = this.targets[0];

    if (type === 'random') {
      // 追踪类型的随机移动（单目标，支持短暂随机/完全随机）
      const centerX = (bounds.xMin + bounds.xMax) / 2;
      const centerY = (bounds.yMin + bounds.yMax) / 2;
      const randomMode = this.config.movement.randomMode || 'full';
      const ratio = this.config.movement.randomLinearRatio ?? 0.5;
      const cycleDuration = 2000 / speed;
      const randomDuration = cycleDuration * ratio;
      const linearDuration = cycleDuration * (1 - ratio);

      if (!target.metadata) target.metadata = {};

      if (randomMode === 'brief') {
        // 短暂随机：随机移动 ↔ 直线移动交替
        const phase = (target.metadata.randomPhase as string) || 'random';
        const elapsed = (target.metadata.randomPhaseElapsed as number) || 0;
        const newElapsed = elapsed + deltaTime;

        if (phase === 'random') {
          if (!target.metadata.targetX) {
            target.metadata.targetX = centerX + (Math.random() - 0.5) * radiusX * 2;
            target.metadata.targetY = centerY + (Math.random() - 0.5) * radiusY * 2;
          }
          const dx = (target.metadata.targetX as number) - target.position.x;
          const dy = (target.metadata.targetY as number) - target.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.3) {
            target.metadata.targetX = centerX + (Math.random() - 0.5) * radiusX * 2;
            target.metadata.targetY = centerY + (Math.random() - 0.5) * radiusY * 2;
          }
          if (dist > 0.01) {
            target.position.x += (dx / dist) * speed * deltaTime / 500;
            target.position.y += (dy / dist) * speed * deltaTime / 500;
          }

          if (newElapsed >= randomDuration) {
            const dirDist = dist > 0.01 ? dist : 1;
            target.metadata.linearDirX = dx / dirDist;
            target.metadata.linearDirY = dy / dirDist;
            target.metadata.randomPhase = 'linear';
            target.metadata.randomPhaseElapsed = 0;
          } else {
            target.metadata.randomPhaseElapsed = newElapsed;
          }
        } else {
          const ldx = (target.metadata.linearDirX as number) || 1;
          const ldy = (target.metadata.linearDirY as number) || 0;
          target.position.x += ldx * speed * deltaTime / 500;
          target.position.y += ldy * speed * deltaTime / 500;

          if (newElapsed >= linearDuration) {
            target.metadata.targetX = centerX + (Math.random() - 0.5) * radiusX * 2;
            target.metadata.targetY = centerY + (Math.random() - 0.5) * radiusY * 2;
            target.metadata.randomPhase = 'random';
            target.metadata.randomPhaseElapsed = 0;
          } else {
            target.metadata.randomPhaseElapsed = newElapsed;
          }
        }
      } else {
        // 完全随机：纯 waypoint-chasing
        if (!target.metadata.targetX) {
          target.metadata.targetX = centerX + (Math.random() - 0.5) * radiusX * 2;
          target.metadata.targetY = centerY + (Math.random() - 0.5) * radiusY * 2;
        }
        const dx = (target.metadata.targetX as number) - target.position.x;
        const dy = (target.metadata.targetY as number) - target.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.3) {
          target.metadata.targetX = centerX + (Math.random() - 0.5) * radiusX * 2;
          target.metadata.targetY = centerY + (Math.random() - 0.5) * radiusY * 2;
        }
        if (dist > 0.01) {
          target.position.x += (dx / dist) * speed * deltaTime / 500;
          target.position.y += (dy / dist) * speed * deltaTime / 500;
        }
      }

      // 叠加路径噪声（随机度 > 0 时）
      if (randomness > 0) {
        const noiseScale = (randomness / 100) * Math.min(radiusX, radiusY) * 0.5;
        const noiseTime = this.movementPhase;
        const noiseX = (Math.sin(noiseTime * 1.7 + 0.3) * 0.4 + Math.sin(noiseTime * 3.1 + 1.7) * 0.3 + Math.sin(noiseTime * 5.3 + 2.9) * 0.3) * noiseScale;
        const noiseY = (Math.sin(noiseTime * 2.3 + 1.1) * 0.4 + Math.sin(noiseTime * 4.7 + 0.5) * 0.3 + Math.sin(noiseTime * 6.1 + 3.7) * 0.3) * noiseScale;
        target.position.x += noiseX;
        target.position.y += noiseY;
      }

      target.position.x = Math.max(bounds.xMin, Math.min(bounds.xMax, target.position.x));
      target.position.y = Math.max(bounds.yMin, Math.min(bounds.yMax, target.position.y));
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
      // 静态点击类型：使用与 GridshotScene 完全一致的格子占用追踪
      const { rows, cols } = display;
      const availableCells = this.getAvailableCells(rows, cols);

      if (availableCells.length === 0) return false;

      // 随机打乱候选格子，依次尝试找到不重叠的位置
      for (let i = availableCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
      }

      // 与 GridshotScene 完全一致的网格计算：14×8 区域
      const cellWidth = 14 / cols;
      const cellHeight = 8 / rows;

      for (const [row, col] of availableCells) {
        const x = (col - cols / 2 + 0.5) * cellWidth;
        const y = (row + 0.5) * cellHeight + 2;

        // 检查与所有已存在目标的距离，确保不重叠（间距 >= 目标直径）
        const minDist = actualSize; // 球心距 >= 直径 = 不重叠
        let overlaps = false;
        for (const t of this.targets) {
          const dx = x - t.position.x;
          const dy = y - t.position.y;
          if (Math.sqrt(dx * dx + dy * dy) < minDist) {
            overlaps = true;
            break;
          }
        }

        if (overlaps) continue; // 该格子太近，尝试下一个

        const mesh = this.spawnTarget(new BABYLON.Vector3(x, y, 8), actualSize);
        const cellKey = `${row},${col}`;
        mesh.metadata = { ...mesh.metadata, cellKey };
        this.occupiedCells.set(cellKey, mesh);

        return true;
      }

      // 所有候选位置都太近，生成失败
      return false;
    } else {
      // 运动类型：根据当前运动状态计算正确位置，避免闪烁
      const direction = this.config.movement.direction || 'horizontal';
      const type = this.config.movement.type;
      const minSpacing = actualSize * 2.5;

      let x: number, y: number;
      let phaseOffset: number | undefined;
      let baseX: number | undefined;
      let baseY: number | undefined;

      if (this.config.category === 'dynamic-clicking' && type === 'linear' && direction === 'horizontal') {
        // 动态点击 + 水平移动：每个目标分配不同 y 高度和独立相位偏移
        const rangeY = bounds.yMax - bounds.yMin;

        // 收集已占用的 y 值
        const occupiedY: number[] = [];
        for (const t of this.targets) {
          if (t.metadata?.baseY !== undefined) {
            occupiedY.push(t.metadata.baseY as number);
          }
        }

        // 在范围内均匀分布候选 y 位置
        const maxTargets = this.config.spawn.maxActive;
        const candidateYs: number[] = [];
        const step = rangeY / (maxTargets + 1);
        for (let i = 1; i <= maxTargets; i++) {
          candidateYs.push(bounds.yMin + i * step);
        }

        // 随机打乱候选位置
        for (let i = candidateYs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidateYs[i], candidateYs[j]] = [candidateYs[j], candidateYs[i]];
        }

        // 选第一个未被占用且间距足够的
        let chosenY: number | null = null;
        for (const cy of candidateYs) {
          const tooClose = occupiedY.some(oy => Math.abs(cy - oy) < minSpacing);
          if (!tooClose) {
            chosenY = cy;
            break;
          }
        }

        if (chosenY === null) {
          chosenY = bounds.yMin + Math.random() * rangeY;
        }

        // 预先生成相位偏移，确保初始位置与运动路径一致（避免刷新后闪烁/瞬移）
        phaseOffset = Math.random() * Math.PI * 2;
        const pos = this.getMovementPosition(this.movementPhase + phaseOffset);
        x = pos ? pos.x : (bounds.xMin + bounds.xMax) / 2;
        y = chosenY;
        baseY = chosenY;

      } else if (this.config.category === 'dynamic-clicking' && type === 'linear' && direction === 'vertical') {
        // 动态点击 + 垂直移动：每个目标分配不同 x 位置和独立相位偏移
        const rangeX = bounds.xMax - bounds.xMin;

        // 收集已占用的 x 值
        const occupiedX: number[] = [];
        for (const t of this.targets) {
          if (t.metadata?.baseX !== undefined) {
            occupiedX.push(t.metadata.baseX as number);
          }
        }

        // 在范围内均匀分布候选 x 位置
        const maxTargets = this.config.spawn.maxActive;
        const candidateXs: number[] = [];
        const step = rangeX / (maxTargets + 1);
        for (let i = 1; i <= maxTargets; i++) {
          candidateXs.push(bounds.xMin + i * step);
        }

        // 随机打乱候选位置
        for (let i = candidateXs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidateXs[i], candidateXs[j]] = [candidateXs[j], candidateXs[i]];
        }

        // 选第一个未被占用且间距足够的
        let chosenX: number | null = null;
        for (const cx of candidateXs) {
          const tooClose = occupiedX.some(ox => Math.abs(cx - ox) < minSpacing);
          if (!tooClose) {
            chosenX = cx;
            break;
          }
        }

        if (chosenX === null) {
          chosenX = bounds.xMin + Math.random() * rangeX;
        }

        // 预先生成相位偏移，确保初始位置与运动路径一致
        phaseOffset = Math.random() * Math.PI * 2;
        const pos = this.getMovementPosition(this.movementPhase + phaseOffset);
        x = chosenX;
        y = pos ? pos.y : (bounds.yMin + bounds.yMax) / 2;
        baseX = chosenX;

      } else {
        // 其他运动类型（random 等）：随机位置 + 距离防重叠
        phaseOffset = Math.random() * Math.PI * 2;
        const pos = this.getMovementPosition(this.movementPhase + phaseOffset);
        x = pos ? pos.x : bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin);
        y = pos ? pos.y : bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);

        // 尝试多次寻找不重叠的位置
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          let overlaps = false;
          for (const t of this.targets) {
            const dx = x - t.position.x;
            const dy = y - t.position.y;
            if (Math.sqrt(dx * dx + dy * dy) < minSpacing) {
              overlaps = true;
              break;
            }
          }
          if (!overlaps) break;
          // 重新随机位置
          x = bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin);
          y = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
        }
      }

      // 最终防重叠校验：确保与所有已存在目标有足够间距
      const minDist = actualSize; // 球心距 >= 直径 = 不重叠
      let hasOverlap = false;
      for (const t of this.targets) {
        const dx = x - t.position.x;
        const dy = y - t.position.y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) {
          hasOverlap = true;
          break;
        }
      }

      // 如果仍然重叠，尝试微调位置
      if (hasOverlap) {
        const offsetAngles = [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4, Math.PI, -Math.PI / 4, -Math.PI / 2, -Math.PI * 3 / 4];
        let resolved = false;
        for (const angle of offsetAngles) {
          const nx = x + Math.cos(angle) * minSpacing;
          const ny = y + Math.sin(angle) * minSpacing;
          // 确保在边界内
          if (nx < bounds.xMin || nx > bounds.xMax || ny < bounds.yMin || ny > bounds.yMax) continue;
          let ok = true;
          for (const t of this.targets) {
            const dx = nx - t.position.x;
            const dy = ny - t.position.y;
            if (Math.sqrt(dx * dx + dy * dy) < minDist) {
              ok = false;
              break;
            }
          }
          if (ok) {
            x = nx;
            y = ny;
            resolved = true;
            break;
          }
        }
        // 如果所有方向都无法解决，放弃生成
        if (!resolved) return false;
      }

      const position = new BABYLON.Vector3(x, y, 8);
      const mesh = this.spawnTarget(position, actualSize);

      // 动态点击：存储 baseX/baseY 和 phaseOffset 用于独立移动
      if (this.config.category === 'dynamic-clicking' && phaseOffset !== undefined) {
        mesh.metadata = {
          ...mesh.metadata,
          baseX: baseX ?? x,
          baseY: baseY ?? y,
          phaseOffset,
        };
      }

      return true;
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
    super.dispose();
  }
}
