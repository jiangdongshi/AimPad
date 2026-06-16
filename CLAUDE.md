# AimPad · 瞄点

Web 端专业瞄准训练平台。零安装、即开即练，支持键鼠和手柄（Xbox / PlayStation / Switch Pro）双输入，基于 Babylon.js 3D 渲染。目标是为手柄玩家补齐 Web 端练枪工具的最后一块拼图。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript 5（`strict` 模式） |
| 构建 | Vite 5（`@vitejs/plugin-react`） |
| 状态管理 | Zustand 4（`persist` 中间件用于 localStorage 持久化） |
| 路由 | React Router v6（BrowserRouter） |
| 样式 | TailwindCSS 3（自定义 CSS 变量 + 8 套主题） + CSS Modules |
| 3D 引擎 | Babylon.js 6（`@babylonjs/core`, `@babylonjs/gui`, `@babylonjs/loaders`, `@babylonjs/materials`） |
| 图表 | Recharts 2 |
| 本地存储 | IndexedDB（训练记录） + localStorage（设置/偏好） |
| 后端 | Express 4 + MySQL 2（mysql2） + Redis（ioredis） |
| 认证 | JWT（jsonwebtoken） + 邮箱验证码登录 |
| 部署 | Docker Compose + Nginx，GitHub Actions CI/CD |
| 测试 | Vitest |
| 代码质量 | ESLint + Prettier |
| 字体 | Orbitron（游戏标题） + Rajdhani（显示） + JetBrains Mono（等宽） |

## 项目结构

