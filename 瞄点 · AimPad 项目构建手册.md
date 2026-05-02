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
│   ├── api/                 # API 客户端
│   │   ├── client.ts        # Axios 封装、JWT 拦截器
│   │   ├── auth.ts          # 认证接口
│   │   └── settings.ts      # 设置同步接口
│   ├── components/          # React 组件
│   │   ├── ui/              # 通用 UI 组件
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── ThemeSwitcher.tsx
│   │   │   ├── LanguageSwitcher.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── hud/             # HUD 组件
│   │   │   ├── Crosshair.tsx       # 准星（dot/cross/circle）
│   │   │   ├── TrainingHUD.tsx     # 训练实时数据
│   │   │   └── TrainingResultPanel.tsx  # 训练结果面板
│   │   └── layout/          # 布局组件
│   │       ├── Header.tsx
│   │       └── Layout.tsx
│   ├── game/                # Babylon.js 游戏逻辑
│   │   ├── scenes/          # 训练任务场景
│   │   │   ├── BaseScene.ts         # 场景基类（难度系统、目标过期）
│   │   │   ├── GridshotScene.ts     # 静态点射 / 蜘蛛射击
│   │   │   └── SphereTrackScene.ts  # 跟踪训练
│   │   ├── input/           # 输入抽象层
│   │   │   ├── InputManager.ts
│   │   │   └── GamepadAdapter.ts
│   │   └── engine/          # Babylon.js 引擎配置
│   │       └── GameEngine.ts
│   ├── hooks/               # 自定义 React Hooks
│   │   ├── useGamepad.ts
│   │   ├── useTraining.ts
│   │   ├── useStatistics.ts
│   │   └── useTheme.ts      # 主题 + 国际化
│   ├── stores/              # Zustand 状态管理
│   │   ├── gameStore.ts
│   │   ├── authStore.ts
│   │   └── settingsStore.ts
│   ├── utils/               # 工具函数
│   │   ├── scoring.ts       # 评分算法
│   │   ├── inputSmoother.ts # 输入平滑
│   │   ├── gamepadMap.ts    # 手柄按键映射
│   │   └── storage.ts       # IndexedDB 封装
│   ├── types/               # TypeScript 类型定义
│   │   ├── gamepad.ts
│   │   ├── training.ts      # 任务配置、难度系统
│   │   ├── statistics.ts
│   │   ├── auth.ts
│   │   ├── theme.ts         # 8 主题定义
│   │   └── locale.ts        # 中英文翻译
│   ├── styles/              # 全局样式
│   │   ├── tokens.css       # CSS 设计令牌
│   │   ├── themes.css       # 8 套主题 CSS 变量
│   │   └── global.css       # 全局样式 + 动画
│   ├── pages/               # 页面组件
│   │   ├── Home.tsx
│   │   ├── Training.tsx
│   │   ├── Statistics.tsx
│   │   ├── Settings.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── ForgotPassword.tsx
│   ├── App.tsx
│   └── main.tsx
├── server/                  # 后端 API
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

## 11. 已实现功能总览

### 11.1 训练系统

| 功能 | 说明 |
|------|------|
| **6 个训练任务** | Gridshot（静态点射）、Spidershot（蜘蛛射击）、SphereTrack（球体跟踪）、StrafeTrack（移动跟踪）、TargetSwitch（目标切换）、ReflexShot（反应射击） |
| **5 级游戏难度** | 容易（1.5x）、简单（1.0x）、普通（0.7x）、困难（0.5x + 2s 消失）、地狱（0.3x + 1.2s 消失） |
| **每个任务独立难度** | 各任务难度独立存储于 `localStorage`（key: `aimpad_task_difficulties`），默认为"困难"，切换任务自动加载对应难度 |
| **3 秒倒计时** | 开始训练前显示大号倒计时数字 |
| **Pointer Lock** | 训练时锁定鼠标指针，解锁自动暂停 |
| **ESC 暂停** | 支持在等待、倒计时、游戏中三阶段按 ESC 暂停 |
| **暂停菜单** | 暂停时显示难度选择器（选中蓝色高亮 + 缩放 + 下划线）+ 退出/重新开始/继续按钮 |
| **难度切换自动重置** | 暂停时切换难度，点击继续会回到"点击开始训练"阶段（而非直接恢复） |
| **目标过期机制** | 困难/地狱难度下，目标在指定时间未被击中会消失并计入脱靶（BaseScene.checkExpiredTargets） |
| **Canvas 清除** | 重新开始训练时用 `gl.clear()` + `gl.finish()` 清除 WebGL 画布残影 |
| **WebGL 场景销毁** | 训练结束/重置时正确销毁 Babylon.js 引擎和场景，防止内存泄漏 |

