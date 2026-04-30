# 瞄点 · AimPad 项目手册

## 项目概述

### 1.1 项目背景

随着竞技FPS游戏（如Valorant、CS2、Apex Legends、守望先锋等）的持续火热，越来越多玩家开始重视瞄准能力的系统化训练。Aim Lab和KovaaK's是当前市面上最主流的两款练枪软件，前者拥有超过3000万用户，提供AI驱动的个性化训练方案和约12,000+个训练任务；后者则以15,500+个玩家自制场景和极致的自定义能力著称。然而，目前主流练枪软件均以客户端形式分发，Web端尚未出现功能完备的专业级练枪平台。本项目旨在填补这一空白，打造一款纯Web端的练枪网站，同时支持键鼠和手柄（Xbox、PlayStation等）两种输入方式，为手柄玩家提供专业的瞄准训练环境。

### 1.2 市场机会

游戏控制器市场规模持续扩大：2025年全球市场规模约42.3亿美元，预计到2036年将增长至86.6亿美元，复合年增长率为6.75%。随着Xbox云游戏等平台的普及，Web端游戏体验的需求显著提升，而Web端专业练枪工具的缺失，恰好为本项目提供了明确的差异化定位。

### 1.3 核心价值主张

- **零安装，即开即练**：浏览器打开即可开始训练，无需下载客户端
- **手柄原生支持**：借助Gamepad API，完美识别Xbox、PlayStation、Switch Pro等主流手柄，无需额外驱动或插件
- **专业训练体系**：参考Aim Lab/KovaaK's的科学训练方法论，提供多维度瞄准能力评估和针对性训练
- **跨平台兼容**：PC、Mac、Linux均可通过浏览器访问，数据云端同步

## 技术选型

### 2.1 前端框架

| 技术     | 选型                      | 理由                           |
| :------- | :------------------------ | :----------------------------- |
| UI框架   | React 18 + TypeScript     | 组件化开发、生态成熟、类型安全 |
| 状态管理 | Zustand                   | 轻量、易用、TypeScript友好     |
| 路由     | React Router v6           | 标准方案                       |
| 样式方案 | TailwindCSS + CSS Modules | 快速开发、可维护性强           |

### 2.2 3D渲染引擎

练枪网站需要流畅的3D场景渲染能力。推荐选型方案：

| 引擎                   | 特点                                                         | 适用性                   |
| :--------------------- | :----------------------------------------------------------- | :----------------------- |
| **Babylon.js**（推荐） | 功能完备的Web 3D引擎，内置PBR材质、物理模拟、射线检测、GUI系统等，适合快速开发FPS类3D应用 | 高度适合练枪场景的3D需求 |
| Three.js               | 更底层的WebGL封装，灵活性高但需要更多自定义开发              | 备选方案                 |
| Leaf-js                | 新一代基于WebGPU的渲染引擎，性能优异但生态尚不成熟           | 观望，未来可能迁移       |

本项目推荐采用**Babylon.js**，理由如下：

- 内置UniversalCamera支持WASD移动和自由视角旋转，且原生支持手柄等多模态输入抽象
- 提供Ray射线检测用于射击命中判定、PBR渲染管线、后处理效果等完整游戏开发工具链
- 内置GUI系统可快速搭建HUD（准星、血条、弹药数等）

### 2.3 手柄接入方案

手柄识别是本项目的核心技术亮点。现代浏览器通过**Gamepad API**提供了完整的手柄接入能力，支持Xbox、PlayStation、Switch Pro等绝大多数USB/蓝牙游戏手柄，无需插件、不依赖第三方服务。全球浏览器覆盖率约63%，且仍在稳步提升。

**方案一：原生Gamepad API + 自研封装（推荐）**

typescript