```
src/
├── game/
│   ├── engine/GameEngine.ts        # Babylon.js 引擎封装
│   │   - 鼠标输入：Pointer Lock + mousemove 直接旋转摄像机
│   │   - 硬件缩放：4 档画质 (low/medium/high/ultra)
│   │   - 手柄视角控制：摇杆死角 + 灵敏度 + Y轴反转
│   │   - 输入仲裁：鼠标/手柄自动切换（250ms 闲置期 + 激活阈值）
│   │   - 噪声过滤：NaN/Infinity 检测，亚像素噪声 (<0.5px)，60px 单次跳变钳制
│   │   - 灵敏度缓存：每秒刷新一次 Zustand store 读取
│   ├── scenes/
│   │   ├── BaseScene.ts            # 场景基类
│   │   │   - 对象池：12 个 Sphere mesh 预创建 + 共享材质（减少 DrawCall/GC）
│   │   │   - 射击检测：BABYLON.Ray + pickWithRay + metadata.isTarget 过滤
│   │   │   - 墙壁系统：createBoxWalls() 单材质 CreateBox（depth=18），backFaceCulling=false
│   │   │   - 目标：spawnTarget/removeTarget/returnTargetToPool（O(1) 池操作）
│   │   │   - 击破模式：hits（命中次数） / time（受击时间累积 ms）
│   │   │   - 颜色系统：setTargetColor(hex) / setWallColor(hex) 动态换色
│   │   │   - 手柄：checkGamepadFire（按键边沿检测）/ checkGamepadPause（Select/Start）
│   │   ├── GridshotScene.ts        # 静态点射场景（Gridshot + Spidershot）
│   │   │   - 3x5 网格 + 格子占用追踪（Map<"row,col", Mesh>）
│   │   │   - 目标被击破后自动补充（50ms 冷却，防同帧重复生成）
│   │   │   - 兼容 createBoxWalls 墙壁系统
│   │   ├── SphereTrackScene.ts     # 追瞄场景（SphereTrack + StrafeTrack）
│   │   │   - 三种运动模式：circular（圆形）/ linear（直线）/ orbital（随机平滑转向）
│   │   │   - 软边界：靠近墙壁时平滑偏向中心（避免频繁反弹）
│   │   │   - 归一化恒速移动：转向时保持 speed 不变
│   │   │   - 准星接近实时计分（无射击逻辑）：distance→normalizedScore×(dt/1000)×100
│   │   │   - worldToScreen：BABYLON.Vector3.Project 世界坐标→屏幕坐标
│   │   └── CustomScene.ts          # 自定义训练通用场景（SceneConfig 驱动）
│   │       - 7 种运动类型：static / circular / sine / figure8 / linear(4方向) / random
│   │       - 路径噪声叠加（randomness 参数，3 个正弦波混合）
│   │       - 动态点击：线性移动目标每个独立相位偏移 + 独立 Y 线分布
│   │       - 追踪类：准星接近实时计分（与 SphereTrackScene 一致）
│   │       - 目标切换 + 时间模式：检测准星落在哪个目标上累积受击时间
│   └── input/
│       ├── GamepadAdapter.ts       # 手柄适配器
│       │   - 死区：applyDeadzone（magnitude < deadzone → 0，否则重映射 [deadzone,1] → [0,1]）
│       │   - 类型检测：detectGamepadType（id.contains("xbox"|"ps"|"nintendo")）
│       │   - 死区范围：0-0.5，默认 0.1
│       └── InputManager.ts         # 统一输入管理（鼠标/手柄自动切换）
├── hooks/
│   ├── useTraining.ts              # 训练生命周期（核心 hook，~500 行）
│   │   - 状态：idle → loading → playing → paused → completed
│   │   - createScene：根据 task.id 工厂化创建对应场景
│   │   - 渲染循环：requestAnimationFrame + Babylon.js renderLoop
│   │   - 状态同步：100ms 节流批量更新 Zustand（避免每帧 React 重渲染）
│   │   - FPS 计数：每 6 次同步更新一次（~600ms）
│   │   - 暂停/恢复：记录 elapsedBeforePauseRef，恢复时继承已用时间
│   │   - 停止：handleTrainingEnd → scene.stop() → trainingStorage.saveRecord()
│   │   - Canvas 清除：resetTraining 用 gl.clear() + gl.finish() 清除残影
│   │   - 主题变化监听：MutationObserver 观察 data-theme 属性变化
│   ├── useGamepad.ts               # 手柄连接、rAF 轮询
│   ├── useStatistics.ts            # 统计分析（useStatistics / useTaskStats / useTimeSeriesData）
│   └── useTheme.ts                 # 主题 + 国际化（useLocale）
├── stores/
│   ├── gameStore.ts                # 游戏实时数据
│   │   - status: 'idle'|'loading'|'playing'|'paused'|'completed'
│   │   - 帧数据：hits/misses/realtimeScore/isTracking/timeRemaining/fps
│   │   - updateFrameData：批量更新（单一 set 调用，避免多次渲染）
│   ├── settingsStore.ts            # 用户设置（persist → localStorage）
│   │   - 手柄：deadzone/sensitivity/invertY/fireButton
│   │   - 鼠标：sensitivity/invertY
│   │   - 准星：style(dot/cross/circle)/color/size
│   │   - 显示：fov/quality(4档)/theme(8套)
│   │   - 音效：enabled/volume
│   │   - 云同步：loadFromServer/syncToServer（snake_case ↔ camelCase 转换）
│   ├── authStore.ts                # 认证状态 + JWT（persist → localStorage）
│   │   - 邮箱验证码登录：sendCode → login/register
│   │   - 自动加载用户设置：login/register 后同步
│   └── customTaskStore.ts          # 自定义任务 CRUD + 收藏 + 分享码
├── pages/
│   ├── Home.tsx                    # 首页：Hero + 特性介绍 + 热门任务 + 使用指南
│   ├── Training.tsx                # 训练主页（~570 行，最复杂的页面）
│   │   - Tab 切换：预设任务 / 自定义任务 / 收藏
│   │   - 倒计时 3-2-1 系统（首次 / 恢复 / 重新开始三种模式）
│   │   - 暂停菜单：训练时长选择、小球颜色、墙壁颜色
│   │   - 手柄开火按钮启动训练（100ms 轮询）
│   │   - 手柄 Select/Start 暂停（rAF 轮询）
│   │   - Pointer Lock 状态管理：解除锁定自动暂停
│   │   - ESC 键处理：弹窗关闭 / 游戏暂停（idle+countdown）/ 指针锁定（playing）
│   ├── Statistics.tsx              # 数据统计仪表板（Recharts 图表）
│   ├── Settings.tsx                # 设置页（手柄/鼠标/准星/显示/音效）
│   ├── Gamepad.tsx                 # 手柄可视化测试页
│   ├── CustomTaskEditor.tsx        # 自定义任务编辑器
│   ├── Login.tsx / Register.tsx / ForgotPassword.tsx  # 认证页面
│   └── Admin.tsx                   # 管理后台
├── components/
│   ├── hud/
│   │   ├── Crosshair.tsx           # 准星组件（dot/cross/circle + 自定义颜色/大小）
│   │   ├── TrainingHUD.tsx         # 训练 HUD：分数/时间/命中率/命中-脱靶 计数
│   │   │   - 追踪模式：隐藏 hits/misses/accuracy，仅显示分数 + FPS
│   │   └── TrainingResultPanel.tsx # 训练结果面板（分数/命中率/反应时间 等）
│   ├── ui/                         # 通用 UI 组件库
│   │   - Button：variant(primary/secondary/ghost) + size
│   │   - Card：variant(bordered) + hoverable
│   │   - Badge / ThemeSwitcher / LanguageSwitcher / UserMenu
│   └── layout/                     # Header（导航 + 用户菜单） + Layout（Outlet）
├── types/                          # TypeScript 类型定义
│   ├── training.ts                 # TaskType(5种) / TrainingTaskConfig / TrainingResult / ScoreComponents / TRAINING_TASKS
│   ├── gamepad.ts                  # GamepadType / ButtonMapping(16 键)
│   ├── statistics.ts               # 统计数据类型
│   ├── auth.ts                     # User / AuthRequest
│   ├── theme.ts                    # ThemeId / ThemeConfig
│   ├── customTask.ts               # SceneConfig（完整场景配置 schema）
│   └── locale.ts                   # 国际化类型
├── utils/
│   ├── storage.ts                  # IndexedDB 封装（TrainingStorage 类）
│   │   - init/saveRecord/getRecords/getBestScore/deleteRecord/clearAll
│   │   - 索引：taskId + timestamp
│   ├── scoring.ts                  # 评分算法
│   │   - calculateStaticClickingScore：加权综合分（accuracy/speed/consistency）
│   │   - calculateConsistency：标准差→一致性得分
│   │   - calculateSmoothness：Jerk（加速度变化）+ 跟踪误差
│   ├── gamepadMap.ts               # 手柄按键映射
│   │   - detectGamepadType：id.contains("xbox"|"playstation"|"nintendo")
│   │   - getButtonMapping：Xbox/PS/Switch 按键映射（Nintendo A/B 交换）
│   │   - getButtonIndex：按名称获取按键索引
│   ├── inputSmoother.ts            # 输入平滑算法
│   ├── themeColors.ts              # 3D 场景颜色工具
│   │   - getSceneClearColor / getSceneBackgroundRgb / getSceneWallColor
│   │   - getSceneGroundColor / getSceneGridColor
│   │   - 从 CSS 自定义属性读取当前主题颜色
│   └── shareCode.ts               # 16 位分享码编解码（Base64URL + CRC16）
├── api/                            # API 客户端
│   ├── client.ts                   # fetch 封装（自动附加 JWT Authorization header）
│   ├── auth.ts                     # 认证 API（sendCode/login/register/resetPassword/me）
│   ├── settings.ts                 # 设置 API（get/update）
│   └── admin.ts                    # 管理 API
└── styles/
    ├── tokens.css                  # 设计 Token（颜色/间距/圆角/字体/阴影/过渡）
    ├── themes.css                  # 8 套主题（通过 [data-theme] 属性切换）
    └── global.css                  # 全局样式 + Tailwind 指令

server/
├── src/index.ts                    # Express 入口（端口 3001）
│   - CORS（credentials: true）
│   - 原始请求体日志（verify 回调 + debug middleware）
│   - Routes：/api/auth /api/settings /api/admin + /api/health
├── src/config.ts                   # 环境变量配置（dotenv）
│   - MySQL/Redis/JWT 配置
│   - DEMO_CODE: '1234'（演示验证码）
│   - CODE_TTL_SECONDS: 300, SEND_COOLDOWN_SECONDS: 60
├── src/db.ts                       # MySQL 连接池（mysql2/promise, connectionLimit: 10）
├── src/redis.ts                    # Redis 客户端（ioredis）
├── src/middleware/auth.ts          # JWT 认证中间件（requireAuth）
└── src/routes/
    ├── auth.ts                     # 认证路由
    │   - POST /send-code：邮箱验证码发送（Redis 冷却 + MySQL 审计）
    │   - POST /register：验证码校验 → 创建用户 → 默认设置 → JWT 签发
    │   - POST /login：验证码校验 → 查找用户 → 更新登录时间 → JWT 签发
    │   - POST /reset-password：验证码校验 → bcrypt 密码哈希
    │   - GET /me：JWT 验证 → 返回用户信息 + 设置
    ├── settings.ts                 # 设置同步路由（get/update）
    └── admin.ts                    # 管理后台路由
├── Dockerfile                      # Docker 部署配置
├── package.json                    # 后端依赖
└── tsconfig.json
```

