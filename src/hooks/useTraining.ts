import { useState, useRef, useCallback } from 'react';
import { GameEngine } from '@/game/engine/GameEngine';
import { GridshotScene } from '@/game/scenes/GridshotScene';
import { SphereTrackScene } from '@/game/scenes/SphereTrackScene';
import { BaseScene } from '@/game/scenes/BaseScene';
import type { TrainingTaskConfig, TrainingResult } from '@/types/training';
import { trainingStorage } from '@/utils/storage';

type TrainingStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'completed';

export function useTraining() {
  const [status, setStatus] = useState<TrainingStatus>('idle');
  const [currentTask, setCurrentTask] = useState<TrainingTaskConfig | null>(null);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const engineRef = useRef<GameEngine | null>(null);
  const sceneRef = useRef<BaseScene | null>(null);
  const animFrameRef = useRef<number>(0);

  const createScene = useCallback((task: TrainingTaskConfig, canvas: HTMLCanvasElement): BaseScene => {
    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    switch (task.id) {
      case 'gridshot':
      case 'spidershot':
        return new GridshotScene(engine, {
          targetCount: task.parameters.targetCount,
          targetSize: task.parameters.targetSize,
          duration: task.duration,
          spawnInterval: task.parameters.spawnInterval,
        });
      case 'sphere-track':
      case 'strafe-track':
        return new SphereTrackScene(engine, {
          targetSize: task.parameters.targetSize,
          targetSpeed: task.parameters.targetSpeed,
          duration: task.duration,
        });
      default:
        return new GridshotScene(engine, {
          targetCount: task.parameters.targetCount,
          targetSize: task.parameters.targetSize,
          duration: task.duration,
        });
    }
  }, []);

  const startTraining = useCallback(async (task: TrainingTaskConfig, canvas: HTMLCanvasElement) => {
    setStatus('loading');
    setCurrentTask(task);
    setResult(null);

    try {
      const scene = createScene(task, canvas);
      sceneRef.current = scene;

      await scene.setup();
      scene.start();

      // 启动渲染循环
      const startTime = performance.now();
      let lastTime = startTime;

      const renderLoop = () => {
        const now = performance.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        scene.update(deltaTime);

        // 更新剩余时间
        const elapsed = now - startTime;
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
  }, [createScene]);

  const handleTrainingEnd = useCallback(async () => {
    if (!sceneRef.current || !currentTask) return;

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
  }, [currentTask]);

  const pauseTraining = useCallback(() => {
    if (status === 'playing') {
      engineRef.current?.stop();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setStatus('paused');
    }
  }, [status]);

  const resumeTraining = useCallback(() => {
    if (status === 'paused' && currentTask) {
      engineRef.current?.startRenderLoop();
      setStatus('playing');
    }
  }, [status, currentTask]);

  const stopTraining = useCallback(() => {
    handleTrainingEnd();
  }, [handleTrainingEnd]);

  const resetTraining = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    sceneRef.current?.dispose();
    engineRef.current?.dispose();
    sceneRef.current = null;
    engineRef.current = null;
    setStatus('idle');
    setCurrentTask(null);
    setResult(null);
    setTimeRemaining(0);
  }, []);

  return {
    status,
    currentTask,
    result,
    timeRemaining,
    startTraining,
    pauseTraining,
    resumeTraining,
    stopTraining,
    resetTraining,
  };
}
