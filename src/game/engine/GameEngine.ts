import * as BABYLON from '@babylonjs/core';
import { getSceneClearColor } from '@/utils/themeColors';
import { useSettingsStore } from '@/stores/settingsStore';

const MAX_MOUSE_DELTA_PER_EVENT = 60; // 单次 mousemove 最大像素（防指针锁定重获时巨幅跳变）
const MIN_MOVEMENT_MAG = 0.5;         // 亚像素噪声过滤

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private scene: BABYLON.Scene | null = null;
  private fps: number = 0;
  private camera: BABYLON.UniversalCamera | null = null;
  private isPointerLocked: boolean = false;

  private activeController: 'mouse' | 'gamepad' | null = null;
  private lastMouseMoveTime: number = 0;
  private lastGamepadMoveTime: number = 0;
  private cameraControlEnabled: boolean = true;
  private readonly CONTROLLER_IDLE_MS = 250;
  private readonly GAMEPAD_ACTIVATION_THRESHOLD = 0.08;

  // 缓存的鼠标灵敏度，避免每次 mousemove 事件读 Zustand store
  private cachedMouseSensitivity: number = 0;
  private sensitivityCacheTimestamp: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });

    window.addEventListener('resize', () => this.engine.resize());

    this.engine.onBeginFrameObservable.add(() => {
      this.fps = this.engine.getFps();
    });

    this.setupPointerLock();
  }

  /* ───── 指针锁定 & 鼠标输入 ───── */

  private setupPointerLock() {
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === (this.canvas as unknown as Element);
    });

    // 鼠标移动 — 直接旋转摄像机（同步，与 v2.0.1 一致）
    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked || !this.camera || !this.cameraControlEnabled) return;

      const rawDX = e.movementX;
      const rawDY = e.movementY;

      // 异常值过滤：浏览器偶发报告 NaN 或 ±Infinity
      if (!isFinite(rawDX) || !isFinite(rawDY)) return;

      const absDX = Math.abs(rawDX);
      const absDY = Math.abs(rawDY);

      // 噪声过滤
      if (absDX < MIN_MOVEMENT_MAG && absDY < MIN_MOVEMENT_MAG) return;

      const now = performance.now();

      // 手柄活跃时需超过闲置期才允许鼠标接管
      if (this.activeController === 'gamepad') {
        const gamepadIdle = now - this.lastGamepadMoveTime > this.CONTROLLER_IDLE_MS;
        if (!gamepadIdle) return;
      }

      this.activeController = 'mouse';
      this.lastMouseMoveTime = now;

      // 钳制单次事件增量，防止指针锁定重获时浏览器报告巨幅位移
      const clampedDX = Math.max(-MAX_MOUSE_DELTA_PER_EVENT, Math.min(MAX_MOUSE_DELTA_PER_EVENT, rawDX));
      const clampedDY = Math.max(-MAX_MOUSE_DELTA_PER_EVENT, Math.min(MAX_MOUSE_DELTA_PER_EVENT, rawDY));

      // 定期刷新缓存的灵敏度（每秒读一次 Zustand store）
      if (now - this.sensitivityCacheTimestamp > 1000) {
        this.cachedMouseSensitivity = useSettingsStore.getState().mouseSensitivity * 0.002;
        this.sensitivityCacheTimestamp = now;
      }

      const sensitivity = this.cachedMouseSensitivity || useSettingsStore.getState().mouseSensitivity * 0.002;

      // 直接旋转摄像机（同步方式，每个 mousemove 事件立即生效）
      this.camera.rotation.y += clampedDX * sensitivity;
      this.camera.rotation.x += clampedDY * sensitivity;

      // 垂直视角限制
      this.camera.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.camera.rotation.x));
    });
  }

  requestPointerLock() {
    this.canvas.requestPointerLock();
  }

  exitPointerLock() {
    document.exitPointerLock();
  }

  /* ───── 场景 & 渲染循环 ───── */

  createScene(): BABYLON.Scene {
    this.scene = new BABYLON.Scene(this.engine);

    this.camera = new BABYLON.UniversalCamera(
      'camera',
      new BABYLON.Vector3(0, 5, -8),
      this.scene
    );
    this.camera.setTarget(new BABYLON.Vector3(0, 5, 8));
    this.camera.speed = 0;
    this.camera.angularSensibility = 1000;
    this.camera.inputs.clear();

    const hemisphericLight = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    hemisphericLight.intensity = 0.8;

    const directionalLight = new BABYLON.DirectionalLight(
      'dirLight',
      new BABYLON.Vector3(-1, -2, 1),
      this.scene
    );
    directionalLight.intensity = 0.3;

    this.scene.clearColor = getSceneClearColor();
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

  /* ───── 手柄控制 ───── */

  updateCameraFromGamepad(deltaTime: number) {
    if (!this.camera || deltaTime <= 0 || !this.cameraControlEnabled) return;

    const now = performance.now();

    if (this.activeController === 'mouse' && now - this.lastMouseMoveTime > this.CONTROLLER_IDLE_MS) {
      this.activeController = null;
    }
    if (this.activeController === 'gamepad' && now - this.lastGamepadMoveTime > this.CONTROLLER_IDLE_MS) {
      this.activeController = null;
    }

    const settings = useSettingsStore.getState();
    const sensitivity = settings.gamepadSensitivity;
    const invertY = settings.gamepadInvertY ? -1 : 1;

    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;

      const rx = gp.axes[2] || 0;
      const ry = gp.axes[3] || 0;
      const magnitude = Math.sqrt(rx ** 2 + ry ** 2);

      if (this.activeController !== 'gamepad') {
        if (magnitude < this.GAMEPAD_ACTIVATION_THRESHOLD) return;
        if (this.activeController === 'mouse') {
          const mouseIdle = now - this.lastMouseMoveTime > this.CONTROLLER_IDLE_MS;
          if (!mouseIdle) return;
        }
      }

      this.activeController = 'gamepad';
      this.lastGamepadMoveTime = now;

      const speed = sensitivity * 2.5 * (deltaTime / 1000);
      this.camera.rotation.y += rx * speed;
      this.camera.rotation.x += ry * speed * invertY;

      this.camera.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.camera.rotation.x));
      break;
    }
  }

  /* ───── 杂项 ───── */

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

  setCameraControlEnabled(enabled: boolean) {
    this.cameraControlEnabled = enabled;
    if (!enabled) {
      this.activeController = null;
    }
  }
}
