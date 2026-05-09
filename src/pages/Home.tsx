import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TRAINING_TASKS } from '@/types/training';
import { useLocale } from '@/hooks/useTheme';
import { useSettingsStore } from '@/stores/settingsStore';

export function Home() {
  const locale = useLocale();
  const isZh = useSettingsStore((s) => s.locale) === 'zh';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center py-16 mb-12">
        <h1 className="text-6xl font-gaming text-accent mb-4 animate-fade-in">
          {locale['home.title']}
        </h1>
        <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
          {locale['home.subtitle']}
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/training">
            <Button size="lg" className="px-8">
              {locale['home.startTraining']}
            </Button>
          </Link>
          <Link to="/statistics">
            <Button variant="secondary" size="lg">
              {locale['home.viewStats']}
            </Button>
          </Link>
        </div>
      </section>

      {/* 特性介绍 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <Card variant="bordered" className="text-center p-6">
          <div className="text-4xl mb-4">🎮</div>
          <h3 className="text-lg font-gaming text-text-primary mb-2">{locale['home.feature1.title']}</h3>
          <p className="text-sm text-text-secondary">
            {locale['home.feature1.desc']}
          </p>
        </Card>
        <Card variant="bordered" className="text-center p-6">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-lg font-gaming text-text-primary mb-2">{locale['home.feature2.title']}</h3>
          <p className="text-sm text-text-secondary">
            {locale['home.feature2.desc']}
          </p>
        </Card>
        <Card variant="bordered" className="text-center p-6">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-gaming text-text-primary mb-2">{locale['home.feature3.title']}</h3>
          <p className="text-sm text-text-secondary">
            {locale['home.feature3.desc']}
          </p>
        </Card>
      </section>

      {/* 热门训练 */}
      <section className="mb-16">
        <h2 className="text-2xl font-gaming text-text-primary mb-6">
          {locale['home.popularTasks']}
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
                    {locale[`difficulty.${task.difficulty}` as keyof typeof locale]}
                  </span>
                </div>
                <p className="text-sm text-text-secondary">{isZh ? task.description : task.descriptionEn}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                  <span>{locale[`taskType.${task.type}` as keyof typeof locale]}</span>
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
          {locale['home.howToStart']}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-display text-text-primary mb-4">{locale['home.gamepadConnect']}</h3>
            <ol className="space-y-3 text-text-secondary">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">1</span>
                <span>{locale['home.gamepadStep1']}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">2</span>
                <span>{locale['home.gamepadStep2']}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">3</span>
                <span>{locale['home.gamepadStep3']}</span>
              </li>
            </ol>
          </div>
          <div>
            <h3 className="text-lg font-display text-text-primary mb-4">{locale['home.startTrain']}</h3>
            <ol className="space-y-3 text-text-secondary">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">1</span>
                <span>{locale['home.trainStep1']}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">2</span>
                <span>{locale['home.trainStep2']}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">3</span>
                <span>{locale['home.trainStep3']}</span>
              </li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
