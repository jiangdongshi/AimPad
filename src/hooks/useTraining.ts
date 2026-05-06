import { useState, useRef, useCallback, useEffect } from 'react';
import { GameEngine } from '@/game/engine/GameEngine';
import { GridshotScene } from '@/game/scenes/GridshotScene';
import { SphereTrackScene } from '@/game/scenes/SphereTrackScene';
import { BaseScene } from '@/game/scenes/BaseScene';
import type { TrainingTaskConfig, TrainingResult, GameDifficulty } from '@/types/training';
import { GAME_DIFFICULTY_CONFIG } from '@/types/training';
import { trainingStorage } from '@/utils/storage';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getSceneBackgroundRgb, getSceneClearColor } from '@/utils/themeColors';

type TrainingStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'completed';

const DIFFICULTY_STORAGE_KEY = 'aimpad_task_difficulties';
const BALL_COLOR_STORAGE_KEY = 'aimpad_ball_color';
const DEFAULT_BALL_COLOR = '#ADD8E6';
const DURATION_STORAGE_KEY = 'aimpad_task_durations';

export type TaskDuration = 30000 | 45000 | 60000 | 0;

export const DURATION_OPTIONS: { value: TaskDuration; labelKey: string }[] = [
  { value: 30000, labelKey: 'training.duration.30s' },
  { value: 45000, labelKey: 'training.duration.45s' },
  { value: 60000, labelKey: 'training.duration.60s' },
  { value: 0, labelKey: 'training.duration.unlimited' },
];