**难度配置详情（GAME_DIFFICULTY_CONFIG）**：

| 难度 | 目标大小倍率 | 目标存活时间 | 说明 |
|------|-------------|-------------|------|
| 容易 | 1.5x | 无限制 | 目标放大 |
| 简单 | 1.0x | 无限制 | 默认大小 |
| 普通 | 0.7x | 无限制 | 目标缩小 |
| 困难 | 0.5x | 2000ms | 目标缩小 + 2 秒后消失 |
| 地狱 | 0.3x | 1200ms | 目标极小 + 1.2 秒后消失 |

### 11.2 3D 游戏引擎

| 功能 | 说明 |
|------|------|
| **Babylon.js v6 引擎** | 带抗锯齿和模板缓冲的 3D 渲染 |
| **FPS 风格摄像机** | 鼠标控制视角旋转，垂直旋转限制 ±60° |
| **光线投射击中检测** | 从摄像机中心发射射线检测目标命中 |
| **目标生成动画** | 红色发光球体，带 GlowLayer 辉光效果 |
| **目标消失动画** | 命中后缩放至零的动画 |
| **网格背景** | Gridshot 场景带墙面网格线参考 |
| **椭圆轨道** | SphereTrack 场景带椭圆轨道引导线 |
| **画质档位** | low（2x 缩放）、medium（1.5x）、high（1x）、ultra（0.75x） |
| **FPS 监控** | 通过 `onBeginFrameObservable` 实时监测帧率 |

### 11.3 输入系统

| 功能 | 说明 |
|------|------|
| **Gamepad API 原生支持** | Xbox / PlayStation / Switch 手柄自动识别 |
| **手柄按键映射** | 针对不同手柄类型的 16 键映射（含 Nintendo A/B 交换） |
| **摇杆死区处理** | 基于幅度的平滑重映射，避免漂移 |
| **输入平滑** | 移动平均缓冲区（默认 3 帧）减少摇杆抖动 |
| **统一输入管理器** | 鼠标/手柄自动切换，边沿检测（shootPressed） |
| **自定义鼠标处理** | 清除默认输入，使用 Pointer Lock API 的 movementX/Y |

### 11.4 HUD 与准星

| 功能 | 说明 |
|------|------|
| **3 种准星样式** | 点状（dot）、十字（cross）、圆形（circle） |
| **准星颜色自定义** | 颜色选择器，实时预览 |
| **准星大小可调** | 2-12px 滑块控制 |
| **训练 HUD** | 顶部：分数、倒计时、命中率；左下：命中数、脱靶数、FPS |
| **训练结果面板** | 最终分数、命中率、击杀数、平均反应时间、训练时长 |

### 11.5 主题系统

| 功能 | 说明 |
|------|------|
| **8 套完整主题** | 深黑（默认）、午夜蓝、森林绿、皇家紫、中国红、纯白、暖奶油、冷灰 |
| **CSS 自定义属性** | 所有颜色通过 `var(--color-*)` 变量驱动 |
| **RGB 变体** | 每个主题同时提供 RGB 值（支持 Tailwind 透明度） |
| **主题跟随 UI** | 暂停菜单、主题选择器、设置页面、Card 组件均跟随主题 |
| **`data-theme` 属性** | 通过 `<html data-theme="...">` 全局切换 |

### 11.6 国际化

