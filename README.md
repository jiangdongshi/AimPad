## 🎯 AimPad

🎮 瞄点 · AimPad – 纯 Web 端的专业瞄准训练平台，零安装即可使用。原生支持 Xbox、PlayStation、Switch Pro 等主流手柄，同时也支持键鼠。基于 React + TypeScript + Babylon.js 构建，提供静态点射、跟枪、切换瞄准等科学训练任务，并拥有完善的统计分析与排行榜系统。为手柄玩家补齐练枪工具的最后一块拼图。

---

## 📘 README.md

```markdown
<div align="center">
  <h1>🎯 瞄点 · AimPad</h1>
  <p><strong>Web 端专业瞄准训练平台 | 零安装 · 原生手柄支持</strong></p>
  <p>
    <img src="https://img.shields.io/badge/React-18-61dafb?logo=react" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/Babylon.js-6-ffb13b?logo=babylon.js" alt="Babylon.js">
    <img src="https://img.shields.io/badge/Gamepad_API-原生-9cf" alt="Gamepad API">
    <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  </p>
  <p>
    <!-- 可以后续替换为实际预览图或在线 Demo 链接 -->
    <a href="https://your-demo-link.com">🌐 在线体验</a> •
    <a href="#-项目概述">📖 文档</a> •
    <a href="#-开发计划">🗓️ 路线图</a>
  </p>
</div>

---

## 📌 项目概述

随着竞技 FPS 游戏（Valorant、CS2、Apex 等）的持续火热，瞄准训练已成为玩家提升实力的刚需。目前主流练枪软件（如 Aim Lab、KovaaK's）均为客户端应用，**Web 端尚无功能完备的专业练枪平台**。

**AimPad** 填补了这一空白：
- ✅ 纯浏览器运行，无需下载安装
- ✅ **原生支持手柄**（Xbox、PlayStation、Switch Pro 等），借助 Gamepad API 即插即用
- ✅ 提供科学的训练体系（静态/动态点射、跟枪、切换瞄准、反应训练）
- ✅ 多维度数据分析 + 排行榜社交系统

本项目旨在为手柄玩家和键鼠玩家提供一个便捷、专业、跨平台的练枪环境。

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🎮 **原生手柄支持** | 自动识别 Xbox、PlayStation、Switch Pro 等手柄，支持摇杆死区、灵敏度曲线、按键映射配置 |
| 🖱️ **键鼠兼容** | 传统键鼠用户同样可以获得完整的训练体验 |
| 🔫 **科学训练体系** | 参考 Aim Lab / KovaaK's，内置静态点射、跟枪、切换瞄准、反应训练等 5 大类任务 |
| 📊 **数据分析** | 反应时间、命中率、KPS、跟枪平滑度、路径效率等 7+ 指标，雷达图 & 趋势图表可视化 |
| 🏆 **排行榜 & 社交** | 日/周/赛季排行榜、好友对比、成绩分享 |
| 🎨 **自定义任务** | 玩家可调节目标数量、速度、大小、持续时间，并分享自己的任务配置 |
| ⚡ **高性能渲染** | 基于 Babylon.js 的 3D 引擎，支持 LOD、实例化渲染、画质档位调节 |
| 💾 **云端同步** | 训练数据本地缓存（IndexedDB） + 云端备份，跨设备同步 |

---

## 🛠️ 技术选型

### 前端
- **框架**：React 18 + TypeScript
- **状态管理**：Zustand
- **路由**：React Router v6
- **样式**：TailwindCSS + CSS Modules
- **3D 引擎**：Babylon.js（含射线检测、PBR、GUI 系统）
- **手柄接入**：原生 Gamepad API + 自定义封装

### 后端（计划中）
- **运行时**：Node.js + Express / Next.js API Routes
- **数据库**：PostgreSQL + Redis
- **认证**：NextAuth.js / Supabase Auth
- **部署**：Vercel / Cloudflare Pages

> 目前 MVP 阶段以前端为主，后端采用 Serverless 或轻量 API 即可运行。

---

## 🚀 快速开始

### 前置条件
- Node.js ≥ 18
- npm 或 yarn

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/yourusername/AimPad.git
cd AimPad

# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev
```

