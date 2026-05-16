import { useState, useRef, useCallback, useEffect } from 'react';
import { GameEngine } from '@/game/engine/GameEngine';
import { GridshotScene } from '@/game/scenes/GridshotScene';
import { SphereTrackScene } from '@/game/scenes/SphereTrackScene';
import { BaseScene } from '@/game/scenes/BaseScene';
import type { TrainingTaskConfig, TrainingResult } from '@/types/training';
import { trainingStorage } from '@/utils/storage';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getSceneBackgroundRgb, getSceneClearColor } from '@/utils/themeColors';
import type { CustomTask } from '@/types/customTask';
import { CustomScene } from '@/game/scenes/CustomScene';
import { useCustomTaskStore } from '@/stores/customTaskStore';

type TrainingStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'completed';

const BALL_COLOR_STORAGE_KEY = 'aimpad_ball_color';
const DEFAULT_BALL_COLOR = '#ADD8E6';
const WALL_COLOR_STORAGE_KEY = 'aimpad_wall_color';
const DURATION_STORAGE_KEY = 'aimpad_task_durations';

// React 状态同步节流：100ms 一次批量更新，避免每帧触发重渲染
const STATE_SYNC_MS = 100;

export type TaskDuration = 30000 | 45000 | 60000 | 0;

