import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAdminConfigStore } from '@/stores/adminConfigStore';
import { useLocale } from '@/hooks/useTheme';
import { downloadConfigFiles, copyToClipboard, generatePresetTasksSource, generateHotTasksSource } from '@/utils/adminPublish';
import type { TrainingTaskConfig, TaskType } from '@/types/training';
import { useTrainingConfig } from '@/hooks/useTrainingConfig';

type AdminTab = 'tasks' | 'hot' | 'publish';

const TASK_TYPES: TaskType[] = ['static-clicking', 'dynamic-clicking', 'tracking', 'target-switching', 'reaction'];

function PasswordGate() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordHash = useAdminConfigStore((s) => s.passwordHash);
  const setPassword = useAdminConfigStore((s) => s.setPassword);
  const verifyPassword = useAdminConfigStore((s) => s.verifyPassword);
  const login = useAdminConfigStore((s) => s.login);
  const locale = useLocale();

  const isFirstTime = !passwordHash;

  const handleSubmit = useCallback(async () => {
    if (input.length < 4) {
      setError(isFirstTime
        ? (locale['admin.passwordTooShort' as keyof typeof locale] || 'Password too short (min 4 chars)')
        : '');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isFirstTime) {
        await setPassword(input);
      } else {
        const ok = await verifyPassword(input);
        if (ok) {
          login();
        } else {
          setError(locale['admin.passwordWrong' as keyof typeof locale] || 'Incorrect password');
        }
      }
    } catch {
      setError(locale['admin.passwordError' as keyof typeof locale] || 'Error');
    }
    setLoading(false);
  }, [input, isFirstTime, setPassword, verifyPassword, login, locale]);

  return (
    <div className="max-w-md mx-auto mt-20">
      <Card>
        <CardContent className="p-8 text-center space-y-6">
          <div className="text-4xl">🔐</div>
          <h2 className="text-xl font-gaming text-text-primary">
            {locale['admin.title' as keyof typeof locale] || 'Admin Panel'}
          </h2>
          <p className="text-sm text-text-muted">
            {isFirstTime
              ? (locale['admin.passwordSet' as keyof typeof locale] || 'Set admin password')
              : (locale['admin.passwordVerify' as keyof typeof locale] || 'Enter password to continue')}
          </p>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={locale['admin.passwordPlaceholder' as keyof typeof locale] || 'Password'}
            className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors ${
              error ? 'border-red-500' : 'border-surface-500'
            }`}
            style={{
              backgroundColor: 'var(--color-bg-surface-hover)',
              color: 'var(--color-text-primary)',
            }}
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
            loading={loading}
          >
            {isFirstTime
              ? (locale['admin.passwordSetBtn' as keyof typeof locale] || 'Set Password')
              : (locale['admin.passwordVerifyBtn' as keyof typeof locale] || 'Verify')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- 训练任务编辑器 ----

function TaskEditor({
  task,
  onSave,
  onReset,
  onDelete,
  hasRecords,
}: {
  task: TrainingTaskConfig;
  onSave: (id: string, updates: Partial<TrainingTaskConfig>) => void;
  onReset: (id: string) => void;
  onDelete: (id: string) => void;
  hasRecords: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TrainingTaskConfig>(() => structuredClone(task));
  const locale = useLocale();

  // Sync form when task prop changes externally
  if (!open) {
    Object.assign(form, task);
  }

  const handleSave = () => {
    onSave(task.id, form);
    setOpen(false);
  };

  const handleCancel = () => {
    setForm(structuredClone(task));
    setOpen(false);
  };

  return (
    <div className="border-b border-surface-600 last:border-b-0">
      {/* Summary Row */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-surface-700/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-text-primary min-w-[120px]">{task.name}</span>
        <Badge variant="info">{locale[`taskType.${task.type}` as keyof typeof locale] || task.type}</Badge>
        <span className="text-xs text-text-muted">{task.duration / 1000}s</span>
        <svg
          className={`w-4 h-4 ml-auto text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Editor */}
      {open && (
        <div className="px-4 pb-4 space-y-3 bg-surface-800/30">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID" value={task.id} disabled />
            <Field label={locale['admin.task.name' as keyof typeof locale] || 'Name'} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label={locale['admin.task.description' as keyof typeof locale] || 'Desc (ZH)'} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            <Field label={locale['admin.task.descriptionEn' as keyof typeof locale] || 'Desc (EN)'} value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} />
            <div>
              <label className="text-xs text-text-muted">{locale['admin.task.type' as keyof typeof locale] || 'Type'}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm border border-surface-500"
                style={{ backgroundColor: 'var(--color-bg-surface-hover)', color: 'var(--color-text-primary)' }}
              >
                {TASK_TYPES.map(t => (
                  <option key={t} value={t}>{locale[`taskType.${t}` as keyof typeof locale] || t}</option>
                ))}
              </select>
            </div>
            <Field label={locale['admin.task.duration' as keyof typeof locale] || 'Duration (ms)'} value={String(form.duration)} onChange={(v) => setForm({ ...form, duration: Number(v) || 30000 })} type="number" />
          </div>

          {/* Parameters */}
          <div>
            <h4 className="text-xs font-medium text-text-muted mb-2">
              {locale['admin.task.parameters' as keyof typeof locale] || 'Parameters'}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <Field label="targetCount" value={String(form.parameters.targetCount)} onChange={(v) => setForm({ ...form, parameters: { ...form.parameters, targetCount: Number(v) || 1 } })} type="number" />
              <Field label="targetSize" value={String(form.parameters.targetSize)} onChange={(v) => setForm({ ...form, parameters: { ...form.parameters, targetSize: Number(v) || 1 } })} type="number" />
              <Field label="targetSpeed" value={String(form.parameters.targetSpeed)} onChange={(v) => setForm({ ...form, parameters: { ...form.parameters, targetSpeed: Number(v) || 0 } })} type="number" />
              <Field label="spawnInterval" value={String(form.parameters.spawnInterval)} onChange={(v) => setForm({ ...form, parameters: { ...form.parameters, spawnInterval: Number(v) || 1000 } })} type="number" />
              <Field label="minDistance" value={String(form.parameters.minDistance)} onChange={(v) => setForm({ ...form, parameters: { ...form.parameters, minDistance: Number(v) || 1 } })} type="number" />
              <Field label="maxDistance" value={String(form.parameters.maxDistance)} onChange={(v) => setForm({ ...form, parameters: { ...form.parameters, maxDistance: Number(v) || 10 } })} type="number" />
            </div>
          </div>

          {/* Scoring */}
          <div>
            <h4 className="text-xs font-medium text-text-muted mb-2">
              {locale['admin.task.scoring' as keyof typeof locale] || 'Scoring Weights'}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <Field label="weightAccuracy" value={String(form.scoring.weightAccuracy)} onChange={(v) => setForm({ ...form, scoring: { ...form.scoring, weightAccuracy: Number(v) || 0 } })} type="number" />
              <Field label="weightSpeed" value={String(form.scoring.weightSpeed)} onChange={(v) => setForm({ ...form, scoring: { ...form.scoring, weightSpeed: Number(v) || 0 } })} type="number" />
              <Field label="weightConsistency" value={String(form.scoring.weightConsistency)} onChange={(v) => setForm({ ...form, scoring: { ...form.scoring, weightConsistency: Number(v) || 0 } })} type="number" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-surface-600">
            <Button variant="primary" size="sm" onClick={handleSave}>
              {locale['admin.task.save' as keyof typeof locale] || 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              {locale['admin.task.cancel' as keyof typeof locale] || 'Cancel'}
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => onReset(task.id)}>
              {locale['admin.task.resetDefault' as keyof typeof locale] || 'Reset to Default'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (hasRecords) {
                  const msg = locale['admin.task.deleteHasRecords' as keyof typeof locale] || 'This task has training records. Delete anyway?';
                  if (!window.confirm(msg)) return;
                }
                onDelete(task.id);
              }}
            >
              {locale['admin.task.delete' as keyof typeof locale] || 'Delete'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-text-muted">{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        className="w-full mt-1 px-3 py-2 rounded-lg text-sm border border-surface-500 disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-bg-surface-hover)', color: 'var(--color-text-primary)' }}
      />
    </div>
  );
}