| 功能 | 说明 |
|------|------|
| **中英文双语** | 约 170 个翻译键值对 |
| **语言切换器** | 导航栏一键切换"中"/"EN" |
| **覆盖范围** | 导航、首页、训练、结果、HUD、统计、设置、主题、难度、任务类型、认证 |

### 11.7 用户认证

| 功能 | 说明 |
|------|------|
| **邮箱验证码登录** | 发送 4 位验证码，60 秒冷却倒计时 |
| **用户注册** | 邮箱 + 用户名（3-32 字符，字母数字下划线）+ 验证码 |
| **找回密码** | 邮箱 + 验证码 + 新密码 + 确认密码 |
| **JWT 令牌** | 登录后自动持久化，刷新页面自动恢复 |
| **演示模式** | 验证码 1234（开发环境） |
| **注册后同步** | 注册成功自动将本地设置推送到服务器 |

### 11.8 设置与同步

| 功能 | 说明 |
|------|------|
| **手柄设置** | 死区（0-0.5）、灵敏度（0.1-3）、Y 轴反转 |
| **鼠标设置** | 灵敏度（0.1-5）、Y 轴反转 |
| **准星设置** | 样式、颜色、大小 |
| **显示设置** | 画质档位（low/medium/high/ultra） |
| **音效设置** | 启用开关、音量滑块（0-100%） |
| **LocalStorage 持久化** | 通过 Zustand persist 中间件自动保存 |
| **云端同步** | 认证用户可"保存到云端"/"从云端加载" |
| **同步状态指示** | 显示同步中/已同步/错误状态及时间戳 |
| **重置默认** | 一键恢复所有设置 |

### 11.9 数据统计

| 功能 | 说明 |
|------|------|
| **IndexedDB 存储** | 训练结果本地持久化（AimPadDB） |
| **任务筛选** | 按"全部任务"或特定任务过滤 |
| **汇总卡片** | 总训练次数、最佳分数、平均分数、提升趋势 |
| **性能指标** | 平均命中率、平均反应时间、最佳分数 |
| **近期分数图表** | 最近训练成绩的柱状图 |
| **任务统计表** | 每个任务的训练次数、最佳/平均分、命中率（颜色标签） |
| **提升趋势计算** | 最近 10 次 vs 之前 10 次的平均分对比 |

### 11.10 UI 组件库

| 组件 | 说明 |
|------|------|
| **Button** | primary/secondary/danger/ghost 变体，sm/md/lg 尺寸，加载动画，图标槽位 |
| **Card** | default/elevated/bordered 变体，hoverable 交互，CardHeader/CardTitle/CardContent 子组件 |
| **Badge** | default/success/warning/danger/info 变体，药丸形状 |
| **ThemeSwitcher** | 下拉主题选择器，颜色预览圆点，点击外部关闭 |
| **LanguageSwitcher** | 中英文切换按钮 |
| **UserMenu** | 用户头像下拉菜单，显示用户名/邮箱，登出按钮 |

### 11.11 页面清单

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页 | `/` | 项目介绍、功能卡片、热门任务、使用指南 |
| 训练页 | `/training` | 任务选择网格；`?task=xxx` 时进入 3D 画布训练 |
| 统计页 | `/statistics` | 数据面板、趋势图表、任务统计表 |
| 设置页 | `/settings` | 主题、手柄、鼠标、准星、显示、音效设置 |
| 登录页 | `/login` | 邮箱验证码登录 |
| 注册页 | `/register` | 用户注册 |
| 找回密码 | `/forgot-password` | 密码重置 |

### 11.12 布局与导航

| 功能 | 说明 |
|------|------|
| **固定顶部导航栏** | Logo + 导航链接 + 认证区 + 语言/主题切换 |
| **导航高亮** | 当前页面链接高亮显示 |
| **训练时隐藏 Header** | `/training?task=xxx` 时自动隐藏导航栏，全屏画布 |
| **任务选择时显示 Header** | `/training`（无 task 参数）时正常显示导航栏 |
| **响应式布局** | Tailwind CSS 响应式断点适配 |

---

