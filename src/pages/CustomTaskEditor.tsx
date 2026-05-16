import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/hooks/useTheme';
import { useCustomTaskStore } from '@/stores/customTaskStore';
import { encodeShareCode, decodeShareCode, formatShareCode } from '@/utils/shareCode';
import type {
  SceneConfig,
  MovementType,
  TaskCategory,
  ScoringWeights,
} from '@/types/customTask';
import { createDefaultSceneConfig } from '@/types/customTask';

// 各训练类型的默认配置
const TYPE_DEFAULTS: Record<TaskCategory, {
  movement: MovementType;
  spawnMode: 'interval' | 'continuous';
  maxActive: number;
  interval: number;
  lifetime: number;
  speed: number;
  scoring: ScoringWeights;
}> = {
  'static-clicking': {
    movement: 'static',
    spawnMode: 'interval',
    maxActive: 3,
    interval: 800,
    lifetime: 0,
    speed: 0,
    scoring: { weightAccuracy: 0.4, weightSpeed: 0.4, weightConsistency: 0.2 },
  },
  'dynamic-clicking': {
    movement: 'linear',
    spawnMode: 'interval',
    maxActive: 3,
    interval: 800,
    lifetime: 0,
    speed: 3,
    scoring: { weightAccuracy: 0.3, weightSpeed: 0.5, weightConsistency: 0.2 },
  },
  'tracking': {
    movement: 'circular',
    spawnMode: 'continuous',
    maxActive: 1,
    interval: 0,
    lifetime: 0,
    speed: 3,
    scoring: { weightAccuracy: 0.6, weightSpeed: 0.1, weightConsistency: 0.3 },
  },
  'target-switching': {
    movement: 'static',
    spawnMode: 'interval',
    maxActive: 5,
    interval: 500,
    lifetime: 0,
    speed: 0,
    scoring: { weightAccuracy: 0.3, weightSpeed: 0.5, weightConsistency: 0.2 },
  },
  'reaction': {
    movement: 'static',
    spawnMode: 'interval',
    maxActive: 1,
    interval: 2000,
    lifetime: 1500,
    speed: 0,
    scoring: { weightAccuracy: 0.3, weightSpeed: 0.6, weightConsistency: 0.1 },
  },
};

// 轨迹形状选项（用于动态点击和跟踪训练）
const TRACK_MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: 'circular', label: '圆形' },
  { value: 'sine', label: '正弦' },
  { value: 'figure8', label: '8字' },
  { value: 'linear', label: '线性' },
  { value: 'random', label: '随机' },
];

