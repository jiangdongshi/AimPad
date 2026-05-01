import type { TrainingResult } from '@/types/training';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/hooks/useTheme';

interface TrainingResultPanelProps {
  result: TrainingResult;
  onRestart: () => void;
  onBack: () => void;
}

export function TrainingResultPanel({ result, onRestart, onBack }: TrainingResultPanelProps) {
  const locale = useLocale();
  const accuracy = result.accuracy.toFixed(1);
  const avgReaction = result.reactionTime > 0
    ? result.reactionTime.toFixed(0)
    : '-';

  return (
    <div className="fixed inset-0 bg-surface-900/90 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-surface-800 rounded-xl p-8 max-w-md w-full mx-4 animate-slide-up">
        <h2 className="text-3xl font-gaming text-accent text-center mb-6">
          {locale['result.title']}
        </h2>

        {/* 分数 */}
        <div className="text-center mb-8">
          <div className="text-6xl font-gaming text-text-primary mb-2">
            {result.score.toLocaleString()}
          </div>
          <div className="text-text-secondary">{locale['result.finalScore']}</div>
        </div>

        {/* 统计数据 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-surface-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-gaming text-success">{accuracy}%</div>
            <div className="text-xs text-text-secondary mt-1">{locale['result.accuracy']}</div>
          </div>
          <div className="bg-surface-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-gaming text-primary-400">{result.kills}</div>
            <div className="text-xs text-text-secondary mt-1">{locale['result.kills']}</div>
          </div>
          <div className="bg-surface-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-gaming text-accent">{avgReaction}ms</div>
            <div className="text-xs text-text-secondary mt-1">{locale['result.avgReaction']}</div>
          </div>
          <div className="bg-surface-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-gaming text-text-primary">
              {(result.duration / 1000).toFixed(1)}s
            </div>
            <div className="text-xs text-text-secondary mt-1">{locale['result.duration']}</div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <Button variant="secondary" className="flex-1" onClick={onBack}>
            {locale['result.back']}
          </Button>
          <Button variant="primary" className="flex-1" onClick={onRestart}>
            {locale['result.playAgain']}
          </Button>
        </div>
      </div>
    </div>
  );
}