### 构建生产版本

```bash
npm run build
npm start
```

---

## 🎮 使用指南

### 手柄连接
1. 通过蓝牙或 USB 连接手柄
2. 打开 AimPad 网页，页面会自动检测手柄并显示连接成功
3. 在设置页面可调整：
   - 摇杆死区（避免漂移）
   - 灵敏度曲线（线性 / 指数）
   - 按键映射（为不同手柄预设或自定义）

### 开始训练
- 选择训练任务（如 Gridshot、SphereTrack）
- 使用**准星对准目标**，按下**射击键**（鼠标左键 / 手柄 RT / A 键等）
- 训练结束后查看详细数据报告

### 数据同步
- 未登录时数据保存在本地 IndexedDB
- 注册账号后可开启云端同步，跨设备保存历史记录

---

## 📁 项目结构

```
AimPad/
├── public/               # 静态资源
├── src/
│   ├── components/       # React 组件（UI、HUD、设置面板）
│   ├── game/             # Babylon.js 场景 & 游戏逻辑
│   │   ├── scenes/       # 不同训练任务场景
│   │   ├── entities/     # 目标物体、准星、特效
│   │   └── input/        # 输入抽象层（鼠标 + 手柄）
│   ├── hooks/            # 自定义 hooks（含 useGamepad）
│   ├── stores/           # Zustand 状态管理
│   ├── utils/            # 评分算法、命中检测、数据存储
│   ├── styles/           # Tailwind + CSS Modules
│   └── App.tsx
├── server/               # 后端 API（可选，用于排行榜/用户）
├── package.json
└── README.md
```

---

## 🧪 核心算法示例

### 跟枪平滑度计算（简化版）

```typescript
function calculateSmoothness(
  mousePositions: Vector2[],
  targetPositions: Vector2[]
): number {
  // 计算加速度变化（jerk）与跟踪误差
  const jerk = computeJerk(mousePositions);
  const trackingError = averageDistance(mousePositions, targetPositions);
  return 100 / (1 + jerk * 0.1 + trackingError * 0.05);
}
```

### 命中检测（Babylon.js 射线）

```typescript
const ray = new BABYLON.Ray(camera.position, camera.getForwardRay().direction, 100);
const hit = scene.pickWithRay(ray);
if (hit.pickedMesh?.metadata?.isTarget) {
  onTargetHit(hit.pickedMesh);
}
```

---

## 🗓️ 开发计划

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| **Phase 1** | MVP：手柄识别 + Gridshot/SphereTrack + 本地成绩 | 4-6 周 |
| **Phase 2** | 完整任务库（6-8任务）+ 统计仪表板 + 自定义任务 | 6-8 周 |
| **Phase 3** | 排行榜、好友系统、成就、多语言 | 4-6 周 |
| **Phase 4** | AI 训练建议、弹道可视化、移动端适配 | 持续迭代 |

> 当前处于 **Phase 1 开发中**，欢迎贡献代码或提出建议。

---

## 🤝 贡献指南

我们欢迎任何形式的贡献（代码、文档、测试、建议）！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

请确保代码遵循项目现有的 TypeScript 和 React 规范。

---

## 📄 许可证

本项目基于 MIT 协议开源，详情见 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

- [Aim Lab](https://aimlab.gg/) & [KovaaK's](https://kovaak.com/) – 训练方法论参考
- [Babylon.js](https://www.babylonjs.com/) – 强大的 Web 3D 引擎
- Gamepad API 规范 – 让手柄 Web 化成为可能

---

## 📧 联系方式

- 项目维护者：[@jiangdongshi](https://github.com/jiangdongshi)
- 问题反馈：[qq:14071489 or huchao_cloud@163.com](../../issues)
- 讨论与建议：[qq:14071489 or huchao_cloud@163.com](../../discussions)

**瞄准，永无止境。** 🎯