export function CustomTaskEditor() {
  const navigate = useNavigate();
  const locale = useLocale();
  const { addTask, importFromShareCode } = useCustomTaskStore();
  const configRef = useRef<SceneConfig>(createDefaultSceneConfig());

  const TASK_CATEGORIES: { value: TaskCategory; label: string }[] = [
    { value: 'static-clicking', label: locale['taskType.static-clicking'] },
    { value: 'dynamic-clicking', label: locale['taskType.dynamic-clicking'] },
    { value: 'tracking', label: locale['taskType.tracking'] },
    { value: 'target-switching', label: locale['taskType.target-switching'] },
    { value: 'reaction', label: locale['taskType.reaction'] },
  ];

  const DURATION_OPTIONS = [
    { value: 30000, label: locale['training.duration.30s'] },
    { value: 45000, label: locale['training.duration.45s'] },
    { value: 60000, label: locale['training.duration.60s'] },
    { value: 0, label: locale['training.duration.unlimited'] },
  ];

  const [config, setConfig] = useState<SceneConfig>(createDefaultSceneConfig());
  configRef.current = config;
  const [importCode, setImportCode] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'import'>('create');

  // 切换训练类型时，自动应用该类型的默认配置
  const handleCategoryChange = useCallback((category: TaskCategory) => {
    const defaults = TYPE_DEFAULTS[category];
    setConfig(prev => ({
      ...prev,
      category,
      movement: {
        ...prev.movement,
        type: defaults.movement,
        speed: defaults.speed,
        randomness: category === 'tracking' ? 0 : undefined,
      },
      spawn: {
        ...prev.spawn,
        mode: defaults.spawnMode,
        maxActive: defaults.maxActive,
        interval: defaults.interval,
        lifetime: defaults.lifetime,
      },
      scoring: { ...defaults.scoring },
    }));
  }, []);

  const updateConfig = useCallback((updates: Partial<SceneConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const updateTarget = useCallback((updates: Partial<SceneConfig['target']>) => {
    setConfig(prev => ({
      ...prev,
      target: { ...prev.target, ...updates },
    }));
  }, []);

  const updateMovement = useCallback((updates: Partial<SceneConfig['movement']>) => {
    setConfig(prev => ({
      ...prev,
      movement: { ...prev.movement, ...updates },
    }));
  }, []);

  const updateSpawn = useCallback((updates: Partial<SceneConfig['spawn']>) => {
    setConfig(prev => ({
      ...prev,
      spawn: { ...prev.spawn, ...updates },
    }));
  }, []);

  const updateScoring = useCallback((updates: Partial<SceneConfig['scoring']>) => {
    setConfig(prev => ({
      ...prev,
      scoring: { ...prev.scoring, ...updates },
    }));
  }, []);

  const handleGenerateCode = useCallback(() => {
    const code = encodeShareCode(configRef.current);
    setShareCode(code);
    setCopied(false);
  }, []);

  const handleCopyCode = useCallback(() => {
    if (shareCode) {
      navigator.clipboard.writeText(shareCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [shareCode]);

  const handleSave = useCallback(() => {
    if (!config.name.trim()) return;
    const task = addTask(config);
    const code = encodeShareCode(config);
    setShareCode(code);
    navigate(`/training?custom=${task.id}`);
  }, [config, addTask, navigate]);

  const handleImport = useCallback(() => {
    setImportError('');
    if (!importCode.trim()) {
      setImportError(locale['custom.importError.empty']);
      return;
    }

    const decoded = decodeShareCode(importCode.trim());
    if (!decoded) {
      setImportError(locale['custom.importError.invalid']);
      return;
    }

    const task = importFromShareCode(importCode.trim());
    if (task) {
      navigate(`/training?custom=${task.id}`);
    } else {
      setImportError(locale['custom.importError.failed']);
    }
  }, [importCode, importFromShareCode, navigate]);

  const handleReset = useCallback(() => {
    setConfig(createDefaultSceneConfig());
    setShareCode('');
    setCopied(false);
  }, []);

  // 样式常量
  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface-hover)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: 'var(--color-text-primary)',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '6px',
    color: 'var(--color-text-secondary)',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none' as const,
    cursor: 'pointer',
    paddingRight: '32px',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23666' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  };

  const category = config.category;

  // 渲染各类型专属参数
  const renderTypeParams = () => {
    switch (category) {
      case 'static-clicking':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{locale['taskType.static-clicking']}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label style={labelStyle}>{locale['custom.targetSize'] || '大小'}: {config.target.size.toFixed(1)}</label>
                <input type="range" min="0.3" max="2.0" step="0.1" value={config.target.size}
                  onChange={(e) => updateTarget({ size: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.maxActive'] || '数量'}: {config.spawn.maxActive}</label>
                <input type="range" min="1" max="10" step="1" value={config.spawn.maxActive}
                  onChange={(e) => updateSpawn({ maxActive: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>{locale['custom.gridRows'] || '网格行数'}: {config.display?.rows ?? 3}</label>
                  <input type="range" min="1" max="10" step="1" value={config.display?.rows ?? 3}
                    onChange={(e) => setConfig(prev => ({ ...prev, display: { ...prev.display!, rows: parseInt(e.target.value) } }))}
                    className="w-full" style={{ accentColor: '#2563EB' }} />
                </div>
                <div>
                  <label style={labelStyle}>{locale['custom.gridCols'] || '网格列数'}: {config.display?.cols ?? 5}</label>
                  <input type="range" min="1" max="20" step="1" value={config.display?.cols ?? 5}
                    onChange={(e) => setConfig(prev => ({ ...prev, display: { ...prev.display!, cols: parseInt(e.target.value) } }))}
                    className="w-full" style={{ accentColor: '#2563EB' }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.lifetime'] || '存活时间'}: {config.spawn.lifetime === 0 ? locale['training.duration.unlimited'] : `${config.spawn.lifetime}ms`}</label>
                <input type="range" min="0" max="5000" step="100" value={config.spawn.lifetime}
                  onChange={(e) => updateSpawn({ lifetime: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
            </CardContent>
          </Card>
        );

      case 'dynamic-clicking':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{locale['taskType.dynamic-clicking']}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label style={labelStyle}>{locale['custom.targetSize'] || '大小'}: {config.target.size.toFixed(1)}</label>
                <input type="range" min="0.3" max="2.0" step="0.1" value={config.target.size}
                  onChange={(e) => updateTarget({ size: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.speed'] || '速度'}: {config.movement.speed.toFixed(1)}</label>
                <input type="range" min="1" max="10" step="0.5" value={config.movement.speed}
                  onChange={(e) => updateMovement({ speed: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.movementType'] || '轨迹'}</label>
                <div className="flex flex-wrap gap-2">
                  {TRACK_MOVEMENT_TYPES.filter(mt => mt.value !== 'static').map(mt => (
                    <button key={mt.value} onClick={() => updateMovement({ type: mt.value })}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        backgroundColor: config.movement.type === mt.value ? 'rgba(37, 99, 235, 0.15)' : 'var(--color-bg-surface-hover)',
                        color: config.movement.type === mt.value ? '#2563EB' : 'var(--color-text-secondary)',
                        border: config.movement.type === mt.value ? '2px solid #2563EB' : '1px solid var(--color-border)',
                      }}>
                      {mt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.lifetime'] || '存活时间'}: {config.spawn.lifetime === 0 ? locale['training.duration.unlimited'] : `${config.spawn.lifetime}ms`}</label>
                <input type="range" min="0" max="5000" step="100" value={config.spawn.lifetime}
                  onChange={(e) => updateSpawn({ lifetime: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
            </CardContent>
          </Card>
        );

      case 'tracking':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{locale['taskType.tracking']}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label style={labelStyle}>{locale['custom.targetSize'] || '大小'}: {config.target.size.toFixed(1)}</label>
                <input type="range" min="0.3" max="2.0" step="0.1" value={config.target.size}
                  onChange={(e) => updateTarget({ size: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.speed'] || '速度'}: {config.movement.speed.toFixed(1)}</label>
                <input type="range" min="1" max="10" step="0.5" value={config.movement.speed}
                  onChange={(e) => updateMovement({ speed: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.movementType'] || '轨迹形状'}</label>
                <div className="flex flex-wrap gap-2">
                  {TRACK_MOVEMENT_TYPES.filter(mt => mt.value !== 'static').map(mt => (
                    <button key={mt.value} onClick={() => updateMovement({ type: mt.value })}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        backgroundColor: config.movement.type === mt.value ? 'rgba(37, 99, 235, 0.15)' : 'var(--color-bg-surface-hover)',
                        color: config.movement.type === mt.value ? '#2563EB' : 'var(--color-text-secondary)',
                        border: config.movement.type === mt.value ? '2px solid #2563EB' : '1px solid var(--color-border)',
                      }}>
                      {mt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.randomness'] || '随机度'}: {config.movement.randomness ?? 0}%</label>
                <input type="range" min="0" max="100" step="5" value={config.movement.randomness ?? 0}
                  onChange={(e) => updateMovement({ randomness: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
            </CardContent>
          </Card>
        );

      case 'target-switching':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{locale['taskType.target-switching']}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label style={labelStyle}>{locale['custom.targetSize'] || '大小'}: {config.target.size.toFixed(1)}</label>
                <input type="range" min="0.3" max="2.0" step="0.1" value={config.target.size}
                  onChange={(e) => updateTarget({ size: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.maxActive'] || '数量'}: {config.spawn.maxActive}</label>
                <input type="range" min="1" max="10" step="1" value={config.spawn.maxActive}
                  onChange={(e) => updateSpawn({ maxActive: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>{locale['custom.gridRows'] || '网格行数'}: {config.display?.rows ?? 3}</label>
                  <input type="range" min="1" max="10" step="1" value={config.display?.rows ?? 3}
                    onChange={(e) => setConfig(prev => ({ ...prev, display: { ...prev.display!, rows: parseInt(e.target.value) } }))}
                    className="w-full" style={{ accentColor: '#2563EB' }} />
                </div>
                <div>
                  <label style={labelStyle}>{locale['custom.gridCols'] || '网格列数'}: {config.display?.cols ?? 5}</label>
                  <input type="range" min="1" max="20" step="1" value={config.display?.cols ?? 5}
                    onChange={(e) => setConfig(prev => ({ ...prev, display: { ...prev.display!, cols: parseInt(e.target.value) } }))}
                    className="w-full" style={{ accentColor: '#2563EB' }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.movementType'] || '移动性'}</label>
                <div className="flex gap-2">
                  {[{ value: 'static', label: '静态' }, { value: 'linear', label: '移动' }].map(mt => (
                    <button key={mt.value} onClick={() => updateMovement({ type: mt.value as MovementType })}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        backgroundColor: config.movement.type === mt.value ? 'rgba(37, 99, 235, 0.15)' : 'var(--color-bg-surface-hover)',
                        color: config.movement.type === mt.value ? '#2563EB' : 'var(--color-text-secondary)',
                        border: config.movement.type === mt.value ? '2px solid #2563EB' : '1px solid var(--color-border)',
                      }}>
                      {mt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.lifetime'] || '存活时间'}: {config.spawn.lifetime === 0 ? locale['training.duration.unlimited'] : `${config.spawn.lifetime}ms`}</label>
                <input type="range" min="0" max="5000" step="100" value={config.spawn.lifetime}
                  onChange={(e) => updateSpawn({ lifetime: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
            </CardContent>
          </Card>
        );

      case 'reaction':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{locale['taskType.reaction']}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label style={labelStyle}>{locale['custom.targetSize'] || '大小'}: {config.target.size.toFixed(1)}</label>
                <input type="range" min="0.3" max="2.0" step="0.1" value={config.target.size}
                  onChange={(e) => updateTarget({ size: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.lifetime'] || '存活时间'}: {config.spawn.lifetime === 0 ? '1500ms' : `${config.spawn.lifetime}ms`}</label>
                <input type="range" min="500" max="3000" step="100" value={config.spawn.lifetime || 1500}
                  onChange={(e) => updateSpawn({ lifetime: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.spawnInterval'] || '间隔'}: {config.spawn.interval}ms</label>
                <input type="range" min="500" max="5000" step="100" value={config.spawn.interval}
                  onChange={(e) => updateSpawn({ interval: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
              <div>
                <label style={labelStyle}>{locale['custom.maxActive'] || '同时数量'}: {config.spawn.maxActive}</label>
                <input type="range" min="1" max="5" step="1" value={config.spawn.maxActive}
                  onChange={(e) => updateSpawn({ maxActive: parseInt(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-gaming text-text-primary">
          {locale['custom.title'] || 'Custom Task Editor'}
        </h1>
        <Button variant="ghost" onClick={() => navigate('/training')}>
          {locale['result.back'] || 'Back'}
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('create')}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'create' ? '#2563EB' : 'var(--color-bg-surface)',
            color: activeTab === 'create' ? '#fff' : 'var(--color-text-secondary)',
            border: activeTab === 'create' ? '1px solid #2563EB' : '1px solid var(--color-border)',
          }}
        >
          {locale['custom.create'] || 'Create Task'}
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'import' ? '#2563EB' : 'var(--color-bg-surface)',
            color: activeTab === 'import' ? '#fff' : 'var(--color-text-secondary)',
            border: activeTab === 'import' ? '1px solid #2563EB' : '1px solid var(--color-border)',
          }}
        >
          {locale['custom.import'] || 'Import from Code'}
        </button>
      </div>

      {activeTab === 'import' ? (
        /* Import Section */
        <Card>
          <CardHeader>
            <CardTitle>{locale['custom.importTitle'] || 'Import Task from Share Code'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label style={labelStyle}>
                  {locale['custom.shareCode'] || 'Share Code'}
                </label>
                <input
                  type="text"
                  value={importCode}
                  onChange={(e) => {
                    setImportCode(e.target.value);
                    setImportError('');
                  }}
                  placeholder={locale['custom.shareCodePlaceholder'] || 'Enter share code'}
                  style={inputStyle}
                />
                {importError && (
                  <p className="text-sm mt-2" style={{ color: '#ef4444' }}>{importError}</p>
                )}
              </div>
              <Button variant="primary" onClick={handleImport}>
                {locale['custom.importButton'] || 'Import & Start'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Create Section */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Config Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>{locale['custom.basicInfo'] || 'Basic Info'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label style={labelStyle}>{locale['custom.taskName'] || 'Task Name'}</label>
                  <input type="text" value={config.name}
                    onChange={(e) => updateConfig({ name: e.target.value })}
                    placeholder="My Custom Task" style={inputStyle} maxLength={32} />
                </div>
                <div>
                  <label style={labelStyle}>{locale['custom.description'] || 'Description'}</label>
                  <input type="text" value={config.description}
                    onChange={(e) => updateConfig({ description: e.target.value })}
                    placeholder={locale['custom.descPlaceholder'] || 'Optional description'} style={inputStyle} maxLength={200} />
                </div>
                <div>
                  <label style={labelStyle}>{locale['custom.category'] || 'Training Type'}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TASK_CATEGORIES.map(cat => (
                      <button key={cat.value} onClick={() => handleCategoryChange(cat.value)}
                        className="px-3 py-2 rounded-lg text-sm transition-all"
                        style={{
                          backgroundColor: config.category === cat.value ? 'rgba(37, 99, 235, 0.15)' : 'var(--color-bg-surface-hover)',
                          color: config.category === cat.value ? '#2563EB' : 'var(--color-text-secondary)',
                          border: config.category === cat.value ? '2px solid #2563EB' : '1px solid var(--color-border)',
                          fontWeight: config.category === cat.value ? 700 : 500,
                        }}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{locale['training.duration'] || 'Duration'}</label>
                  <select value={config.duration ?? 30000}
                    onChange={(e) => updateConfig({ duration: parseInt(e.target.value) })} style={selectStyle}>
                    {DURATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Type-specific parameters */}
            {renderTypeParams()}

            {/* Scoring Weights */}
            <Card>
              <CardHeader>
                <CardTitle>{locale['custom.scoring'] || 'Scoring Weights'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label style={labelStyle}>
                    {locale['custom.weightAccuracy'] || 'Accuracy Weight'}: {Math.round(config.scoring.weightAccuracy * 100)}%
                  </label>
                  <input type="range" min="0" max="1" step="0.05" value={config.scoring.weightAccuracy}
                    onChange={(e) => updateScoring({ weightAccuracy: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
                </div>
                <div>
                  <label style={labelStyle}>
                    {locale['custom.weightSpeed'] || 'Speed Weight'}: {Math.round(config.scoring.weightSpeed * 100)}%
                  </label>
                  <input type="range" min="0" max="1" step="0.05" value={config.scoring.weightSpeed}
                    onChange={(e) => updateScoring({ weightSpeed: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
                </div>
                <div>
                  <label style={labelStyle}>
                    {locale['custom.weightConsistency'] || 'Consistency Weight'}: {Math.round(config.scoring.weightConsistency * 100)}%
                  </label>
                  <input type="range" min="0" max="1" step="0.05" value={config.scoring.weightConsistency}
                    onChange={(e) => updateScoring({ weightConsistency: parseFloat(e.target.value) })} className="w-full" style={{ accentColor: '#2563EB' }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview & Actions */}
          <div className="space-y-6">
            {/* Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle>{locale['custom.preview'] || 'Preview'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="text-text-muted">{locale['custom.preview.name']}: </span>
                  <span className="text-text-primary font-medium">{config.name || locale['custom.preview.untitled']}</span>
                </div>
                <div className="text-sm">
                  <span className="text-text-muted">{locale['custom.preview.category']}: </span>
                  <span className="text-text-primary">{locale[`taskType.${config.category}` as keyof typeof locale] || config.category}</span>
                </div>
                <div className="text-sm">
                  <span className="text-text-muted">{locale['custom.preview.movement']}: </span>
                  <span className="text-text-primary">{config.movement.type}</span>
                </div>
                <div className="text-sm">
                  <span className="text-text-muted">{locale['custom.preview.targets']}: </span>
                  <span className="text-text-primary">{config.spawn.maxActive} {locale['custom.preview.active']}</span>
                </div>
                <div className="text-sm">
                  <span className="text-text-muted">{locale['custom.preview.duration']}: </span>
                  <span className="text-text-primary">
                    {config.duration === 0 ? locale['training.duration.unlimited'] : `${config.duration / 1000}s`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-muted">{locale['custom.preview.color']}: </span>
                  <span className="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: config.target.color, border: '1px solid var(--color-border)' }} />
                  <span className="text-text-primary">{config.target.color}</span>
                </div>
              </CardContent>
            </Card>

            {/* Share Code Card */}
            <Card>
              <CardHeader>
                <CardTitle>{locale['custom.shareCode'] || 'Share Code'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="secondary" className="w-full" onClick={handleGenerateCode}>
                  {locale['custom.generateCode'] || 'Generate Code'}
                </Button>
                {shareCode && (
                  <>
                    <div className="py-3 px-4 rounded-lg font-mono text-xs break-all"
                      style={{ backgroundColor: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', color: '#2563EB', wordBreak: 'break-all' }}>
                      {formatShareCode(shareCode)}
                    </div>
                    <Button variant="ghost" className="w-full" onClick={handleCopyCode}>
                      {copied ? (locale['custom.copied'] || 'Copied!') : (locale['custom.copyCode'] || 'Copy Code')}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardContent className="space-y-3">
                <Button variant="primary" className="w-full" onClick={handleSave} disabled={!config.name.trim()}>
                  {locale['custom.saveAndStart'] || 'Save & Start Training'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={handleReset}>
                  {locale['custom.reset'] || 'Reset to Default'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
