import * as BABYLON from '@babylonjs/core';
import { GameEngine } from '../engine/GameEngine';
import type { TrainingResult } from '@/types/training';
import { getSceneGroundColor, getSceneWallColor } from '@/utils/themeColors';
import { getButtonIndex } from '@/utils/gamepadMap';

export abstract class BaseScene {
  protected engine: GameEngine;
  protected scene: BABYLON.Scene;
  protected camera: BABYLON.UniversalCamera;
  protected targets: BABYLON.Mesh[] = [];
  protected startTime: number = 0;
  protected isActive: boolean = false;
  protected taskId: string;

  // 难度配置
  protected targetLifetime: number = 0; // 0 表示无限制
  protected targetSizeMultiplier: number = 1.0;

  // 目标小球颜色（默认淡蓝色 #ADD8E6）
  protected targetColor: BABYLON.Color3 = new BABYLON.Color3(0.68, 0.85, 0.9);

  // 墙壁颜色（默认 null，使用主题自动配色）
  protected wallColor: BABYLON.Color3 | null = null;
  protected wallMaterials: BABYLON.StandardMaterial[] = [];
  protected groundMaterial: BABYLON.StandardMaterial | null = null;

  // 对象池：预先创建的可重用目标
  protected targetPool: BABYLON.Mesh[] = [];
  protected targetPoolAvailable: BABYLON.Mesh[] = [];
  protected readonly POOL_SIZE = 12;

  // 手柄开火按键
  protected fireButtonName: string = 'RT';
  private prevFirePressed: boolean = false;

  // 统计数据
  protected hits: number = 0;
  protected misses: number = 0;
  protected reactionTimes: number[] = [];
  protected killTimes: number[] = [];
  protected lastTargetSpawnTime: number = 0;

  constructor(engine: GameEngine, taskId: string) {
    this.engine = engine;
    this.scene = engine.createScene();
    this.camera = this.scene.getCameraByName('camera') as BABYLON.UniversalCamera;
    this.taskId = taskId;
  }

  abstract setup(): Promise<void>;
  abstract update(deltaTime: number): void;

  start() {
    this.resetStats();
    this.startTime = performance.now();
    this.isActive = true;
    this.lastTargetSpawnTime = this.startTime;
    this.setupShooting();
  }

  stop(): TrainingResult {
    this.isActive = false;
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

  protected resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.reactionTimes = [];
    this.killTimes = [];
  }

  protected setupShooting() {
    this.scene.onPointerDown = (_evt) => {
      this.tryShoot();
    };
  }

  protected tryShoot() {
    if (!this.isActive) return false;
    const ray = this.camera.getForwardRay(100);
    const hit = this.scene.pickWithRay(ray, (mesh) => mesh.metadata?.isTarget === true, false);
    if (hit?.pickedMesh) {
      this.onTargetHit(hit.pickedMesh as BABYLON.Mesh);
      return true;
    } else {
      this.misses++;
      return false;
    }
  }

  setFireButton(name: string) {
    this.fireButtonName = name;
  }