```
// 手柄连接监听
window.addEventListener('gamepadconnected', (e) => {
  console.log('Gamepad connected:', e.gamepad.id);
});

window.addEventListener('gamepaddisconnected', (e) => {
  console.log('Gamepad disconnected:', e.gamepad.id);
});

// 每帧读取手柄状态
function updateGamepadState() {
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;
    // 读取摇杆轴值、按钮状态等
  }
  requestAnimationFrame(updateGamepadState);
}
```



**方案二：使用react-gamepad-hooks（如用React）**

轻量级React Hook库，纯React + 浏览器Gamepad API实现，无额外依赖。支持所有控制器（Xbox、PlayStation、通用USB），提供摇杆死区配置、扳机阈值、事件系统等功能。

### 2.4 后端与数据存储

| 技术     | 选型                                   | 理由                        |
| :------- | :------------------------------------- | :-------------------------- |
| 后端框架 | Node.js + Express / Next.js API Routes | 统一技术栈，轻量高效        |
| 数据库   | PostgreSQL + Redis                     | 关系数据存储 + 排行榜缓存   |
| 用户认证 | NextAuth.js / Supabase Auth            | 快速集成多种登录方式        |
| 部署     | Vercel / Cloudflare Pages              | 免费CDN、边缘计算、自动部署 |

## 系统架构设计

### 3.1 整体架构图