## 命令

```bash
npm run dev          # 启动前端开发服务器（port 3000，API proxy → 3001）
npm run build        # 生产构建（tsc -b && vite build）
npm run preview      # 预览构建产物
npm run lint         # ESLint
npm run test         # Vitest
npm run coverage     # 测试覆盖率
cd server && npm run dev  # 启动后端 API 服务器（tsx watch）
```

## 核心架构

### 训练生命周期

```
idle → loading → playing ⇄ paused
         ↓            ↓
       completed ←─────┘
```

1. 用户在 `/training` 选择任务（预设/自定义/收藏三个 Tab）
2. 预设任务：`handleStart(task)` → 导航到 `/training?task=id` → 点击 canvas / 手柄开火键 → 3 秒倒计时 → `startTraining()` → `createScene()` 工厂化创建场景
3. 自定义任务：直接导航 `/training?custom=id` → 自动进入倒计时 → `startCustomTraining()` → `new CustomScene(engine, task, task.id)`
4. `useTraining` 驱动双渲染循环：
   - Babylon.js `engine.runRenderLoop()`（引擎层渲染）
   - `requestAnimationFrame(renderLoop)`（逻辑层：update + 状态同步 + 结束检测）
5. 状态同步：每 100ms 批量调用 `gameStore.updateFrameData()`，且仅在值变化时更新（避免无意义 React 重渲染）
6. 暂停触发：ESC / Pointer Lock 解除 / 手柄 Select+Start
7. 恢复：`startResumeCountdown()` 3 秒倒计时后恢复，`isResuming` 标记防止 pointerlockchange 误触
8. 结束：`handleTrainingEnd()` → `scene.stop()` → IndexedDB 保存记录 → 显示结果面板

