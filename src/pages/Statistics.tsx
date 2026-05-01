import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useStatistics, useTaskStats } from '@/hooks/useStatistics';
import { TRAINING_TASKS } from '@/types/training';
import { useLocale } from '@/hooks/useTheme';

export function Statistics() {
  const [selectedTask, setSelectedTask] = useState<string | undefined>();
  const { stats, loading, refresh } = useStatistics(selectedTask);
  const { taskStats, loading: taskLoading } = useTaskStats();
  const locale = useLocale();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-gaming text-text-primary">{locale['stats.title']}</h1>
        <Button variant="ghost" size="sm" onClick={refresh}>
          {locale['stats.refresh']}
        </Button>
      </div>

      {/* 任务筛选 */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          className={`px-4 py-2 rounded-full text-sm transition-colors ${
            !selectedTask
              ? 'bg-accent text-surface-900'
              : 'bg-surface-700 text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setSelectedTask(undefined)}
        >
          {locale['stats.allTasks']}
        </button>
        {TRAINING_TASKS.map((task) => (
          <button
            key={task.id}
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              selectedTask === task.id
                ? 'bg-accent text-surface-900'
                : 'bg-surface-700 text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setSelectedTask(task.id)}
          >
            {task.name}
          </button>
        ))}
      </div>

      {/* 总体统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="text-center p-6">
            <div className="text-sm text-text-secondary mb-2">{locale['stats.totalSessions']}</div>
            <div className="text-4xl font-gaming text-text-primary">
              {loading ? '-' : stats?.totalSessions || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-6">
            <div className="text-sm text-text-secondary mb-2">{locale['stats.bestScore']}</div>
            <div className="text-4xl font-gaming text-accent">
              {loading ? '-' : stats?.bestScore?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-6">
            <div className="text-sm text-text-secondary mb-2">{locale['stats.averageScore']}</div>
            <div className="text-4xl font-gaming text-text-primary">
              {loading ? '-' : stats?.averageScore?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-6">
            <div className="text-sm text-text-secondary mb-2">{locale['stats.trend']}</div>
            <div className={`text-4xl font-gaming ${
              !stats?.improvementTrend ? 'text-text-primary' :
              stats.improvementTrend > 0 ? 'text-success' : 'text-danger'
            }`}>
              {loading ? '-' : (
                stats?.improvementTrend
                  ? `${stats.improvementTrend > 0 ? '+' : ''}${stats.improvementTrend}%`
                  : '0%'
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 性能指标 */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['stats.performanceMetrics']}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-text-muted py-8">{locale['stats.loading']}</div>
            ) : stats ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">{locale['stats.averageAccuracy']}</span>
                  <span className="font-gaming text-success">{stats.averageAccuracy}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">{locale['stats.averageReactionTime']}</span>
                  <span className="font-gaming text-primary-400">{stats.averageReactionTime}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">{locale['stats.bestScore']}</span>
                  <span className="font-gaming text-accent">{stats.bestScore.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-text-muted py-8">
                {locale['stats.noData']}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近成绩趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['stats.recentScores']}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-text-muted py-8">{locale['stats.loading']}</div>
            ) : stats?.recentScores && stats.recentScores.length > 0 ? (
              <div className="h-48 flex items-end gap-1">
                {stats.recentScores.map((score, index) => {
                  const maxScore = Math.max(...stats.recentScores);
                  const height = maxScore > 0 ? (score / maxScore) * 100 : 0;
                  return (
                    <div
                      key={index}
                      className="flex-1 bg-accent/30 rounded-t"
                      style={{ height: `${height}%` }}
                      title={`Score: ${score}`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-text-muted py-8">
                {locale['stats.noRecentScores']}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 任务统计 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{locale['stats.taskStatistics']}</CardTitle>
          </CardHeader>
          <CardContent>
            {taskLoading ? (
              <div className="text-center text-text-muted py-8">{locale['stats.loading']}</div>
            ) : taskStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-text-secondary text-sm border-b border-surface-600">
                      <th className="pb-3 pr-4">{locale['stats.table.task']}</th>
                      <th className="pb-3 pr-4">{locale['stats.table.sessions']}</th>
                      <th className="pb-3 pr-4">{locale['stats.table.bestScore']}</th>
                      <th className="pb-3 pr-4">{locale['stats.table.avgScore']}</th>
                      <th className="pb-3">{locale['stats.table.accuracy']}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskStats.map((ts) => {
                      const task = TRAINING_TASKS.find(t => t.id === ts.taskId);
                      return (
                        <tr key={ts.taskId} className="border-b border-surface-700 last:border-0">
                          <td className="py-3 pr-4">
                            <span className="font-gaming text-text-primary">{task?.name || ts.taskId}</span>
                          </td>
                          <td className="py-3 pr-4 text-text-secondary">{ts.sessions}</td>
                          <td className="py-3 pr-4 font-gaming text-accent">{ts.bestScore.toLocaleString()}</td>
                          <td className="py-3 pr-4 font-gaming text-text-primary">{ts.averageScore.toLocaleString()}</td>
                          <td className="py-3">
                            <Badge variant={ts.averageAccuracy >= 80 ? 'success' : ts.averageAccuracy >= 60 ? 'warning' : 'danger'}>
                              {ts.averageAccuracy}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-text-muted py-8">
                {locale['stats.noTaskData']}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