text

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端（Browser）                         │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│  React UI     │  Gamepad API  │ Babylon.js    │  IndexedDB      │
│  (页面组件)   │  (手柄输入)   │  (3D渲染)     │  (本地数据)     │
├───────────────┴───────────────┴───────────────┴─────────────────┤
│                        HTTP / WebSocket                          │
├─────────────────────────────────────────────────────────────────┤
│                         后端服务（Node.js）                       │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│  REST API     │  WebSocket    │  认证服务     │  排行榜服务     │
├───────────────┴───────────────┴───────────────┴─────────────────┤
│                     数据库（PostgreSQL + Redis）                  │
└─────────────────────────────────────────────────────────────────┘
```



### 3.2 数据流设计

1. **输入层**：Gamepad API / 鼠标事件 → 输入标准化 → 输入管理器
2. **逻辑层**：训练任务逻辑 → 命中检测 → 得分计算 → 数据收集
3. **渲染层**：Babylon.js场景 → 目标/准星/特效 → 帧同步
4. **存储层**：训练数据 → 本地缓存（IndexedDB） → 云端同步（按需）

## 功能模块设计

### 4.1 手柄识别与管理模块

参考Aim Lab和KovaaK's均不支持手柄练枪的痛点，本模块是项目的核心差异化功能。

**功能点：**

- **设备检测与连接**：监听gamepadconnected/gamepaddisconnected事件，实时识别接入的手柄设备
- **多手柄支持**：支持多个手柄同时接入，允许多位玩家在同一设备上进行PK训练
- **按键映射**：为Xbox、PlayStation、Switch Pro等主流手柄提供预设按键映射表，自动识别设备类型并应用对应映射
- **死区配置**：支持摇杆死区（Deadzone）自定义配置，避免漂移误触
- **灵敏度调节**：摇杆灵敏度曲线可调（线性/指数/自定义曲线）
- **多场景UI控制**：同一按钮在不同UI场景中绑定不同事件，通过Manager模式管理多个Controller的切换与激活
- **扳机模拟值**：支持LT/RT等模拟扳机的渐进值读取，用于精细控制

### 4.2 训练任务系统

参考Aim Lab的训练体系，瞄准训练的核心分为三大类型：**点射（Tap）**、**跟枪（Track）** 和**切换（Switch）** 。

**任务类型：**

| 类型                         | 训练目标                     | 示例任务                 |
| :--------------------------- | :--------------------------- | :----------------------- |
| 静态点射（Static Clicking）  | 快速准确点击固定目标         | Gridshot、Spidershot     |
| 动态点射（Dynamic Clicking） | 点击移动目标，训练预判和定位 | StrafeShot、MotionShot   |
| 跟枪（Tracking）             | 持续将准星保持在移动目标上   | SphereTrack、StrafeTrack |
| 切换瞄准（Target Switching） | 在多个目标间快速切换         | TargetSwitch、ReflexShot |
| 反应训练（Reaction）         | 提升反应速度和察觉能力       | ReflexFlick、Detection   |

**自定义任务系统：**

- 支持玩家自定义目标数量、移动速度、出现频率、持续时间等参数
- 提供任务分享功能（类似KovaaK's的玩家生态）
- 任务预设模板库

### 4.3 数据统计与分析模块

参考Aim Lab的AI分析能力，从多个维度评估玩家瞄准水平：

**核心指标：**

| 指标                        | 描述                            | 计算方式            |
| :-------------------------- | :------------------------------ | :------------------ |
| 反应时间（Reaction Time）   | 从目标出现到首次移动/射击的时间 | 毫秒级精度          |
| 命中率（Accuracy）          | 命中次数 / 射击次数             | 百分比              |
| 击杀时间（Time to Kill）    | 从目标出现到击杀的平均时间      | 毫秒                |
| KPS（Kills Per Second）     | 每秒击杀数                      | 击杀数 / 时间       |
| 路径效率（Path Efficiency） | 准星移动轨迹的平滑度和最优性    | 实际路径 / 最优路径 |
| 抖动指数（Smoothness）      | 跟枪时的抖动程度                | 加速度变化方差      |
| 综合评分（Overall Score）   | 多维度加权综合得分              | 加权公式            |

**可视化展示：**

- 单次训练数据详情（命中率曲线、反应时间分布、击杀热力图）
- 历史训练趋势图表（周/月/年维度）
- 维度雷达图（对比各维度能力得分）
- 与全球玩家/好友的百分位排名对比
- 训练视频回放功能（类似Aim Lab）

### 4.4 排行榜与社交模块

- 每日/每周/赛季排行榜
- 任务细分排行榜（每个训练任务单独排名）
- 好友系统与成绩对比
- 分享训练成绩到社交媒体

### 4.5 用户系统

- 账号注册/登录（邮箱/第三方OAuth）
- 个人设置（灵敏度配置、FOV、准星样式、按键映射）
- 训练历史记录
- 成就与徽章系统

## 核心算法设计

### 5.1 瞄准评分算法

静态点射任务的综合评分示例：

python

```
def calculate_score(hits, misses, avg_reaction_time, kill_times):
    accuracy = hits / (hits + misses)
    time_factor = 1 / (avg_reaction_time + avg_kill_time)  # 时间越短分数越高
    consistency = 1 / (std_dev(kill_times) + 1)  # 稳定性因子
    
    base_score = hits * 100
    accuracy_multiplier = accuracy ** 1.5  # 高命中率有额外奖励
    speed_multiplier = time_factor * 1000
    consistency_multiplier = consistency
    
    return base_score * accuracy_multiplier * speed_multiplier * consistency_multiplier
```



### 5.2 跟枪平滑度算法

跟枪训练中衡量准星抖动程度的平滑度指标：

python

```
def calculate_smoothness(mouse_movements, target_positions):
    """
    计算跟枪平滑度
    mouse_movements: 准星位置时间序列
    target_positions: 目标位置时间序列
    """
    # 计算加速度变化（二阶导数）
    accelerations = second_derivative(mouse_movements)
    jerk = sum(abs(acc)) for acc in accelerations
    
    # 计算与目标轨迹的偏差
    tracking_error = mean([distance(mouse, target) for mouse, target 
                           in zip(mouse_movements, target_positions)])
    
    # 综合评分
    smoothness = 100 / (1 + jerk * 0.1 + tracking_error * 0.05)
    return smoothness
```



### 5.3 命中检测算法（3D射线检测）

利用Babylon.js的Ray射线检测实现射击命中判定：

typescript

```
// 从摄像机位置沿准星方向发射射线
const ray = new BABYLON.Ray(
  camera.position,
  camera.getForwardRay().direction,
  100 // 射程
);

