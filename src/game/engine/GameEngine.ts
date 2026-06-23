import * as BABYLON from '@babylonjs/core';
import { getSceneClearColor } from '@/utils/themeColors';
import { useSettingsStore } from '@/stores/settingsStore';
import { getButtonIndex } from '@/utils/gamepadMap';
import type { ButtonMapping } from '@/types/gamepad';

const MAX_MOUSE_DELTA_PER_EVENT = 60; // 单次 mousemove 最大像素（防指针锁定重获时巨幅跳变）
const MIN_MOVEMENT_MAG = 0.5;         // 亚像素噪声过滤

// ───── 控制方式切换阈值 ─────
const STICK_SWITCH_THRESHOLD = 0.5;        // 鼠标→手柄：左/右摇杆推动幅度 > 50%
const MOUSE_SWITCH_ACCUM_THRESHOLD = 80;   // 手柄→鼠标：窗口内累计鼠标位移(px)
const MOUSE_SWITCH_WINDOW_MS = 600;        // 累计鼠标位移的有效窗口，超时归零

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

/** 画质 → 球体分段数映射（分段越少 = 三角面越少 = 性能越高） */
const QUALITY_SPHERE_SEGMENTS: Record<QualityLevel, number> = {
  low: 6,
  medium: 8,
  high: 12,
  ultra: 20,
};

const QUALITY_SCALING: Record<QualityLevel, number> = {
  low: 2,
  medium: 1.5,
  high: 1,
  ultra: 0.75,
};

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private scene: BABYLON.Scene | null = null;
  private fps: number = 0;
  private camera: BABYLON.UniversalCamera | null = null;
  private isPointerLocked: boolean = false;
  private quality: QualityLevel;

  // 当前激活的控制方式（默认鼠标）。切换需满足"大幅输入 + 开火键边沿按下"。
  private activeController: 'mouse' | 'gamepad' = 'mouse';
  private cameraControlEnabled: boolean = true;

  // 手柄→鼠标：累计鼠标位移 + 时间窗口
  private mouseAccum: number = 0;
  private lastMouseAccumTime: number = 0;
  // 鼠标→手柄：摇杆是否曾达到阈值（持续条件，开火边沿触发时检查）
  private gamepadStickArmed: boolean = false;
  // 开火键边沿检测（用于切换判定，独立于射击逻辑）
  private prevSwitchFirePressed: boolean = false;

  // 缓存的鼠标灵敏度，避免每次 mousemove 事件读 Zustand store
  private cachedMouseSensitivity: number = 0;
  private sensitivityCacheTimestamp: number = 0;

  constructor(canvas: HTMLCanvasElement, quality: QualityLevel = 'high') {
    this.canvas = canvas;
    this.quality = quality;

    // 低/中画质关闭 MSAA 抗锯齿以提升帧率
    const antialias = quality === 'high' || quality === 'ultra';
    // 低/中画质不按 devicePixelRatio 渲染（始终 1x）
    const adaptToDeviceRatio = quality === 'high' || quality === 'ultra';

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias,
      adaptToDeviceRatio,
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

      // 钳制单次事件增量，防止指针锁定重获时浏览器报告巨幅位移
      const clampedDX = Math.max(-MAX_MOUSE_DELTA_PER_EVENT, Math.min(MAX_MOUSE_DELTA_PER_EVENT, rawDX));
      const clampedDY = Math.max(-MAX_MOUSE_DELTA_PER_EVENT, Math.min(MAX_MOUSE_DELTA_PER_EVENT, rawDY));

      // 当前为手柄控制：累计鼠标位移，达到阈值则"待命"，等待开火键确认切换。
      // 仅累计移动量，不旋转摄像机（避免手柄控制时鼠标误触）。
      if (this.activeController === 'gamepad') {
        // 超出窗口则重置累计（要求一段连续的大幅移动）
        if (now - this.lastMouseAccumTime > MOUSE_SWITCH_WINDOW_MS) {
          this.mouseAccum = 0;
        }
        this.mouseAccum += Math.abs(clampedDX) + Math.abs(clampedDY);
        this.lastMouseAccumTime = now;
        return;
      }

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

    // 鼠标左键按下 — 当前为手柄控制时，作为切回鼠标的确认信号
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.cameraControlEnabled) return;
      if (this.activeController !== 'gamepad') return;

      const now = performance.now();
      // 累计窗口未过期，且累计位移达到阈值 → 切换到鼠标控制
      const accumFresh = now - this.lastMouseAccumTime <= MOUSE_SWITCH_WINDOW_MS;
      if (accumFresh && this.mouseAccum >= MOUSE_SWITCH_ACCUM_THRESHOLD) {
        this.activeController = 'mouse';
        this.mouseAccum = 0;
        this.gamepadStickArmed = false;
      }
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

    // 应用画质相关的场景设置
    this.applyQualitySettings();

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
    const rightDeadzone = settings.rightDeadzone ?? 0.1;

    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;

      const rx = gp.axes[2] || 0;
      const ry = gp.axes[3] || 0;
      const magnitude = Math.sqrt(rx ** 2 + ry ** 2);

      if (this.activeController !== 'gamepad') {
        if (magnitude < rightDeadzone) return;
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

  /** 获取当前画质对应的球体分段数（三角面密度） */
  getQualitySphereSegments(): number {
    return QUALITY_SPHERE_SEGMENTS[this.quality];
  }

  /** 应用画质相关的渲染设置 */
  private applyQualitySettings(): void {
    // 渲染分辨率缩放：low=2(半分辨率) → ultra=0.75(超采样)
    const scaling = QUALITY_SCALING[this.quality] ?? 1;
    this.engine.setHardwareScalingLevel(scaling);

    if (this.scene) {
      // 低画质禁用阴影和后期处理
      this.scene.shadowsEnabled = this.quality !== 'low';
      this.scene.postProcessesEnabled = this.quality === 'high' || this.quality === 'ultra';
    }
  }

  /** 运行时切换画质（供设置页实时预览用） */
  setQuality(level: QualityLevel): void {
    this.quality = level;
    this.applyQualitySettings();
  }

  /** 获取当前画质等级 */
  getQuality(): QualityLevel {
    return this.quality;
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
