import * as BABYLON from '@babylonjs/core';
import { getSceneClearColor } from '@/utils/themeColors';
import { useSettingsStore } from '@/stores/settingsStore';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private scene: BABYLON.Scene | null = null;
  private fps: number = 0;
  private camera: BABYLON.UniversalCamera | null = null;
  private isPointerLocked: boolean = false;

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

    // 设置指针锁定事件
    this.setupPointerLock();
  }

  private setupPointerLock() {
    // 指针锁定状态变化
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === (this.canvas as unknown as Element);
    });

    // 鼠标移动 - 控制摄像机视角
    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked || !this.camera) return;

      const sensitivity = 0.002;
      this.camera.rotation.y += e.movementX * sensitivity;
      this.camera.rotation.x += e.movementY * sensitivity;

      // 限制垂直视角范围
      this.camera.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.camera.rotation.x));
    });
  }

  requestPointerLock() {
    this.canvas.requestPointerLock();
  }

  exitPointerLock() {
    document.exitPointerLock();
  }

  createScene(): BABYLON.Scene {
    this.scene = new BABYLON.Scene(this.engine);

    // 创建摄像机 - 面向目标墙
    this.camera = new BABYLON.UniversalCamera(
      'camera',
      new BABYLON.Vector3(0, 5, -8),
      this.scene
    );
    // 看向场景中心偏上的位置（目标墙区域）
    this.camera.setTarget(new BABYLON.Vector3(0, 5, 8));
    // 不使用 attachControl，我们自己处理鼠标输入
    this.camera.speed = 0;
    this.camera.angularSensibility = 1000;

    // 禁用所有默认输入
    this.camera.inputs.clear();

    // 光照 - 从上方照射
    const hemisphericLight = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    hemisphericLight.intensity = 0.8;

    // 添加方向光增强立体感
    const directionalLight = new BABYLON.DirectionalLight(
      'dirLight',
      new BABYLON.Vector3(-1, -2, 1),
      this.scene
    );
    directionalLight.intensity = 0.3;

    // 环境 - 使用当前主题背景色
    this.scene.clearColor = getSceneClearColor();

    // 优化：启用硬件缩放
    this.engine.setHardwareScalingLevel(1);

    return this.scene;
  }

  startRenderLoop(onRender?: () => void) {
    this.engine.runRenderLoop(() => {
      this.updateCameraFromGamepad(this.engine.getDeltaTime());
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

  getIsPointerLocked(): boolean {
    return this.isPointerLocked;
  }

  updateCameraFromGamepad(deltaTime: number) {
    if (!this.camera || deltaTime <= 0) return;

    const settings = useSettingsStore.getState();
    const deadzone = settings.gamepadDeadzone;
    const sensitivity = settings.gamepadSensitivity;
    const invertY = settings.gamepadInvertY ? -1 : 1;

    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;

      const rx = gp.axes[2] || 0;
      const ry = gp.axes[3] || 0;

      const magnitude = Math.sqrt(rx * rx + ry * ry);
      if (magnitude < deadzone) return;

      const scale = (magnitude - deadzone) / (1 - deadzone);
      const normalizedX = (rx / magnitude) * scale;
      const normalizedY = (ry / magnitude) * scale;

      const speed = sensitivity * 2.5 * (deltaTime / 1000);
      this.camera.rotation.y += normalizedX * speed;
      this.camera.rotation.x += normalizedY * speed * invertY;

      this.camera.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.camera.rotation.x));
      break;
    }
  }

  updateClearColor(color: BABYLON.Color4) {
    if (this.scene) {
      this.scene.clearColor = color;
    }
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
