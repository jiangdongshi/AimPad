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

  constructor(engine: GameEngine, config?: Partial<GridshotConfig>) {
    super(engine, 'gridshot');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async setup() {
    // 创建训练场地面
    this.createGround(20, 20);

    // 创建网格背景线
    this.createGridLines();

    // 创建边界墙
    this.createWalls();

    // 初始生成目标
    for (let i = 0; i < this.config.targetCount; i++) {
      this.spawnRandomTarget();
    }
  }

  update(_deltaTime: number) {
    if (!this.isActive) return;

    const now = performance.now();

    // 检查过期目标（困难/地狱模式）
    this.checkExpiredTargets();

    // 实时保持场上小球数量等于 targetCount，一旦不足立即补足
    while (this.targets.length < this.config.targetCount) {
      this.spawnRandomTarget();
    }

    // 检查训练时间（duration=0 表示不限时间）
    if (this.config.duration > 0 && now - this.startTime > this.config.duration) {
      this.stop();
    }
  }

  private spawnRandomTarget() {
    const { gridRows, gridCols, targetSize } = this.config;
    const cellWidth = 14 / gridCols;
    const cellHeight = 8 / gridRows;

    const row = Math.floor(Math.random() * gridRows);
    const col = Math.floor(Math.random() * gridCols);

    const x = (col - gridCols / 2 + 0.5) * cellWidth;
    const y = (row + 0.5) * cellHeight + 2;
    const z = 8; // 固定在目标墙上

    this.spawnTarget(new BABYLON.Vector3(x, y, z), targetSize * this.targetSizeMultiplier);
  }

  private createGridLines() {
    const { gridRows, gridCols } = this.config;
    const gridColor = getSceneGridColor();
    const gridZ = 8; // 与目标位置一致

    // 垂直线
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

    // 水平线
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
    // 后墙（目标墙背景）
    const backWall = BABYLON.MeshBuilder.CreatePlane('backWall', { width: 16, height: 10 }, this.scene);
    backWall.position = new BABYLON.Vector3(0, 6, 8.1);

    // 墙壁材质 - 跟随主题
    const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = getSceneWallColor();
    wallMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    backWall.material = wallMat;
  }

  dispose() {
    this.gridLines.forEach(l => l.dispose());
    super.dispose();
  }
}
