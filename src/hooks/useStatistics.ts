import { useState, useEffect, useCallback } from 'react';
import { trainingStorage } from '@/utils/storage';
import type { TrainingStats, TaskStats, TimeSeriesData } from '@/types/statistics';
import type { TrainingResult } from '@/types/training';

export function useStatistics(taskId?: string) {
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await trainingStorage.getRecords(taskId, 1000);

      if (records.length === 0) {
        setStats(null);
        return;
      }

      const totalSessions = records.length;
      const averageScore = records.reduce((sum, r) => sum + r.score, 0) / totalSessions;
      const bestScore = Math.max(...records.map(r => r.score));
      const averageAccuracy = records.reduce((sum, r) => sum + r.accuracy, 0) / totalSessions;
      const averageReactionTime = records.reduce((sum, r) => sum + r.reactionTime, 0) / totalSessions;

      // 计算趋势（最近 10 次 vs 之前 10 次）
      const recent = records.slice(0, 10);
      const previous = records.slice(10, 20);
      const recentAvg = recent.reduce((s, r) => s + r.score, 0) / recent.length;
      const previousAvg = previous.length > 0
        ? previous.reduce((s, r) => s + r.score, 0) / previous.length
        : recentAvg;
      const improvementTrend = previousAvg > 0
        ? ((recentAvg - previousAvg) / previousAvg) * 100
        : 0;

      setStats({
        totalSessions,
        averageScore: Math.round(averageScore),
        bestScore,
        averageAccuracy: Math.round(averageAccuracy * 10) / 10,
        averageReactionTime: Math.round(averageReactionTime),
        improvementTrend: Math.round(improvementTrend * 10) / 10,
        recentScores: recent.map(r => r.score).reverse(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, loading, error, refresh: loadStats };
}

export function useTaskStats() {
  const [taskStats, setTaskStats] = useState<TaskStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTaskStats = useCallback(async () => {
    setLoading(true);
    try {
      const records = await trainingStorage.getRecords(undefined, 10000);

      // 按任务分组统计
      const taskMap = new Map<string, TrainingResult[]>();
      records.forEach(record => {
        const existing = taskMap.get(record.taskId) || [];
        existing.push(record);
        taskMap.set(record.taskId, existing);
      });

      const stats: TaskStats[] = Array.from(taskMap.entries()).map(([taskId, taskRecords]) => ({
        taskId,
        taskName: taskId, // 可以从 TRAINING_TASKS 获取名称
        sessions: taskRecords.length,
        bestScore: Math.max(...taskRecords.map(r => r.score)),
        averageScore: Math.round(taskRecords.reduce((s, r) => s + r.score, 0) / taskRecords.length),
        averageAccuracy: Math.round(taskRecords.reduce((s, r) => s + r.accuracy, 0) / taskRecords.length * 10) / 10,
        lastPlayed: Math.max(...taskRecords.map(r => r.timestamp)),
      }));

      setTaskStats(stats.sort((a, b) => b.lastPlayed - a.lastPlayed));
    } catch (err) {
      console.error('Failed to load task stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTaskStats();
  }, [loadTaskStats]);

  return { taskStats, loading, refresh: loadTaskStats };
}

export function useTimeSeriesData(taskId?: string, days: number = 30) {
  const [data, setData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const records = await trainingStorage.getRecords(taskId, 10000);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

      const filtered = records
        .filter(r => r.timestamp > cutoff)
        .sort((a, b) => a.timestamp - b.timestamp);

      setData(filtered.map(r => ({
        timestamp: r.timestamp,
        score: r.score,
        accuracy: r.accuracy,
        reactionTime: r.reactionTime,
      })));
    } catch (err) {
      console.error('Failed to load time series data:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, refresh: loadData };
}
