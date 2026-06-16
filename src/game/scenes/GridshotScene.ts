import * as BABYLON from '@babylonjs/core';
import { BaseScene } from './BaseScene';
import { GameEngine } from '../engine/GameEngine';
import { getSceneWallColor, getSceneGridColor } from '@/utils/themeColors';

interface GridshotConfig {
  targetCount: number;
  targetSize: number;
  gridRows: number;
  gridCols: number;
  duration: number;
  spawnInterval: number;
}

const DEFAULT_CONFIG: GridshotConfig = {
  targetCount: 3,
  targetSize: 0.8,
  gridRows: 3,
  gridCols: 5,
  duration: 30000,
  spawnInterval: 800,
};

export class GridshotScene extends BaseScene {
  private config: GridshotConfig;
  private gridLines: BABYLON.LinesMesh[] = [];

  // 格子占用追踪：key = "row,col"，value = mesh
  private occupiedCells = new Map<string, BABYLON.Mesh>();

  // 补充相关状态
  private lastSpawnTime: number = 0;
  private static readonly SPAWN_COOLDOWN_MS = 50; // 补充间隔 50ms，肉眼不可感知

  constructor(engine: GameEngine, config?: Partial<GridshotConfig>) {
    super(engine, 'gridshot');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async setup() {
    this.createGround(20, 20);
    this.createGridLines();
    this.createWalls();
    this.initTargetPool();

    // 初始生成目标
    for (let i = 0; i < this.config.targetCount; i++) {
      this.spawnRandomTarget();
    }
  }

  update(_deltaTime: number) {
    if (!this.isActive) return;

    const now = performance.now();

    // 检测场上活跃目标数量（removeTarget 已同步从数组移除，length 即活跃数）
    const missingCount = this.config.targetCount - this.targets.length;

    // 当目标数不足时，优先补充（快速响应，无冷却延迟）
    if (missingCount > 0 && now - this.lastSpawnTime >= GridshotScene.SPAWN_COOLDOWN_MS) {
      if (this.spawnRandomTarget()) {
        this.lastSpawnTime = now;
      }
      // 如果生成失败（无空格子），不更新 lastSpawnTime，下一帧会重试
    }

    if (this.config.duration > 0 && now - this.startTime > this.config.duration) {
      this.stop();
    }
  }

  /** 生成目标，返回是否成功（无空格子时返回 false） */
  private spawnRandomTarget(): boolean {
    const { gridRows, gridCols, targetSize } = this.config;
    const availableCells = this.getAvailableCells(gridRows, gridCols);

    if (availableCells.length === 0) return false;

    // 随机打乱候选格子
    for (let i = availableCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
    }

    const cellWidth = 14 / gridCols;
    const cellHeight = 8 / gridRows;
    const z = 8;

    for (const [row, col] of availableCells) {
      const x = (col - gridCols / 2 + 0.5) * cellWidth;
      const y = (row + 0.5) * cellHeight + 2;

      // 检查与所有已存在目标的距离，确保不重叠（间距 >= 目标直径）
      const minDist = targetSize;
      let overlaps = false;
      for (const t of this.targets) {
        const dx = x - t.position.x;
        const dy = y - t.position.y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) {
          overlaps = true;
          break;
        }
      }

      if (overlaps) continue;

      const mesh = this.spawnTarget(new BABYLON.Vector3(x, y, z), targetSize);
      const cellKey = `${row},${col}`;
      mesh.metadata = { ...mesh.metadata, cellKey };
      this.occupiedCells.set(cellKey, mesh);

      return true;
    }

    // 所有候选位置都太近
    return false;
  }

  /** 获取当前未被占用的格子列表 */
  private getAvailableCells(rows: number, cols: number): [number, number][] {
    const cells: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!this.occupiedCells.has(`${r},${c}`)) {
          cells.push([r, c]);
        }
      }
    }
    return cells;
  }

  protected onTargetHit(mesh: BABYLON.Mesh) {
    // 先释放格子（无论是否击破都释放，因为被击中了）
    const cellKey = mesh.metadata?.cellKey as string | undefined;
    super.onTargetHit(mesh);
    // 如果目标被击破，释放格子
    if (cellKey && !this.targets.includes(mesh)) {
      this.occupiedCells.delete(cellKey);
    }
  }

  protected onTargetBroken(_mesh: BABYLON.Mesh) {
    // 目标被击破后立即补充一个新目标
    this.spawnRandomTarget();
  }

  private createGridLines() {
    const { gridRows, gridCols } = this.config;
    const gridColor = getSceneGridColor();
    const gridZ = 7.98;

    for (let i = 0; i <= gridCols; i++) {
      const x = (i - gridCols / 2) * (14 / gridCols);
      const line = BABYLON.MeshBuilder.CreateLines(
        `gridLineV${i}`,
        {
          points: [
            new BABYLON.Vector3(x, 2, gridZ),
            new BABYLON.Vector3(x, 10, gridZ),
          ],
        },
        this.scene
      );
      line.color = gridColor;
      this.gridLines.push(line);
    }

    for (let i = 0; i <= gridRows; i++) {
      const y = i * (8 / gridRows) + 2;
      const line = BABYLON.MeshBuilder.CreateLines(
        `gridLineH${i}`,
        {
          points: [
            new BABYLON.Vector3(-7, y, gridZ),
            new BABYLON.Vector3(7, y, gridZ),
          ],
        },
        this.scene
      );
      line.color = gridColor;
      this.gridLines.push(line);
    }
  }

  private createWalls() {
    const wallHeight = 10;
    const yOffset = 1;
    const depth = 8;

    const backWall = BABYLON.MeshBuilder.CreatePlane('backWall', { width: 16, height: wallHeight }, this.scene);
    backWall.position = new BABYLON.Vector3(0, wallHeight / 2 + yOffset, depth + 0.01);

    const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = this.wallColor ?? getSceneWallColor();
    wallMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    wallMat.backFaceCulling = false;

    backWall.material = wallMat;
    this.registerWallMaterial(wallMat);

    this.createBoxWalls({ width: 16, height: wallHeight, depth, yOffset });
  }

  dispose() {
    this.occupiedCells.clear();
    this.gridLines.forEach(l => l.dispose());
    super.dispose();
  }
}