// 执行碰撞检测
const hit = scene.pickWithRay(ray);
if (hit.pickedMesh && hit.pickedMesh.metadata?.isTarget) {
  // 命中目标
  onTargetHit(hit.pickedMesh);
}
```



### 5.4 手柄输入标准化

由于不同手柄的按键映射存在差异，需要实现输入标准化层：

typescript

```
// 标准化按键名称
const STANDARD_BUTTON_MAP = {
  // Xbox映射
  'xbox': { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, LS: 10, RS: 11 },
  // PlayStation映射
  'ps': { cross: 0, circle: 1, square: 2, triangle: 3, L1: 4, R1: 5, L2: 6, R2: 7, L3: 10, R3: 11 }
};

function normalizeButton(gamepad, buttonName) {
  const mapping = detectGamepadType(gamepad);
  const index = STANDARD_BUTTON_MAP[mapping][buttonName];
  return gamepad.buttons[index];
}
```



## 性能优化方案

### 6.1 渲染性能

- **帧率目标**：稳定60fps（中低端设备）到120fps（高端设备）
- **LOD（Level of Detail）** ：根据目标距离动态调整模型精度
- **实例化渲染**：大量相同目标使用GPU Instancing渲染
- **视锥剔除**：仅渲染摄像机视野内的物体
- **WebGPU支持**：未来考虑迁移到WebGPU以获得更好性能

### 6.2 手柄响应优化

- **高频轮询**：使用requestAnimationFrame在每帧读取手柄状态
- **输入缓冲**：避免事件丢失，平滑处理摇杆输入
- **死区配置**：摇杆死区默认为0.1，支持用户自定义

### 6.3 网络与存储优化

- 训练数据优先存入IndexedDB本地缓存，定时批量同步到云端
- 排行榜数据使用Redis缓存，5分钟刷新一次
- 静态资源CDN加速

## 开发计划与里程碑

### Phase 1：MVP核心功能（4-6周）

- 手柄识别与输入处理
- 基础3D场景搭建（Babylon.js）
- 1-2个核心训练任务（Gridshot + SphereTrack）
- 本地成绩记录与展示
- 基础UI界面

### Phase 2：功能完善（6-8周）

- 完整训练任务库（6-8个任务）
- 数据统计仪表板
- 自定义任务系统
- 用户系统与云端存储
- 准星自定义功能

### Phase 3：社交与进阶（4-6周）

- 排行榜系统
- 好友功能与成绩对比
- 任务分享功能
- 成就系统
- 多语言支持

### Phase 4：优化与扩展（持续）

- 性能优化（移动端适配）
- 更多训练任务和模式
- AI训练建议（根据弱项推荐任务）
- 弹道可视化工具（类似Aim Lab Shot Vision）
- 游戏灵敏度转换工具

## 风险评估与应对

| 风险项                  | 影响程度 | 应对策略                                    |
| :---------------------- | :------- | :------------------------------------------ |
| 浏览器Gamepad API兼容性 | 中       | 提供键鼠备用方案，对不支持的浏览器显示提示  |
| 3D渲染性能瓶颈          | 高       | 提供画质档位设置，低配设备降级到2D模式      |
| 手柄按键映射不一致      | 中       | 构建完善的标准化映射层，支持用户自定义      |
| 用户留存率              | 高       | 通过排行榜、成就、每日任务等机制提升粘性    |
| 与客户端练枪软件的竞争  | 中       | 发挥Web端零安装、跨平台、快速分享的独特优势 |

## 总结

本项目旨在打造一款Web端专业级练枪平台，核心亮点在于**手柄原生支持**和**零安装的便捷体验**。通过Gamepad API实现多平台手柄的即插即用，借助Babylon.js构建高性能3D训练场景，参考Aim Lab/KovaaK's的科学训练方法论，为手柄玩家提供一个专业、便捷的瞄准训练环境。项目技术栈成熟、可行性高，具备明确的市场差异化定位和增长潜力。