## 附录 A：技术选型总览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | 18 | UI 开发 |
| 语言 | TypeScript | 5.x | 类型安全 |
| 状态 | Zustand | 4.x | 轻量状态管理（persist 中间件） |
| 路由 | React Router | v6 | 页面路由（嵌套路由、URL 参数） |
| 样式 | TailwindCSS | 3.x | 原子化 CSS + CSS 自定义属性主题 |
| 3D | Babylon.js | 6.x | 3D 渲染引擎（@babylonjs/core/gui/loaders/materials） |
| 日期 | dayjs | 最新 | 日期处理 |
| 工具 | lodash-es | 最新 | 工具函数 |
| 测试 | Vitest | 最新 | 单元测试框架 |
| 构建 | Vite | 5.x | 构建工具 + 开发服务器 |
| 部署 | Vercel/CF Pages | - | 边缘部署 |

---

## 附录 B：开发里程碑与完成情况

### Phase 1：MVP 核心功能 ✅ 已完成

- [x] 项目初始化与基础架构（Vite + React 18 + TypeScript）
- [x] Babylon.js 引擎集成与基础场景
- [x] Gamepad API 接入与输入抽象层
- [x] Gridshot 训练任务实现（静态点射）
- [x] SphereTrack 跟枪任务实现（跟枪训练）
- [x] 本地成绩记录（IndexedDB）
- [x] 基础 UI 界面（首页、训练页、结果页）
- [x] 训练任务选择界面（6个预设任务）
- [x] 训练 HUD（分数、时间、命中率、FPS）
- [x] 训练结果面板

### Phase 2：功能完善 ✅ 已完成

- [x] 完整训练任务库（6个任务：Gridshot、Spidershot、SphereTrack、StrafeTrack、TargetSwitch、ReflexShot）
- [x] 数据统计仪表板（Statistics 页面）
- [x] 用户系统与云端存储（邮箱验证码认证 + JWT）
- [x] 准星自定义功能（样式、颜色、大小）
- [x] 手柄灵敏度曲线配置（死区、灵敏度、Y轴反转）
- [x] 8 套主题切换（深黑、午夜蓝、森林绿、皇家紫、中国红、纯白、暖奶油、冷灰）
- [x] 多语言支持（中文/英文，约 170 个翻译键）
- [x] 5 级游戏难度系统（容易/简单/普通/困难/地狱，每个任务独立存储）
- [x] 暂停/恢复系统（ESC 暂停、Pointer Lock 集成、难度选择）
- [x] 目标过期机制（困难 2s、地狱 1.2s 未击中自动消失并计入脱靶）
- [x] 设置云端同步（保存到云端 / 从云端加载）
- [x] 主题感知 UI（所有组件通过 CSS 变量跟随主题）
- [x] 导航栏条件隐藏（训练中自动隐藏，任务选择时显示）
- [ ] 自定义任务系统

### Phase 3：社交与进阶 ⏳ 待开始

- [ ] 排行榜系统
- [ ] 好友功能与成绩对比
- [ ] 任务分享功能
- [ ] 成就系统

### Phase 4：优化与扩展 ⏳ 待开始

- [ ] 性能优化与移动端适配
- [ ] AI 训练建议（根据弱项推荐任务）
- [ ] 弹道可视化工具
- [ ] 游戏灵敏度转换工具
- [ ] WebGPU 支持探索

---

## 附录 C：已完成模块详细清单

### C.1 前端核心架构

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 应用入口 | `src/App.tsx` | ✅ | React Router 路由配置 |
| 主入口 | `src/main.tsx` | ✅ | 应用挂载点 |
| 构建配置 | `vite.config.ts` | ✅ | Vite + React + 路径别名 |
| 类型配置 | `tsconfig.json` | ✅ | TypeScript 严格模式 |
| 样式配置 | `tailwind.config.js` | ✅ | 自定义主题色、字体 |

