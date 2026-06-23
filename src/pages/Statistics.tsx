import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useStatistics, useTaskStats } from '@/hooks/useStatistics';
import { useTrainingConfig } from '@/hooks/useTrainingConfig';
import type { TaskType, TrainingTaskConfig } from '@/types/training';
import { useCustomTaskStore } from '@/stores/customTaskStore';
import { useLocale } from '@/hooks/useTheme';

const PAGE_SIZE = 10;

// 按 TaskType 分组预设任务
const TASK_TYPE_ORDER: TaskType[] = [
  'static-clicking',
  'dynamic-clicking',
  'tracking',
  'target-switching',
  'reaction',
];

function groupTasksByType(tasks: TrainingTaskConfig[]) {
  const groups = new Map<TaskType, TrainingTaskConfig[]>();
  for (const type of TASK_TYPE_ORDER) {
    const matched = tasks.filter(t => t.type === type);
    if (matched.length > 0) {
      groups.set(type, matched);
    }
  }
  return groups;
}

type FilterTab = 'all' | 'preset' | 'custom';

export function Statistics() {
  const [selectedTask, setSelectedTask] = useState<string | undefined>();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedType, setSelectedType] = useState<TaskType | undefined>();
  const [panelOpen, setPanelOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'preset' | 'custom'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { stats, loading, refresh } = useStatistics(selectedTask);
  const { taskStats, loading: taskLoading } = useTaskStats();
  const customTasks = useCustomTaskStore((s) => s.tasks);
  const locale = useLocale();
  const { presetTasks } = useTrainingConfig();

  // 构建任务名称映射
  const taskNameMap = useMemo(() => {
    const map = new Map<string, string>();
    presetTasks.forEach(t => {
      map.set(t.id, locale[`task.${t.id}` as keyof typeof locale] || t.name);
    });
    customTasks.forEach(t => {
      map.set(t.id, t.name);
    });
    return map;
  }, [customTasks, locale]);

  // 预设任务按类型分组
  const presetGroups = useMemo(() => groupTasksByType(presetTasks), [presetTasks]);

  // 自定义任务按类型分组
  const customGroups = useMemo(() => {
    const groups = new Map<TaskType, typeof customTasks>();
    for (const type of TASK_TYPE_ORDER) {
      const matched = customTasks.filter(t => t.category === type);
      if (matched.length > 0) {
        groups.set(type, matched);
      }
    }
    return groups;
  }, [customTasks]);

  // 分类筛选后的任务统计（用于底部表格）
  const filteredTaskStats = useMemo(() => {
    if (categoryFilter === 'all') return taskStats;
    const presetIds = new Set(presetTasks.map(t => t.id));
    return taskStats.filter(ts => {
      const isPreset = presetIds.has(ts.taskId);
      return categoryFilter === 'preset' ? isPreset : !isPreset;
    });
  }, [taskStats, categoryFilter]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredTaskStats.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedTaskStats = filteredTaskStats.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getDisplayName = (taskId: string) => taskNameMap.get(taskId) || taskId;

  const getTypeLabel = (type: TaskType) =>
    locale[`taskType.${type}` as keyof typeof locale] || type;

  // 当前 tab 下可用的类型列表
  const availableTypes = useMemo(() => {
    if (filterTab === 'all') return [];
    if (filterTab === 'preset') {
      return TASK_TYPE_ORDER.filter(type => {
        const tasks = presetGroups.get(type);
        return tasks && tasks.length > 0;
      });
    }
    return TASK_TYPE_ORDER.filter(type => {
      const tasks = customGroups.get(type);
      return tasks && tasks.length > 0;
    });
  }, [filterTab, presetGroups, customGroups]);

  // 当前选中类型下的任务列表
  const tasksForSelectedType = useMemo(() => {
    if (!selectedType) return [];
    if (filterTab === 'preset') {
      return presetGroups.get(selectedType) || [];
    }
    if (filterTab === 'custom') {
      return (customGroups.get(selectedType) || []) as Array<{ id: string; name: string }>;
    }
    return [];
  }, [filterTab, selectedType, presetGroups, customGroups]);

  // 处理任务选择 — 选中后折叠面板
  const handleSelectTask = (taskId: string | undefined) => {
    setSelectedTask(taskId);
    setPanelOpen(false);
  };

  // 切换 tab — 展开面板并重置下级
  const handleTabChange = (tab: FilterTab) => {
    setFilterTab(tab);
    setSelectedType(undefined);
    setSelectedTask(undefined);
    setPanelOpen(tab !== 'all');
  };

  // 切换类型 — 保持面板展开，重置任务
  const handleTypeChange = (type: TaskType) => {
    setSelectedType(type);
    setSelectedTask(undefined);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-gaming text-text-primary">{locale['stats.title']}</h1>
        <Button variant="ghost" size="sm" onClick={refresh}>
          {locale['stats.refresh']}
        </Button>
      </div>

      {/* 任务筛选 */}
      <Card className="mb-8">
        <CardContent className="p-4 space-y-4">
          {/* 第一行: 全部任务 + 预设下拉 + 自定义下拉 */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* 全部任务按钮 */}
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterTab === 'all'
                  ? 'bg-accent text-surface-900 shadow-lg shadow-accent/20'
                  : 'bg-surface-700 text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => handleTabChange('all')}
            >
              {locale['stats.filter.allTasks' as keyof typeof locale]}
            </button>

            <span className="w-px h-6 bg-surface-600" />

            {/* 预设训练内容 - 下拉选择栏 */}
            <div className="relative">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 ${
                  filterTab === 'preset'
                    ? 'bg-accent text-surface-900 shadow-lg shadow-accent/20'
                    : 'bg-surface-700 text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => {
                  if (filterTab === 'preset') {
                    setPanelOpen(!panelOpen);
                  } else {
                    handleTabChange('preset');
                  }
                }}>
                {locale['stats.filter.presetTasks' as keyof typeof locale]}
                <svg
                  className={`w-4 h-4 transition-transform ${filterTab === 'preset' && panelOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* 自定义训练内容 - 下拉选择栏 */}
            <div className="relative">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 ${
                  filterTab === 'custom'
                    ? 'bg-accent text-surface-900 shadow-lg shadow-accent/20'
                    : 'bg-surface-700 text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => {
                  if (filterTab === 'custom') {
                    setPanelOpen(!panelOpen);
                  } else {
                    handleTabChange('custom');
                  }
                }}>
                {locale['stats.filter.customTasks' as keyof typeof locale]}
                <svg
                  className={`w-4 h-4 transition-transform ${filterTab === 'custom' && panelOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* 下拉展开面板 */}
          {filterTab !== 'all' && panelOpen && (
            <div className="rounded-xl border border-surface-500 bg-surface-800/40 p-4 space-y-3">
              {/* 类型横向选择栏 */}
              {availableTypes.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-text-muted mr-2 shrink-0">
                    {locale[`stats.filter.${filterTab}Tasks` as keyof typeof locale]} &raquo;
                  </span>
                  {availableTypes.map((type) => (
                    <button
                      key={type}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedType === type
                          ? 'bg-accent text-surface-900 shadow shadow-accent/20'
                          : 'bg-surface-700 text-text-secondary hover:text-text-primary hover:bg-surface-600'
                      }`}
                      onClick={() => handleTypeChange(type)}
                    >
                      {getTypeLabel(type)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-text-muted">
                  {locale['stats.filter.noCustomTasks' as keyof typeof locale]}
                </div>
              )}

              {/* 具体任务横向选择栏 */}
              {selectedType && tasksForSelectedType.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap border-t border-surface-600 pt-3">
                  <span className="text-xs text-text-muted mr-2 shrink-0">
                    {getTypeLabel(selectedType)} &raquo;
                  </span>
                  {tasksForSelectedType.map((task) => (
                    <button
                      key={task.id}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedTask === task.id
                          ? 'bg-accent text-surface-900 shadow shadow-accent/20'
                          : 'bg-surface-600 text-text-secondary hover:text-text-primary hover:bg-surface-500'
                      }`}
                      onClick={() => handleSelectTask(task.id)}
                    >
                      {locale[`task.${task.id}` as keyof typeof locale] || task.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 当前选中摘要（折叠时显示，点击可重新展开） */}
          {!panelOpen && selectedTask && (
            <button
              className="flex items-center gap-2 text-sm pt-2 border-t border-surface-600 w-full hover:bg-surface-700/30 rounded-lg px-2 py-1 -mx-2 transition-colors"
              onClick={() => setPanelOpen(true)}
            >
              <span className="text-text-muted">{locale['stats.currentFilter' as keyof typeof locale] || 'Filter'}:</span>
              <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-medium">
                {filterTab === 'preset'
                  ? locale['stats.filter.presetTasks' as keyof typeof locale]
                  : locale['stats.filter.customTasks' as keyof typeof locale]}
              </span>
              {selectedType && (
                <>
                  <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-medium">
                    {getTypeLabel(selectedType)}
                  </span>
                </>
              )}
              <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-medium">
                {getDisplayName(selectedTask)}
              </span>
              <svg className="w-3.5 h-3.5 text-text-muted ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </CardContent>
      </Card>

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
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>{locale['stats.taskStatistics']}</CardTitle>
              {/* 分类筛选 */}
              <div className="flex gap-1">
                {(['all', 'preset', 'custom'] as const).map((cat) => (
                  <button
                    key={cat}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      categoryFilter === cat
                        ? 'bg-accent text-surface-900'
                        : 'bg-surface-700 text-text-secondary hover:text-text-primary'
                    }`}
                    onClick={() => { setCategoryFilter(cat); setCurrentPage(1); }}
                  >
                    {locale[`stats.category.${cat}` as keyof typeof locale]}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {taskLoading ? (
              <div className="text-center text-text-muted py-8">{locale['stats.loading']}</div>
            ) : filteredTaskStats.length > 0 ? (
              <>
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
                      {pagedTaskStats.map((ts) => (
                        <tr key={ts.taskId} className="border-b border-surface-700 last:border-0">
                          <td className="py-3 pr-4">
                            <span className="font-gaming text-text-primary">{getDisplayName(ts.taskId)}</span>
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
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-600">
                    <span className="text-sm text-text-muted">
                      {locale['stats.page']
                        .replace('{current}', String(safePage))
                        .replace('{total}', String(totalPages))}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      >
                        {locale['stats.prev']}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      >
                        {locale['stats.next']}
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
