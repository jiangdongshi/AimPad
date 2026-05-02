import * as BABYLON from '@babylonjs/core';
import { GameEngine } from '../engine/GameEngine';
import type { TrainingResult } from '@/types/training';

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
      if (!this.isActive) return;

      // 从摄像机中心发射射线（准星位置）
      const ray = this.camera.getForwardRay(100);

      const hit = this.scene.pickWithRay(ray);
      if (hit?.pickedMesh?.metadata?.isTarget) {
        this.onTargetHit(hit.pickedMesh as BABYLON.Mesh);
      } else {
        this.misses++;
      }
    };
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
      { diameter: size },
      this.scene
    );
    target.position = position;
    target.metadata = {
      isTarget: true,
      spawnTime: performance.now(),
    };

    // 高亮材质
    const material = new BABYLON.StandardMaterial(`targetMat-${Date.now()}`, this.scene);
    material.emissiveColor = new BABYLON.Color3(1, 0.3, 0.3);
    material.diffuseColor = new BABYLON.Color3(1, 0.2, 0.2);
    material.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    target.material = material;

    // 光晕效果
    const glowLayer = new BABYLON.GlowLayer('glow', this.scene);
    glowLayer.intensity = 0.5;

    this.targets.push(target);
    return target;
  }

  protected removeTarget(mesh: BABYLON.Mesh) {
    // 消失动画
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
      this.targets = this.targets.filter(t => t !== mesh);
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
    groundMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.15);
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