### C.2 游戏引擎模块

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 游戏引擎 | `src/game/engine/GameEngine.ts` | ✅ | Babylon.js 引擎封装，Pointer Lock 集成，画质档位（low/medium/high/ultra），FPS 监控 |
| 基础场景 | `src/game/scenes/BaseScene.ts` | ✅ | 训练场景基类：目标生成（红色发光球体 + GlowLayer）、光线投射击中检测、难度系统（targetSizeMultiplier + targetLifetime）、目标过期机制、分数计算 |
| Gridshot 场景 | `src/game/scenes/GridshotScene.ts` | ✅ | 网格点射训练：墙面网格线、随机位置生成、支持 Gridshot 和 Spidershot 两种任务 |
| SphereTrack 场景 | `src/game/scenes/SphereTrackScene.ts` | ✅ | 跟踪训练：椭圆轨道运动、光标/目标位置记录、平滑度评分（jerk + 跟踪误差） |

### C.3 输入系统

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 手柄适配器 | `src/game/input/GamepadAdapter.ts` | ✅ | 手柄状态管理、死区处理、类型自动检测 |
| 输入管理器 | `src/game/input/InputManager.ts` | ✅ | 统一鼠标/手柄输入、边沿检测 |
| 手柄映射 | `src/utils/gamepadMap.ts` | ✅ | Xbox/PS/Switch 按键映射 |
| 输入平滑 | `src/utils/inputSmoother.ts` | ✅ | 移动平均缓冲区减少摇杆抖动 |
| 手柄 Hook | `src/hooks/useGamepad.ts` | ✅ | React Hook 封装，每帧轮询 |

### C.3.1 训练 Hooks

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 训练生命周期 | `src/hooks/useTraining.ts` | ✅ | idle→loading→playing→paused→completed 状态机；per-task 难度（localStorage）；requestAnimationFrame 渲染循环；暂停/恢复时间追踪；Canvas 清除 |
| 统计分析 | `src/hooks/useStatistics.ts` | ✅ | useStatistics（汇总）、useTaskStats（分任务）、useTimeSeriesData（时间序列） |
| 主题与国际化 | `src/hooks/useTheme.ts` | ✅ | useTheme（设置 data-theme 属性）、useLocale（返回当前语言字典） |

### C.4 状态管理

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 游戏状态 | `src/stores/gameStore.ts` | ✅ | 实时训练数据（hits/misses/score/fps） |
| 认证状态 | `src/stores/authStore.ts` | ✅ | 用户认证、JWT 管理，登录/注册/重置密码 |
| 设置状态 | `src/stores/settingsStore.ts` | ✅ | 全部用户偏好（主题/手柄/鼠标/准星/显示/音效），LocalStorage 持久化，云端同步（loadFromServer/syncToServer） |

### C.5 类型定义

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 手柄类型 | `src/types/gamepad.ts` | ✅ | GamepadType、ButtonMapping |
| 训练类型 | `src/types/training.ts` | ✅ | TaskType、GameDifficulty（5 级）、GAME_DIFFICULTY_CONFIG、TrainingTaskConfig（6 个预设任务）、TrainingResult |
| 统计类型 | `src/types/statistics.ts` | ✅ | TrainingStats、TaskStats、SkillRadar、TimeSeriesData |
| 认证类型 | `src/types/auth.ts` | ✅ | User、AuthResponse、SendCodeRequest、RegisterRequest、LoginRequest、ResetPasswordRequest |
| 主题类型 | `src/types/theme.ts` | ✅ | ThemeId（8 个）、THEMES 配置（含预览色） |
| 国际化类型 | `src/types/locale.ts` | ✅ | 中英文翻译键值对（约 170 键） |

### C.6 工具函数

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 评分算法 | `src/utils/scoring.ts` | ✅ | 静态点击评分（准确率/速度/一致性加权）、跟枪平滑度（jerk + 跟踪误差） |
| IndexedDB 存储 | `src/utils/storage.ts` | ✅ | TrainingStorage 类：saveRecord、getRecords（按任务/数量过滤）、getBestScore、deleteRecord、clearAll |
| 手柄映射 | `src/utils/gamepadMap.ts` | ✅ | 手柄类型检测（Xbox/PS/Switch）、按键映射（含 Nintendo A/B 交换） |
| 输入平滑 | `src/utils/inputSmoother.ts` | ✅ | InputSmoother（标量移动平均）、VectorSmoother（2D 向量平滑） |

