import { useState, useRef, useCallback } from 'react';
import { GameEngine } from '@/game/engine/GameEngine';
import { GridshotScene } from '@/game/scenes/GridshotScene';
import { SphereTrackScene } from '@/game/scenes/SphereTrackScene';
import { BaseScene } from '@/game/scenes/BaseScene';
import type { TrainingTaskConfig, TrainingResult, GameDifficulty } from '@/types/training';
import { GAME_DIFFICULTY_CONFIG } from '@/types/training';
import { trainingStorage } from '@/utils/storage';
import { useGameStore } from '@/stores/gameStore';

type TrainingStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'completed';

const DIFFICULTY_STORAGE_KEY = 'aimpad_task_difficulties';

function loadTaskDifficulties(): Record<string, GameDifficulty> {
  try {
    const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

export function useTraining() {
  const [status, setStatus] = useState<TrainingStatus>('idle');
  const [currentTask, setCurrentTask] = useState<TrainingTaskConfig | null>(null);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [taskDifficulties, setTaskDifficulties] = useState<Record<string, GameDifficulty>>(loadTaskDifficulties);

  const engineRef = useRef<GameEngine | null>(null);
  const sceneRef = useRef<BaseScene | null>(null);
  const animFrameRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0); // 暂停时的时间点
  const elapsedBeforePauseRef = useRef<number>(0); // 暂停前已用时间
  const currentTaskRef = useRef<TrainingTaskConfig | null>(null); // 用 ref 存储 currentTask

  // 获取 gameStore 的更新方法
  const updateScore = useGameStore((s) => s.updateScore);
  const setFps = useGameStore((s) => s.setFps);

  // 获取指定任务的难度（未设置过则默认 'hard'）
  const getTaskDifficulty = useCallback((taskId: string): GameDifficulty => {
    return taskDifficulties[taskId] ?? 'hard';
  }, [taskDifficulties]);

  const createScene = useCallback((task: TrainingTaskConfig, canvas: HTMLCanvasElement): BaseScene => {
    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    // 应用当前任务的难度配置
    const difficulty = taskDifficulties[task.id] ?? 'hard';
    const diffConfig = GAME_DIFFICULTY_CONFIG[difficulty];

    let scene: BaseScene;
    switch (task.id) {
      case 'gridshot':
      case 'spidershot':
        scene = new GridshotScene(engine, {
          targetCount: task.parameters.targetCount,
          targetSize: task.parameters.targetSize,
          duration: task.duration,
          spawnInterval: task.parameters.spawnInterval,
        });
        break;
      case 'sphere-track':
      case 'strafe-track':
        scene = new SphereTrackScene(engine, {
          targetSize: task.parameters.targetSize,
          targetSpeed: task.parameters.targetSpeed,
          duration: task.duration,
        });
        break;
      default:
        scene = new GridshotScene(engine, {
          targetCount: task.parameters.targetCount,
          targetSize: task.parameters.targetSize,
          duration: task.duration,
        });
    }

    scene.setDifficulty(diffConfig.targetSizeMultiplier, diffConfig.targetLifetime);
    return scene;
  }, [taskDifficulties]);

  const startTraining = useCallback(async (task: TrainingTaskConfig, canvas: HTMLCanvasElement) => {
    setStatus('loading');
    setCurrentTask(task);
    currentTaskRef.current = task; // 同步更新 ref
    setResult(null);
    elapsedBeforePauseRef.current = 0;

    try {
      const scene = createScene(task, canvas);
      sceneRef.current = scene;

      await scene.setup();
      scene.start();

      // 启动渲染循环
      const startTime = performance.now();
      let lastTime = startTime;
      let fpsUpdateCounter = 0;

      const renderLoop = () => {
        const now = performance.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        scene.update(deltaTime);

        // 同步统计数据到 gameStore
        const stats = scene.getStats();
        updateScore(stats.hits, stats.misses);

        // 更新 FPS（每 10 帧更新一次避免频繁渲染）
        fpsUpdateCounter++;
        if (fpsUpdateCounter >= 10) {
          const engine = engineRef.current;
          if (engine) {
            setFps(Math.round(engine.getFps()));
          }
          fpsUpdateCounter = 0;
        }

        // 更新剩余时间（减去暂停前已用时间）
        const elapsed = now - startTime + elapsedBeforePauseRef.current;
        const remaining = Math.max(0, task.duration - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));

        if (remaining > 0) {
          animFrameRef.current = requestAnimationFrame(renderLoop);
        } else {
          handleTrainingEnd();
        }
      };

      engineRef.current?.startRenderLoop();
      animFrameRef.current = requestAnimationFrame(renderLoop);
      setStatus('playing');
    } catch (error) {
      console.error('Failed to start training:', error);
      setStatus('idle');
    }
  }, [createScene, updateScore, setFps]);

  const handleTrainingEnd = useCallback(async () => {
    if (!sceneRef.current) return;

    const trainingResult = sceneRef.current.stop();
    setResult(trainingResult);
    setStatus('completed');

    // 保存结果到 IndexedDB
    try {
      await trainingStorage.saveRecord(trainingResult);
    } catch (error) {
      console.error('Failed to save training result:', error);
    }

    // 停止渲染循环
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (engineRef.current) {
      engineRef.current.stop();
    }
  }, []);

  const pauseTraining = useCallback(() => {
    if (status === 'playing') {
      pauseTimeRef.current = performance.now();
      engineRef.current?.stop();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setStatus('paused');
    }
  }, [status]);

  const resumeTraining = useCallback(() => {
    if (status === 'paused' && currentTask && sceneRef.current) {
      // 计算暂停期间经过的时间
      const pauseDuration = performance.now() - pauseTimeRef.current;
      elapsedBeforePauseRef.current += pauseDuration;

      // 恢复渲染循环
      engineRef.current?.startRenderLoop();

      // 重新启动游戏逻辑更新循环
      let lastTime = performance.now();
      let fpsUpdateCounter = 0;
      const scene = sceneRef.current;

      const renderLoop = () => {
        const now = performance.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        scene.update(deltaTime);

        // 同步统计数据到 gameStore
        const stats = scene.getStats();
        updateScore(stats.hits, stats.misses);

        // 更新 FPS（每 10 帧更新一次）
        fpsUpdateCounter++;
        if (fpsUpdateCounter >= 10) {
          const engine = engineRef.current;
          if (engine) {
            setFps(Math.round(engine.getFps()));
          }
          fpsUpdateCounter = 0;
        }

        // 更新剩余时间
        const elapsed = now - pauseTimeRef.current + elapsedBeforePauseRef.current;
        const remaining = Math.max(0, currentTask.duration - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));

        if (remaining > 0) {
          animFrameRef.current = requestAnimationFrame(renderLoop);
        } else {
          handleTrainingEnd();
        }
      };

      animFrameRef.current = requestAnimationFrame(renderLoop);
      setStatus('playing');
    }
  }, [status, currentTask, handleTrainingEnd, updateScore, setFps]);

  const stopTraining = useCallback(() => {
    handleTrainingEnd();
  }, [handleTrainingEnd]);

  const setGameDifficulty = useCallback((taskId: string, difficulty: GameDifficulty) => {
    setTaskDifficulties((prev) => {
      const next = { ...prev, [taskId]: difficulty };
      try { localStorage.setItem(DIFFICULTY_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    // 如果当前活跃的场景就是这个任务，立即应用新难度
    if (sceneRef.current && currentTaskRef.current?.id === taskId) {
      const config = GAME_DIFFICULTY_CONFIG[difficulty];
      sceneRef.current.setDifficulty(config.targetSizeMultiplier, config.targetLifetime);
    }
  }, []);

  const resetTraining = useCallback((canvas?: HTMLCanvasElement | null) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    // 在销毁引擎前，先用当前 WebGL 上下文清除画布
    if (canvas) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        gl.clearColor(0.06, 0.06, 0.08, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.finish();
      }
    }

    sceneRef.current?.dispose();
    engineRef.current?.dispose();
    sceneRef.current = null;
    engineRef.current = null;

    setStatus('idle');
    setCurrentTask(null);
    currentTaskRef.current = null;
    setResult(null);
    setTimeRemaining(0);
    elapsedBeforePauseRef.current = 0;
  }, []);

  return {
    status,
    currentTask,
    result,
    timeRemaining,
    getTaskDifficulty,
    startTraining,
    pauseTraining,
    resumeTraining,
    stopTraining,
    resetTraining,
    setGameDifficulty,
  };
}
