# 瞄点 · AimPad 项目数据管理手册 v1.0 — 本地存储架构

> 本文档替代 `瞄点 · AimPad 项目数据库设计手册.md`（v1.1），描述 v4.0 本地优先架构下的数据存储方案。不再使用 MySQL/Redis，全部数据存储在浏览器本地。

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. 存储方案总览](#2-存储方案总览)
- [3. IndexedDB 存储设计](#3-indexeddb-存储设计)
- [4. localStorage 存储设计](#4-localstorage-存储设计)
- [5. 本地 Profile 系统](#5-本地-profile-系统)
- [6. 数据导出/导入](#6-数据导出导入)
- [7. 数据生命周期](#7-数据生命周期)
- [8. 存储限制与应对策略](#8-存储限制与应对策略)
- [附录 A：数据字典](#附录-a数据字典)

---

## 1. 背景与目标

### 1.1 架构变更

v4.0 彻底移除服务端依赖，采用纯客户端存储方案：

| 维度 | v3.2（旧） | v4.0（新） |
|------|-----------|-----------|
| 训练记录 | IndexedDB → MySQL 同步 | IndexedDB 唯一存储 |
| 用户设置 | localStorage → MySQL 同步 | localStorage 唯一存储 |
| 用户身份 | MySQL users 表 | localStorage deviceId |
| 验证码 | Redis → MySQL 审计 | 不再需要 |
| 跨设备 | 服务端同步 | JSON 导出/导入 |

### 1.2 目标

- 所有数据 100% 浏览器本地存储
- 零服务端依赖
- 提供 JSON 导出/导入实现数据迁移
- 用户对自己的数据拥有完全控制权

---

## 2. 存储方案总览

```
┌──────────────────────────────────────────────────────────┐
│                    浏览器存储空间                          │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │         IndexedDB: AimPadDB (v1)                │    │
│  │  ┌──────────────┐  ┌────────────────────────┐  │    │
│  │  │ training     │  │ (预留) custom_tasks     │  │    │
│  │  │ keyPath: id  │  │                        │  │    │
│  │  │ indexes:     │  │                        │  │    │
│  │  │  - taskId   │  │                        │  │    │
│  │  │  - timestamp │  │                        │  │    │
│  │  └──────────────┘  └────────────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              localStorage                       │    │
│  │  ┌─────────────────────────────────────────┐   │    │
│  │  │ aimpad_device_id     → "uuid-string"    │   │    │
│  │  │ aimpad_profile      → LocalProfile JSON │   │    │
│  │  │ aimpad_settings     → SettingsState JSON│   │    │
│  │  │ aimpad_custom_tasks → CustomTask[] JSON │   │    │
│  │  │ aimpad_task_durations   → 时长偏好       │   │    │
│  │  │ aimpad_task_difficulties → 难度偏好      │   │    │
│  │  │ aimpad_ball_color   → "#ADD8E6"          │   │    │
│  │  │ aimpad_wall_color   → "#1a1a2e"          │   │    │
│  │  └─────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │             Zustand 内存（运行时）                │    │
│  │  gameStore / settingsStore / profileStore      │    │
│  │  customTaskStore / authStore（待移除）           │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 3. IndexedDB 存储设计

### 3.1 数据库：AimPadDB

| 属性 | 值 |
|------|-----|
| 数据库名 | `AimPadDB` |
| 版本 | `1` |
| 对象存储 | `training` |

### 3.2 training 对象存储

```
TrainingResult {
  id: string              // 主键 (keyPath)，格式: "{taskId}-{timestamp}"
  taskId: string          // 索引，如 "gridshot", "sphere-track"
  timestamp: number       // 索引，Unix 毫秒时间戳
  score: number           // 最终得分
  accuracy: number        // 命中率 0~100
  reactionTime: number    // 平均反应时间 (ms)
  reactionTimes: number[] // 每次反应时间数组
  kills: number           // 命中数
  misses: number          // 脱靶数
  duration: number        // 训练时长 (ms)
  metadata?: {            // 扩展字段
    device?: 'mouse' | 'gamepad'
    platform?: 'xbox' | 'playstation' | 'switch'
    avgFps?: number
    quality?: 'low' | 'medium' | 'high' | 'ultra'
  }
}
```

**索引**：

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `taskId` | taskId | 按任务类型筛选 |
| `timestamp` | timestamp | 按时间排序/筛选 |

**TrainingStorage 类**（`src/utils/storage.ts`，已存在）：

| 方法 | 说明 |
|------|------|
| `init()` | 初始化 IndexedDB |
| `saveRecord(record)` | 保存训练记录 |
| `getRecords(taskId?, limit)` | 获取训练记录（按时间降序） |
| `getBestScore(taskId)` | 获取某任务最高分 |
| `deleteRecord(id)` | 删除单条记录 |
| `clearAll()` | 清空所有记录 |

---

## 4. localStorage 存储设计

### 4.1 设备 ID

| 属性 | 值 |
|------|-----|
| Key | `aimpad_device_id` |
| 类型 | `string` |
| 格式 | UUID v4（`crypto.randomUUID()`） |
| 生成时机 | 首次访问 AimPad 时生成，永不变化 |
| 示例 | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |

### 4.2 本地 Profile

| 属性 | 值 |
|------|-----|
| Key | `aimpad_profile` |
| 类型 | Zustand persist（JSON） |
| 管理 | `profileStore` |

```typescript
interface LocalProfile {
  deviceId: string;
  displayName: string;     // 默认 "Player_" + deviceId 前 4 位
  avatarSeed: string;      // 头像随机种子
  createdAt: number;       // 首次使用时间戳
  version: number;         // 数据格式版本，当前为 1
}
```

### 4.3 用户设置

| 属性 | 值 |
|------|-----|
| Key | `aimpad_settings` |
| 类型 | Zustand persist（JSON） |
| 管理 | `settingsStore` |

结构与 v3.2 完全一致：主题、手柄、鼠标、准星、显示、音效等全部设置项。

### 4.4 自定义任务

| 属性 | 值 |
|------|-----|
| Key | `aimpad_custom_tasks` |
| 类型 | Zustand persist（JSON） |
| 管理 | `customTaskStore` |

### 4.5 运行时偏好

| Key | 内容 | 示例值 |
|-----|------|--------|
| `aimpad_task_durations` | `Record<string, number>` | `{"gridshot": 30000, "sphere-track": 60000}` |
| `aimpad_task_difficulties` | `Record<string, string>` | `{"gridshot": "hard", "sphere-track": "normal"}` |
| `aimpad_ball_color` | `string` | `"#ADD8E6"` |
| `aimpad_wall_color` | `string` | `"#1a1a2e"` |

---

## 5. 本地 Profile 系统

### 5.1 设计目标

用最简方案替代完整的用户认证体系，实现：
- 设备唯一身份识别
- 用户自定义显示名
- 数据与设备关联

### 5.2 ProfileStore 设计

```typescript
// src/stores/profileStore.ts
interface ProfileState {
  deviceId: string;
  displayName: string;
  avatarSeed: string;
  createdAt: number;
  version: number;

  // Actions
  updateDisplayName: (name: string) => void;
  regenerateAvatar: () => void;
  exportAllData: () => Promise<string>;   // 导出 JSON
  importData: (file: File) => Promise<ImportResult>;
  getStorageSize: () => Promise<{indexedDB: number, localStorage: number}>;
  clearAllData: () => Promise<void>;      // 危险操作，需二次确认
}
```

### 5.3 ProfileEditor 页面（替换旧 Login/Register）

`/profile` 页面功能：
- 编辑显示名（输入框）
- 重新生成头像（按钮）
- 查看设备 ID（只读，可复制）
- 查看存储使用情况
- 导出数据（下载 JSON）
- 导入数据（上传 JSON，合并或替换）
- 清除所有数据（危险操作，弹窗确认）

### 5.4 ProfileMenu 组件（替换旧 UserMenu）

导航栏 ProfileMenu：
- 显示头像 + 显示名
- 下拉菜单：编辑资料 / 导出数据 / 导入数据

---

## 6. 数据导出/导入

### 6.1 导出格式

```typescript
interface ExportPayload {
  meta: {
    version: 1;
    exportedAt: string;          // ISO 8601
    deviceId: string;
    recordCount: number;
    customTaskCount: number;
  };
  profile: LocalProfile;
  settings: SettingsState;
  trainingRecords: TrainingResult[];
  customTasks: CustomTask[];
  preferences: {
    taskDurations: Record<string, number>;
    taskDifficulties: Record<string, string>;
    ballColor: string;
    wallColor: string;
  };
}
```

**导出文件名**：`AimPad_backup_2026-06-16.json`

**预估文件大小**：
- 100 条记录：约 30 KB
- 1,000 条记录：约 300 KB
- 10,000 条记录：约 3 MB
- 100,000 条记录：约 30 MB → **建议压缩为 `.json.gz`**

### 6.2 导入策略

合并策略（而非全量替换）：

| 数据类别 | 策略 |
|----------|------|
| Profile | 用户确认后替换 |
| Settings | 用户确认后替换 |
| TrainingRecords | 按 `id` 去重，保留时间戳最新的版本 |
| CustomTasks | 按 `id` 去重，保留更新时间最新的版本 |
| Preferences | 保留当前设置，仅导入新任务的偏好 |

**导入流程**：
1. 用户选择 `.json` 文件 → 解析 → 校验格式
2. 显示导入预览（记录数、任务数、日期）
3. 用户选择合并策略（替换 / 合并）
4. 执行导入 → 显示结果

### 6.3 压缩导出（可选优化）

```typescript
// 使用 Compression Streams API（Chrome 80+, Edge 80+, Safari 16.4+）
async function compressExport(payload: ExportPayload): Promise<Blob> {
  const json = JSON.stringify(payload);
  const stream = new Blob([json]).stream();
  const compressed = stream.pipeThrough(new CompressionStream('gzip'));
  return new Response(compressed).blob();
}
```

---

## 7. 数据生命周期

```
┌─────────────┐    训练完成     ┌──────────────┐
│  gameStore  │ ─────────────→ │   IndexedDB  │
│  (运行时)   │  saveRecord()  │  (持久化)    │
└─────────────┘                └──────┬───────┘
                                      │
                           用户主动导出 │
                                      ▼
                               ┌──────────────┐
                               │  JSON 文件   │
                               │  (下载到本地) │
                               └──────────────┘
                                      │
                           用户主动导入 │
                                      ▼
┌─────────────┐                ┌──────────────┐
│  IndexedDB  │ ←───────────── │  新设备浏览器 │
│  + localStorage│  importData()│              │
└─────────────┘                └──────────────┘
```

**数据保留策略**：
- 训练记录：除非用户主动删除或清除浏览器数据，永久保留
- 设置：除非用户主动重置或清除，永久保留
- 运行时状态：页面刷新即重置（符合预期）

---

## 8. 存储限制与应对策略

### 8.1 浏览器存储限制

| 浏览器 | IndexedDB 限制 | localStorage 限制 |
|--------|---------------|-------------------|
| Chrome | 动态（可用磁盘的 60%） | 10 MB |
| Firefox | 2 GB（可申请更多） | 10 MB |
| Safari | 1 GB（7 天未使用可能清除） | 10 MB |
| Edge | 动态（可用磁盘的 60%） | 10 MB |

### 8.2 当前数据量估算

| 数据 | 单条大小 | 10 万条 |
|------|---------|---------|
| TrainingResult | ~300 bytes | ~30 MB |
| CustomTask | ~2 KB | ~2 MB（1000 个任务） |
| Settings | ~500 bytes | ~500 bytes |
| **合计** | | **~32.5 MB** |

**结论**：在达到任何浏览器限制之前，用户早已有充足理由导出数据。10 万条训练记录足够重度用户使用数年。

### 8.3 数据清理建议

在设置页提供：
- "保留最近 N 条记录"选项（默认：保留全部）
- "清除 90 天前的记录"按钮
- 显示当前存储使用量（IndexedDB + localStorage）

---

## 附录 A：数据字典

### taskId 枚举值

| taskId | 英文名 | 中文名 | 类型 |
|--------|--------|--------|------|
| `gridshot` | Gridshot | 网格射击 | static-clicking |
| `spidershot` | Spidershot | 蜘蛛射击 | static-clicking |
| `sphere-track` | SphereTrack | 球体追踪 | tracking |
| `strafe-track` | StrafeTrack | 移动追踪 | tracking |
| `target-switch` | TargetSwitch | 目标切换 | target-switching |
| `reflex-shot` | ReflexShot | 反射射击 | reaction |
| `custom-*` | 自定义 | 自定义 | 用户创建 |

### theme 枚举值

| 值 | 中文名 |
|----|--------|
| `default` | 深黑 |
| `midnight` | 午夜蓝 |
| `forest` | 森林绿 |
| `purple` | 皇家紫 |
| `chinese` | 中国红 |
| `light` | 纯白 |
| `cream` | 暖米 |
| `cool-light` | 冷灰 |

---

**文档版本**：v1.0
**最后更新**：2026-06-16
**维护者**：@jiangdongshi
