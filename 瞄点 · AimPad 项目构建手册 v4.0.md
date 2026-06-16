# 瞄点 · AimPad 项目构建手册 v4.0

> **版本变更**：v4.0 移除服务端（server/）、用户认证系统。项目变为纯前端 SPA，无需 Docker、MySQL、Redis。本文档替代 v3.2 构建手册中所有涉及后端开发的内容。

## 目录

- [1. 环境准备](#1-环境准备)
- [2. 项目初始化](#2-项目初始化)
- [3. 项目目录结构（v4.0）](#3-项目目录结构v40)
- [4. 核心模块构建指南](#4-核心模块构建指南)
- [5. v4.0 变更：需删除的文件](#5-v40-变更需删除的文件)
- [6. v4.0 变更：需新增的文件](#6-v40-变更需新增的文件)
- [7. v4.0 变更：需修改的文件](#7-v40-变更需修改的文件)
- [8. 开发工作流](#8-开发工作流)
- [9. 常见问题与解决方案](#9-常见问题与解决方案)
- [附录 A：技术选型总览（v4.0）](#附录-a技术选型总览v40)
- [附录 B：开发里程碑](#附录-b开发里程碑)
- [附录 C：快速启动指南](#附录-c快速启动指南)

---

## 1. 环境准备

### 1.1 必要工具

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | ≥ 18.x | JavaScript 运行时 |
| npm | 最新稳定版 | 包管理器 |
| Git | ≥ 2.x | 版本控制 |
| VS Code | 最新稳定版 | 推荐编辑器 |

> **v4.0 不再需要**：MySQL、Redis、Docker。

### 1.2 浏览器要求

| 浏览器 | 最低版本 | Gamepad API | IndexedDB |
|--------|----------|-------------|-----------|
| Chrome | 35+ | ✅ 完整 | ✅ 完整 |
| Firefox | 29+ | ✅ 完整 | ✅ 完整 |
| Edge | 12+ | ✅ 完整 | ✅ 完整 |
| Safari | 10.1+ | ⚠️ 部分 | ✅ 完整 |

---

## 2. 项目初始化

```bash
# 克隆项目
git clone https://github.com/jiangdongshi/AimPad.git
cd AimPad

# 安装依赖（仅前端，无后端）
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev
```

**v4.0 不再需要**：
```bash
# 以下命令已废弃
cd server && npm install    # ❌ server/ 目录已移除
docker compose up -d        # ❌ 不再使用 Docker
```

---

## 3. 项目目录结构（v4.0）

```
AimPad/
├── public/                    # 静态资源
│   └── favicon.svg
├── src/
│   ├── api/                   # 已废弃（保留空目录或移除）
│   ├── components/
│   │   ├── ui/                # Button / Card / Badge / ThemeSwitcher / LanguageSwitcher
│   │   ├── hud/               # Crosshair / TrainingHUD / TrainingResultPanel
│   │   └── layout/            # Header / Layout / ProfileMenu ← 替换 UserMenu
│   ├── game/
│   │   ├── engine/GameEngine.ts
│   │   ├── scenes/
│   │   │   ├── BaseScene.ts
│   │   │   ├── GridshotScene.ts
│   │   │   ├── SphereTrackScene.ts
│   │   │   └── CustomScene.ts
│   │   └── input/
│   │       ├── GamepadAdapter.ts
│   │       └── InputManager.ts
│   ├── hooks/
│   │   ├── useTraining.ts
│   │   ├── useGamepad.ts
│   │   ├── useStatistics.ts
│   │   └── useTheme.ts
│   ├── stores/
│   │   ├── gameStore.ts
│   │   ├── settingsStore.ts       # 移除 syncToServer/loadFromServer
│   │   ├── profileStore.ts        # ← 新增：替换 authStore
│   │   └── customTaskStore.ts
│   ├── types/
│   │   ├── gamepad.ts
│   │   ├── training.ts
│   │   ├── statistics.ts
│   │   ├── customTask.ts
│   │   ├── theme.ts
│   │   ├── locale.ts
│   │   └── profile.ts             # ← 新增：Profile 类型
│   ├── utils/
│   │   ├── scoring.ts
│   │   ├── inputSmoother.ts
│   │   ├── gamepadMap.ts
│   │   ├── themeColors.ts
│   │   ├── shareCode.ts
│   │   ├── storage.ts             # IndexedDB（保持）
│   │   ├── deviceId.ts            # ← 新增：设备 ID 生成
│   │   └── dataExport.ts          # ← 新增：JSON 导出/导入
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Training.tsx
│   │   ├── Statistics.tsx
│   │   ├── Settings.tsx
│   │   ├── Gamepad.tsx
│   │   ├── CustomTaskEditor.tsx
│   │   └── Profile.tsx            # ← 新增：Profile 编辑页（替换 Login/Register）
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── themes.css
│   │   └── global.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts                # 移除 /api proxy
├── .eslintrc.cjs
├── .prettierrc
└── README.md
```

---

## 4. 核心模块构建指南

### 手柄识别、Babylon.js 场景、训练任务、统计、输入系统

与 v3.2 构建手册 **完全一致**，这些模块不受架构变更影响。

参考旧版构建手册：
- 4.1 手柄识别与管理模块 ✅ 保持
- 4.2 Babylon.js 3D 场景搭建 ✅ 保持
- 4.3 训练任务系统 ✅ 保持
- 4.4 数据统计与分析模块 ✅ 保持
- 4.5 输入系统抽象层 ✅ 保持

---

## 5. v4.0 变更：需删除的文件

### 5.1 前端文件

| 文件 | 原因 |
|------|------|
| `src/pages/Login.tsx` | 不再需要登录 |
| `src/pages/Register.tsx` | 不再需要注册 |
| `src/pages/ForgotPassword.tsx` | 不再需要密码找回 |
| `src/pages/Admin.tsx` | 不再需要管理后台 |
| `src/api/auth.ts` | 不再需要认证 API |
| `src/api/settings.ts` | 不再需要设置同步 API |
| `src/api/admin.ts` | 不再需要管理 API |
| `src/api/client.ts` | 不再需要 API 客户端 |
| `src/api/` 目录 | 整体移除 |
| `src/stores/authStore.ts` | 由 profileStore 替代 |
| `src/types/auth.ts` | 不再需要认证类型 |

### 5.2 后端文件（整体移除）

整个 `server/` 目录及其所有内容：
- `server/package.json`
- `server/tsconfig.json`
- `server/Dockerfile`
- `server/src/index.ts`
- `server/src/config.ts`
- `server/src/db.ts`
- `server/src/redis.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/settings.ts`
- `server/src/routes/admin.ts`
- `server/src/middleware/auth.ts`

### 5.3 部署文件（简化）

| 文件 | 变更 |
|------|------|
| `docker-compose.yml` | 移除或简化为仅 Nginx |
| `nginx.conf` | 移除 API 代理配置 |
| `server/Dockerfile` | 移除 |
| `config/mysql/` | 移除 |
| `config/redis/` | 移除 |
| `.env.example` | 简化为仅前端变量 |

---

## 6. v4.0 变更：需新增的文件

### 6.1 types/profile.ts

```typescript
// src/types/profile.ts
export interface LocalProfile {
  deviceId: string;
  displayName: string;
  avatarSeed: string;
  createdAt: number;
  version: number;
}

export interface ExportPayload {
  meta: {
    version: number;
    exportedAt: string;
    deviceId: string;
    recordCount: number;
    customTaskCount: number;
  };
  profile: LocalProfile;
  settings: Record<string, unknown>;
  trainingRecords: TrainingResult[];
  customTasks: CustomTask[];
  preferences: {
    taskDurations: Record<string, number>;
    taskDifficulties: Record<string, string>;
    ballColor: string;
    wallColor: string;
  };
}

export interface ImportResult {
  imported: boolean;
  recordCount: number;
  taskCount: number;
  merged: boolean;
  error?: string;
}
```

### 6.2 utils/deviceId.ts

```typescript
// src/utils/deviceId.ts
const DEVICE_ID_KEY = 'aimpad_device_id';

export function getDeviceId(): string {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
```

### 6.3 utils/dataExport.ts

```typescript
// src/utils/dataExport.ts
import { trainingStorage } from './storage';
import type { ExportPayload, ImportResult } from '@/types/profile';

export async function exportAllData(): Promise<string> {
  const records = await trainingStorage.getRecords(undefined, 100000);
  const profile = JSON.parse(localStorage.getItem('aimpad_profile') || '{}');
  const settings = JSON.parse(localStorage.getItem('aimpad_settings') || '{}');
  const customTasks = JSON.parse(localStorage.getItem('aimpad_custom_tasks') || '[]');

  const payload: ExportPayload = {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      deviceId: profile.deviceId || '',
      recordCount: records.length,
      customTaskCount: customTasks.length,
    },
    profile,
    settings,
    trainingRecords: records,
    customTasks,
    preferences: {
      taskDurations: JSON.parse(localStorage.getItem('aimpad_task_durations') || '{}'),
      taskDifficulties: JSON.parse(localStorage.getItem('aimpad_task_difficulties') || '{}'),
      ballColor: localStorage.getItem('aimpad_ball_color') || '#ADD8E6',
      wallColor: localStorage.getItem('aimpad_wall_color') || '',
    },
  };
  return JSON.stringify(payload, null, 2);
}

export async function importData(json: string): Promise<ImportResult> {
  const payload: ExportPayload = JSON.parse(json);
  if (payload.meta.version !== 1) {
    return { imported: false, recordCount: 0, taskCount: 0, merged: false, error: '不支持的数据版本' };
  }

  // 合并训练记录（按 id 去重）
  const existingIds = new Set((await trainingStorage.getRecords(undefined, 100000)).map(r => r.id));
  let importedRecords = 0;
  for (const record of payload.trainingRecords) {
    if (!existingIds.has(record.id)) {
      await trainingStorage.saveRecord(record);
      importedRecords++;
    }
  }

  // 合并自定义任务（按 id 去重）
  const existingTasks = JSON.parse(localStorage.getItem('aimpad_custom_tasks') || '[]');
  const existingTaskIds = new Set(existingTasks.map((t: {id: string}) => t.id));
  let importedTasks = 0;
  for (const task of payload.customTasks) {
    if (!existingTaskIds.has(task.id)) {
      existingTasks.push(task);
      importedTasks++;
    }
  }
  localStorage.setItem('aimpad_custom_tasks', JSON.stringify(existingTasks));

  return { imported: true, recordCount: importedRecords, taskCount: importedTasks, merged: true };
}
```

### 6.4 stores/profileStore.ts

```typescript
// src/stores/profileStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDeviceId } from '@/utils/deviceId';
import type { LocalProfile } from '@/types/profile';

interface ProfileState extends LocalProfile {
  updateDisplayName: (name: string) => void;
  regenerateAvatar: () => void;
}

function createDefaultProfile(): LocalProfile {
  const deviceId = getDeviceId();
  return {
    deviceId,
    displayName: `Player_${deviceId.slice(0, 4)}`,
    avatarSeed: Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    version: 1,
  };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...createDefaultProfile(),

      updateDisplayName: (name: string) => {
        if (name.length >= 1 && name.length <= 32) {
          set({ displayName: name });
        }
      },

      regenerateAvatar: () => {
        set({ avatarSeed: Math.random().toString(36).slice(2, 8) });
      },
    }),
    {
      name: 'aimpad_profile',
      // 首次使用：如果 localStorage 没有数据，用默认值初始化
      onRehydrateStorage: () => (state) => {
        if (!state?.deviceId) {
          const defaults = createDefaultProfile();
          useProfileStore.setState(defaults);
        }
      },
    }
  )
);
```

### 6.5 pages/Profile.tsx

Profile 编辑页面，功能：
- 显示设备 ID（只读，可复制）
- 编辑显示名（输入框 + 保存按钮）
- 重新生成头像
- 查看存储使用情况
- 导出所有数据（下载 JSON 按钮）
- 导入数据（文件选择器 + 上传按钮）
- 清除所有数据（危险操作，弹窗二次确认）

### 6.6 components/layout/ProfileMenu.tsx

替代旧 `UserMenu.tsx`。导航栏右侧显示：
- 头像（基于 avatarSeed 生成的 SVG）
- 显示名
- 下拉菜单：编辑资料 → /profile，导出数据，导入数据

---

## 7. v4.0 变更：需修改的文件

### 7.1 App.tsx

```diff
- import { Login } from '@/pages/Login';
- import { Register } from '@/pages/Register';
- import { ForgotPassword } from '@/pages/ForgotPassword';
- import { Admin } from '@/pages/Admin';
+ import { Profile } from '@/pages/Profile';

- import { useAuthStore } from '@/stores/authStore';
+ import { useProfileStore } from '@/stores/profileStore';

  function AppInner() {
    useTheme();
-   const fetchUser = useAuthStore((s) => s.fetchUser);
-   const token = useAuthStore((s) => s.token);
-
-   useEffect(() => {
-     if (token) {
-       fetchUser();
-     }
-   }, []);

    return (
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="training" element={<Training />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="settings" element={<Settings />} />
-           <Route path="login" element={<Login />} />
-           <Route path="register" element={<Register />} />
-           <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="gamepad" element={<Gamepad />} />
            <Route path="custom-task" element={<CustomTaskEditor />} />
-           <Route path="admin" element={<Admin />} />
+           <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </Router>
    );
  }
```

### 7.2 settingsStore.ts

```diff
- import { settingsApi, type ServerSettings } from '@/api/settings';

// 移除以下方法和相关内容：
- loadFromServer
- syncToServer
- syncStatus
- lastSyncedAt
- pickSettings()
- toServerPayload()
```

### 7.3 Header.tsx

```diff
- import { UserMenu } from '@/components/ui/UserMenu';
+ import { ProfileMenu } from '@/components/layout/ProfileMenu';

- <UserMenu />
+ <ProfileMenu />
```

### 7.4 vite.config.ts

```diff
  server: {
    port: 3000,
    open: true,
-   proxy: {
-     '/api': {
-       target: 'http://localhost:3001',
-       changeOrigin: true,
-     },
-   },
  },
```

### 7.5 main.tsx

```diff
  // 移除后端依赖初始化
- import { trainingStorage } from './utils/storage';
- trainingStorage.init().catch(console.error);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
```

### 7.6 package.json

```diff
  "scripts": {
    "dev": "vite",
-   "build": "tsc -b && vite build",
+   "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "test": "vitest",
-   "coverage": "vitest run --coverage"
  },
```

---

## 8. 开发工作流

与 v3.2 一致：
- Git 分支策略：main ← develop ← feature/*
- 提交规范：`feat/fix/refactor/docs/test/chore/perf`
- 测试策略：Vitest 单元测试 + React Testing Library 组件测试

---

## 9. 常见问题与解决方案

### Q1: 清除浏览器数据后训练记录丢失

**解决**：
- 定期导出 JSON 备份（设置页提供了便捷按钮）
- 未来考虑 WebDAV 或 Google Drive 自动备份

### Q2: 想在新电脑上继续训练

**解决**：
1. 旧设备：设置 → 导出所有数据 → 下载 JSON 文件
2. 新设备：设置 → 导入数据 → 选择 JSON 文件

### Q3: IndexedDB 存储不足

**解决**：
- 设置页可查看当前存储用量
- 可清除旧记录（保留最近 N 条）
- IndexedDB 限制通常远大于实际需求

---

## 附录 A：技术选型总览（v4.0）

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | 18 | UI 开发 |
| 语言 | TypeScript | 5.x | 类型安全 |
| 状态 | Zustand | 4.x | 轻量状态 + persist |
| 路由 | React Router | v6 | 嵌套路由 |
| 样式 | TailwindCSS | 3.x | 原子化 CSS + 8 套主题 |
| 3D | Babylon.js | 6.x | 3D 渲染引擎 |
| 本地存储 | IndexedDB + localStorage | - | 数据持久化 |
| 日期 | dayjs | 最新 | 日期处理 |
| 构建 | Vite | 5.x | 构建 + 开发服务器 |
| 部署 | Vercel / CF Pages / Nginx | - | 纯静态托管 |

---

## 附录 B：开发里程碑

### Phase 3（v4.0 当前阶段）— 架构简化

- [ ] 移除 server/ 目录
- [ ] 删除 Login/Register/ForgotPassword/Admin 页面
- [ ] 删除 authStore、api/ 目录
- [ ] 新增 profileStore + types/profile.ts
- [ ] 新增 utils/deviceId.ts + utils/dataExport.ts
- [ ] 新增 pages/Profile.tsx（编辑资料 + 数据管理）
- [ ] 新增 components/layout/ProfileMenu.tsx
- [ ] 修改 App.tsx（路由） + Header.tsx + vite.config.ts
- [ ] 修改 settingsStore.ts（移除云端同步）
- [ ] 更新 package.json scripts

---

## 附录 C：快速启动指南

```bash
# 克隆项目
git clone https://github.com/jiangdongshi/AimPad.git
cd AimPad

# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 访问 http://localhost:3000

# 生产构建
npm run build
# 产物在 dist/ 目录，可直接部署到任何静态托管服务
```

---

**文档版本**：v4.0
**最后更新**：2026-06-16
**维护者**：@jiangdongshi
