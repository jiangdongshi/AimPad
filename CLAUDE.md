# AimPad · 瞄点

Web 端专业瞄准训练平台。零安装、即开即练，支持键鼠和手柄（Xbox / PlayStation / Switch Pro）双输入，基于 Babylon.js 3D 渲染。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript 5 |
| 构建 | Vite 5 |
| 状态管理 | Zustand 4（persist 中间件用于本地持久化） |
| 路由 | React Router v6 |
| 样式 | TailwindCSS 3（自定义 CSS 变量 + 8 套主题） |
| 3D 引擎 | Babylon.js 6 (`@babylonjs/core`, `@babylonjs/gui`, `@babylonjs/loaders`, `@babylonjs/materials`) |
| 图表 | Recharts |
| 后端 | Express + MySQL + Redis |
| 部署 | Docker Compose + Nginx，GitHub Actions CI/CD |

## 项目结构

```
src/
├── game/
│   ├── engine/GameEngine.ts      # Babylon.js 引擎封装：Pointer Lock、画质档位、手柄视角控制
│   ├── scenes/
│   │   ├── BaseScene.ts          # 场景基类：对象池、射击检测(hit/miss)、墙壁系统、BoxWalls
│   │   ├── GridshotScene.ts      # 静态点射场景（Gridshot + Spidershot）
│   │   ├── SphereTrackScene.ts   # 追瞄场景：准星接近目标实时计分，无射击逻辑
│   │   └── CustomScene.ts        # 自定义训练通用场景：配置驱动（SceneConfig → 场景行为）
│   └── input/
│       ├── GamepadAdapter.ts     # 手柄适配器：死区处理、类型检测(Xbox/PS/Switch)
│       └── InputManager.ts        # 统一输入管理：鼠标/手柄自动切换、边沿检测
├── hooks/
│   ├── useTraining.ts            # 训练生命周期：start/resume/pause/stop，rAF 渲染循环，状态同步
│   ├── useGamepad.ts             # 手柄连接、轮询
│   ├── useStatistics.ts          # 统计分析（useStatistics / useTaskStats / useTimeSeriesData）
│   └── useTheme.ts               # 主题 + 国际化（useLocale）
├── stores/
│   ├── gameStore.ts              # 游戏实时数据：score/hits/misses/realtimeScore/isTracking
│   ├── settingsStore.ts          # 用户设置：手柄/鼠标/准星/显示/音效，localStorage 持久化
│   ├── authStore.ts              # 认证状态 + JWT
│   └── customTaskStore.ts        # 自定义任务 CRUD + 收藏 + 分享码
├── pages/
│   ├── Training.tsx              # 训练主页：任务选择(预设/自定义/收藏 tab)、倒计时、暂停菜单、结果面板
│   ├── Home.tsx                  # 首页
│   ├── Statistics.tsx            # 数据统计仪表板
│   ├── Settings.tsx              # 设置页
│   ├── Gamepad.tsx               # 手柄可视化测试页
│   ├── CustomTaskEditor.tsx      # 自定义任务编辑器
│   ├── Login.tsx / Register.tsx / ForgotPassword.tsx  # 认证页面
│   └── Admin.tsx                 # 管理后台
├── components/
│   ├── hud/
│   │   ├── Crosshair.tsx         # 准星：dot/cross/circle 三种样式
│   │   ├── TrainingHUD.tsx        # 训练 HUD：分数、时间、命中率、命中/脱靶，追踪模式自动隐藏命中/脱靶
│   │   └── TrainingResultPanel.tsx # 训练结果面板
│   ├── ui/                       # 通用 UI：Button/Card/Badge/ThemeSwitcher/LanguageSwitcher/UserMenu
│   └── layout/                   # Header + Layout
├── types/                        # 类型定义
├── utils/                        # 工具函数
├── api/                          # API 客户端（auth/settings）
└── styles/                       # tokens.css + themes.css(8套主题) + global.css
server/
├── src/index.ts                  # Express 入口
├── src/routes/auth.ts            # 认证路由
├── src/routes/settings.ts        # 设置同步
└── src/middleware/auth.ts        # JWT 中间件
```

## 命令

```bash
npm run dev          # 启动前端开发服务器 (port 3000，API proxy → 3001)
npm run build        # 生产构建（tsc + vite build）
npm run preview      # 预览构建产物
npm run lint         # ESLint
npm run test         # Vitest
npm run coverage     # 测试覆盖率
cd server && npm run dev  # 启动后端 API 服务器
```

## 核心架构

### 训练生命周期

```
idle → loading → playing → paused/completed
```