### 场景体系

| 场景 | 类 | 计分方式 | 命中检测 | 运动 |
|------|-----|---------|--------|------|
| Gridshot | `GridshotScene` | hits×100×accuracy×时间因子 | 射线射击 | 静态（3×5 网格） |
| Spidershot | `GridshotScene` | 同上（targetCount=1，快速响应） | 射线射击 | 静态 |
| SphereTrack | `SphereTrackScene` | 准星接近目标→实时累计分 | 无（接近计分） | circular/orbital |
| StrafeTrack | `SphereTrackScene` | 同上 | 无（接近计分） | linear |
| TargetSwitch | `CustomScene`/`GridshotScene` | 命中率计分 / 时间累积 | 射线/时间 | static |
| ReflexShot | `GridshotScene` | 命中率计分 | 射线射击 | static |
| Custom | `CustomScene` | 追踪=接近计分；其他=命中率 | 视类型而定 | 7 种运动类型 |

### 输入系统

```
物理设备 → GamepadAdapter（死区/类型检测） → InputManager（鼠标/手柄仲裁）
                ↓                                      ↓
         useGamepad hook                    GameEngine.updateCameraFromGamepad
         (React 状态)                       (3D 摄像机旋转)
```

**手柄仲裁逻辑**（GameEngine）：
- 鼠标活跃时：手柄摇杆 magnitude > 0.08 + 鼠标闲置 250ms 后，手柄可接管
- 手柄活跃时：鼠标移动 + 手柄闲置 250ms 后，鼠标可接管
- 无活跃设备时：谁先动谁接管

