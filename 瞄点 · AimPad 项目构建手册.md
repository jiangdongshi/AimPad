# 瞄点 · AimPad 项目构建手册

## 目录

- [1. 环境准备](#1-环境准备)
- [2. 项目初始化](#2-项目初始化)
- [3. 项目目录结构](#3-项目目录结构)
- [4. 核心模块构建指南](#4-核心模块构建指南)
  - [4.1 手柄识别与管理模块](#41-手柄识别与管理模块)
  - [4.2 Babylon.js 3D 场景搭建](#42-babylonjs-3d-场景搭建)
  - [4.3 训练任务系统](#43-训练任务系统)
  - [4.4 数据统计与分析模块](#44-数据统计与分析模块)
  - [4.5 输入系统抽象层](#45-输入系统抽象层)
- [5. 状态管理与数据流](#5-状态管理与数据流)
- [6. 样式与 UI 系统](#6-样式与-ui-系统)
- [7. 性能优化策略](#7-性能优化策略)
- [8. 开发工作流](#8-开发工作流)
- [9. 构建与部署](#9-构建与部署)
- [10. 常见问题与解决方案](#10-常见问题与解决方案)
- [附录 A：技术选型总览](#附录-a技术选型总览)
- [附录 B：开发里程碑](#附录-b开发里程碑)

---

## 1. 环境准备

### 1.1 必要工具

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | ≥ 18.x | JavaScript 运行时 |
| npm 或 yarn | 最新稳定版 | 包管理器 |
| Git | ≥ 2.x | 版本控制 |
| VS Code | 最新稳定版 | 推荐编辑器 |

### 1.2 推荐 VS Code 扩展

| 扩展 | 用途 |
|------|------|
| ESLint | 代码规范检查 |
| Prettier | 代码格式化 |
| Tailwind CSS IntelliSense | Tailwind 智能提示 |
| TypeScript Vue Plugin (Volar) | TS 类型支持 |
| Babylon.js Editor | 3D 场景辅助 |

### 1.3 浏览器要求

| 浏览器 | 最低版本 | Gamepad API 支持 |
|--------|----------|------------------|
| Chrome | 35+ | ✅ 完整支持 |
| Firefox | 29+ | ✅ 完整支持 |
| Edge | 12+ | ✅ 完整支持 |
| Safari | 10.1+ | ⚠️ 部分支持 |
| iOS Safari | - | ❌ 不支持 |

> **提示**：开发时推荐使用 Chrome DevTools 的 Gamepad 模拟功能，可在不连接实体手柄的情况下测试手柄交互。

---

## 2. 项目初始化

### 2.1 创建项目

```bash
# 使用 Vite + React + TypeScript 脚手架
npm create vite@latest AimPad -- --template react-ts
cd AimPad
```

### 2.2 安装核心依赖

```bash
# 3D 引擎
npm install babylonjs @babylonjs/gui @babylonjs/loaders @babylonjs/materials

# 状态管理与路由
npm install zustand react-router-dom

# 样式
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 图表与数据可视化
npm install recharts

# 工具库
npm install dayjs lodash-es
npm install -D @types/lodash-es
```

### 2.3 项目配置文件

**tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        accent: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
        },
      },
      fontFamily: {
        gaming: ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

---

## 3. 项目目录结构

```
AimPad/
├── public/
│   ├── models/              # 3D 模型文件（.glb/.gltf）
│   ├── textures/            # 纹理贴图
│   ├── sounds/              # 音效文件
│   └── favicon.ico
├── src/
│   ├── components/          # React 组件
│   │   ├── ui/              # 通用 UI 组件（Button、Card、Modal 等）
│   │   ├── hud/             # HUD 组件（准星、血条、弹药数等）
│   │   ├── dashboard/       # 数据统计面板组件
│   │   ├── settings/        # 设置页面组件
│   │   └── layout/          # 布局组件（Header、Sidebar、Footer）
│   ├── game/                # Babylon.js 游戏逻辑
│   │   ├── scenes/          # 不同训练任务场景
│   │   │   ├── BaseScene.ts
│   │   │   ├── GridshotScene.ts
│   │   │   └── SphereTrackScene.ts
│   │   ├── entities/        # 游戏实体（目标、准星、特效）
│   │   ├── input/           # 输入抽象层
│   │   │   ├── InputManager.ts
│   │   │   ├── GamepadAdapter.ts
│   │   │   └── MouseAdapter.ts
│   │   ├── physics/         # 物理与碰撞检测
│   │   └── engine/          # Babylon.js 引擎配置
│   ├── hooks/               # 自定义 React Hooks
│   │   ├── useGamepad.ts
│   │   ├── useTraining.ts
│   │   └── useStatistics.ts
│   ├── stores/              # Zustand 状态管理
│   │   ├── gameStore.ts
│   │   ├── settingsStore.ts
│   │   └── statsStore.ts
│   ├── utils/               # 工具函数
│   │   ├── scoring.ts       # 评分算法
│   │   ├── hitDetection.ts  # 命中检测
│   │   ├── gamepadMap.ts    # 手柄按键映射
│   │   └── storage.ts       # IndexedDB 封装
│   ├── types/               # TypeScript 类型定义
│   │   ├── gamepad.ts
│   │   ├── training.ts
│   │   └── statistics.ts
│   ├── styles/              # 全局样式
│   │   ├── tokens.css       # CSS 变量定义
│   │   ├── typography.css
│   │   └── global.css
│   ├── pages/               # 页面组件
│   │   ├── Home.tsx
│   │   ├── Training.tsx
│   │   ├── Statistics.tsx
│   │   └── Settings.tsx
│   ├── App.tsx
│   └── main.tsx
├── server/                  # 后端 API（Phase 2+）
├── .eslintrc.cjs
├── .prettierrc
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 4. 核心模块构建指南

### 4.1 手柄识别与管理模块

手柄支持是 AimPad 的核心差异化功能。采用**原生 Gamepad API + 自研封装**方案。

#### 4.1.1 手柄类型检测与按键映射

```typescript
// src/types/gamepad.ts
export type GamepadType = 'xbox' | 'playstation' | 'switch' | 'unknown';

export interface ButtonMapping {
  A: number;
  B: number;
  X: number;
  Y: number;
  LB: number;
  RB: number;
  LT: number;
  RT: number;
  LS: number;
  RS: number;
  Start: number;
  Select: number;
  DPadUp: number;
  DPadDown: number;
  DPadLeft: number;
  DPadRight: number;
}

// src/utils/gamepadMap.ts
const GAMEPAD_MAPPINGS: Record<GamepadType, ButtonMapping> = {
  xbox: {
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9, LS: 10, RS: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
  },
  playstation: {
    A: 0, B: 1, X: 2, Y: 3,    // Cross, Circle, Square, Triangle
    LB: 4, RB: 5, LT: 6, RT: 7, // L1, R1, L2, R2
    Select: 8, Start: 9, LS: 10, RS: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
  },
  switch: {
    A: 1, B: 0, X: 3, Y: 2,    // Nintendo 布局
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9, LS: 10, RS: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
  },
  unknown: {
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9, LS: 10, RS: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
  },
};

export function detectGamepadType(gamepad: Gamepad): GamepadType {
  const id = gamepad.id.toLowerCase();
  if (id.includes('xbox') || id.includes('xinput')) return 'xbox';
  if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense')) return 'playstation';
  if (id.includes('switch') || id.includes('pro controller')) return 'switch';
  return 'unknown';
}

export function getButtonMapping(gamepad: Gamepad): ButtonMapping {
  const type = detectGamepadType(gamepad);
  return GAMEPAD_MAPPINGS[type];
}
```

#### 4.1.2 手柄输入管理器

```typescript
// src/game/input/GamepadAdapter.ts
import { detectGamepadType, getButtonMapping } from '@/utils/gamepadMap';
import type { GamepadType, ButtonMapping } from '@/types/gamepad';

export interface GamepadState {
  connected: boolean;
  type: GamepadType;
  id: string;
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  buttons: Record<string, { pressed: boolean; value: number }>;
}

const DEFAULT_DEADZONE = 0.1;

export class GamepadAdapter {
  private state: GamepadState;
  private deadzone: number;
  private mapping: ButtonMapping | null = null;

  constructor(deadzone = DEFAULT_DEADZONE) {
    this.deadzone = deadzone;
    this.state = {
      connected: false,
      type: 'unknown',
      id: '',
      leftStick: { x: 0, y: 0 },
      rightStick: { x: 0, y: 0 },
      buttons: {},
    };
  }

  update(gamepad: Gamepad | null): GamepadState {
    if (!gamepad) {
      this.state.connected = false;
      return this.state;
    }

    if (!this.mapping || this.state.id !== gamepad.id) {
      this.mapping = getButtonMapping(gamepad);
      this.state.type = detectGamepadType(gamepad);
      this.state.id = gamepad.id;
      this.state.connected = true;
    }

    // 更新摇杆状态（带死区处理）
    this.state.leftStick = this.applyDeadzone({
      x: gamepad.axes[0] || 0,
      y: gamepad.axes[1] || 0,
    });
    this.state.rightStick = this.applyDeadzone({
      x: gamepad.axes[2] || 0,
      y: gamepad.axes[3] || 0,
    });

    // 更新按钮状态
    gamepad.buttons.forEach((button, index) => {
      this.state.buttons[index] = {
        pressed: button.pressed,
        value: button.value,
      };
    });

    return this.state;
  }

  private applyDeadzone(stick: { x: number; y: number }) {
    const magnitude = Math.sqrt(stick.x ** 2 + stick.y ** 2);
    if (magnitude < this.deadzone) {
      return { x: 0, y: 0 };
    }
    // 重新映射以保持平滑过渡
    const scale = (magnitude - this.deadzone) / (1 - this.deadzone);
    return {
      x: (stick.x / magnitude) * scale,
      y: (stick.y / magnitude) * scale,
    };
  }

  getState(): GamepadState {
    return { ...this.state };
  }

  setDeadzone(value: number) {
    this.deadzone = Math.max(0, Math.min(0.5, value));
  }
}
```

#### 4.1.3 React Hook 封装

```typescript
// src/hooks/useGamepad.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { GamepadAdapter, GamepadState } from '@/game/input/GamepadAdapter';

export function useGamepad(deadzone = 0.1) {
  const adapterRef = useRef<GamepadAdapter | null>(null);
  const [state, setState] = useState<GamepadState>({
    connected: false,
    type: 'unknown',
    id: '',
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
    buttons: {},
  });

  useEffect(() => {
    adapterRef.current = new GamepadAdapter(deadzone);

    const handleConnect = (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id);
    };

    const handleDisconnect = () => {
      setState(prev => ({ ...prev, connected: false }));
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    // 每帧轮询手柄状态
    let animationId: number;
    const poll = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (gp && adapterRef.current) {
          setState(adapterRef.current.update(gp));
          break;
        }
      }
      animationId = requestAnimationFrame(poll);
    };
    animationId = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
      cancelAnimationFrame(animationId);
    };
  }, [deadzone]);

  const setDeadzone = useCallback((value: number) => {
    adapterRef.current?.setDeadzone(value);
  }, []);

  return { ...state, setDeadzone };
}
```

---

### 4.2 Babylon.js 3D 场景搭建

#### 4.2.1 引擎初始化

```typescript
// src/game/engine/GameEngine.ts
import * as BABYLON from 'babylonjs';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private scene: BABYLON.Scene | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    // 响应窗口大小变化
    window.addEventListener('resize', () => this.engine.resize());
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
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);

    return this.scene;
  }

  startRenderLoop() {
    this.engine.runRenderLoop(() => {
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
}
```

#### 4.2.2 训练场景基类

```typescript
// src/game/scenes/BaseScene.ts
import * as BABYLON from 'babylonjs';
import { GameEngine } from '../engine/GameEngine';

export interface TrainingResult {
  hits: number;
  misses: number;
  reactionTimes: number[];
  killTimes: number[];
  duration: number;
  score: number;
}

export abstract class BaseScene {
  protected engine: GameEngine;
  protected scene: BABYLON.Scene;
  protected camera: BABYLON.UniversalCamera;
  protected targets: BABYLON.Mesh[] = [];
  protected startTime: number = 0;
  protected isActive: boolean = false;

  // 统计数据
  protected hits: number = 0;
  protected misses: number = 0;
  protected reactionTimes: number[] = [];
  protected killTimes: number[] = [];

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.scene = engine.createScene();
    this.camera = this.scene.getCameraByName('camera') as BABYLON.UniversalCamera;
  }

  abstract setup(): Promise<void>;
  abstract update(deltaTime: number): void;

  start() {
    this.resetStats();
    this.startTime = performance.now();
    this.isActive = true;
    this.setupShooting();
  }

  stop(): TrainingResult {
    this.isActive = false;
    return {
      hits: this.hits,
      misses: this.misses,
      reactionTimes: this.reactionTimes,
      killTimes: this.killTimes,
      duration: performance.now() - this.startTime,
      score: this.calculateScore(),
    };
  }

  protected resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.reactionTimes = [];
    this.killTimes = [];
  }

  protected setupShooting() {
    this.scene.onPointerDown = (evt) => {
      if (!this.isActive) return;

      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        BABYLON.Matrix.Identity(),
        this.camera
      );

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
      'target',
      { diameter: size },
      this.scene
    );
    target.position = position;
    target.metadata = {
      isTarget: true,
      spawnTime: performance.now(),
    };

    // 高亮材质
    const material = new BABYLON.StandardMaterial('targetMat', this.scene);
    material.emissiveColor = new BABYLON.Color3(1, 0.3, 0.3);
    material.diffuseColor = new BABYLON.Color3(1, 0.2, 0.2);
    target.material = material;

    this.targets.push(target);
    return target;
  }

  protected removeTarget(mesh: BABYLON.Mesh) {
    // 消失特效
    const animation = new BABYLON.Animation(
      'scaleDown',
      'scaling',
      60,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3
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
    const avgReaction = this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length;
    const timeFactor = 1000 / (avgReaction + 100);
    return Math.round(this.hits * 100 * accuracy * timeFactor);
  }

  dispose() {
    this.targets.forEach(t => t.dispose());
    this.scene.dispose();
  }
}
```

#### 4.2.3 Gridshot 训练场景示例

```typescript
// src/game/scenes/GridshotScene.ts
import * as BABYLON from 'babylonjs';
import { BaseScene } from './BaseScene';

interface GridshotConfig {
  targetCount: number;
  targetSize: number;
  gridRows: number;
  gridCols: number;
  duration: number; // 毫秒
}

export class GridshotScene extends BaseScene {
  private config: GridshotConfig;
  private lastSpawnTime: number = 0;
  private spawnInterval: number = 800; // ms

  constructor(engine, config?: Partial<GridshotConfig>) {
    super(engine);
    this.config = {
      targetCount: 3,
      targetSize: 0.8,
      gridRows: 3,
      gridCols: 5,
      duration: 30000,
      ...config,
    };
  }

  async setup() {
    // 创建训练场地面
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: 20, height: 20 },
      this.scene
    );
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
    ground.material = groundMat;

    // 创建网格背景线
    this.createGridLines();

    // 初始生成目标
    for (let i = 0; i < this.config.targetCount; i++) {
      this.spawnRandomTarget();
    }
  }

  update(deltaTime: number) {
    if (!this.isActive) return;

    // 检查是否需要生成新目标
    const now = performance.now();
    if (this.targets.length < this.config.targetCount &&
        now - this.lastSpawnTime > this.spawnInterval) {
      this.spawnRandomTarget();
      this.lastSpawnTime = now;
    }

    // 检查训练时间
    if (now - this.startTime > this.config.duration) {
      this.stop();
    }
  }

  private spawnRandomTarget() {
    const { gridRows, gridCols, targetSize } = this.config;
    const cellWidth = 16 / gridCols;
    const cellHeight = 10 / gridRows;

    const row = Math.floor(Math.random() * gridRows);
    const col = Math.floor(Math.random() * gridCols);

    const x = (col - gridCols / 2 + 0.5) * cellWidth;
    const y = (row + 0.5) * cellHeight + 1;
    const z = 5 + Math.random() * 3;

    this.spawnTarget(new BABYLON.Vector3(x, y, z), targetSize);
  }

  private createGridLines() {
    // 简化版本，实际可使用 Lines Mesh 创建网格线
    for (let i = 0; i <= this.config.gridCols; i++) {
      const x = (i - this.config.gridCols / 2) * (16 / this.config.gridCols);
      const line = BABYLON.MeshBuilder.CreateLines(
        `gridLineV${i}`,
        {
          points: [
            new BABYLON.Vector3(x, 1, 5),
            new BABYLON.Vector3(x, 11, 5),
          ],
        },
        this.scene
      );
      line.color = new BABYLON.Color3(0.3, 0.3, 0.4);
    }
  }
}
```

---

### 4.3 训练任务系统

#### 4.3.1 训练任务配置接口

```typescript
// src/types/training.ts
export type TaskType =
  | 'static-clicking'
  | 'dynamic-clicking'
  | 'tracking'
  | 'target-switching'
  | 'reaction';

export interface TrainingTaskConfig {
  id: string;
  name: string;
  type: TaskType;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  duration: number; // 毫秒
  parameters: {
    targetCount: number;
    targetSize: number;
    targetSpeed: number;       // 动态任务用
    spawnInterval: number;     // ms
    minDistance: number;
    maxDistance: number;
  };
  scoring: {
    weightAccuracy: number;
    weightSpeed: number;
    weightConsistency: number;
  };
}

// 预设任务配置
export const TRAINING_TASKS: TrainingTaskConfig[] = [
  {
    id: 'gridshot',
    name: 'Gridshot',
    type: 'static-clicking',
    description: '快速点击网格中的固定目标，训练基础定位能力',
    difficulty: 'beginner',
    duration: 30000,
    parameters: {
      targetCount: 3,
      targetSize: 0.8,
      targetSpeed: 0,
      spawnInterval: 800,
      minDistance: 5,
      maxDistance: 10,
    },
    scoring: {
      weightAccuracy: 0.4,
      weightSpeed: 0.4,
      weightConsistency: 0.2,
    },
  },
  {
    id: 'sphere-track',
    name: 'SphereTrack',
    type: 'tracking',
    description: '持续追踪移动中的球体，训练跟枪平滑度',
    difficulty: 'intermediate',
    duration: 30000,
    parameters: {
      targetCount: 1,
      targetSize: 1.2,
      targetSpeed: 3,
      spawnInterval: 0,
      minDistance: 5,
      maxDistance: 10,
    },
    scoring: {
      weightAccuracy: 0.6,
      weightSpeed: 0.1,
      weightConsistency: 0.3,
    },
  },
  // 更多任务配置...
];
```

#### 4.3.2 评分算法

```typescript
// src/utils/scoring.ts
export interface ScoreComponents {
  accuracy: number;       // 0-100
  speed: number;          // 0-100
  consistency: number;    // 0-100
  rawScore: number;
  finalScore: number;
}

export function calculateStaticClickingScore(
  hits: number,
  misses: number,
  reactionTimes: number[],
  killTimes: number[],
  weights: { accuracy: number; speed: number; consistency: number }
): ScoreComponents {
  // 准确率
  const accuracy = hits + misses > 0
    ? (hits / (hits + misses)) * 100
    : 0;

  // 速度得分（反应时间越短越好）
  const avgReaction = reactionTimes.length > 0
    ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
    : 1000;
  const speed = Math.max(0, 100 - (avgReaction / 10));

  // 一致性（击杀时间标准差越小越好）
  const consistency = calculateConsistency(killTimes);

  // 原始分数
  const rawScore = hits * 100;

  // 加权综合分
  const finalScore = Math.round(
    rawScore *
    (accuracy / 100) ** weights.accuracy *
    (speed / 100) ** weights.speed *
    (consistency / 100) ** weights.consistency
  );

  return { accuracy, speed, consistency, rawScore, finalScore };
}

function calculateConsistency(times: number[]): number {
  if (times.length < 2) return 100;
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
  const stdDev = Math.sqrt(variance);
  // 标准差越小，一致性越高
  return Math.max(0, 100 - stdDev / 10);
}

export function calculateSmoothness(
  cursorPositions: { x: number; y: number }[],
  targetPositions: { x: number; y: number }[]
): number {
  if (cursorPositions.length < 3) return 0;

  // 计算加速度变化（jerk）
  let totalJerk = 0;
  for (let i = 2; i < cursorPositions.length; i++) {
    const dx1 = cursorPositions[i - 1].x - cursorPositions[i - 2].x;
    const dy1 = cursorPositions[i - 1].y - cursorPositions[i - 2].y;
    const dx2 = cursorPositions[i].x - cursorPositions[i - 1].x;
    const dy2 = cursorPositions[i].y - cursorPositions[i - 1].y;
    const jerk = Math.sqrt((dx2 - dx1) ** 2 + (dy2 - dy1) ** 2);
    totalJerk += jerk;
  }

  // 计算跟踪误差
  let totalError = 0;
  for (let i = 0; i < Math.min(cursorPositions.length, targetPositions.length); i++) {
    const dx = cursorPositions[i].x - targetPositions[i].x;
    const dy = cursorPositions[i].y - targetPositions[i].y;
    totalError += Math.sqrt(dx * dx + dy * dy);
  }
  const avgError = totalError / cursorPositions.length;

  return Math.max(0, 100 / (1 + totalJerk * 0.1 + avgError * 0.05));
}
```

---

### 4.4 数据统计与分析模块

#### 4.4.1 本地存储封装

```typescript
// src/utils/storage.ts
const DB_NAME = 'AimPadDB';
const DB_VERSION = 1;

interface TrainingRecord {
  id: string;
  taskId: string;
  timestamp: number;
  score: number;
  accuracy: number;
  reactionTime: number;
  kills: number;
  misses: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

class TrainingStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('training')) {
          const store = db.createObjectStore('training', { keyPath: 'id' });
          store.createIndex('taskId', 'taskId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveRecord(record: TrainingRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('training', 'readwrite');
      const store = transaction.objectStore('training');
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRecords(taskId?: string, limit = 100): Promise<TrainingRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('training', 'readonly');
      const store = transaction.objectStore('training');
      const request = taskId
        ? store.index('taskId').getAll(taskId)
        : store.getAll();

      request.onsuccess = () => {
        const results = request.result as TrainingRecord[];
        resolve(
          results
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit)
        );
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getBestScore(taskId: string): Promise<number> {
    const records = await this.getRecords(taskId, 1000);
    return records.reduce((max, r) => Math.max(max, r.score), 0);
  }
}

export const trainingStorage = new TrainingStorage();
```

#### 4.4.2 统计分析 React Hook

```typescript
// src/hooks/useStatistics.ts
import { useState, useEffect } from 'react';
import { trainingStorage } from '@/utils/storage';

interface TrainingStats {
  totalSessions: number;
  averageScore: number;
  bestScore: number;
  averageAccuracy: number;
  averageReactionTime: number;
  improvementTrend: number; // 正数表示提升，负数表示下降
  recentScores: number[];
}

export function useStatistics(taskId?: string) {
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [taskId]);

  async function loadStats() {
    setLoading(true);
    try {
      const records = await trainingStorage.getRecords(taskId, 1000);

      if (records.length === 0) {
        setStats(null);
        return;
      }

      const totalSessions = records.length;
      const averageScore = records.reduce((sum, r) => sum + r.score, 0) / totalSessions;
      const bestScore = Math.max(...records.map(r => r.score));
      const averageAccuracy = records.reduce((sum, r) => sum + r.accuracy, 0) / totalSessions;
      const averageReactionTime = records.reduce((sum, r) => sum + r.reactionTime, 0) / totalSessions;

      // 计算趋势（最近 10 次 vs 之前 10 次）
      const recent = records.slice(0, 10);
      const previous = records.slice(10, 20);
      const recentAvg = recent.reduce((s, r) => s + r.score, 0) / recent.length;
      const previousAvg = previous.length > 0
        ? previous.reduce((s, r) => s + r.score, 0) / previous.length
        : recentAvg;
      const improvementTrend = ((recentAvg - previousAvg) / previousAvg) * 100;

      setStats({
        totalSessions,
        averageScore: Math.round(averageScore),
        bestScore,
        averageAccuracy: Math.round(averageAccuracy * 10) / 10,
        averageReactionTime: Math.round(averageReactionTime),
        improvementTrend: Math.round(improvementTrend * 10) / 10,
        recentScores: recent.map(r => r.score).reverse(),
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return { stats, loading, refresh: loadStats };
}
```

---

### 4.5 输入系统抽象层

为了统一处理鼠标和手柄输入，建立输入抽象层：

```typescript
// src/game/input/InputManager.ts
import { GamepadAdapter } from './GamepadAdapter';

export interface InputState {
  // 视角控制
  lookX: number;   // -1 到 1
  lookY: number;   // -1 到 1
  // 射击
  shoot: boolean;
  shootPressed: boolean;  // 单次按下检测
  // 移动
  moveX: number;   // -1 到 1
  moveY: number;   // -1 到 1
  // 动作
  reload: boolean;
  pause: boolean;
}

export class InputManager {
  private gamepadAdapter: GamepadAdapter;
  private mouseState = { x: 0, y: 0, shoot: false, lastShoot: false };
  private currentState: InputState;
  private useGamepad: boolean = false;

  constructor() {
    this.gamepadAdapter = new GamepadAdapter();
    this.currentState = this.getEmptyState();
    this.setupMouseListeners();
  }

  private getEmptyState(): InputState {
    return {
      lookX: 0, lookY: 0,
      shoot: false, shootPressed: false,
      moveX: 0, moveY: 0,
      reload: false, pause: false,
    };
  }

  private setupMouseListeners() {
    window.addEventListener('mousemove', (e) => {
      this.mouseState.x = e.movementX / 100;
      this.mouseState.y = e.movementY / 100;
    });
    window.addEventListener('mousedown', () => {
      this.mouseState.shoot = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouseState.shoot = false;
    });
  }

  update(): InputState {
    const gamepads = navigator.getGamepads();
    let gp: Gamepad | null = null;
    for (const g of gamepads) {
      if (g) { gp = g; break; }
    }

    if (gp) {
      this.useGamepad = true;
      const gpState = this.gamepadAdapter.update(gp);
      const prevShoot = this.currentState.shoot;

      this.currentState = {
        lookX: gpState.rightStick.x,
        lookY: gpState.rightStick.y,
        shoot: gpState.buttons[7]?.pressed || gpState.buttons[0]?.pressed || false,
        shootPressed: false,
        moveX: gpState.leftStick.x,
        moveY: gpState.leftStick.y,
        reload: gpState.buttons[2]?.pressed || false, // X/Square
        pause: gpState.buttons[9]?.pressed || false,  // Start
      };

      this.currentState.shootPressed = this.currentState.shoot && !prevShoot;
    } else {
      this.useGamepad = false;
      const prevShoot = this.currentState.shoot;
      this.currentState = {
        lookX: this.mouseState.x,
        lookY: this.mouseState.y,
        shoot: this.mouseState.shoot,
        shootPressed: this.mouseState.shoot && !prevShoot,
        moveX: 0,
        moveY: 0,
        reload: false,
        pause: false,
      };
      // 重置鼠标增量
      this.mouseState.x = 0;
      this.mouseState.y = 0;
    }

    return this.currentState;
  }

  isUsingGamepad(): boolean {
    return this.useGamepad;
  }

  dispose() {
    // 清理事件监听
  }
}
```

---

## 5. 状态管理与数据流

### 5.1 Zustand Store 设计

```typescript
// src/stores/gameStore.ts
import { create } from 'zustand';
import { TrainingTaskConfig } from '@/types/training';

interface GameState {
  // 游戏状态
  status: 'idle' | 'playing' | 'paused' | 'completed';
  currentTask: TrainingTaskConfig | null;

  // 实时数据
  score: number;
  hits: number;
  misses: number;
  timeRemaining: number;

  // 操作
  startTraining: (task: TrainingTaskConfig) => void;
  pauseTraining: () => void;
  resumeTraining: () => void;
  endTraining: () => void;
  updateScore: (hits: number, misses: number) => void;
  setTimeRemaining: (time: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: 'idle',
  currentTask: null,
  score: 0,
  hits: 0,
  misses: 0,
  timeRemaining: 0,

  startTraining: (task) => set({
    status: 'playing',
    currentTask: task,
    score: 0,
    hits: 0,
    misses: 0,
    timeRemaining: task.duration,
  }),

  pauseTraining: () => set({ status: 'paused' }),

  resumeTraining: () => set({ status: 'playing' }),

  endTraining: () => set({ status: 'completed' }),

  updateScore: (hits, misses) => set({ hits, misses }),

  setTimeRemaining: (time) => set({ timeRemaining: time }),
}));
```

```typescript
// src/stores/settingsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // 手柄设置
  gamepadDeadzone: number;
  gamepadSensitivity: number;
  gamepadInvertY: boolean;

  // 鼠标设置
  mouseSensitivity: number;
  mouseInvertY: boolean;

  // 显示设置
  crosshairStyle: 'dot' | 'cross' | 'circle';
  crosshairColor: string;
  fov: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';

  // 操作
  updateSettings: (partial: Partial<SettingsState>) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  gamepadDeadzone: 0.1,
  gamepadSensitivity: 1.0,
  gamepadInvertY: false,
  mouseSensitivity: 1.0,
  mouseInvertY: false,
  crosshairStyle: 'dot' as const,
  crosshairColor: '#00ff00',
  fov: 90,
  quality: 'high' as const,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSettings: (partial) => set((state) => ({ ...state, ...partial })),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'aimpad-settings' }
  )
);
```

---

## 6. 样式与 UI 系统

### 6.1 CSS 变量定义

```css
/* src/styles/tokens.css */
:root {
  /* 颜色 */
  --color-bg-primary: #0a0a14;
  --color-bg-secondary: #12121e;
  --color-bg-surface: #1a1a2e;
  --color-text-primary: #e8e8f0;
  --color-text-secondary: #8888a0;
  --color-accent: #f59e0b;
  --color-accent-hover: #fbbf24;
  --color-success: #22c55e;
  --color-danger: #ef4444;

  /* 间距 */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* 圆角 */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;

  /* 字体 */
  --font-gaming: 'Orbitron', 'Rajdhani', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* 阴影 */
  --shadow-glow: 0 0 20px rgba(245, 158, 11, 0.3);
  --shadow-neon: 0 0 10px rgba(0, 255, 255, 0.5);
}
```

### 6.2 HUD 准星组件

```tsx
// src/components/hud/Crosshair.tsx
import { useSettingsStore } from '@/stores/settingsStore';

export function Crosshair() {
  const { crosshairStyle, crosshairColor } = useSettingsStore();

  const styles: Record<string, React.CSSProperties> = {
    dot: {
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      backgroundColor: crosshairColor,
    },
    cross: {
      width: '20px',
      height: '20px',
      position: 'relative',
    },
    circle: {
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      border: `2px solid ${crosshairColor}`,
    },
  };

  if (crosshairStyle === 'dot') {
    return (
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
        style={styles.dot}
      />
    );
  }

  if (crosshairStyle === 'cross') {
    return (
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
        {/* 水平线 */}
        <div
          className="absolute top-1/2 left-0 w-full h-[2px] -translate-y-1/2"
          style={{ backgroundColor: crosshairColor }}
        />
        {/* 垂直线 */}
        <div
          className="absolute top-0 left-1/2 w-[2px] h-full -translate-x-1/2"
          style={{ backgroundColor: crosshairColor }}
        />
        {/* 中心点 */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[4px] h-[4px] rounded-full"
          style={{ backgroundColor: crosshairColor }}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
      style={styles.circle}
    />
  );
}
```

---

## 7. 性能优化策略

### 7.1 渲染优化

| 优化项 | 策略 | 目标 |
|--------|------|------|
| 帧率控制 | 固定 60fps / 120fps 选项 | 流畅体验 |
| LOD | 根据距离动态调整模型精度 | 降低 GPU 负载 |
| 实例化渲染 | 相同目标使用 GPU Instancing | 减少 draw call |
| 视锥剔除 | 仅渲染视野内物体 | 节省渲染开销 |
| 画质档位 | low/medium/high/ultra 四档 | 兼容不同设备 |

### 7.2 手柄响应优化

```typescript
// 高频轮询 + 输入平滑
class InputSmoother {
  private buffer: number[] = [];
  private bufferSize = 3;

  smooth(value: number): number {
    this.buffer.push(value);
    if (this.buffer.length > this.bufferBufferSize) {
      this.buffer.shift();
    }
    return this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
  }
}
```

### 7.3 内存管理

```typescript
// 训练结束时清理资源
function cleanupTraining(scene: BABYLON.Scene, entities: BABYLON.Mesh[]) {
  entities.forEach(entity => {
    entity.dispose();
  });
  scene.getEngine().wipeCaches(true);
}
```

---

## 8. 开发工作流

### 8.1 Git 分支策略

```
main          ← 生产环境
├── develop   ← 开发主线
│   ├── feature/gamepad-support
│   ├── feature/training-tasks
│   └── feature/statistics
└── hotfix/*  ← 紧急修复
```

### 8.2 提交规范

```
<type>(<scope>): <description>

[可选正文]

[可选脚注]
```

**Type 类型**：
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 重构
- `docs`: 文档
- `test`: 测试
- `chore`: 构建/工具
- `perf`: 性能优化

**示例**：
```
feat(gamepad): 添加 PlayStation 手柄按键映射
fix(scoring): 修复跟枪平滑度计算溢出问题
perf(render): 启用 GPU Instancing 优化大量目标渲染
```

### 8.3 测试策略

| 测试类型 | 工具 | 覆盖目标 |
|----------|------|----------|
| 单元测试 | Vitest + Testing Library | ≥ 80% |
| 组件测试 | React Testing Library | 核心组件 |
| E2E 测试 | Playwright | 关键用户流程 |
| 性能测试 | Lighthouse | CWV 达标 |

---

## 9. 构建与部署

### 9.1 本地构建

```bash
# 开发环境
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 9.2 环境变量

```bash
# .env.local
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_GA_ID=G-XXXXXXXXXX
```

### 9.3 Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 生产部署
vercel --prod
```

**vercel.json 配置**：

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 9.4 Cloudflare Pages 部署

1. 连接 GitHub 仓库
2. 设置构建命令：`npm run build`
3. 设置输出目录：`dist`
4. 配置环境变量

---

## 10. 常见问题与解决方案

### Q1: Gamepad API 在 Safari 中不工作

**问题**：Safari 对 Gamepad API 支持有限，某些手柄无法识别。

**解决**：
- 检测浏览器能力，显示兼容性提示
- 提供键鼠作为备用方案
- 引导用户使用 Chrome/Firefox

### Q2: 手柄摇杆漂移

**问题**：摇杆存在轻微漂移导致准星移动。

**解决**：
```typescript
// 调整死区配置
deadzone: 0.12  // 从默认 0.1 提高到 0.12
```

### Q3: 3D 场景帧率低

**问题**：在低配设备上帧率不足 30fps。

**解决**：
```typescript
// 降低画质
engine.setHardwareScalingLevel(2);  // 降低渲染分辨率
scene.shadowsEnabled = false;       // 关闭阴影
scene.postProcessesEnabled = false; // 关闭后处理
```

### Q4: IndexedDB 数据丢失

**问题**：清除浏览器缓存导致训练数据丢失。

**解决**：
- 提示用户注册账号，开启云端同步
- 支持数据导出为 JSON 文件
- 定期自动备份到 localStorage（小数据量）

---

## 附录 A：技术选型总览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | 18 | UI 开发 |
| 语言 | TypeScript | 5.x | 类型安全 |
| 状态 | Zustand | 4.x | 轻量状态管理 |
| 路由 | React Router | v6 | 页面路由 |
| 样式 | TailwindCSS | 3.x | 原子化 CSS |
| 3D | Babylon.js | 6.x | 3D 渲染引擎 |
| 图表 | Recharts | 2.x | 数据可视化 |
| 构建 | Vite | 5.x | 构建工具 |
| 部署 | Vercel/CF Pages | - | 边缘部署 |

---

## 附录 B：开发里程碑

### Phase 1：MVP 核心功能（4-6 周）

- [x] 项目初始化与基础架构
- [x] Babylon.js 引擎集成与基础场景
- [x] Gamepad API 接入与输入抽象层
- [x] Gridshot 训练任务实现
- [x] SphereTrack 跟枪任务实现
- [x] 本地成绩记录（IndexedDB）
- [x] 基础 UI 界面（首页、训练页、结果页）

### Phase 2：功能完善（6-8 周）

- [ ] 完整训练任务库（6-8 个任务）
- [x] 数据统计仪表板
- [ ] 自定义任务系统
- [ ] 用户系统与云端存储
- [x] 准星自定义功能
- [ ] 手柄灵敏度曲线配置

### Phase 3：社交与进阶（4-6 周）

- [ ] 排行榜系统
- [ ] 好友功能与成绩对比
- [ ] 任务分享功能
- [ ] 成就系统
- [ ] 多语言支持

### Phase 4：优化与扩展（持续迭代）

- [ ] 性能优化与移动端适配
- [ ] AI 训练建议（根据弱项推荐任务）
- [ ] 弹道可视化工具
- [ ] 游戏灵敏度转换工具
- [ ] WebGPU 支持探索

---

**文档版本**：v1.0
**最后更新**：2026-04-30
**维护者**：@jiangdongshi
