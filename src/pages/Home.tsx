import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TRAINING_TASKS } from '@/types/training';

export function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center py-16 mb-12">
        <h1 className="text-6xl font-gaming text-accent mb-4 animate-fade-in">
          AimPad
        </h1>
        <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
          Web 端专业瞄准训练平台 · 零安装 · 原生手柄支持
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/training">
            <Button size="lg" className="px-8">
              Start Training
            </Button>
          </Link>
          <Link to="/statistics">
            <Button variant="secondary" size="lg">
              View Stats
            </Button>
          </Link>
        </div>
      </section>

      {/* 特性介绍 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <Card variant="bordered" className="text-center p-6">
          <div className="text-4xl mb-4">🎮</div>
          <h3 className="text-lg font-gaming text-text-primary mb-2">原生手柄支持</h3>
          <p className="text-sm text-text-secondary">
            支持 Xbox、PlayStation、Switch Pro 等主流手柄，即插即用
          </p>
        </Card>
        <Card variant="bordered" className="text-center p-6">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-lg font-gaming text-text-primary mb-2">科学训练体系</h3>
          <p className="text-sm text-text-secondary">
            点射、跟枪、切换等多种训练模式，全面提升瞄准能力
          </p>
        </Card>
        <Card variant="bordered" className="text-center p-6">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-gaming text-text-primary mb-2">数据分析</h3>
          <p className="text-sm text-text-secondary">
            命中率、反应时间、平滑度等多维度数据分析
          </p>
        </Card>
      </section>

      {/* 热门训练 */}
      <section className="mb-16">
        <h2 className="text-2xl font-gaming text-text-primary mb-6">
          Popular Tasks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRAINING_TASKS.slice(0, 6).map((task) => (
            <Link key={task.id} to={`/training?task=${task.id}`}>
              <Card hoverable className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-gaming text-text-primary">{task.name}</h3>
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium
                    ${task.difficulty === 'beginner' ? 'bg-success/20 text-success' :
                      task.difficulty === 'intermediate' ? 'bg-warning/20 text-warning' :
                      task.difficulty === 'advanced' ? 'bg-danger/20 text-danger' :
                      'bg-primary-500/20 text-primary-400'}
                  `}>
                    {task.difficulty}
                  </span>
                </div>
                <p className="text-sm text-text-secondary">{task.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                  <span>{task.type}</span>
                  <span>·</span>
                  <span>{task.duration / 1000}s</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* 使用说明 */}
      <section className="mb-16">
        <h2 className="text-2xl font-gaming text-text-primary mb-6">
          How to Start
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-display text-text-primary mb-4">手柄连接</h3>
            <ol className="space-y-3 text-text-secondary">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">1</span>
                <span>通过蓝牙或 USB 连接手柄到电脑</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">2</span>
                <span>打开 AimPad 网页，自动识别手柄</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">3</span>
                <span>在设置页面调整灵敏度和按键映射</span>
              </li>
            </ol>
          </div>
          <div>
            <h3 className="text-lg font-display text-text-primary mb-4">开始训练</h3>
            <ol className="space-y-3 text-text-secondary">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">1</span>
                <span>选择适合的训练任务</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">2</span>
                <span>使用准星对准目标，按下射击键</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">3</span>
                <span>训练结束后查看详细数据报告</span>
              </li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