**手柄开火**（BaseScene.checkGamepadFire）：
- 每帧轮询 navigator.getGamepads()
- 按键边沿检测（pressed && !prevPressed）
- 按钮映射：getButtonIndex(gp, fireButtonName) 支持跨平台

### 自定义任务系统

`SceneConfig` 配置驱动，关键字段：

```typescript
interface SceneConfig {
  category: 'static-clicking' | 'dynamic-clicking' | 'tracking' | 'target-switching' | 'reaction';
  duration: number;          // 训练时长（ms），0 = 无限
  target: {
    shape: 'sphere';
    size: number;           // 目标大小
    color: string;          // hex 颜色
    glowIntensity: number;  // 发光强度
  };
  movement: {
    type: 'static' | 'circular' | 'sine' | 'figure8' | 'linear' | 'random';
    speed: number;
    direction?: 'horizontal' | 'vertical' | 'diagonal-tl-br' | 'diagonal-tr-bl';
    randomness?: number;    // 路径噪声（0-100）
    bounds: { xMin, xMax, yMin, yMax };
  };
  spawn: {
    mode: 'interval';
    interval: number;       // 生成间隔 ms
    maxActive: number;      // 最大同时活跃目标数
    hitsToBreak: number;    // 击破所需命中次数
    breakMode: 'hits' | 'time';  // 击破方式
    hitTimeMs: number;      // 受击时间阈值 ms
  };
  display: {
    rows: number; cols: number;
    showLines: boolean;
    wallColor: string;
    wallHeight: number;
  };
  scoring: { weightAccuracy, weightSpeed, weightConsistency };
}
```

- 分享码：16 位 = Base64URL(JSON) + CRC16 校验
- CustomTaskStore：CRUD + favorites + playCount + 分享码编解码

### 主题系统

- 8 套主题通过 `[data-theme]` 属性切换，全部使用 CSS 自定义属性
- Tailwind 颜色类通过 RGB CSS 变量驱动：`rgb(var(--tw-primary-500-rgb) / <alpha-value>)`
- 设计 Token 体系（`tokens.css`）：颜色/间距/圆角/字体/阴影/过渡
- 3D 场景颜色通过 `themeColors.ts` 从 CSS 属性实时读取（`getComputedStyle`）
- 主题变化监听：`MutationObserver` 监视 `data-theme` 属性 → `engine.updateClearColor()`

### 数据存储架构

```
训练记录 → IndexedDB（TrainingStorage）
用户设置 → localStorage（Zustand persist + settingsStore）
认证状态 → localStorage（Zustand persist + authStore）
服务器同步 → MySQL（user_settings 表）
验证码 → Redis（5 分钟 TTL）+ MySQL 审计日志
```

## 后端 API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/send-code` | 发送邮箱验证码（Redis 缓存 + 60s 冷却） |
| POST | `/api/auth/register` | 注册（验证码 → MySQL 插入 → JWT 签发） |
| POST | `/api/auth/login` | 登录（验证码 → 查找用户 → JWT 签发） |
| POST | `/api/auth/reset-password` | 重置密码（验证码 → bcrypt hash） |
| GET | `/api/auth/me` | 获取当前用户信息（JWT 认证） |
| GET | `/api/settings` | 获取用户设置 |
| PUT | `/api/settings` | 更新用户设置 |
| GET | `/api/admin/*` | 管理后台接口 |
| GET | `/api/health` | 健康检查 |

## 特殊注意事项