### C.7 页面组件

| 页面 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 首页 | `src/pages/Home.tsx` | ✅ | 项目介绍、功能卡片、热门任务、使用指南 |
| 训练页 | `src/pages/Training.tsx` | ✅ | 任务选择网格、3D 画布、倒计时、暂停菜单（含难度选择）、结果面板 |
| 统计页 | `src/pages/Statistics.tsx` | ✅ | 任务筛选、汇总卡片、性能指标、分数图表、任务统计表 |
| 设置页 | `src/pages/Settings.tsx` | ✅ | 主题（8 个）、手柄、鼠标、准星、显示、音效设置，云端同步 |
| 登录页 | `src/pages/Login.tsx` | ✅ | 邮箱验证码登录、60 秒冷却、演示模式 |
| 注册页 | `src/pages/Register.tsx` | ✅ | 邮箱 + 用户名 + 验证码注册，注册后自动同步设置 |
| 找回密码 | `src/pages/ForgotPassword.tsx` | ✅ | 邮箱 + 验证码 + 新密码重置 |

### C.8 UI 组件

| 组件 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 按钮 | `src/components/ui/Button.tsx` | ✅ | primary/secondary/danger/ghost 变体，sm/md/lg，加载动画 |
| 卡片 | `src/components/ui/Card.tsx` | ✅ | default/elevated/bordered 变体，hoverable，主题感知 CSS 变量 |
| 徽章 | `src/components/ui/Badge.tsx` | ✅ | default/success/warning/danger/info 变体 |
| 准星 | `src/components/hud/Crosshair.tsx` | ✅ | dot/cross/circle 三种样式，颜色/大小可配置 |
| 训练 HUD | `src/components/hud/TrainingHUD.tsx` | ✅ | 顶部：分数、倒计时、命中率；左下：命中数、脱靶数、FPS |
| 训练结果 | `src/components/hud/TrainingResultPanel.tsx` | ✅ | 全屏模态：最终分数、命中率、击杀数、反应时间、时长 |
| 主题切换 | `src/components/ui/ThemeSwitcher.tsx` | ✅ | 下拉选择器，颜色预览圆点，主题感知样式 |
| 语言切换 | `src/components/ui/LanguageSwitcher.tsx` | ✅ | 中英文切换按钮 |
| 用户菜单 | `src/components/ui/UserMenu.tsx` | ✅ | 头像下拉菜单，用户名/邮箱，登出 |
| 头部导航 | `src/components/layout/Header.tsx` | ✅ | 固定顶部导航栏，backdrop blur，活跃链接高亮 |
| 布局 | `src/components/layout/Layout.tsx` | ✅ | 训练时隐藏 Header（`/training?task=xxx`），任务选择时显示 |

### C.9 后端 API

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 服务入口 | `server/src/index.ts` | ✅ | Express 服务器 |
| 数据库 | `server/src/db.ts` | ✅ | MySQL 连接池 |
| Redis | `server/src/redis.ts` | ✅ | Redis 缓存连接 |
| 配置 | `server/src/config.ts` | ✅ | 环境变量配置 |
| 认证路由 | `server/src/routes/auth.ts` | ✅ | 注册/登录/验证码/重置密码 |
| 设置路由 | `server/src/routes/settings.ts` | ✅ | 用户设置同步 |
| 认证中间件 | `server/src/middleware/auth.ts` | ✅ | JWT 验证 |

### C.10 部署与 DevOps

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 前端 Dockerfile | `Dockerfile` | ✅ | Nginx 静态服务 |
| 后端 Dockerfile | `server/Dockerfile` | ✅ | Node.js API 服务 |
| Docker Compose | `docker-compose.yml` | ✅ | 完整服务编排 |
| Nginx 配置 | `nginx.conf` | ✅ | 反向代理、SPA 路由 |
| MySQL 配置 | `config/mysql/custom.cnf` | ✅ | 性能优化配置 |
| Redis 配置 | `config/redis/redis.conf` | ✅ | 持久化、安全配置 |
| CI/CD | `.github/workflows/deploy.yml` | ✅ | GitHub Actions 自动化 |
| 环境变量 | `.env.example` | ✅ | 配置模板 |

