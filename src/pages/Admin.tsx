import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { adminApi, type AdminUser, type AdminTask } from '@/api/admin';

type AdminTab = 'users' | 'tasks';

const TASK_TYPES = ['static-clicking', 'dynamic-clicking', 'tracking', 'target-switching', 'reaction'];

export function Admin() {
  const locale = useLocale();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<AdminTab>('users');

  // 检查权限
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-text-secondary text-lg">{locale['admin.noPermission']}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-accent text-surface-900 rounded-md font-semibold"
          >
            {locale['result.back']}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-gaming text-accent mb-6">{locale['admin.title']}</h1>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6 border-b border-surface-700 pb-2">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-t-md text-sm font-display transition-colors ${
            tab === 'users'
              ? 'bg-accent/20 text-accent border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {locale['admin.users']}
        </button>
        <button
          onClick={() => setTab('tasks')}
          className={`px-4 py-2 rounded-t-md text-sm font-display transition-colors ${
            tab === 'tasks'
              ? 'bg-accent/20 text-accent border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {locale['admin.tasks']}
        </button>
      </div>

      {tab === 'users' ? <UserManagement locale={locale} /> : <TaskManagement locale={locale} />}
    </div>
  );
}

// --------------------------------------------
// 用户管理
// --------------------------------------------
function UserManagement({ locale }: { locale: Record<string, string> }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers(page, pageSize, search);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await adminApi.updateUser(userId, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.localeCompare && !confirm(locale['admin.user.deleteConfirm'])) return;
    if (!confirm(locale['admin.user.deleteConfirm'])) return;
    try {
      await adminApi.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(prev => prev - 1);
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert((err as Error).message);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return <div className="text-center py-12 text-text-secondary">{locale['admin.loading']}</div>;
  }

  return (
    <div>
      {/* 搜索 */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={locale['admin.user.search']}
          className="w-full max-w-sm px-3 py-2 bg-surface-800 border border-surface-600 rounded-md text-text-primary text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto bg-surface-800 rounded-lg border border-surface-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700 text-text-secondary">
              <th className="px-4 py-3 text-left">{locale['admin.user.id']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.user.username']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.user.email']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.user.role']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.user.createdAt']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.user.lastLogin']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.user.actions']}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-surface-700/50 hover:bg-surface-700/30">
                <td className="px-4 py-3 text-text-secondary">{u.id}</td>
                <td className="px-4 py-3 text-text-primary font-medium">{u.username}</td>
                <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    className="bg-surface-700 border border-surface-600 rounded px-2 py-1 text-text-primary text-xs focus:outline-none focus:border-accent"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-text-secondary text-xs">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3 text-text-secondary text-xs">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/40 transition-colors"
                  >
                    {locale['admin.user.delete']}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 text-sm bg-surface-700 rounded disabled:opacity-40 text-text-primary"
          >
            {locale['stats.prev']}
          </button>
          <span className="text-sm text-text-secondary">
            {locale['stats.page'].replace('{current}', String(page)).replace('{total}', String(totalPages))}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm bg-surface-700 rounded disabled:opacity-40 text-text-primary"
          >
            {locale['stats.next']}
          </button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------
// 训练项目管理
// --------------------------------------------
function TaskManagement({ locale }: { locale: Record<string, string> }) {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getTasks();
      setTasks(data.tasks);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleDelete = async (taskId: string) => {
    if (!confirm(locale['admin.task.deleteConfirm'])) return;
    try {
      await adminApi.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleToggleActive = async (task: AdminTask) => {
    try {
      const updated = await adminApi.updateTask(task.id, { isActive: !task.isActive });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, isActive: !task.isActive } : t));
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleSave = async (taskData: Partial<AdminTask>) => {
    try {
      if (isCreating) {
        const result = await adminApi.createTask(taskData);
        setTasks(prev => [...prev, result.task]);
      } else if (editingTask) {
        const result = await adminApi.updateTask(editingTask.id, taskData);
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...result.task } : t));
      }
      setEditingTask(null);
      setIsCreating(false);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-text-secondary">{locale['admin.loading']}</div>;
  }

  // 编辑/创建表单
  if (editingTask || isCreating) {
    return (
      <TaskEditForm
        task={editingTask}
        isNew={isCreating}
        locale={locale}
        onSave={handleSave}
        onCancel={() => { setEditingTask(null); setIsCreating(false); }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-accent text-surface-900 rounded-md text-sm font-semibold hover:bg-accent-dark transition-colors"
        >
          {locale['admin.task.create']}
        </button>
      </div>

      <div className="overflow-x-auto bg-surface-800 rounded-lg border border-surface-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700 text-text-secondary">
              <th className="px-4 py-3 text-left">{locale['admin.task.id']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.task.name']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.task.nameZh']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.task.type']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.task.duration']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.task.isActive']}</th>
              <th className="px-4 py-3 text-left">{locale['admin.task.actions']}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id} className="border-b border-surface-700/50 hover:bg-surface-700/30">
                <td className="px-4 py-3 text-text-secondary font-mono text-xs">{t.id}</td>
                <td className="px-4 py-3 text-text-primary font-medium">{t.name}</td>
                <td className="px-4 py-3 text-text-secondary">{t.nameZh || '-'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs rounded bg-accent/20 text-accent">
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary">{(t.duration / 1000)}s</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(t)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      t.isActive ? 'bg-green-600' : 'bg-surface-600'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      t.isActive ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => setEditingTask(t)}
                    className="px-2 py-1 text-xs bg-accent/20 text-accent rounded hover:bg-accent/40 transition-colors"
                  >
                    {locale['admin.task.edit']}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/40 transition-colors"
                  >
                    {locale['admin.task.delete']}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------
// 任务编辑表单
// --------------------------------------------
function TaskEditForm({
  task,
  isNew,
  locale,
  onSave,
  onCancel,
}: {
  task: AdminTask | null;
  isNew: boolean;
  locale: Record<string, string>;
  onSave: (data: Partial<AdminTask>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    id: task?.id || '',
    name: task?.name || '',
    nameZh: task?.nameZh || '',
    type: task?.type || 'static-clicking',
    description: task?.description || '',
    duration: task?.duration || 30000,
    targetSize: (task?.parameters?.targetSize as number) || 0.8,
    targetCount: (task?.parameters?.targetCount as number) || 3,
    targetSpeed: (task?.parameters?.targetSpeed as number) || 0,
    spawnInterval: (task?.parameters?.spawnInterval as number) || 800,
    weightAccuracy: (task?.scoring?.weightAccuracy as number) || 0.4,
    weightSpeed: (task?.scoring?.weightSpeed as number) || 0.4,
    weightConsistency: (task?.scoring?.weightConsistency as number) || 0.2,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: formData.id,
      name: formData.name,
      nameZh: formData.nameZh || null,
      type: formData.type,
      description: formData.description || null,
      duration: formData.duration,
      parameters: {
        targetSize: formData.targetSize,
        targetCount: formData.targetCount,
        targetSpeed: formData.targetSpeed,
        spawnInterval: formData.spawnInterval,
      },
      scoring: {
        weightAccuracy: formData.weightAccuracy,
        weightSpeed: formData.weightSpeed,
        weightConsistency: formData.weightConsistency,
      },
    });
  };

  const inputClass = "w-full px-3 py-2 bg-surface-700 border border-surface-600 rounded-md text-text-primary text-sm focus:outline-none focus:border-accent";
  const labelClass = "block text-sm text-text-secondary mb-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <h2 className="text-lg font-gaming text-accent mb-4">
        {isNew ? locale['admin.task.create'] : locale['admin.task.edit']}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        {/* ID */}
        <div>
          <label className={labelClass}>{locale['admin.task.id']}</label>
          <input
            type="text"
            value={formData.id}
            onChange={e => setFormData(prev => ({ ...prev, id: e.target.value }))}
            disabled={!isNew}
            className={`${inputClass} ${!isNew ? 'opacity-50' : ''}`}
            required
          />
        </div>

        {/* Type */}
        <div>
          <label className={labelClass}>{locale['admin.task.type']}</label>
          <select
            value={formData.type}
            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
            className={inputClass}
          >
            {TASK_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className={labelClass}>{locale['admin.task.name']}</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className={inputClass}
            required
          />
        </div>

        {/* NameZh */}
        <div>
          <label className={labelClass}>{locale['admin.task.nameZh']}</label>
          <input
            type="text"
            value={formData.nameZh}
            onChange={e => setFormData(prev => ({ ...prev, nameZh: e.target.value }))}
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className={labelClass}>{locale['custom.description']}</label>
          <input
            type="text"
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className={inputClass}
          />
        </div>

        {/* Duration */}
        <div>
          <label className={labelClass}>{locale['admin.task.duration']} (ms)</label>
          <input
            type="number"
            value={formData.duration}
            onChange={e => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 30000 }))}
            className={inputClass}
            min={0}
            step={1000}
          />
        </div>

        {/* Target Size */}
        <div>
          <label className={labelClass}>{locale['custom.targetSize']}</label>
          <input
            type="number"
            value={formData.targetSize}
            onChange={e => setFormData(prev => ({ ...prev, targetSize: parseFloat(e.target.value) || 0.8 }))}
            className={inputClass}
            min={0.1}
            max={5}
            step={0.1}
          />
        </div>

        {/* Target Count */}
        <div>
          <label className={labelClass}>Target Count</label>
          <input
            type="number"
            value={formData.targetCount}
            onChange={e => setFormData(prev => ({ ...prev, targetCount: parseInt(e.target.value) || 1 }))}
            className={inputClass}
            min={1}
            max={20}
          />
        </div>

        {/* Target Speed */}
        <div>
          <label className={labelClass}>{locale['custom.speed']}</label>
          <input
            type="number"
            value={formData.targetSpeed}
            onChange={e => setFormData(prev => ({ ...prev, targetSpeed: parseFloat(e.target.value) || 0 }))}
            className={inputClass}
            min={0}
            max={20}
            step={0.5}
          />
        </div>

        {/* Spawn Interval */}
        <div>
          <label className={labelClass}>{locale['custom.spawnInterval']} (ms)</label>
          <input
            type="number"
            value={formData.spawnInterval}
            onChange={e => setFormData(prev => ({ ...prev, spawnInterval: parseInt(e.target.value) || 800 }))}
            className={inputClass}
            min={0}
            step={100}
          />
        </div>

        {/* Scoring Weights */}
        <div className="col-span-2 mt-2">
          <label className="block text-sm text-text-secondary mb-2">{locale['custom.scoring']}</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-secondary">{locale['custom.weightAccuracy']}</label>
              <input
                type="number"
                value={formData.weightAccuracy}
                onChange={e => setFormData(prev => ({ ...prev, weightAccuracy: parseFloat(e.target.value) || 0 }))}
                className={inputClass}
                min={0}
                max={1}
                step={0.1}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">{locale['custom.weightSpeed']}</label>
              <input
                type="number"
                value={formData.weightSpeed}
                onChange={e => setFormData(prev => ({ ...prev, weightSpeed: parseFloat(e.target.value) || 0 }))}
                className={inputClass}
                min={0}
                max={1}
                step={0.1}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">{locale['custom.weightConsistency']}</label>
              <input
                type="number"
                value={formData.weightConsistency}
                onChange={e => setFormData(prev => ({ ...prev, weightConsistency: parseFloat(e.target.value) || 0 }))}
                className={inputClass}
                min={0}
                max={1}
                step={0.1}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 按钮 */}
      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          className="px-6 py-2 bg-accent text-surface-900 rounded-md text-sm font-semibold hover:bg-accent-dark transition-colors"
        >
          {locale['admin.task.save']}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-surface-700 text-text-primary rounded-md text-sm hover:bg-surface-600 transition-colors"
        >
          {locale['admin.task.cancel']}
        </button>
      </div>
    </form>
  );
}