export const DURATION_OPTIONS: { value: TaskDuration; labelKey: string }[] = [
  { value: 30000, labelKey: 'training.duration.30s' },
  { value: 45000, labelKey: 'training.duration.45s' },
  { value: 60000, labelKey: 'training.duration.60s' },
  { value: 0, labelKey: 'training.duration.unlimited' },
];

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
  const [currentCustomTask, setCurrentCustomTask] = useState<CustomTask | null>(null);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [ballColor, setBallColorState] = useState<string>(() => {
    try {
      return localStorage.getItem(BALL_COLOR_STORAGE_KEY) || DEFAULT_BALL_COLOR;
    } catch {
      return DEFAULT_BALL_COLOR;
    }
  });
  const [wallColor, setWallColorState] = useState<string>(() => {
    try {
      return localStorage.getItem(WALL_COLOR_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [taskDurations, setTaskDurations] = useState<Record<string, TaskDuration>>(loadTaskDurations);

  const engineRef = useRef<GameEngine | null>(null);
  const sceneRef = useRef<BaseScene | null>(null);
  const animFrameRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const currentTaskRef = useRef<TrainingTaskConfig | null>(null);
  const currentCustomTaskRef = useRef<CustomTask | null>(null);

  // 使用批量更新避免每帧多次 setState
  const updateFrameData = useGameStore((s) => s.updateFrameData);

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

  const getTaskDuration = useCallback((taskId: string, defaultDuration: number): number => {
    return taskDurations[taskId] ?? defaultDuration;
  }, [taskDurations]);

  const createScene = useCallback((task: TrainingTaskConfig, canvas: HTMLCanvasElement): BaseScene => {
    const engine = new GameEngine(canvas);
    engineRef.current = engine;

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
        scene = new SphereTrackScene(engine, {
          targetSize: task.parameters.targetSize,
          targetSpeed: task.parameters.targetSpeed,
          duration,
          movementType: 'orbital',
        });
        break;
      case 'strafe-track':
        scene = new SphereTrackScene(engine, {
          targetSize: task.parameters.targetSize,
          targetSpeed: task.parameters.targetSpeed,
          duration,
          movementType: 'linear',
        });
        break;
      default:
        scene = new GridshotScene(engine, {
          targetCount: task.parameters.targetCount,
          targetSize: task.parameters.targetSize,
          duration,
        });
    }

    scene.setTargetColor(ballColor);
    if (wallColor) scene.setWallColor(wallColor);
    scene.setFireButton(useSettingsStore.getState().gamepadFireButton);
    return scene;
  }, [taskDurations, ballColor, wallColor]);

  const startTraining = useCallback(async (task: TrainingTaskConfig, canvas: HTMLCanvasElement) => {
    setStatus('loading');
    setCurrentTask(task);
    currentTaskRef.current = task;
    setResult(null);
    elapsedBeforePauseRef.current = 0;

    try {
      const scene = createScene(task, canvas);
      sceneRef.current = scene;

      await scene.setup();
      scene.start();

      startTimeRef.current = performance.now();
      let lastTime = startTimeRef.current;
      let fpsUpdateCounter = 0;
      let lastStateSync = 0;
      let lastTimeRemaining = -1;

      const renderLoop = () => {
        const now = performance.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        scene.update(deltaTime);
        scene.checkGamepadFire();

        const stats = scene.getStats();

        // 计算剩余时间（一次计算，状态同步 + 结束检测共用）
        const elapsed = now - startTimeRef.current + elapsedBeforePauseRef.current;
        const duration = taskDurations[task.id] ?? task.duration;
        const remaining = duration > 0 ? Math.max(0, duration - elapsed) : -1;
        const displayTime = duration > 0 ? Math.ceil(remaining / 1000) : -1;

        // 节流状态同步：100ms 间隔，且仅在值变化时更新（避免无意义重渲染）
        if (now - lastStateSync >= STATE_SYNC_MS) {
          fpsUpdateCounter++;
          const fps = fpsUpdateCounter >= 6
            ? Math.round(engineRef.current?.getFps() ?? 0)
            : useGameStore.getState().fps;
          if (fpsUpdateCounter >= 6) fpsUpdateCounter = 0;

          const realtimeScore = stats.realtimeScore ?? 0;
          const isTracking = stats.isTracking ?? false;
          if (displayTime !== lastTimeRemaining || stats.hits !== useGameStore.getState().hits || stats.misses !== useGameStore.getState().misses || realtimeScore !== useGameStore.getState().realtimeScore || isTracking !== useGameStore.getState().isTracking) {
            updateFrameData({
              hits: stats.hits,
              misses: stats.misses,
              timeRemaining: displayTime,
              fps,
              realtimeScore,
              isTracking,
            });
            setTimeRemaining(displayTime);
            lastTimeRemaining = displayTime;
          }

          lastStateSync = now;
        }

        // 训练结束检测（每帧检查，确保精确）
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
  }, [createScene, updateFrameData, taskDurations]);

  const handleTrainingEnd = useCallback(async () => {
    if (!sceneRef.current) return;

    const trainingResult = sceneRef.current.stop();
    setResult(trainingResult);
    setStatus('completed');

    try {
      await trainingStorage.saveRecord(trainingResult);
    } catch (error) {
      console.error('Failed to save training result:', error);
    }

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
      elapsedBeforePauseRef.current += pauseTimeRef.current - startTimeRef.current;
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
      startTimeRef.current = performance.now();

      let lastTime = startTimeRef.current;
      let fpsUpdateCounter = 0;
      let lastStateSync = 0;
      let lastTimeRemaining = useGameStore.getState().timeRemaining;
      const scene = sceneRef.current;

      const renderLoop = () => {
        const now = performance.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        scene.update(deltaTime);
        scene.checkGamepadFire();

        const stats = scene.getStats();

        const elapsed = now - startTimeRef.current + elapsedBeforePauseRef.current;
        const duration = taskDurations[currentTask.id] ?? currentTask.duration;
        const remaining = duration > 0 ? Math.max(0, duration - elapsed) : -1;
        const displayTime = duration > 0 ? Math.ceil(remaining / 1000) : -1;

        if (now - lastStateSync >= STATE_SYNC_MS) {
          fpsUpdateCounter++;
          const fps = fpsUpdateCounter >= 6
            ? Math.round(engineRef.current?.getFps() ?? 0)
            : useGameStore.getState().fps;
          if (fpsUpdateCounter >= 6) fpsUpdateCounter = 0;

          const realtimeScore = stats.realtimeScore ?? 0;
          const isTracking = stats.isTracking ?? false;
          if (displayTime !== lastTimeRemaining || stats.hits !== useGameStore.getState().hits || stats.misses !== useGameStore.getState().misses || realtimeScore !== useGameStore.getState().realtimeScore || isTracking !== useGameStore.getState().isTracking) {
            updateFrameData({
              hits: stats.hits,
              misses: stats.misses,
              timeRemaining: displayTime,
              fps,
              realtimeScore,
              isTracking,
            });
            setTimeRemaining(displayTime);
            lastTimeRemaining = displayTime;
          }

          lastStateSync = now;
        }

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
  }, [status, currentTask, handleTrainingEnd, updateFrameData, taskDurations]);

  const stopTraining = useCallback(() => {
    handleTrainingEnd();
  }, [handleTrainingEnd]);

  // 启动自定义任务训练
  const startCustomTraining = useCallback(async (task: CustomTask, canvas: HTMLCanvasElement) => {
    setStatus('loading');
    setCurrentCustomTask(task);
    currentCustomTaskRef.current = task;
    setCurrentTask(null);
    currentTaskRef.current = null;
    setResult(null);
    elapsedBeforePauseRef.current = 0;

    try {
      const engine = new GameEngine(canvas);
      engineRef.current = engine;

      const scene = new CustomScene(engine, task, task.id);
      sceneRef.current = scene;

      scene.setTargetColor(ballColor);
      if (wallColor) scene.setWallColor(wallColor);
      scene.setFireButton(useSettingsStore.getState().gamepadFireButton);

      await scene.setup();
      scene.start();

      startTimeRef.current = performance.now();
      let lastTime = startTimeRef.current;
      let fpsUpdateCounter = 0;
      let lastStateSync = 0;
      let lastTimeRemaining = -1;

      const renderLoop = () => {
        const now = performance.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        scene.update(deltaTime);
        scene.checkGamepadFire();

        const stats = scene.getStats();

        const duration = task.duration || 0;
        const elapsed = now - startTimeRef.current + elapsedBeforePauseRef.current;
        const remaining = duration > 0 ? Math.max(0, duration - elapsed) : -1;
        const displayTime = duration > 0 ? Math.ceil(remaining / 1000) : -1;

        if (now - lastStateSync >= STATE_SYNC_MS) {
          fpsUpdateCounter++;
          const fps = fpsUpdateCounter >= 6
            ? Math.round(engineRef.current?.getFps() ?? 0)
            : useGameStore.getState().fps;
          if (fpsUpdateCounter >= 6) fpsUpdateCounter = 0;

          const realtimeScore = stats.realtimeScore ?? 0;
          const isTracking = stats.isTracking ?? false;
          if (displayTime !== lastTimeRemaining || stats.hits !== useGameStore.getState().hits || stats.misses !== useGameStore.getState().misses || realtimeScore !== useGameStore.getState().realtimeScore || isTracking !== useGameStore.getState().isTracking) {
            updateFrameData({
              hits: stats.hits,
              misses: stats.misses,
              timeRemaining: displayTime,
              fps,
              realtimeScore,
              isTracking,
            });
            setTimeRemaining(displayTime);
            lastTimeRemaining = displayTime;
          }

          lastStateSync = now;
        }

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

      useCustomTaskStore.getState().incrementPlayCount(task.id);
    } catch (error) {
      console.error('Failed to start custom training:', error);
      setStatus('idle');
    }
  }, [ballColor, wallColor, updateFrameData, handleTrainingEnd]);

  const setBallColor = useCallback((color: string) => {
    setBallColorState(color);
    try { localStorage.setItem(BALL_COLOR_STORAGE_KEY, color); } catch {}
    if (sceneRef.current) {
      sceneRef.current.setTargetColor(color);
    }
  }, []);

  const setWallColor = useCallback((color: string) => {
    setWallColorState(color);
    try { localStorage.setItem(WALL_COLOR_STORAGE_KEY, color); } catch {}
    if (sceneRef.current) {
      sceneRef.current.setWallColor(color);
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
    setCurrentCustomTask(null);
    currentCustomTaskRef.current = null;
    setResult(null);
    setTimeRemaining(0);
    elapsedBeforePauseRef.current = 0;
  }, []);

  return {
    status,
    currentTask,
    currentCustomTask,
    result,
    timeRemaining,
    startTraining,
    startCustomTraining,
    pauseTraining,
    resumeTraining,
    stopTraining,
    resetTraining,
    ballColor,
    setBallColor,
    wallColor,
    setWallColor,
    getTaskDuration,
    setTaskDuration,
    taskDurations,
  };
}