1. 用户在 `/training` 选择任务（预设/自定义/收藏）
2. 预设任务：`handleStart(task)` → `navigate('/training?task=id')` → 点击 canvas 开始 3 秒倒计时 → `startTraining()` → `useTraining.startCustomTraining()` 或 `createScene()`
3. 自定义任务：直接 `navigate('/training?custom=id')` → 自动倒计时 → `startCustomTraining()`
4. `useTraining` 驱动 requestAnimationFrame 渲染循环，每 100ms 批量同步状态到 Zustand `gameStore`
5. ESC / Pointer Lock 解除触发暂停，双击 canvas 恢复
6. 退出：`handleBack()` → `navigate('/training?tab=custom')`（自定义任务）或 `navigate('/training')`（预设任务）

### 场景类型

| 场景 | 类 | 计分方式 | 命中检测 |
|------|-----|---------|--------|
| 静态点射（Gridshot/Spidershot） | `GridshotScene` | 命中→分数 = hits×100×准确率×时间因子 | 射线射击 |
| 球体追踪（SphereTrack/StrafeTrack） | `SphereTrackScene` | 准星接近目标→实时累计 `realtimeScore` | 无射击（仅接近计分） |
| 自定义训练 | `CustomScene` | 追踪类=准星接近计分；其他=命中率计分 | 追踪类无射击；其他=射线射击 |

### 关键数据流

```
GameEngine (Babylon.js) → BaseScene.update() → getStats() → useTraining renderLoop
    → gameStore.updateFrameData({hits, misses, realtimeScore, isTracking, ...})
    → TrainingHUD + Training.tsx 读取 gameStore
```

- `isTracking` 标记控制 HUD 行为：追踪模式下隐藏命中/脱靶/命中率，仅显示分数和 FPS
- `CustomScene` 的追踪类任务通过 `getStats()` 返回 `isTracking: true`

### 自定义任务系统

- `SceneConfig` 配置驱动：`category`（task type）、`movement`（static/circular/sine/linear/random/figure8）、`spawn`、`target`、`display`
- 16 位分享码 = Base64URL(JSON) + CRC16 校验
- `CustomTaskStore` 管理 CRUD、收藏、分享码编解码

### 主题系统

- 8 套主题通过 `data-theme` 属性 + CSS 自定义属性切换
- 所有组件颜色使用 `var(--color-*)` 变量
- Tailwind 颜色类通过 RGB 变量驱动（如 `rgb(var(--tw-primary-500-rgb) / <alpha-value>)`）
- 3D 场景颜色通过 `themeColors.ts` 工具函数实时适配

### 手柄系统

- Gamepad API 原生支持，无需插件
- `gamepadMap.ts` 提供 Xbox/PS/Switch 按键映射（Nintendo A/B 交换）
- `GamepadAdapter` 死区处理（默认 0.1）+ 平滑重映射
- 手柄开火按钮可配置（Settings → gamepadFireButton）

## 特殊注意事项

- **Pointer Lock**：训练时锁定鼠标指针，解除锁定自动暂停。`document.pointerLockElement` 判断状态。
- **Canvas 清除**：重置训练时使用 `gl.clear() + gl.finish()` 清除 WebGL 残影。
- **对象池**：`BaseScene.initTargetPool()` 预创建 12 个 Sphere mesh+共享材质，减少 GC 卡顿。
- **墙壁系统**：`createBoxWalls()` 使用单材质 CreateBox（depth=18, z∈[-10,8]），`backFaceCulling=false` 保证从内部各方向可见。墙色统一通过 `roomMat.diffuseColor` 控制。
- **状态同步节流**：`useTraining` 中 renderLoop 每 100ms 批量更新 Zustand，避免每帧触发 React 重渲染。
- **开发端口**：前端 3000，后端 3001（Vite 自动代理 `/api → 3001`）。
- **演示模式**：验证码 `1234` 可用于开发环境登录。

## 项目文档

- [瞄点 · AimPad 项目方案](瞄点 · AimPad 项目方案.md) — 产品方案、技术选型、架构设计
- [瞄点 · AimPad 项目构建手册](瞄点 · AimPad 项目构建手册.md) — 开发指南、模块详解、已实现功能总览（v3.2）
- [瞄点 · AimPad 项目数据库设计手册](瞄点 · AimPad 项目数据库设计手册.md)
- [瞄点 · AimPad CI-CD 自动化部署手册](瞄点 · AimPad CICD 自动化部署手册 v2.1.md)
- [瞄点 · AimPad 用户认证系统设计手册](瞄点 · AimPad 用户认证系统设计手册.md)
- [瞄点 · AimPad 项目运行环境部署手册](瞄点 · AimPad 项目运行环境部署手册.md)