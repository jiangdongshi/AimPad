import { useLocale } from '@/hooks/useTheme';
import { useGamepad } from '@/hooks/useGamepad';

const BUTTON_LABELS: Record<string, string> = {
  A: 'A (×)', B: 'B (○)', X: 'X (□)', Y: 'Y (△)',
  DPadUp: '↑', DPadDown: '↓', DPadLeft: '←', DPadRight: '→',
  Start: 'Start', Select: 'Select',
};

const IDX_MAP: Record<string, number> = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  Select: 8, Start: 9, LS: 10, RS: 11,
  DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
};

export function Gamepad() {
  const locale = useLocale();
  const { connected, type, id, leftStick, rightStick, buttons } = useGamepad(0);

  const isPressed = (name: string) => {
    const idx = IDX_MAP[name];
    return idx !== undefined && buttons[idx]?.pressed === true;
  };

  const triggerValue = (name: string): number => {
    const idx = IDX_MAP[name];
    if (idx === undefined) return 0;
    return buttons[idx]?.value ?? 0;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-gaming text-text-primary mb-8">
        {locale['gamepad.title']}
      </h1>

      {/* 连接状态 */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: connected ? 'var(--color-success)' : 'var(--color-text-muted)',
              boxShadow: connected ? '0 0 12px var(--color-success)' : 'none',
            }}
          />
          <span
            className="text-xl font-gaming"
            style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-muted)' }}
          >
            {connected ? locale['gamepad.connected'] : locale['gamepad.disconnected']}
          </span>
        </div>
        {!connected && (
          <p className="mt-4 text-text-secondary">{locale['gamepad.notConnected']}</p>
        )}
      </div>

      {connected && (
        <>
          {/* 设备信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="text-xs text-text-muted mb-1">{locale['gamepad.type']}</div>
              <div className="text-lg font-gaming text-text-primary capitalize">{type}</div>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="text-xs text-text-muted mb-1">{locale['gamepad.name']}</div>
              <div className="text-lg font-gaming text-text-primary truncate">{id}</div>
            </div>
          </div>

          {/* 摇杆可视化 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <StickVisualizer
              label={locale['gamepad.leftStick']}
              x={leftStick.x}
              y={leftStick.y}
            />
            <StickVisualizer
              label={locale['gamepad.rightStick']}
              x={rightStick.x}
              y={rightStick.y}
            />
          </div>

          {/* 按钮状态 — 仿手柄布局 */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="text-sm text-text-muted mb-6">{locale['gamepad.buttons']}</div>

            {/* 顶部：肩键 / 扳机 */}
            <div className="flex justify-between mb-6 max-w-[560px] mx-auto">
              {/* 左侧扳机 + 肩键 */}
              <div className="flex flex-col items-center gap-2">
                <TriggerBtn label="LT" value={triggerValue('LT')} pressed={isPressed('LT')} />
                <Btn label="LB" pressed={isPressed('LB')} />
              </div>
              {/* 右侧扳机 + 肩键 */}
              <div className="flex flex-col items-center gap-2">
                <TriggerBtn label="RT" value={triggerValue('RT')} pressed={isPressed('RT')} />
                <Btn label="RB" pressed={isPressed('RB')} />
              </div>
            </div>

            {/* 中部：十字键 / 功能键 — 左右分区 */}
            <div className="flex justify-between items-center max-w-[560px] mx-auto mb-6">
              {/* 左侧：十字键 */}
              <div className="grid grid-cols-3 gap-1 w-[120px]">
                <div />
                <Btn label={BUTTON_LABELS.DPadUp} pressed={isPressed('DPadUp')} />
                <div />
                <Btn label={BUTTON_LABELS.DPadLeft} pressed={isPressed('DPadLeft')} />
                <div />
                <Btn label={BUTTON_LABELS.DPadRight} pressed={isPressed('DPadRight')} />
                <div />
                <Btn label={BUTTON_LABELS.DPadDown} pressed={isPressed('DPadDown')} />
                <div />
              </div>

              {/* 中间：Select / Start */}
              <div className="flex items-center gap-4">
                <Btn label={BUTTON_LABELS.Select} pressed={isPressed('Select')} />
                <Btn label={BUTTON_LABELS.Start} pressed={isPressed('Start')} />
              </div>

              {/* 右侧：ABXY 功能键 */}
              <div className="grid grid-cols-3 gap-1 w-[120px]">
                <div />
                <Btn label={BUTTON_LABELS.Y} pressed={isPressed('Y')} />
                <div />
                <Btn label={BUTTON_LABELS.X} pressed={isPressed('X')} />
                <div />
                <Btn label={BUTTON_LABELS.B} pressed={isPressed('B')} />
                <div />
                <Btn label={BUTTON_LABELS.A} pressed={isPressed('A')} />
                <div />
              </div>
            </div>

            {/* 底部：摇杆按键 */}
            <div className="flex justify-between max-w-[560px] mx-auto">
              <div className="flex justify-center w-[120px]">
                <Btn label="LS" pressed={isPressed('LS')} />
              </div>
              <div className="flex justify-center w-[120px]">
                <Btn label="RS" pressed={isPressed('RS')} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Btn({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <div
      className="rounded-lg text-xs font-medium text-center transition-all flex items-center justify-center"
      style={{
        width: '36px',
        height: '36px',
        backgroundColor: pressed ? '#2563EB' : 'var(--color-bg-surface-hover)',
        color: pressed ? '#FFFFFF' : 'var(--color-text-secondary)',
        transform: pressed ? 'scale(1.1)' : 'scale(1)',
        border: pressed ? '2px solid #2563EB' : '1px solid var(--color-border)',
      }}
    >
      {label}
    </div>
  );
}

function TriggerBtn({ label, value, pressed }: { label: string; value: number; pressed: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="rounded-lg text-xs font-medium text-center flex items-center justify-center relative overflow-hidden"
        style={{
          width: '36px',
          height: '52px',
          backgroundColor: 'var(--color-bg-surface-hover)',
          border: pressed ? '2px solid #2563EB' : '1px solid var(--color-border)',
        }}
      >
        {/* 填充条 — 从底部向上 */}
        <div
          className="absolute left-0 right-0 bottom-0 transition-all"
          style={{
            height: `${pct}%`,
            backgroundColor: '#2563EB',
            opacity: 0.7,
            transition: 'height 0.03s linear',
          }}
        />
        <span
          className="relative z-10"
          style={{ color: pressed ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)' }}
        >
          {label}
        </span>
      </div>
      <span className="text-[10px] text-text-muted font-mono">{pct}%</span>
    </div>
  );
}

function StickVisualizer({ label, x, y }: { label: string; x: number; y: number }) {
  const dotX = 50 + x * 45;
  const dotY = 50 - y * 45;

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="text-sm text-text-muted mb-3">{label}</div>
      <div className="flex justify-center">
        <div
          className="relative rounded-full"
          style={{
            width: '140px',
            height: '140px',
            backgroundColor: 'var(--color-bg-surface-hover)',
            border: '2px solid var(--color-border)',
          }}
        >
          <div
            className="absolute left-0 right-0 top-1/2"
            style={{ height: '1px', backgroundColor: 'var(--color-border)', opacity: 0.5 }}
          />
          <div
            className="absolute top-0 bottom-0 left-1/2"
            style={{ width: '1px', backgroundColor: 'var(--color-border)', opacity: 0.5 }}
          />
          <div
            className="absolute rounded-full"
            style={{
              left: `${dotX}%`,
              top: `${dotY}%`,
              width: '16px',
              height: '16px',
              marginLeft: '-8px',
              marginTop: '-8px',
              backgroundColor: '#2563EB',
              boxShadow: '0 0 8px rgba(37, 99, 235, 0.5)',
            }}
          />
        </div>
      </div>
      <div className="flex justify-between mt-2 text-xs text-text-muted px-2">
        <span>X: {x.toFixed(4)}</span>
        <span>Y: {y.toFixed(4)}</span>
      </div>
    </div>
  );
}