- **Pointer Lock**：训练时锁定鼠标指针，解除锁定自动暂停。恢复时 `isResuming` 标志防止 pointerlockchange 误触。
- **Canvas 清除**：重置训练时使用 `gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT) + gl.finish()` 清除 WebGL 残影（确保 GPU 命令完成）。
- **对象池**：`BaseScene.initTargetPool()` 预创建 12 个 Sphere mesh + 共享 StandardMaterial，`disableLighting = true`，避免 GC 卡顿。
- **墙壁系统**：`createBoxWalls()` 使用单一 CreateBox（depth=18, z∈[-10,8]），`backFaceCulling=false` 保证从内部各方向可见。墙色统一通过 `roomMat.diffuseColor` 控制。
- **状态同步节流**：`useTraining` 中 renderLoop 每 100ms 批量更新 Zustand，且只在值变化时更新（比较 prevState vs currentState），避免每帧触发 React 重渲染。
- **开发端口**：前端 3000，后端 3001（Vite proxy 自动转发 `/api → http://localhost:3001`）。
- **演示模式**：验证码 `1234` 可用于开发环境登录。
- **字体预加载**：`index.html` 中 preconnect Google Fonts CDN 加载 Orbitron/Rajdhani/JetBrains Mono。
- **路径别名**：`@/*` 映射到 `src/*`（tsconfig paths + vite alias）。
- **Immutable 模式**：所有 Zustand state 更新创建新对象，不修改原状态。

## 项目文档

### v4.0 文档（最新 — 本地优先架构）
- [瞄点 · AimPad 项目方案 v4.0 - 本地优先架构](瞄点 · AimPad 项目方案 v4.0 - 本地优先架构.md) — **最新**产品方案，设备即身份，零服务端依赖
- [瞄点 · AimPad 项目构建手册 v4.0](瞄点 · AimPad 项目构建手册 v4.0.md) — **最新**开发指南，移除 server/ 认证系统后的构建方案
- [瞄点 · AimPad 项目数据管理手册 v1.0 - 本地存储架构](瞄点 · AimPad 项目数据管理手册 v1.0 - 本地存储架构.md) — **新增** IndexedDB + localStorage + JSON 导出/导入
- [瞄点 · AimPad 项目部署手册 v3.0 - 纯前端方案](瞄点 · AimPad 项目部署手册 v3.0 - 纯前端方案.md) — **最新** Vercel/CF Pages/Nginx 静态托管

### v3.2 文档（旧 — 保留参考）
- [瞄点 · AimPad 项目方案](瞄点 · AimPad 项目方案.md) — 产品方案、技术选型、架构设计（含认证系统）
- [瞄点 · AimPad 项目构建手册](瞄点 · AimPad 项目构建手册.md) — 开发指南、模块详解、已实现功能总览（含后端）
- [瞄点 · AimPad 项目数据库设计手册](瞄点 · AimPad 项目数据库设计手册.md) — MySQL + Redis 设计
- [瞄点 · AimPad 用户认证系统设计手册](瞄点 · AimPad 用户认证系统设计手册.md) — 邮箱验证码 + JWT 认证
- [瞄点 · AimPad 项目运行环境部署手册](瞄点 · AimPad 项目运行环境部署手册.md) — Docker Compose 部署
- [瞄点 · AimPad CICD 自动化部署手册 v2.2](瞄点 · AimPad CICD 自动化部署手册 v2.2.md) — CI/CD 流水线

## 依赖版本

### 前端
| 依赖 | 版本 | 用途 |
|------|------|------|
| react / react-dom | ^18.2.0 | UI 框架 |
| react-router-dom | ^6.21.0 | 路由 |
| zustand | ^4.4.7 | 状态管理 |
| @babylonjs/core | ^6.0.0 | 3D 引擎核心 |
| @babylonjs/gui | ^6.0.0 | 3D GUI 系统 |
| @babylonjs/loaders | ^6.0.0 | 3D 模型加载 |
| @babylonjs/materials | ^6.0.0 | 3D 材质库 |
| recharts | ^2.10.3 | 统计图表 |
| dayjs | ^1.11.10 | 日期处理 |
| lodash-es | ^4.17.21 | 工具函数 |
| tailwindcss | ^3.4.0 | CSS 框架 |
| typescript | ^5.2.2 | 类型系统 |
| vite | ^5.0.8 | 构建工具 |

### 后端
| 依赖 | 版本 | 用途 |
|------|------|------|
| express | ^4.18.2 | Web 框架 |
| mysql2 | ^3.7.0 | MySQL 驱动 |
| ioredis | ^5.3.2 | Redis 客户端 |
| jsonwebtoken | ^9.0.2 | JWT 认证 |
| bcryptjs | ^2.4.3 | 密码哈希 |
| tsx | ^4.6.2 | TypeScript 执行 |
