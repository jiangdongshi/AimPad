import { useRef, useEffect, useCallback, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TRAINING_TASKS, GAME_DIFFICULTY_CONFIG } from '@/types/training';
import type { TrainingTaskConfig, GameDifficulty } from '@/types/training';
import { useTraining } from '@/hooks/useTraining';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Crosshair } from '@/components/hud/Crosshair';
import { TrainingHUD } from '@/components/hud/TrainingHUD';
import { TrainingResultPanel } from '@/components/hud/TrainingResultPanel';
import { useGameStore } from '@/stores/gameStore';
import { useLocale } from '@/hooks/useTheme';

export function Training() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const taskId = searchParams.get('task');
  const locale = useLocale();
  const pendingStartRef = useRef<TrainingTaskConfig | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const resumeTrainingRef = useRef<(() => void) | null>(null);

  const {
    status,
    currentTask,
    result,
    timeRemaining,
    getTaskDifficulty,
    startTraining,
    pauseTraining,
    resumeTraining,
    resetTraining,
    setGameDifficulty,
  } = useTraining();

  const { hits, misses, score, fps } = useGameStore();
  const isPausedByUser = useRef(false); // 标记是否是用户主动暂停
  const [isPaused, setIsPaused] = useState(false);
  const pausePhaseRef = useRef<'idle' | 'countdown' | null>(null); // 暂停时所处阶段
  const pausedDifficultyRef = useRef<GameDifficulty | null>(null); // 暂停时的难度

  const selectedTask = taskId
    ? TRAINING_TASKS.find(t => t.id === taskId)
    : null;

  // 当前任务的游戏难度（每个任务独立）
  const gameDifficulty = selectedTask ? getTaskDifficulty(selectedTask.id) : 'hard' as GameDifficulty;

  // 监听指针锁定状态 - 当指针锁定解除时自动暂停训练
  useEffect(() => {
    const handlePointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsPointerLocked(locked);

      // 如果指针锁定被解除且正在游戏中，自动暂停
      if (!locked && status === 'playing' && !isPausedByUser.current) {
        pauseTraining();
      }
      isPausedByUser.current = false;
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, [status, pauseTraining]);

  // 暂停时退出指针锁定
  useEffect(() => {
    if (status === 'paused') {
      isPausedByUser.current = true;
      document.exitPointerLock();
      setIsPointerLocked(false);
      // 记录暂停时的难度
      pausedDifficultyRef.current = gameDifficulty;
    }
  }, [status, gameDifficulty]);

  // ESC 键暂停（idle / countdown 阶段）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // 游戏进行中的 ESC 由 pointerlockchange 处理，这里不管
      if (status === 'playing') return;

      // idle 阶段（已选择任务，未开始倒计时）
      if (status === 'idle' && selectedTask && countdown === null && !isPaused) {
        pausePhaseRef.current = 'idle';
        setIsPaused(true);
        return;
      }

      // 倒计时阶段
      if (countdown !== null && countdown > 0 && !isPaused) {
        pausePhaseRef.current = 'countdown';
        setCountdown(null);
        setIsPaused(true);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [status, selectedTask, countdown, isPaused]);

  const handleStart = useCallback(async (task: TrainingTaskConfig) => {
    // 先导航到带 task 参数的 URL，让 canvas 渲染出来
    navigate(`/training?task=${task.id}`);
    // 保存待启动的任务
    pendingStartRef.current = task;
  }, [navigate]);

  // 开始倒计时（首次开始训练）
  const startCountdown = useCallback(() => {
    setCountdown(3);
    setIsResuming(false);
  }, []);

  // 开始恢复倒计时（暂停后继续）
  const startResumeCountdown = useCallback(() => {
    setIsPaused(false);

    // idle/countdown 阶段的暂停：重新开始倒计时
    if (pausePhaseRef.current === 'idle' || pausePhaseRef.current === 'countdown') {
      pausePhaseRef.current = null;
      setCountdown(3);
      setIsResuming(false);
      return;
    }

    // playing 阶段的暂停：检查难度是否变化
    if (pausePhaseRef.current === null && pausedDifficultyRef.current !== null) {
      const difficultyChanged = pausedDifficultyRef.current !== gameDifficulty;
      pausedDifficultyRef.current = null;

      if (difficultyChanged) {
        // 难度变化：重置训练，回到"点击开始"阶段
        const taskToRestart = currentTask;
        if (taskToRestart) {
          const canvas = document.querySelector('canvas');
          resetTraining(canvas);
          pendingStartRef.current = taskToRestart;
          setCountdown(null);
          setIsResuming(false);
        }
        return;
      }
    }
    pausedDifficultyRef.current = null;

    // playing 阶段的暂停（status === 'paused'，难度未变）：恢复训练
    setCountdown(3);
    setIsResuming(true);
    resumeTrainingRef.current = resumeTraining;
  }, [resumeTraining, gameDifficulty, currentTask, resetTraining]);

  // 倒计时逻辑
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        // 倒计时结束
        setCountdown(null);

        // 锁定鼠标
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.requestPointerLock();
        }

        if (isResuming) {
          // 恢复训练
          if (resumeTrainingRef.current) {
            resumeTrainingRef.current();
            resumeTrainingRef.current = null;
          }
          setIsResuming(false);
        } else {
          // 首次开始训练
          if (pendingStartRef.current && canvas) {
            const task = pendingStartRef.current;
            pendingStartRef.current = null;
            startTraining(task, canvas);
          }
        }
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isResuming, startTraining]);

  // Canvas ref callback
  const canvasCallbackRef = useCallback((_node: HTMLCanvasElement | null) => {
    // Canvas 已挂载，等待用户点击开始
  }, []);

  // 重新开始训练（立即刷新界面，倒计时后开始）
  const handleRestart = useCallback(() => {
    const taskToRestart = currentTask || pendingStartRef.current;
    if (taskToRestart) {
      setIsPaused(false);
      pausePhaseRef.current = null;
      // 先重置训练状态并立即清除画布
      const canvas = document.querySelector('canvas');
      resetTraining(canvas);
      // 保存任务用于倒计时后开始
      pendingStartRef.current = taskToRestart;
      // 设置倒计时状态为"重新开始"
      setCountdown(3);
      setIsResuming(false);
    }
  }, [currentTask, resetTraining]);

  const handleBack = useCallback(() => {
    setIsPaused(false);
    pausePhaseRef.current = null;
    setCountdown(null);
    const canvas = document.querySelector('canvas');
    resetTraining(canvas);
    navigate('/training');
  }, [resetTraining, navigate]);

  // 当 selectedTask 变化时，设置待启动任务
  useEffect(() => {
    if (selectedTask && status === 'idle') {
      pendingStartRef.current = selectedTask;
    }
  }, [selectedTask, status]);

  return (
    <div className="relative min-h-screen">
      {/* 任务选择界面 */}
      {status === 'idle' && !selectedTask && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-gaming text-text-primary mb-8">
            {locale['training.chooseTask']}
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TRAINING_TASKS.map((task) => (
              <Card key={task.id} hoverable className="h-full">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-gaming text-text-primary">{task.name}</h3>
                  <span className={`
                    px-2.5 py-1 rounded-full text-xs font-medium
                    ${task.difficulty === 'beginner' ? 'bg-success/20 text-success' :
                      task.difficulty === 'intermediate' ? 'bg-warning/20 text-warning' :
                      task.difficulty === 'advanced' ? 'bg-danger/20 text-danger' :
                      'bg-primary-500/20 text-primary-400'}
                  `}>
                    {locale[`difficulty.${task.difficulty}` as keyof typeof locale]}
                  </span>
                </div>
                <p className="text-text-secondary mb-4">{task.description}</p>
                <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
                  <span>{locale[`taskType.${task.type}` as keyof typeof locale]}</span>
                  <span>·</span>
                  <span>{task.duration / 1000}s</span>
                  <span>·</span>
                  <span>{task.parameters.targetCount} {locale['training.targets']}</span>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => handleStart(task)}
                >
                  {locale['training.start']}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 游戏画布 */}
      {(selectedTask || countdown !== null || status === 'loading' || status === 'playing' || status === 'paused') && (
        <>
          <canvas
            ref={canvasCallbackRef}
            className="w-full h-screen cursor-none"
            style={{ display: 'block' }}
            onClick={() => {
              if (status === 'idle' && selectedTask && countdown === null) {
                // 点击开始训练
                startCountdown();
              } else if (status === 'playing' && !isPointerLocked) {
                // 游戏中点击重新锁定指针
                const canvas = document.querySelector('canvas');
                if (canvas) canvas.requestPointerLock();
              }
            }}
          />
          {/* 自定义准星 - 固定在屏幕中央 */}
          <Crosshair />
          <TrainingHUD
            score={score}
            hits={hits}
            misses={misses}
            timeRemaining={timeRemaining}
            fps={fps}
          />

          {/* 点击开始训练提示（仅在等待开始且无倒计时时显示） */}
          {status === 'idle' && selectedTask && countdown === null && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="text-center">
                <div className="text-6xl font-gaming text-accent mb-4 animate-pulse">
                  {selectedTask.name}
                </div>
                <div className="bg-surface-900/60 backdrop-blur-sm rounded-lg px-8 py-4 text-text-secondary text-xl">
                  {locale['training.clickToStart']}
                </div>
              </div>
            </div>
          )}

          {/* 倒计时显示 */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div className="text-9xl font-gaming text-accent">
                {countdown}
              </div>
            </div>
          )}

          {/* 暂停覆盖层 */}
          {(status === 'paused' || isPaused) && (
            <div
              className="absolute inset-0 flex items-center justify-center z-50"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                className="text-center rounded-2xl px-12 py-10 shadow-2xl"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-accent)',
                  boxShadow: '0 0 40px rgba(var(--tw-accent-rgb) / 0.15)',
                }}
              >
                <h2 className="text-3xl font-gaming mb-6" style={{ color: 'var(--color-accent)' }}>
                  {locale['training.paused']}
                </h2>

                {/* 难度选择 */}
                <div className="mb-8">
                  <div className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    {locale['difficulty.select']}
                  </div>
                  <div className="flex gap-3 justify-center">
                    {(Object.keys(GAME_DIFFICULTY_CONFIG) as GameDifficulty[]).map((diff) => {
                      const selected = gameDifficulty === diff;
                      return (
                        <button
                          key={diff}
                          onClick={() => selectedTask && setGameDifficulty(selectedTask.id, diff)}
                          className="relative flex flex-col items-center"
                          style={{ transition: 'all 0.2s ease' }}
                        >
                          <div
                            className="px-5 py-2.5 rounded-xl text-sm font-medium"
                            style={{
                              backgroundColor: selected
                                ? 'var(--color-accent)'
                                : 'var(--color-bg-surface-hover)',
                              color: selected
                                ? 'var(--color-bg-primary)'
                                : 'var(--color-text-secondary)',
                              fontWeight: selected ? 700 : 500,
                              transform: selected ? 'scale(1.1)' : 'scale(1)',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {locale[GAME_DIFFICULTY_CONFIG[diff].label]}
                          </div>
                          {/* 选中下划线 */}
                          <div
                            className="mt-1.5 rounded-sm"
                            style={{
                              width: '60%',
                              height: '4px',
                              backgroundColor: selected ? 'var(--color-accent)' : 'transparent',
                              transition: 'all 0.2s ease',
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  {/* 当前难度说明 */}
                  <div
                    className="mt-4 inline-block rounded-lg px-4 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {gameDifficulty === 'easy' && '目标放大 1.5x'}
                    {gameDifficulty === 'simple' && '默认难度'}
                    {gameDifficulty === 'normal' && '目标缩小 0.7x'}
                    {gameDifficulty === 'hard' && '目标缩小 0.5x · 2秒后消失'}
                    {gameDifficulty === 'hell' && '目标缩小 0.3x · 1.2秒后消失'}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button variant="secondary" onClick={handleBack}>
                    {locale['training.quit']}
                  </Button>
                  <Button variant="secondary" onClick={handleRestart}>
                    {locale['training.restart']}
                  </Button>
                  <Button variant="primary" onClick={startResumeCountdown}>
                    {locale['training.resume']}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ESC 键暂停提示（仅在游戏进行中且指针锁定时显示） */}
          {status === 'playing' && isPointerLocked && (
            <div className="absolute bottom-4 right-4 z-40">
              <Button
                variant="ghost"
                size="sm"
                onClick={pauseTraining}
                className="opacity-50 hover:opacity-100"
              >
                {locale['training.escPause']}
              </Button>
            </div>
          )}
        </>
      )}

      {/* 结果面板 */}
      {status === 'completed' && result && (
        <TrainingResultPanel
          result={result}
          onRestart={handleRestart}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