// ---- 主管理页面 ----

export function Admin() {
  const [tab, setTab] = useState<AdminTab>('tasks');
  const [createMode, setCreateMode] = useState(false);
  const [clipboardMsg, setClipboardMsg] = useState('');
  const locale = useLocale();

  const isAuthenticated = useAdminConfigStore((s) => s.isAuthenticated);
  const logout = useAdminConfigStore((s) => s.logout);
  const presetTasks = useAdminConfigStore((s) => s.presetTasks);
  const hotTaskIds = useAdminConfigStore((s) => s.hotTaskIds);
  const updateTask = useAdminConfigStore((s) => s.updateTask);
  const resetTask = useAdminConfigStore((s) => s.resetTask);
  const resetAllTasks = useAdminConfigStore((s) => s.resetAllTasks);
  const addTask = useAdminConfigStore((s) => s.addTask);
  const removeTask = useAdminConfigStore((s) => s.removeTask);
  const toggleHotTask = useAdminConfigStore((s) => s.toggleHotTask);
  const moveHotTaskUp = useAdminConfigStore((s) => s.moveHotTaskUp);
  const moveHotTaskDown = useAdminConfigStore((s) => s.moveHotTaskDown);

  // 必须放在 early return 之前——hooks 不能在条件分支后调用
  const { hotTasks } = useTrainingConfig();

  if (!isAuthenticated) return <PasswordGate />;

  const tabLabel = (key: AdminTab) => locale[`admin.tab.${key}` as keyof typeof locale] || key;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-gaming text-text-primary">
          {locale['admin.title' as keyof typeof locale] || 'Admin Panel'}
        </h1>
        <Button variant="ghost" size="sm" onClick={logout}>
          {locale['admin.logout' as keyof typeof locale] || 'Exit'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['tasks', 'hot', 'publish'] as const).map((key) => (
          <button
            key={key}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-accent text-surface-900'
                : 'bg-surface-700 text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setTab(key)}
          >
            {tabLabel(key)}
          </button>
        ))}
      </div>

      {/* Tab: Tasks */}
      {tab === 'tasks' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{locale['admin.tab.tasks' as keyof typeof locale] || 'Training Tasks'}</CardTitle>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCreateMode(!createMode)}>
                  + {locale['admin.task.create' as keyof typeof locale] || 'Create'}
                </Button>
                <Button variant="ghost" size="sm" onClick={resetAllTasks}>
                  {locale['admin.task.resetAll' as keyof typeof locale] || 'Reset All'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Create new task form */}
            {createMode && (
              <CreateTaskForm
                locale={locale}
                onSave={(task) => { addTask(task); setCreateMode(false); }}
                onCancel={() => setCreateMode(false)}
              />
            )}

            {presetTasks.map((task) => (
              <TaskEditor
                key={task.id}
                task={task}
                onSave={updateTask}
                onReset={resetTask}
                onDelete={removeTask}
                hasRecords={false}
              />
            ))}
            {presetTasks.length === 0 && (
              <div className="p-4 text-center text-sm text-text-muted">
                {locale['admin.task.empty' as keyof typeof locale] || 'No tasks'}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Hot Tasks */}
      {tab === 'hot' && (
        <div className="space-y-6">
          {/* Hot Tasks Manager */}
          <Card>
            <CardHeader>
              <CardTitle>{locale['admin.tab.hot' as keyof typeof locale] || 'Hot Tasks'}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-muted mb-4">
                {locale['admin.hot.desc' as keyof typeof locale] || 'Select and order tasks for the Home page.'}
              </p>
              {presetTasks.map((task) => {
                const isHot = hotTaskIds.includes(task.id);
                const hotIdx = hotTaskIds.indexOf(task.id);
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isHot ? 'bg-accent/10' : 'opacity-60'
                    }`}
                  >
                    <button
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isHot ? 'bg-accent border-accent' : 'border-surface-500'
                      }`}
                      onClick={() => toggleHotTask(task.id)}
                    >
                      {isHot && (
                        <svg className="w-3 h-3 text-surface-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm text-text-primary flex-1">{task.name}</span>
                    <Badge variant="info">{locale[`taskType.${task.type}` as keyof typeof locale]}</Badge>
                    {isHot && (
                      <>
                        <span className="text-xs text-text-muted">#{hotIdx + 1}</span>
                        <button
                          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                          disabled={hotIdx <= 0}
                          onClick={() => moveHotTaskUp(task.id)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                          disabled={hotIdx >= hotTaskIds.length - 1}
                          onClick={() => moveHotTaskDown(task.id)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Home Page Preview */}
          <Card>
            <CardHeader>
              <CardTitle>{locale['admin.hot.preview' as keyof typeof locale] || 'Home Preview'}</CardTitle>
            </CardHeader>
            <CardContent>
              {hotTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hotTasks.map((task) => (
                    <Card key={task.id} className="h-full">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-gaming text-text-primary text-sm">{task.name}</h3>
                        </div>
                        <p className="text-xs text-text-secondary line-clamp-2">{task.description}</p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                          <span>{locale[`taskType.${task.type}` as keyof typeof locale]}</span>
                          <span>·</span>
                          <span>{task.duration / 1000}s</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-text-muted text-center py-8">
                  {locale['admin.hot.empty' as keyof typeof locale] || 'No hot tasks configured'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Publish */}
      {tab === 'publish' && (
        <Card>
          <CardHeader>
            <CardTitle>{locale['admin.tab.publish' as keyof typeof locale] || 'Publish'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-300">
                ⚠ {locale['admin.publish.desc' as keyof typeof locale] || 'Publishing generates config files. Replace the files in src/config/ and push to deploy.'}
              </p>
            </div>

            {/* Change Summary */}
            <div className="p-4 rounded-lg bg-surface-800 border border-surface-600">
              <h4 className="text-sm font-medium text-text-primary mb-3">
                {locale['admin.publish.changeSummary' as keyof typeof locale] || 'Change Summary'}
              </h4>
              <div className="text-sm text-text-muted space-y-1">
                <p>{locale['admin.publish.taskCount' as keyof typeof locale]?.replace('{n}', String(presetTasks.length)) || `${presetTasks.length} tasks`}</p>
                <p>{locale['admin.publish.hotCount' as keyof typeof locale]?.replace('{n}', String(hotTaskIds.length)) || `${hotTaskIds.length} hot tasks`}</p>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong>{locale['admin.publish.step1' as keyof typeof locale] || 'Step 1'}:</strong> {locale['admin.publish.step1Desc' as keyof typeof locale] || 'Download the generated config files below'}</p>
              <p><strong>{locale['admin.publish.step2' as keyof typeof locale] || 'Step 2'}:</strong> {locale['admin.publish.step2Desc' as keyof typeof locale] || 'Replace src/config/defaultPresetTasks.ts and src/config/defaultHotTasks.ts'}</p>
              <p><strong>{locale['admin.publish.step3' as keyof typeof locale] || 'Step 3'}:</strong> {locale['admin.publish.step3Desc' as keyof typeof locale] || 'Git commit & push to main branch'}</p>
              <p><strong>{locale['admin.publish.step4' as keyof typeof locale] || 'Step 4'}:</strong> {locale['admin.publish.step4Desc' as keyof typeof locale] || 'GitHub Actions auto-deploys'}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() => downloadConfigFiles(presetTasks, hotTaskIds)}
              >
                📥 {locale['admin.publish.download' as keyof typeof locale] || 'Download Files'}
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  const tasksSrc = generatePresetTasksSource(presetTasks);
                  const hotSrc = generateHotTasksSource(hotTaskIds);
                  const ok = await copyToClipboard(`${tasksSrc}\n\n${hotSrc}`);
                  setClipboardMsg(ok
                    ? (locale['admin.publish.copied' as keyof typeof locale] || 'Copied!')
                    : (locale['admin.publish.copyFailed' as keyof typeof locale] || 'Failed to copy'));
                  setTimeout(() => setClipboardMsg(''), 3000);
                }}
              >
                📋 {clipboardMsg || (locale['admin.publish.copyClipboard' as keyof typeof locale] || 'Copy to Clipboard')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- 创建新任务表单 ----

function CreateTaskForm({
  locale,
  onSave,
  onCancel,
}: {
  locale: Record<string, string>;
  onSave: (task: TrainingTaskConfig) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TrainingTaskConfig>({
    id: 'new-task-' + Date.now(),
    name: 'New Task',
    type: 'static-clicking',
    description: '',
    descriptionEn: '',
    duration: 30000,
    parameters: {
      targetCount: 1,
      targetSize: 1,
      targetSpeed: 0,
      spawnInterval: 1000,
      minDistance: 5,
      maxDistance: 10,
    },
    scoring: {
      weightAccuracy: 0.4,
      weightSpeed: 0.4,
      weightConsistency: 0.2,
    },
  });

  return (
    <div className="p-4 border-b border-surface-600 bg-surface-800/40">
      <h4 className="text-sm font-medium text-text-primary mb-3">
        {locale['admin.task.create' as keyof typeof locale] || 'Create New Task'}
      </h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="ID" value={form.id} onChange={(v) => setForm({ ...form, id: v })} />
        <Field label={locale['admin.task.name' as keyof typeof locale] || 'Name'} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label={locale['admin.task.description' as keyof typeof locale] || 'Desc (ZH)'} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <Field label={locale['admin.task.descriptionEn' as keyof typeof locale] || 'Desc (EN)'} value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} />
        <div>
          <label className="text-xs text-text-muted">{locale['admin.task.type' as keyof typeof locale] || 'Type'}</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm border border-surface-500"
            style={{ backgroundColor: 'var(--color-bg-surface-hover)', color: 'var(--color-text-primary)' }}
          >
            {TASK_TYPES.map(t => (
              <option key={t} value={t}>{locale[`taskType.${t}` as keyof typeof locale] || t}</option>
            ))}
          </select>
        </div>
        <Field label={locale['admin.task.duration' as keyof typeof locale] || 'Duration (ms)'} value={String(form.duration)} onChange={(v) => setForm({ ...form, duration: Number(v) || 30000 })} type="number" />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={() => onSave(form)}>
          {locale['admin.task.create' as keyof typeof locale] || 'Create'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {locale['admin.task.cancel' as keyof typeof locale] || 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
