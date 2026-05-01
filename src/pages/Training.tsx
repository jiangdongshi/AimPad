import { useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TRAINING_TASKS } from '@/types/training';
import type { TrainingTaskConfig } from '@/types/training';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const locale = useLocale();

  const {
    status,
    currentTask,
    result,
    timeRemaining,
    startTraining,
    pauseTraining,
    resumeTraining,
    resetTraining,
  } = useTraining();

  const { hits, misses, score, fps } = useGameStore();

  const selectedTask = taskId
    ? TRAINING_TASKS.find(t => t.id === taskId)
    : null;

  const handleStart = useCallback(async (task: TrainingTaskConfig) => {
    if (!canvasRef.current) return;
    await startTraining(task, canvasRef.current);
  }, [startTraining]);

  const handleRestart = useCallback(() => {
    resetTraining();
    if (currentTask && canvasRef.current) {
      setTimeout(() => {
        handleStart(currentTask);
      }, 100);
    }
  }, [resetTraining, currentTask, handleStart]);

  const handleBack = useCallback(() => {
    resetTraining();
    navigate('/training');
  }, [resetTraining, navigate]);

  useEffect(() => {
    if (selectedTask && status === 'idle' && canvasRef.current) {
      handleStart(selectedTask);
    }
  }, [selectedTask, status, handleStart]);

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
      {(status === 'loading' || status === 'playing' || status === 'paused') && (
        <>
          <canvas
            ref={canvasRef}
            className="w-full h-screen cursor-crosshair"
            style={{ display: 'block' }}
          />
          <Crosshair />
          <TrainingHUD
            score={score}
            hits={hits}
            misses={misses}
            timeRemaining={timeRemaining}
            fps={fps}
          />

          {/* 暂停覆盖层 */}
          {status === 'paused' && (
            <div className="fixed inset-0 bg-surface-900/80 flex items-center justify-center z-50">
              <div className="text-center">
                <h2 className="text-3xl font-gaming text-accent mb-8">{locale['training.paused']}</h2>
                <div className="flex gap-4">
                  <Button variant="secondary" onClick={handleBack}>
                    {locale['training.quit']}
                  </Button>
                  <Button variant="primary" onClick={resumeTraining}>
                    {locale['training.resume']}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ESC 键暂停 */}
          <div className="fixed bottom-4 right-4 z-40">
            <Button
              variant="ghost"
              size="sm"
              onClick={pauseTraining}
              className="opacity-50 hover:opacity-100"
            >
              {locale['training.escPause']}
            </Button>
          </div>
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