function loadTaskDifficulties(): Record<string, GameDifficulty> {
  try {
    const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function loadTaskDurations(): Record<string, TaskDuration> {
  try {
    const stored = localStorage.getItem(DURATION_STORAGE_KEY);
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
  const [ballColor, setBallColorState] = useState<string>(() => {
    try {
      return localStorage.getItem(BALL_COLOR_STORAGE_KEY) || DEFAULT_BALL_COLOR;
    } catch {
      return DEFAULT_BALL_COLOR;
    }
  });
  const [taskDurations, setTaskDurations] = useState<Record<string, TaskDuration>>(loadTaskDurations);

  const engineRef = useRef<GameEngine | null>(null);
  const sceneRef = useRef<BaseScene | null>(null);
  const animFrameRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0); // 暂停时的时间点
  const elapsedBeforePauseRef = useRef<number>(0); // 暂停前已用时间
  const currentTaskRef = useRef<TrainingTaskConfig | null>(null); // 用 ref 存储 currentTask

  // 获取 gameStore 的更新方法
  const updateScore = useGameStore((s) => s.updateScore);
  const setFps = useGameStore((s) => s.setFps);

  // 监听主题变化，实时更新 3D 场景背景色
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const engine = engineRef.current;
      if (engine) {
        engine.updateClearColor(getSceneClearColor());
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // 获取指定任务的难度（未设置过则默认 'hard'）
  const getTaskDifficulty = useCallback((taskId: string): GameDifficulty => {
    return taskDifficulties[taskId] ?? 'hard';
  }, [taskDifficulties]);

  // 获取指定任务的时长（未设置过则使用任务默认值）
  const getTaskDuration = useCallback((taskId: string, defaultDuration: number): number => {
    return taskDurations[taskId] ?? defaultDuration;
  }, [taskDurations]);

  const createScene = useCallback((task: TrainingTaskConfig, canvas: HTMLCanvasElement): BaseScene => {
    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    // 应用当前任务的难度配置
    const difficulty = taskDifficulties[task.id] ?? 'hard';
    const diffConfig = GAME_DIFFICULTY_CONFIG[difficulty];

    // 应用当前任务的时长配置
    const duration = taskDurations[task.id] ?? task.duration;

    let scene: BaseScene;
    switch (task.id) {
      case 'gridshot':
      case 'spidershot':
        scene = new GridshotScene(engine, {
          targetCount: task.parameters.targetCount,
          targetSize: task.parameters.targetSize,
          duration,
          spawnInterval: task.parameters.spawnInterval,
        });
        break;
      case 'sphere-track':
      case 'strafe-track':
        scene = new SphereTrackScene(engine, {
          targetSize: task.parameters.targetSize,
          targetSpeed: task.parameters.targetSpeed,
          duration,
        });
        break;
      default:
        scene = new GridshotScene(engine, {
          targetCount: task.parameters.targetCount,
          targetSize: task.parameters.targetSize,
          duration,
        });
    }

    scene.setDifficulty(diffConfig.targetSizeMultiplier, diffConfig.targetLifetime);
    scene.setTargetColor(ballColor);
    scene.setFireButton(useSettingsStore.getState().gamepadFireButton);
    return scene;
  }, [taskDifficulties, taskDurations, ballColor]);

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

        // 检测手柄开火
        scene.checkGamepadFire();

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
        const duration = taskDurations[task.id] ?? task.duration;
        const remaining = duration > 0 ? Math.max(0, duration - elapsed) : -1;
        setTimeRemaining(duration > 0 ? Math.ceil(remaining / 1000) : -1);

        if (duration <= 0 || remaining > 0) {
          animFrameRef.current = requestAnimationFrame(renderLoop);
        } else {
          handleTrainingEnd();
        }
      };

      engineRef.current?.startRenderLoop();
      animFrameRef.current = requestAnimationFrame(renderLoop);
      engineRef.current?.setCameraControlEnabled(true);
      setStatus('playing');
    } catch (error) {
      console.error('Failed to start training:', error);
      setStatus('idle');
    }
  }, [createScene, updateScore, setFps, taskDurations]);

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
      // 只停止游戏逻辑循环，保持 Babylon 渲染循环运行（避免恢复时 shader 重编译导致卡顿）
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      engineRef.current?.setCameraControlEnabled(false);
      setStatus('paused');
    }
  }, [status]);

  const resumeTraining = useCallback(() => {
    if (status === 'paused' && currentTask && sceneRef.current) {
      // 计算暂停期间经过的时间
      const pauseDuration = performance.now() - pauseTimeRef.current;
      elapsedBeforePauseRef.current += pauseDuration;

      // 仅重启游戏逻辑循环（Babylon 渲染循环从未停止，无需重启）
      let lastTime = performance.now();
      let fpsUpdateCounter = 0;
      const scene = sceneRef.current;

      const renderLoop = () => {
        const now = performance.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        scene.update(deltaTime);

        // 检测手柄开火
        scene.checkGamepadFire();

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
        const duration = taskDurations[currentTask.id] ?? currentTask.duration;
        const remaining = duration > 0 ? Math.max(0, duration - elapsed) : -1;
        setTimeRemaining(duration > 0 ? Math.ceil(remaining / 1000) : -1);

        if (duration <= 0 || remaining > 0) {
          animFrameRef.current = requestAnimationFrame(renderLoop);
        } else {
          handleTrainingEnd();
        }
      };

      animFrameRef.current = requestAnimationFrame(renderLoop);
      engineRef.current?.setCameraControlEnabled(true);
      setStatus('playing');
    }
  }, [status, currentTask, handleTrainingEnd, updateScore, setFps, taskDurations]);

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

  const setBallColor = useCallback((color: string) => {
    setBallColorState(color);
    try { localStorage.setItem(BALL_COLOR_STORAGE_KEY, color); } catch {}
    if (sceneRef.current) {
      sceneRef.current.setTargetColor(color);
    }
  }, []);

  const setTaskDuration = useCallback((taskId: string, duration: TaskDuration) => {
    setTaskDurations((prev) => {
      const next = { ...prev, [taskId]: duration };
      try { localStorage.setItem(DURATION_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetTraining = useCallback((canvas?: HTMLCanvasElement | null) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    // 在销毁引擎前，先用当前主题背景色清除画布
    if (canvas) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const [r, g, b] = getSceneBackgroundRgb();
        gl.clearColor(r, g, b, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.finish();
      }
    }

    sceneRef.current?.dispose();
    engineRef.current?.setCameraControlEnabled(false);
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

  // 因难度变化重启：清理场景/引擎，但保留 currentTask 供 UI 使用
  // 使用 requestAnimationFrame 分帧执行，避免阻塞 UI
  const restartForDifficulty = useCallback((canvas?: HTMLCanvasElement | null) => {
    return new Promise<void>((resolve) => {
      // 第一步：取消动画帧
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }

      // 第二步：在下一帧清理画布
      requestAnimationFrame(() => {
        if (canvas) {
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (gl) {
            const [r, g, b] = getSceneBackgroundRgb();
            gl.clearColor(r, g, b, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.finish();
          }
        }

        // 第三步：再下一帧清理场景和引擎
        requestAnimationFrame(() => {
          sceneRef.current?.dispose();
          engineRef.current?.dispose();
          sceneRef.current = null;
          engineRef.current = null;

          // 更新状态
          setStatus('idle');
          setResult(null);
          setTimeRemaining(0);
          elapsedBeforePauseRef.current = 0;

          resolve();
        });
      });
    });
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
    restartForDifficulty,
    setGameDifficulty,
    ballColor,
    setBallColor,
    getTaskDuration,
    setTaskDuration,
    taskDurations,
  };
}
