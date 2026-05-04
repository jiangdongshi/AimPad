import { useRef, useEffect, useCallback, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TRAINING_TASKS, GAME_DIFFICULTY_CONFIG } from '@/types/training';
import type { TrainingTaskConfig, GameDifficulty } from '@/types/training';
import { useTraining, DURATION_OPTIONS } from '@/hooks/useTraining';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Crosshair } from '@/components/hud/Crosshair';
import { TrainingHUD } from '@/components/hud/TrainingHUD';
import { TrainingResultPanel } from '@/components/hud/TrainingResultPanel';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useLocale } from '@/hooks/useTheme';
import { getButtonIndex } from '@/utils/gamepadMap';
import type { ButtonMapping } from '@/types/gamepad';

const BALL_COLOR_PRESETS = [
  '#ADD8E6', // 淡蓝色（默认）
  '#FF3333', // 红色
  '#33D94D', // 绿色
  '#FFD700', // 黄色
  '#B44CFF', // 紫色
  '#FFFFFF', // 白色
  '#FF8C00', // 橙色
  '#FF69B4', // 粉色
];

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
    ballColor,
    setBallColor,
    getTaskDuration,
    setTaskDuration,
  } = useTraining();

  const { hits, misses, score, fps } = useGameStore();
  const isPausedByUser = useRef(false); // 标记是否是用户主动暂停
  const [isPaused, setIsPaused] = useState(false);
  const [showDifficultyPopup, setShowDifficultyPopup] = useState(false);
  const [showDurationPopup, setShowDurationPopup] = useState(false);
  const [showColorPopup, setShowColorPopup] = useState(false);
  const pausePhaseRef = useRef<'idle' | 'countdown' | 'resume-countdown' | null>(null); // 暂停时所处阶段
  const pausedDifficultySnapshotRef = useRef<GameDifficulty | null>(null); // 暂停时的难度快照（仅首次暂停时记录，防止被难度变化覆盖）

  const selectedTask = taskId
    ? TRAINING_TASKS.find(t => t.id === taskId)
    : null;

  // 当前任务的游戏难度（每个任务独立）
  const gameDifficulty = selectedTask ? getTaskDifficulty(selectedTask.id) : 'hard' as GameDifficulty;

  // 当前任务的训练时长（每个任务独立）
  const currentDuration = selectedTask ? getTaskDuration(selectedTask.id, selectedTask.duration) : 30000;

  // 监听指针锁定状态 - 当指针锁定解除时自动暂停训练
  useEffect(() => {
    const handlePointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsPointerLocked(locked);

      // 恢复训练期间锁定指针，跳过自动暂停
      if (isResuming) return;

      // 如果指针锁定被解除且正在游戏中，自动暂停
      if (!locked && status === 'playing' && !isPausedByUser.current) {
        pauseTraining();
      }
      isPausedByUser.current = false;
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, [status, pauseTraining, isResuming]);

  // 弹窗外部点击关闭
  useEffect(() => {
    if (!showDifficultyPopup && !showDurationPopup && !showColorPopup) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showDifficultyPopup && !target.closest('[data-difficulty-popup]')) {
        setShowDifficultyPopup(false);
      }
      if (showDurationPopup && !target.closest('[data-duration-popup]')) {
        setShowDurationPopup(false);
      }
      if (showColorPopup && !target.closest('[data-color-popup]')) {
        setShowColorPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDifficultyPopup, showDurationPopup, showColorPopup]);

  // 暂停时退出指针锁定，并记录暂停时的难度快照（仅在进入暂停时记录一次）
  useEffect(() => {
    if (status === 'paused') {
      isPausedByUser.current = true;
      document.exitPointerLock();
      setIsPointerLocked(false);
      // 仅在首次进入暂停状态时记录难度快照，后续难度变化不覆盖
      if (pausedDifficultySnapshotRef.current === null) {
        pausedDifficultySnapshotRef.current = gameDifficulty;
      }
    } else {
      // 退出暂停时清空快照
      pausedDifficultySnapshotRef.current = null;
    }
  }, [status]);

  // ESC 键暂停（idle / countdown 阶段）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // 弹窗打开时，ESC 关闭弹窗
      if (showDifficultyPopup) {
        setShowDifficultyPopup(false);
        return;
      }
      if (showDurationPopup) {
        setShowDurationPopup(false);
        return;
      }
      if (showColorPopup) {
        setShowColorPopup(false);
        return;
      }

      // 游戏进行中的 ESC 由 pointerlockchange 处理，这里不管
      if (status === 'playing') return;

      // idle 阶段（已选择任务，未开始倒计时）
      if (status === 'idle' && selectedTask && countdown === null && !isPaused) {
        pausePhaseRef.current = 'idle';
        setIsPaused(true);
        return;
      }

      // 倒计时阶段（区分首次开始 / 恢复继续的倒计时）
      if (countdown !== null && countdown > 0 && !isPaused) {
        pausePhaseRef.current = status === 'paused' ? 'resume-countdown' : 'countdown';
        setCountdown(null);
        setIsPaused(true);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [status, selectedTask, countdown, isPaused, showDifficultyPopup, showDurationPopup, showColorPopup]);

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

  // 暂停后继续：按 Vercel rerender-move-effect-to-event 原则，交互逻辑直接在事件处理器中完成
  const startResumeCountdown = useCallback(() => {
    setIsPaused(false);

    // 首次开始倒计时被暂停 → 重新开始倒计时
    if (pausePhaseRef.current === 'idle' || pausePhaseRef.current === 'countdown') {
      pausePhaseRef.current = null;
      setCountdown(3);
      setIsResuming(false);
      return;
    }

    // 恢复继续的倒计时被暂停 → 重新恢复倒计时
    if (pausePhaseRef.current === 'resume-countdown') {
      pausePhaseRef.current = null;
      setCountdown(3);
      setIsResuming(true);
      resumeTrainingRef.current = resumeTraining;
      return;
    }

    pausePhaseRef.current = null;

    // playing 阶段的暂停：检查难度是否变化
    if (pausedDifficultySnapshotRef.current !== null) {
      const difficultyChanged = pausedDifficultySnapshotRef.current !== gameDifficulty;
      pausedDifficultySnapshotRef.current = null;

      if (difficultyChanged) {
        // 难度已变化 → 直接回到「点击开始训练」界面，难度已在暂停时保存
        const canvas = document.querySelector('canvas');
        resetTraining(canvas);
        return;
      }
    }

    // 难度未变 → 倒计时 3-2-1 后恢复训练
    setCountdown(3);
    setIsResuming(true);
    resumeTrainingRef.current = resumeTraining;
  }, [resumeTraining, gameDifficulty, resetTraining]);

  // 手柄开火按钮启动训练
  useEffect(() => {
    if (status !== 'idle' || !selectedTask || countdown !== null) return;

    const fireButton = useSettingsStore.getState().gamepadFireButton;
    let prevPressed = false;
    let animId: number;

    const poll = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;
        const idx = getButtonIndex(gp, fireButton as keyof ButtonMapping);
        if (idx === undefined) continue;
        const pressed = gp.buttons[idx]?.pressed ?? false;
        if (pressed && !prevPressed) {
          startCountdown();
        }
        prevPressed = pressed;
        break;
      }
      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [status, selectedTask, countdown, startCountdown]);

  // 倒计时逻辑
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);

        if (isResuming) {
          // 恢复训练（难度未变）：直接恢复游戏逻辑循环
          if (resumeTrainingRef.current) {
            resumeTrainingRef.current();
            resumeTrainingRef.current = null;
          }
          setIsResuming(false);
          // 指针锁定推迟到下一事件循环，避免阻塞恢复操作
          setTimeout(() => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
              try { canvas.requestPointerLock(); } catch {}
            }
          }, 0);
        } else {
          // 首次开始训练 / 重新开始
          const canvas = document.querySelector('canvas');
          if (pendingStartRef.current && canvas) {
            const task = pendingStartRef.current;
            pendingStartRef.current = null;
            try { canvas.requestPointerLock(); } catch {}
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

          {/* 暂停覆盖层 — 倒计时期间自动隐藏，让用户看到 3-2-1 */}
          {(status === 'paused' || isPaused) && countdown === null && (
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
                  border: '1px solid #2563EB',
                  boxShadow: '0 0 40px rgba(37, 99, 235, 0.22)',
                }}
              >
                <h2 className="text-3xl font-gaming mb-6" style={{ color: '#2563EB' }}>
                  {locale['training.paused']}
                </h2>

                {/* 当前难度 + 选择按钮 */}
                <div className="mb-6">
                  <div
                    className="text-sm mb-3"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {locale['training.currentDifficulty']?.replace('{difficulty}', locale[GAME_DIFFICULTY_CONFIG[gameDifficulty].label]) || locale['difficulty.select']}
                  </div>
                  <div className="relative inline-block" data-difficulty-popup>
                    <button
                      onClick={() => setShowDifficultyPopup(!showDifficultyPopup)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                      style={{
                        backgroundColor: 'var(--color-bg-surface-hover)',
                        color: '#2563EB',
                        border: '1px solid #2563EB',
                        fontWeight: 700,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {locale[GAME_DIFFICULTY_CONFIG[gameDifficulty].label]}
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showDifficultyPopup ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {/* 难度选择弹窗 */}
                    {showDifficultyPopup && (
                      <div
                        className="absolute top-full mt-2 left-1/2 -translate-x-1/2 rounded-xl py-2 min-w-[200px] z-10"
                        style={{
                          backgroundColor: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        }}
                      >
                        {(Object.keys(GAME_DIFFICULTY_CONFIG) as GameDifficulty[]).map((diff) => (
                          <button
                            key={diff}
                            onClick={() => {
                              if (selectedTask) setGameDifficulty(selectedTask.id, diff);
                              setShowDifficultyPopup(false);
                            }}
                            className="w-full text-left px-5 py-2.5 text-sm transition-colors flex items-center justify-between"
                            style={{
                              color: gameDifficulty === diff ? '#2563EB' : 'var(--color-text-secondary)',
                              backgroundColor: gameDifficulty === diff ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                              fontWeight: gameDifficulty === diff ? 700 : 500,
                            }}
                          >
                            {locale[GAME_DIFFICULTY_CONFIG[diff].label]}
                            {gameDifficulty === diff && (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M3 7.5L5.5 10L11 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        ))}
                        <div
                          className="mx-4 my-2 border-t"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                        <div
                          className="px-5 py-2 text-xs"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {gameDifficulty === 'easy' && '目标放大 1.5x'}
                          {gameDifficulty === 'simple' && '默认难度'}
                          {gameDifficulty === 'normal' && '目标缩小 0.7x'}
                          {gameDifficulty === 'hard' && '目标缩小 0.5x · 2秒后消失'}
                          {gameDifficulty === 'hell' && '目标缩小 0.3x · 1.2秒后消失'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 训练时长选择 */}
                <div className="mb-6">
                  <div
                    className="text-sm mb-3"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {locale['training.duration']}
                  </div>
                  <div className="relative inline-block" data-duration-popup>
                    <button
                      onClick={() => setShowDurationPopup(!showDurationPopup)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                      style={{
                        backgroundColor: 'var(--color-bg-surface-hover)',
                        color: '#2563EB',
                        border: '1px solid #2563EB',
                        fontWeight: 700,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {locale[DURATION_OPTIONS.find(o => o.value === currentDuration)?.labelKey as keyof typeof locale] || `${currentDuration / 1000}s`}
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showDurationPopup ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {showDurationPopup && (
                      <div
                        className="absolute top-full mt-2 left-1/2 -translate-x-1/2 rounded-xl py-2 min-w-[160px] z-10"
                        style={{
                          backgroundColor: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        }}
                      >
                        {DURATION_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              if (selectedTask) setTaskDuration(selectedTask.id, opt.value);
                              setShowDurationPopup(false);
                            }}
                            className="w-full text-left px-5 py-2.5 text-sm transition-colors flex items-center justify-between"
                            style={{
                              color: currentDuration === opt.value ? '#2563EB' : 'var(--color-text-secondary)',
                              backgroundColor: currentDuration === opt.value ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                              fontWeight: currentDuration === opt.value ? 700 : 500,
                            }}
                          >
                            {locale[opt.labelKey as keyof typeof locale]}
                            {currentDuration === opt.value && (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M3 7.5L5.5 10L11 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 小球颜色选择 */}
                <div className="mb-8">
                  <div
                    className="text-sm mb-3"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {locale['training.ballColor']}
                  </div>
                  <div className="relative inline-block" data-color-popup>
                    <button
                      onClick={() => setShowColorPopup(!showColorPopup)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                      style={{
                        backgroundColor: 'var(--color-bg-surface-hover)',
                        border: '1px solid #2563EB',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span
                        className="inline-block rounded-full"
                        style={{
                          width: '16px',
                          height: '16px',
                          backgroundColor: ballColor,
                        }}
                      />
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#2563EB', transform: showColorPopup ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {showColorPopup && (
                      <div
                        className="absolute top-full mt-2 left-1/2 -translate-x-1/2 rounded-xl py-3 px-3 z-10"
                        style={{
                          backgroundColor: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        }}
                      >
                        <div className="flex gap-2.5 justify-center">
                          {BALL_COLOR_PRESETS.map((color) => {
                            const selected = ballColor === color;
                            return (
                              <button
                                key={color}
                                onClick={() => {
                                  setBallColor(color);
                                  setShowColorPopup(false);
                                }}
                                className="rounded-full transition-all"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  backgroundColor: color,
                                  border: selected
                                    ? '3px solid #2563EB'
                                    : '2px solid var(--color-border)',
                                  transform: selected ? 'scale(1.15)' : 'scale(1)',
                                  boxShadow: selected ? '0 0 10px rgba(37, 99, 235, 0.5)' : 'none',
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
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
