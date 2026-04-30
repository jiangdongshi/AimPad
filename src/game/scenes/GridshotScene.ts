import * as BABYLON from '@babylonjs/core';
import { BaseScene } from './BaseScene';
import { GameEngine } from '../engine/GameEngine';

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

    // 检查是否需要生成新目标
    if (this.targets.length < this.config.targetCount &&
        now - this.lastTargetSpawnTime > this.config.spawnInterval) {
      this.spawnRandomTarget();
      this.lastTargetSpawnTime = now;
    }

    // 检查训练时间
    if (now - this.startTime > this.config.duration) {
      this.stop();
    }
  }

  private spawnRandomTarget() {
    const { gridRows, gridCols, targetSize } = this.config;
    const cellWidth = 16 / gridCols;
    const cellHeight = 10 / gridRows;

    const row = Math.floor(Math.random() * gridRows);
    const col = Math.floor(Math.random() * gridCols);

    const x = (col - gridCols / 2 + 0.5) * cellWidth;
    const y = (row + 0.5) * cellHeight + 1;
    const z = 5 + Math.random() * 3;

    this.spawnTarget(new BABYLON.Vector3(x, y, z), targetSize);
  }

  private createGridLines() {
    const { gridRows, gridCols } = this.config;
    const gridColor = new BABYLON.Color3(0.2, 0.2, 0.3);

    // 垂直线
    for (let i = 0; i <= gridCols; i++) {
      const x = (i - gridCols / 2) * (16 / gridCols);
      const line = BABYLON.MeshBuilder.CreateLines(
        `gridLineV${i}`,
        {
          points: [
            new BABYLON.Vector3(x, 1, 5),
            new BABYLON.Vector3(x, 11, 5),
          ],
        },
        this.scene
      );
      line.color = gridColor;
      this.gridLines.push(line);
    }

    // 水平线
    for (let i = 0; i <= gridRows; i++) {
      const y = i * (10 / gridRows) + 1;
      const line = BABYLON.MeshBuilder.CreateLines(
        `gridLineH${i}`,
        {
          points: [
            new BABYLON.Vector3(-8, y, 5),
            new BABYLON.Vector3(8, y, 5),
          ],
        },
        this.scene
      );
      line.color = gridColor;
      this.gridLines.push(line);
    }
  }

  private createWalls() {
    // 左墙
    const leftWall = BABYLON.MeshBuilder.CreatePlane('leftWall', { width: 20, height: 12 }, this.scene);
    leftWall.position = new BABYLON.Vector3(-10, 6, 5);
    leftWall.rotation.y = Math.PI / 2;

    // 右墙
    const rightWall = BABYLON.MeshBuilder.CreatePlane('rightWall', { width: 20, height: 12 }, this.scene);
    rightWall.position = new BABYLON.Vector3(10, 6, 5);
    rightWall.rotation.y = -Math.PI / 2;

    // 后墙（目标墙）
    const backWall = BABYLON.MeshBuilder.CreatePlane('backWall', { width: 20, height: 12 }, this.scene);
    backWall.position = new BABYLON.Vector3(0, 6, 8);

    // 墙壁材质
    const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.12);
    wallMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    leftWall.material = wallMat;
    rightWall.material = wallMat;
    backWall.material = wallMat;
  }

  dispose() {
    this.gridLines.forEach(l => l.dispose());
    super.dispose();
  }
}