  /** 每帧调用，检测手柄 Select/Start 暂停 */
  checkGamepadPause(): boolean {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;
      // 检测 Select (8) 和 Start (9) 按钮
      const selectIdx = 8;
      const startIdx = 9;
      if (gp.buttons[selectIdx]?.pressed || gp.buttons[startIdx]?.pressed) {
        return true;
      }
    }
    return false;
  }

  /** 每帧调用，检测手柄开火按键 */
  checkGamepadFire() {
    if (!this.isActive) return;
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;
      const idx = getButtonIndex(gp, this.fireButtonName as keyof import('@/types/gamepad').ButtonMapping);
      if (idx === undefined) continue;
      const pressed = gp.buttons[idx]?.pressed ?? false;
      if (pressed && !this.prevFirePressed) {
        this.tryShoot();
      }
      this.prevFirePressed = pressed;
      break;
    }
  }

  protected onTargetHit(mesh: BABYLON.Mesh) {
    this.hits++;
    const reactionTime = performance.now() - (mesh.metadata?.spawnTime || this.startTime);
    this.reactionTimes.push(reactionTime);
    this.removeTarget(mesh);
  }

  // 初始化对象池 - 使用共享材质减少 DrawCall
  protected initTargetPool(): void {
    // 创建共享材质（所有池内对象共用）
    const sharedMaterial = new BABYLON.StandardMaterial('targetMat-shared', this.scene);
    sharedMaterial.diffuseColor = this.targetColor;
    sharedMaterial.emissiveColor = this.targetColor;
    sharedMaterial.specularColor = BABYLON.Color3.Black();
    sharedMaterial.disableLighting = true;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const target = BABYLON.MeshBuilder.CreateSphere(
        `target-pool-${i}`,
        { diameter: 1, segments: 12 }, // 减少分段数提升性能
        this.scene
      );
      target.setEnabled(false);
      target.metadata = { isTarget: false, poolIndex: i };
      target.material = sharedMaterial;
      target.scaling = new BABYLON.Vector3(1, 1, 1);

      this.targetPool.push(target);
      this.targetPoolAvailable.push(target);
    }
  }

  // 从对象池获取目标 - O(1)
  protected getPooledTarget(): BABYLON.Mesh | null {
    if (this.targetPoolAvailable.length === 0) return null;
    return this.targetPoolAvailable.pop()!;
  }

  // 将目标归还对象池 - O(1)
  protected returnTargetToPool(target: BABYLON.Mesh): void {
    target.setEnabled(false);
    target.metadata = { isTarget: false, poolIndex: target.metadata?.poolIndex };
    this.targetPoolAvailable.push(target);
  }

  protected spawnTarget(position: BABYLON.Vector3, size: number = 1): BABYLON.Mesh {
    // 优先从对象池获取
    let target = this.getPooledTarget();

    if (!target) {
      // 池耗尽时回退到创建新对象（不应该发生）
      target = BABYLON.MeshBuilder.CreateSphere(
        `target-${Date.now()}`,
        { diameter: size, segments: 12 },
        this.scene
      );
      const material = new BABYLON.StandardMaterial(`targetMat-${Date.now()}`, this.scene);
      material.diffuseColor = this.targetColor;
      material.emissiveColor = this.targetColor;
      material.specularColor = BABYLON.Color3.Black();
      material.disableLighting = true;
      target.material = material;
    }

    // 激活目标
    target.position = position;
    target.scaling = new BABYLON.Vector3(size, size, size);
    target.metadata = {
      isTarget: true,
      spawnTime: performance.now(),
      poolIndex: target.metadata?.poolIndex,
    };

    // 更新材质颜色（支持动态变色）- 仅非池对象需要更新
    if (!this.targetPool.includes(target)) {
      const mat = target.material as BABYLON.StandardMaterial;
      if (mat) {
        mat.diffuseColor = this.targetColor;
        mat.emissiveColor = this.targetColor;
      }
    }

    target.setEnabled(true);
    this.targets.push(target);
    return target;
  }

  protected removeTarget(mesh: BABYLON.Mesh) {
    // 立即从数组中移除，让生成逻辑能及时补充目标
    const idx = this.targets.indexOf(mesh);
    if (idx !== -1) this.targets.splice(idx, 1);
    mesh.metadata.isTarget = false;

    // 即时归还对象池，不创建 Animation 对象，杜绝 GC 卡顿
    if (this.targetPool.includes(mesh)) {
      this.returnTargetToPool(mesh);
    } else {
      mesh.dispose();
    }
  }

  protected calculateScore(): number {
    if (this.hits === 0) return 0;
    const accuracy = this.hits / (this.hits + this.misses);
    const avgReaction = this.reactionTimes.length > 0
      ? this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length
      : 1000;
    const timeFactor = 1000 / (avgReaction + 100);
    return Math.round(this.hits * 100 * accuracy * timeFactor);
  }

  protected createGround(width: number = 20, height: number = 20) {
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width, height },
      this.scene
    );
    ground.position.y = 0;
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = this.wallColor ?? getSceneGroundColor();
    groundMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    groundMat.backFaceCulling = false;
    ground.material = groundMat;
    ground.receiveShadows = true;
    this.groundMaterial = groundMat;
    return ground;
  }

  // 设置难度配置
  setDifficulty(targetSizeMultiplier: number, targetLifetime: number) {
    this.targetSizeMultiplier = targetSizeMultiplier;
    this.targetLifetime = targetLifetime;
  }

  // 所有墙壁材质名称，用于按名查找更新（兜底策略）
  private static readonly WALL_MAT_NAMES = ['wallMat', 'roomMat'];

  // 设置目标小球颜色（接受 hex 字符串如 '#ADD8E6'）
  setTargetColor(hex: string) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    this.targetColor = new BABYLON.Color3(r, g, b);

    // 更新对象池的共享材质颜色
    const sharedMat = this.scene.getMaterialByName('targetMat-shared') as BABYLON.StandardMaterial;
    if (sharedMat) {
      sharedMat.diffuseColor = this.targetColor;
      sharedMat.emissiveColor = this.targetColor;
    }
  }

  // 设置墙壁颜色（接受 hex 字符串如 '#1a1a2e'，传空字符串恢复主题默认）
  setWallColor(hex: string) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
      this.wallColor = null;
      const defaultWall = getSceneWallColor();
      const defaultGround = getSceneGroundColor();
      this.applyWallColorToAll(defaultWall, defaultGround);
      return;
    }
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    this.wallColor = new BABYLON.Color3(r, g, b);
    this.applyWallColorToAll(this.wallColor);
  }

  // 将给定颜色写到所有墙壁材质和地面
  private applyWallColorToAll(wallColor: BABYLON.Color3, groundColor?: BABYLON.Color3) {
    // 1. 遍历注册的材质（包括 roomMat 和各个子类的 wallMat）
    for (const mat of this.wallMaterials) {
      mat.diffuseColor = wallColor;
    }
    // 2. 按名称兜底
    for (const name of BaseScene.WALL_MAT_NAMES) {
      const mat = this.scene.getMaterialByName(name) as BABYLON.StandardMaterial;
      if (mat && !this.wallMaterials.includes(mat)) {
        mat.diffuseColor = wallColor;
      }
    }
    // 3. 地面保持 0.85 倍比例
    if (this.groundMaterial) {
      this.groundMaterial.diffuseColor = groundColor ?? wallColor.scale(0.85);
    }
  }

  // 子类在创建墙壁后调用此方法注册墙壁材质，以支持动态换色
  protected registerWallMaterial(mat: BABYLON.StandardMaterial) {
    this.wallMaterials.push(mat);
    if (this.wallColor) {
      mat.diffuseColor = this.wallColor;
    }
  }

  /**
   * 创建封闭训练房间 — 单一 CreateBox + 单一材质 + backFaceCulling=false。
   *
   * 盒子 z ∈ [-10, 8]，覆盖 z=8 到 z=-10 范围（depth=18，居中 z=-1），
   * 确保相机（z=-8）在盒子内部 2 单位，背后有完整墙壁。
   * y ∈ [0, height + 2] 确保从地面到天花板完全封闭。
   *
   * 所有六个面共用同一个材质，修改 diffuseColor 即可统一换色。
   * 子类的 backWall（z≈8）恰好与盒子的前面对齐，颜色相同，无视觉接缝。
   */
  protected createBoxWalls(options?: { width?: number; height?: number; depth?: number; yOffset?: number }) {
    const width = options?.width ?? 16;
    const height = options?.height ?? 10;
    const wallColor = this.wallColor ?? getSceneWallColor();

    // 单材质，所有墙面统一颜色
    const roomMat = new BABYLON.StandardMaterial('roomMat', this.scene);
    roomMat.diffuseColor = wallColor;
    roomMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    roomMat.backFaceCulling = false;

    // 盒子：宽 width，高 height+2（覆盖天花板），深 18（z∈[-10,8]）
    const box = BABYLON.MeshBuilder.CreateBox('roomBox', { width, height: height + 2, depth: 18 }, this.scene);
    box.position = new BABYLON.Vector3(0, height / 2, -1);
    box.material = roomMat;
    box.isPickable = false;

    this.registerWallMaterial(roomMat);
  }

  // 检查过期目标（困难/地狱模式）
  protected checkExpiredTargets() {
    if (this.targetLifetime <= 0) return;

    const now = performance.now();
    const expired: BABYLON.Mesh[] = [];

    for (const target of this.targets) {
      const spawnTime = target.metadata?.spawnTime || 0;
      if (spawnTime > 0 && now - spawnTime > this.targetLifetime) {
        expired.push(target);
      }
    }

    for (const target of expired) {
      this.misses++;
      this.removeTarget(target);
    }
  }

  // 获取统计数据
  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      reactionTimes: this.reactionTimes,
    };
  }

  dispose() {
    this.targets.forEach(t => t.dispose());
    this.scene.dispose();
  }
}
