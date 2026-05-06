import * as BABYLON from '@babylonjs/core';
import { GameEngine } from '../engine/GameEngine';
import type { TrainingResult } from '@/types/training';
import { getSceneGroundColor } from '@/utils/themeColors';
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

  protected spawnTarget(position: BABYLON.Vector3, size: number = 1): BABYLON.Mesh {
    const target = BABYLON.MeshBuilder.CreateSphere(
      `target-${Date.now()}`,
      { diameter: size, segments: 16 },
      this.scene
    );
    target.position = position;
    target.metadata = {
      isTarget: true,
      spawnTime: performance.now(),
    };

    // 纯色材质，无光照阴影
    const material = new BABYLON.StandardMaterial(`targetMat-${Date.now()}`, this.scene);
    material.diffuseColor = this.targetColor;
    material.emissiveColor = this.targetColor;
    material.specularColor = BABYLON.Color3.Black();
    material.disableLighting = true;
    target.material = material;

    this.targets.push(target);
    return target;
  }

  protected removeTarget(mesh: BABYLON.Mesh) {
    // 立即从数组中移除，让生成逻辑能及时补充目标
    this.targets = this.targets.filter(t => t !== mesh);
    mesh.metadata.isTarget = false;

    // 消失动画（mesh 仍在场景中播放动画，结束后清理）
    const animation = new BABYLON.Animation(
      'scaleDown',
      'scaling',
      60,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    animation.setKeys([
      { frame: 0, value: mesh.scaling.clone() },
      { frame: 10, value: new BABYLON.Vector3(0, 0, 0) },
    ]);
    mesh.animations.push(animation);
    this.scene.beginAnimation(mesh, 0, 10, false, 1, () => {
      mesh.dispose();
    });
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
    groundMat.diffuseColor = getSceneGroundColor();
    groundMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    ground.material = groundMat;
    ground.receiveShadows = true;
    return ground;
  }

  // 设置难度配置
  setDifficulty(targetSizeMultiplier: number, targetLifetime: number) {
    this.targetSizeMultiplier = targetSizeMultiplier;
    this.targetLifetime = targetLifetime;
  }

  // 设置目标小球颜色（接受 hex 字符串如 '#ADD8E6'）
  setTargetColor(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    this.targetColor = new BABYLON.Color3(r, g, b);

    // 立即更新已有目标的颜色
    for (const target of this.targets) {
      const mat = target.material as BABYLON.StandardMaterial;
      if (mat?.diffuseColor) {
        mat.diffuseColor = this.targetColor;
        mat.emissiveColor = this.targetColor;
      }
    }
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
