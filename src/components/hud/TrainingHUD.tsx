interface TrainingHUDProps {
  score: number;
  hits: number;
  misses: number;
  timeRemaining: number;
  fps?: number;
}

export function TrainingHUD({ score, hits, misses, timeRemaining, fps }: TrainingHUDProps) {
  const accuracy = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) : '0.0';
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed top-0 left-0 right-0 pointer-events-none z-40">
      {/* 顶部信息栏 */}
      <div className="flex justify-between items-start p-4">
        {/* 左侧：分数 */}
        <div className="bg-surface-900/80 backdrop-blur-sm rounded-lg px-4 py-2">
          <div className="text-xs text-text-secondary font-display uppercase tracking-wider">Score</div>
          <div className="text-3xl font-gaming text-accent">{score.toLocaleString()}</div>
        </div>

        {/* 中间：时间 */}
        <div className="bg-surface-900/80 backdrop-blur-sm rounded-lg px-6 py-2 text-center">
          <div className="text-xs text-text-secondary font-display uppercase tracking-wider">Time</div>
          <div className="text-4xl font-gaming text-text-primary tabular-nums">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>

        {/* 右侧：命中率 */}
        <div className="bg-surface-900/80 backdrop-blur-sm rounded-lg px-4 py-2 text-right">
          <div className="text-xs text-text-secondary font-display uppercase tracking-wider">Accuracy</div>
          <div className="text-3xl font-gaming text-success">{accuracy}%</div>
        </div>
      </div>

      {/* 底部统计 */}
      <div className="fixed bottom-4 left-4 flex gap-4">
        <div className="bg-surface-900/80 backdrop-blur-sm rounded-lg px-3 py-1">
          <span className="text-xs text-text-secondary">Hits: </span>
          <span className="text-sm font-gaming text-success">{hits}</span>
        </div>
        <div className="bg-surface-900/80 backdrop-blur-sm rounded-lg px-3 py-1">
          <span className="text-xs text-text-secondary">Misses: </span>
          <span className="text-sm font-gaming text-danger">{misses}</span>
        </div>
        {fps !== undefined && (
          <div className="bg-surface-900/80 backdrop-blur-sm rounded-lg px-3 py-1">
            <span className="text-xs text-text-secondary">FPS: </span>
            <span className="text-sm font-gaming text-text-primary">{fps}</span>
          </div>
        )}
      </div>
    </div>
  );
}
