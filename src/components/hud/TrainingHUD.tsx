import { useLocale } from '@/hooks/useTheme';
import { getSceneHudBg } from '@/utils/themeColors';

interface TrainingHUDProps {
  score: number;
  hits: number;
  misses: number;
  timeRemaining: number;
  fps?: number;
  realtimeScore?: number; // 追踪场景的实时分数
  isTracking?: boolean; // 是否为追踪场景
}

export function TrainingHUD({ score, hits, misses, timeRemaining, fps, realtimeScore, isTracking }: TrainingHUDProps) {
  const locale = useLocale();
  const accuracy = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) : '0.0';
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const hudBg = { backgroundColor: getSceneHudBg() };

  // 使用 isTracking 标志判断是否为追踪场景
  const isTrackingMode = isTracking === true;
  // 追踪模式下，左上角显示实时分数（取整）；射击模式下显示 score
  const displayScore = isTrackingMode ? Math.round(realtimeScore ?? 0) : score;

  return (
    <>
      {/* 顶部信息栏 */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-40">
        <div className="flex justify-between items-start p-4">
          {/* 左侧：分数 */}
          <div className="backdrop-blur-sm rounded-lg px-4 py-2" style={hudBg}>
            <div className="text-xs text-white/70 font-display uppercase tracking-wider">{locale['hud.score']}</div>
            <div className="text-3xl font-gaming text-accent">{displayScore.toLocaleString()}</div>
          </div>

          {/* 中间：时间 */}
          <div className="backdrop-blur-sm rounded-lg px-6 py-2 text-center" style={hudBg}>
            <div className="text-xs text-white/70 font-display uppercase tracking-wider">{locale['hud.time']}</div>
            <div className="text-4xl font-gaming text-white tabular-nums">
              {timeRemaining >= 0
                ? `${minutes}:${seconds.toString().padStart(2, '0')}`
                : '∞'}
            </div>
          </div>

          {/* 右侧：命中率（射击模式才显示） */}
          {!isTrackingMode && (
            <div className="backdrop-blur-sm rounded-lg px-4 py-2 text-right" style={hudBg}>
              <div className="text-xs text-white/70 font-display uppercase tracking-wider">{locale['hud.accuracy']}</div>
              <div className="text-3xl font-gaming text-success">{accuracy}%</div>
            </div>
          )}
        </div>
      </div>

      {/* 底部统计（射击模式显示命中/脱靶，追踪模式不显示） */}
      {!isTrackingMode && (
        <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none z-40">
          <div className="backdrop-blur-sm rounded-lg px-3 py-1" style={hudBg}>
            <span className="text-xs text-white/70">{locale['hud.hits']}: </span>
            <span className="text-sm font-gaming text-success">{hits}</span>
          </div>
          <div className="backdrop-blur-sm rounded-lg px-3 py-1" style={hudBg}>
            <span className="text-xs text-white/70">{locale['hud.misses']}: </span>
            <span className="text-sm font-gaming text-danger">{misses}</span>
          </div>
          {fps !== undefined && (
            <div className="backdrop-blur-sm rounded-lg px-3 py-1" style={hudBg}>
              <span className="text-xs text-white/70">{locale['hud.fps']}: </span>
              <span className="text-sm font-gaming text-white">{fps}</span>
            </div>
          )}
        </div>
      )}

      {/* FPS 显示（追踪模式单独显示） */}
      {isTrackingMode && fps !== undefined && (
        <div className="absolute bottom-4 left-4 pointer-events-none z-40">
          <div className="backdrop-blur-sm rounded-lg px-3 py-1" style={hudBg}>
            <span className="text-xs text-white/70">{locale['hud.fps']}: </span>
            <span className="text-sm font-gaming text-white">{fps}</span>
          </div>
        </div>
      )}
    </>
  );
}
