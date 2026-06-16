# 瞄点 · AimPad 项目方案 v4.0 — 本地优先架构

> **版本变更**：v4.0 移除用户注册/登录/认证系统，采用"设备即身份 + JSON 数据迁移"的本地优先架构。本文档替代 v3.2 项目方案中所有涉及服务端认证、MySQL/Redis 的内容。

## 目录

- [1. 架构变更概述](#1-架构变更概述)
- [2. 核心价值主张](#2-核心价值主张)
- [3. 技术选型](#3-技术选型)
- [4. 系统架构设计](#4-系统架构设计)
- [5. 功能模块设计](#5-功能模块设计)
- [6. 本地身份与数据管理](#6-本地身份与数据管理)
- [7. 核心算法设计](#7-核心算法设计)
- [8. 性能优化方案](#8-性能优化方案)
- [9. 开发计划与里程碑](#9-开发计划与里程碑)
- [10. 风险评估与应对](#10-风险评估与应对)

---

## 1. 架构变更概述

### 1.1 为什么从"账号体系"切换到"本地优先"？

| 维度 | v3.2（旧） | v4.0（新） |
|------|-----------|-----------|
| 用户身份 | 邮箱验证码 + JWT | 设备 ID（`crypto.randomUUID()`） |
| 数据存储 | MySQL + Redis + IndexedDB | IndexedDB + localStorage 纯本地 |
| 跨设备同步 | 服务端同步（需邮箱验证码登录） | JSON 导出/导入（无需服务器） |
| 服务器依赖 | Express + MySQL + Redis + Nginx | 纯静态文件托管（Vercel/Pages/Nginx） |
| 运营成本 | 服务器 + 数据库 + 短信邮件服务费 | **零**（仅静态托管费用） |
| 用户首次体验 | 输入邮箱 → 收验证码 → 输入 → 开始 | 打开网页 → 点击开始 |

### 1.2 核心理念

> **设备即身份，数据跟设备走。想要换设备？导出 JSON 文件即可。**

- 打开浏览器 = 已"登录"（自动生成 deviceId）
- 所有训练数据 100% 本地（IndexedDB + localStorage）
- JSON 导出/导入实现跨设备数据迁移
- 永远不需要输入邮箱、手机号、密码

---

## 2. 核心价值主张

- **零安装，即开即练**：浏览器打开即可开始训练，无需下载客户端
- **零注册，设备即身份**：打开网页即生成唯一设备 ID，无需邮箱/手机号/密码
- **手柄原生支持**：借助 Gamepad API，完美识别 Xbox、PlayStation、Switch Pro 等主流手柄
- **专业训练体系**：参考 Aim Lab/KovaaK's 的科学训练方法论
- **跨平台兼容**：PC、Mac、Linux 均可通过浏览器访问
- **数据主权在用户**：所有数据存储在本地，JSON 导出/导入实现数据迁移

---

## 3. 技术选型

### 3.1 前端（纯客户端 SPA）

| 技术 | 选型 | 理由 |
|------|------|------|
| UI 框架 | React 18 + TypeScript | 组件化开发、生态成熟、类型安全 |
| 状态管理 | Zustand + persist 中间件 | 轻量、localStorage 持久化 |
| 路由 | React Router v6 | 标准方案 |
| 样式方案 | TailwindCSS + CSS 自定义属性 | 8 套主题，快速开发 |
| 3D 渲染引擎 | Babylon.js 6 | 内置 PBR、射线检测、GUI 系统 |
| 图表 | Recharts 2 | 统计图表 |
| 本地存储 | IndexedDB + localStorage | 训练记录 + 设置 |
| 构建 | Vite 5 | 极速 HMR、高效构建 |
| 部署 | Vercel / Cloudflare Pages / Nginx | 纯静态托管，免费 CDN |

### 3.2 不再使用的技术（已移除）

| 旧技术 | 移除原因 |
|--------|----------|
| Express.js | 无需后端 API |
| MySQL 8.0 | 数据全部本地存储 |
| Redis 7.x | 无需缓存/验证码 |
| JWT (jsonwebtoken) | 无需认证 |
| bcryptjs | 无需密码 |
| Docker Compose（后端部分） | 纯静态部署 |
| 华为云 SWR | 无需 Docker 镜像仓库 |

---

## 4. 系统架构设计

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    浏览器（纯前端 SPA）                            │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│  React UI     │  Gamepad API  │ Babylon.js    │  本地存储层       │
│  (页面组件)   │  (手柄输入)   │  (3D渲染)     │  IndexedDB       │
│               │               │               │  + localStorage  │
├───────────────┴───────────────┴───────────────┴─────────────────┤
│                    静态文件托管（Vercel / Nginx）                  │
└─────────────────────────────────────────────────────────────────┘
```

**关键变化**：不再有后端服务层、数据库层。架构从三层简化为纯客户端单层。

### 4.2 数据流设计

1. **输入层**：Gamepad API / 鼠标事件 → 输入标准化 → 输入管理器
2. **逻辑层**：训练任务逻辑 → 命中检测 → 得分计算 → 数据收集
3. **渲染层**：Babylon.js 场景 → 目标/准星/特效 → 帧同步
4. **存储层**：训练数据 → IndexedDB（本地持久化）→ JSON 导出（可选）

---

## 5. 功能模块设计

### 5.1 手柄识别与管理模块（保持）

与 v3.2 一致：设备检测、多手柄支持、按键映射、死区配置、灵敏度调节。

### 5.2 训练任务系统（保持）

6 个预设任务 + 自定义训练任务系统（SceneConfig 驱动 + 16 位分享码）。

### 5.3 数据统计与分析模块（保持）

7+ 指标评估、雷达图、趋势图表、历史训练分析。所有数据从 IndexedDB 读取。

### 5.4 本地身份与数据管理（新增）

**此模块替代旧版"用户系统"和"排行榜/社交模块"。**

详见 [第 6 节](#6-本地身份与数据管理)。

---

## 6. 本地身份与数据管理

### 6.1 设备身份（Device Identity）

首次访问 AimPad 时，自动生成唯一设备 ID：

```typescript
// 生成设备 ID（仅首次）
function getDeviceId(): string {
  const stored = localStorage.getItem('aimpad_device_id');
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem('aimpad_device_id', id);
  return id;
}
```

**Profile 数据结构**：

```typescript
interface LocalProfile {
  deviceId: string;           // 设备唯一 ID（crypto.randomUUID()）
  displayName: string;        // 用户自定义昵称（默认 "Player_xxxx"）
  avatarSeed: string;         // 用于生成默认头像的 seed
  createdAt: number;          // 本设备首次使用时间戳
  version: number;            // 数据格式版本
}
```

### 6.2 数据存储架构

```
浏览器存储空间
├── IndexedDB（AimPadDB）
│   └── training → { id, taskId, timestamp, score, accuracy, ... }
│       索引: taskId, timestamp
│
├── localStorage
│   ├── aimpad_device_id      → 设备唯一 ID（首次生成，永不变化）
│   ├── aimpad_profile        → 本地 Profile（Zustand persist）
│   ├── aimpad_settings       → 用户设置（Zustand persist）
│   ├── aimpad_custom_tasks   → 自定义训练任务
│   ├── aimpad_task_durations → 每个任务的训练时长偏好
│   ├── aimpad_task_difficulties → 每个任务的难度偏好
│   ├── aimpad_ball_color     → 小球颜色偏好
│   └── aimpad_wall_color     → 墙壁颜色偏好
│
└── 不需要登录、不需要 Token、不需要验证码
```

### 6.3 JSON 数据导出

用户可在设置页导出全部数据为单个 JSON 文件：

```typescript
interface ExportPayload {
  version: 1;
  exportedAt: string;       // ISO 8601
  profile: LocalProfile;
  settings: SettingsState;
  trainingRecords: TrainingResult[];  // 全量训练记录
  customTasks: CustomTask[];
  taskDurations: Record<string, number>;
  taskDifficulties: Record<string, string>;
}
```

导出按钮在 `/settings` 页面底部：
- "导出所有数据 (JSON)" 按钮 → 浏览器下载 `AimPad_export_2026-06-16.json`

### 6.4 JSON 数据导入

用户可在设置页或首次访问时导入 JSON 文件：

```typescript
async function importData(file: File): Promise<ImportResult> {
  const payload: ExportPayload = JSON.parse(await file.text());
  
  // 校验版本
  if (payload.version !== 1) throw new Error('不支持的数据格式版本');
  
  // 合并策略：保留最高分、最新设置
  // Profile、Settings 全量替换（用户确认后）
  // TrainingRecords 按 id 去重合并
  // CustomTasks 按 id 去重合并
  
  return { imported: true, recordCount, taskCount };
}
```

### 6.5 跨设备数据同步方案对比

| 方案 | 实现复杂度 | 用户体验 | 是否需要服务器 |
|------|-----------|----------|---------------|
| **JSON 导出/导入（选用）** | 低（~200 行代码） | 手动操作，但一次搞定 | 否 |
| Passkeys/WebAuthn | 中（~500 行 + 简单服务端） | 指纹/面容一键 | 需要极简服务端 |
| 浏览器书签同步 | 低 | 半自动（依赖浏览器） | 否 |
| 第三方云盘同步 | 低 | 用户自行管理文件 | 否 |

**当前阶段选择 JSON 导出/导入。** 未来如果需要无缝跨设备体验，可扩展为 Passkeys + 轻量同步服务。

---

## 7. 核心算法设计

### 7.1 瞄准评分算法（保持）

与 v3.2 一致：准确率 × 速度 × 一致性加权综合评分。

### 7.2 跟枪平滑度算法（保持）

Jerk（加速度变化）+ 跟踪误差综合评估。

### 7.3 命中检测算法（保持）

Babylon.js 射线检测（Ray + pickWithRay）。

### 7.4 手柄输入标准化（保持）

Xbox / PS / Switch 三种映射 + Nintendo A/B 交换。

---

## 8. 性能优化方案

### 8.1 渲染性能（保持）

- 帧率目标：60fps（中低端）→ 120fps（高端）
- LOD、实例化渲染、视锥剔除
- 四档画质（low/medium/high/ultra）
- 对象池：12 个 Sphere mesh 预创建 + 共享材质

### 8.2 存储优化（新增）

- IndexedDB 按时间戳索引，查询 O(log n)
- 训练记录单条约 300 bytes，10 万条 ≈ 30 MB — 远低于浏览器限制
- localStorage 总使用量 < 50 KB
- JSON 导出文件：10 万条记录 ≈ 25 MB（压缩后 < 5 MB）

---

## 9. 开发计划与里程碑

### Phase 1：MVP 核心功能 ✅ 已完成

- 手柄识别、Babylon.js 3D 场景、2 个核心训练任务、本地成绩记录

### Phase 2：功能完善 ✅ 已完成

- 6 个训练任务、统计仪表板、自定义任务系统、准星自定义、8 套主题、多语言
- ~~用户系统~~ → **已移除，替换为本地 Profile**

### Phase 3：架构简化（当前阶段）

- [ ] 移除认证系统（Login/Register/ForgotPassword 页面 + authStore + auth API）
- [ ] 新增 profileStore（设备 ID + 昵称 + 头像）
- [ ] 新增 JSON 导出/导入功能
- [ ] 新增 Profile 编辑页（替换登录/注册页）
- [ ] 移除 server/ 后端代码依赖
- [ ] 简化部署流程（纯静态）

### Phase 4：优化与扩展（持续）

- [ ] 性能优化与移动端适配
- [ ] AI 训练建议
- [ ] 弹道可视化工具
- [ ] 游戏灵敏度转换工具
- [ ] 可选：Passkeys 跨设备同步

---

## 10. 风险评估与应对

| 风险项 | 影响程度 | 应对策略 |
|--------|----------|----------|
| 浏览器 Gamepad API 兼容性 | 中 | 键鼠备用方案 |
| 3D 渲染性能瓶颈 | 高 | 四档画质 + 对象池 |
| 用户清除浏览器数据导致数据丢失 | 高 | 设置页显著位置提供"导出数据"按钮 + 定期提醒 |
| 手柄按键映射不一致 | 中 | 标准化映射层 + 用户自定义 |
| IndexedDB 存储限制 | 低 | 单条记录约 300B，Firefox 限制 2GB，足够存 600 万条 |
| 无排行榜/社交功能 | 中 | 未来可选实现匿名排行榜（仅用 deviceId 前 8 位 + 昵称） |

---

**文档版本**：v4.0
**最后更新**：2026-06-16
**维护者**：@jiangdongshi
