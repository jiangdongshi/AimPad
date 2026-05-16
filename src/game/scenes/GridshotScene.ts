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

  // 补充队列：避免同帧内创建多个目标造成卡顿
  private spawnQueue: number = 0;
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

    if (missingCount > this.spawnQueue) {
      this.spawnQueue = missingCount;
    }

    // 按冷却间隔逐个补充，避免同帧批量创建造成卡顿
    if (this.spawnQueue > 0 && now - this.lastSpawnTime >= GridshotScene.SPAWN_COOLDOWN_MS) {
      if (this.spawnRandomTarget()) {
        this.spawnQueue--;
        this.lastSpawnTime = now;
      } else {
        // 没有空格子可用了，清空队列
        this.spawnQueue = 0;
      }
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

    const [row, col] = availableCells[Math.floor(Math.random() * availableCells.length)];
    const cellWidth = 14 / gridCols;
    const cellHeight = 8 / gridRows;

    const x = (col - gridCols / 2 + 0.5) * cellWidth;
    const y = (row + 0.5) * cellHeight + 2;
    const z = 8;

    const mesh = this.spawnTarget(new BABYLON.Vector3(x, y, z), targetSize);
    const cellKey = `${row},${col}`;
    mesh.metadata = { ...mesh.metadata, cellKey };
    this.occupiedCells.set(cellKey, mesh);

    return true;
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
    // 先释放格子，再调用父类移除逻辑
    const cellKey = mesh.metadata?.cellKey as string | undefined;
    if (cellKey) {
      this.occupiedCells.delete(cellKey);
    }
    super.onTargetHit(mesh);
  }

  private createGridLines() {
    const { gridRows, gridCols } = this.config;
    const gridColor = getSceneGridColor();
    const gridZ = 8;

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