### C.11 API 客户端

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| API 客户端 | `src/api/client.ts` | ✅ | 基础 URL `/api`，自动附加 Bearer token，get/post/put 方法 |
| 认证 API | `src/api/auth.ts` | ✅ | POST /auth/send-code、/register、/login、/reset-password，GET /auth/me |
| 设置 API | `src/api/settings.ts` | ✅ | GET/PUT /settings，ServerSettings 接口（snake_case 转换） |

### C.12 样式与主题

| 模块 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 设计令牌 | `src/styles/tokens.css` | ✅ | CSS 自定义属性（颜色、间距、圆角、字体、阴影） |
| 主题系统 | `src/styles/themes.css` | ✅ | 8 套完整主题的 CSS 变量定义（含 RGB 变体） |
| 全局样式 | `src/styles/global.css` | ✅ | 自定义滚动条、选中色、字体覆盖、关键帧动画（pulse-glow/slide-up/fade-in/float） |

---

## 附录 D：技术架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        AimPad 架构                          │
├─────────────────────────────────────────────────────────────┤
│  用户层                                                      │
│  ├── 浏览器 (Chrome/Firefox/Edge)                           │
│  ├── 手柄 (Xbox/PS/Switch Pro)                              │
│  └── 键鼠                                                    │
├─────────────────────────────────────────────────────────────┤
│  前端层 (React + TypeScript + Vite)                         │
│  ├── UI 组件 (TailwindCSS)                                  │
│  ├── 状态管理 (Zustand)                                      │
│  ├── 路由 (React Router v6)                                 │
│  ├── 3D 引擎 (Babylon.js)                                   │
│  └── 输入系统 (Gamepad API + 抽象层)                        │
├─────────────────────────────────────────────────────────────┤
│  后端层 (Node.js + Express)                                 │
│  ├── 认证服务 (JWT + 邮箱验证码)                            │
│  ├── 设置同步 API                                           │
│  └── 健康检查                                               │
├─────────────────────────────────────────────────────────────┤
│  数据层                                                      │
│  ├── MySQL 8.0 (用户数据、训练记录)                         │
│  └── Redis 7.x (验证码缓存、会话)                          │
├─────────────────────────────────────────────────────────────┤
│  部署层                                                      │
│  ├── Docker Compose (服务编排)                              │
│  ├── Nginx (反向代理、静态文件)                             │
│  ├── 华为云 SWR (镜像仓库)                                  │
│  └── GitHub Actions (CI/CD)                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 附录 E：环境变量配置

### E.1 前端环境变量

```bash
# .env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### E.2 后端环境变量

```bash
# server/.env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=aimpad_user
DB_PASSWORD=your_password
DB_NAME=aimpad
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
JWT_SECRET=your_jwt_secret_at_least_32_chars
JWT_EXPIRES_IN=7d
DEMO_CODE=888888
```

### E.3 Docker 环境变量

```bash
# .env (项目根目录)
MYSQL_ROOT_PASSWORD=your_strong_root_password
MYSQL_PASSWORD=your_strong_user_password
REDIS_PASSWORD=your_strong_redis_password
JWT_SECRET=your_strong_jwt_secret_at_least_32_chars
```

---

## 附录 F：快速启动指南

### F.1 本地开发

```bash
# 克隆项目
git clone https://github.com/jiangdongshi/AimPad.git
cd AimPad

# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
cd ..

# 启动后端（需要 MySQL 和 Redis）
cd server
npm run dev

# 启动前端
npm run dev
```

### F.2 Docker 部署

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env 填写密码

# 启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### F.3 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost | 主应用 |
| API | http://localhost:3001 | 后端接口 |
| 健康检查 | http://localhost:3001/api/health | 服务状态 |

---

**文档版本**：v3.0
**最后更新**：2026-05-02
**维护者**：@jiangdongshi
**项目仓库**：https://github.com/jiangdongshi/AimPad
