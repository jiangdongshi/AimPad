import * as BABYLON from '@babylonjs/core';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private scene: BABYLON.Scene | null = null;
  private fps: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });

    // 响应窗口大小变化
    window.addEventListener('resize', () => this.engine.resize());

    // 监控 FPS
    this.engine.onBeginFrameObservable.add(() => {
      this.fps = this.engine.getFps();
    });
  }

  createScene(): BABYLON.Scene {
    this.scene = new BABYLON.Scene(this.engine);

    // 创建摄像机（FPS 风格）
    const camera = new BABYLON.UniversalCamera(
      'camera',
      new BABYLON.Vector3(0, 1.6, -5),
      this.scene
    );
    camera.attachControl(this.canvas, true);
    camera.speed = 0.5;
    camera.angularSensibility = 2000;

    // 设置为 FPS 控制
    camera.keysUp = [87];    // W
    camera.keysDown = [83];  // S
    camera.keysLeft = [65];  // A
    camera.keysRight = [68]; // D

    // 光照
    const hemisphericLight = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    hemisphericLight.intensity = 0.7;

    // 环境
    this.scene.clearColor = new BABYLON.Color4(0.06, 0.06, 0.08, 1);

    // 优化：启用硬件缩放
    this.engine.setHardwareScalingLevel(1);

    return this.scene;
  }

  startRenderLoop(onRender?: () => void) {
    this.engine.runRenderLoop(() => {
      onRender?.();
      this.scene?.render();
    });
  }

  stop() {
    this.engine.stopRenderLoop();
  }

  dispose() {
    this.scene?.dispose();
    this.engine.dispose();
  }

  getEngine(): BABYLON.Engine {
    return this.engine;
  }

  getScene(): BABYLON.Scene | null {
    return this.scene;
  }

  getFps(): number {
    return this.fps;
  }

  setQuality(level: 'low' | 'medium' | 'high' | 'ultra') {
    const scalingLevels = { low: 2, medium: 1.5, high: 1, ultra: 0.75 };
    this.engine.setHardwareScalingLevel(scalingLevels[level]);

    if (this.scene) {
      this.scene.shadowsEnabled = level !== 'low';
      this.scene.postProcessesEnabled = level === 'high' || level === 'ultra';
    }
  }
}
