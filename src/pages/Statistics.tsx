import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useStatistics, useTaskStats } from '@/hooks/useStatistics';
import { TRAINING_TASKS } from '@/types/training';

export function Statistics() {
  const [selectedTask, setSelectedTask] = useState<string | undefined>();
  const { stats, loading, refresh } = useStatistics(selectedTask);
  const { taskStats, loading: taskLoading } = useTaskStats();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-gaming text-text-primary">Statistics</h1>
        <Button variant="ghost" size="sm" onClick={refresh}>
          Refresh
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
          All Tasks
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
            <div className="text-sm text-text-secondary mb-2">Total Sessions</div>
            <div className="text-4xl font-gaming text-text-primary">
              {loading ? '-' : stats?.totalSessions || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-6">
            <div className="text-sm text-text-secondary mb-2">Best Score</div>
            <div className="text-4xl font-gaming text-accent">
              {loading ? '-' : stats?.bestScore?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-6">
            <div className="text-sm text-text-secondary mb-2">Average Score</div>
            <div className="text-4xl font-gaming text-text-primary">
              {loading ? '-' : stats?.averageScore?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-6">
            <div className="text-sm text-text-secondary mb-2">Trend</div>
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
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-text-muted py-8">Loading...</div>
            ) : stats ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Average Accuracy</span>
                  <span className="font-gaming text-success">{stats.averageAccuracy}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Average Reaction Time</span>
                  <span className="font-gaming text-primary-400">{stats.averageReactionTime}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Best Score</span>
                  <span className="font-gaming text-accent">{stats.bestScore.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-text-muted py-8">
                No data available. Start training to see your stats!
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近成绩趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-text-muted py-8">Loading...</div>
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
                No recent scores
              </div>
            )}
          </CardContent>
        </Card>

        {/* 任务统计 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Task Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            {taskLoading ? (
              <div className="text-center text-text-muted py-8">Loading...</div>
            ) : taskStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-text-secondary text-sm border-b border-surface-600">
                      <th className="pb-3 pr-4">Task</th>
                      <th className="pb-3 pr-4">Sessions</th>
                      <th className="pb-3 pr-4">Best Score</th>
                      <th className="pb-3 pr-4">Avg Score</th>
                      <th className="pb-3">Accuracy</th>
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
                No task data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
