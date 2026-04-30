import { useSettingsStore } from '@/stores/settingsStore';

export function Crosshair() {
  const { crosshairStyle, crosshairColor, crosshairSize } = useSettingsStore();

  const styles: Record<string, React.CSSProperties> = {
    dot: {
      width: `${crosshairSize}px`,
      height: `${crosshairSize}px`,
      borderRadius: '50%',
      backgroundColor: crosshairColor,
    },
    cross: {
      width: `${crosshairSize * 5}px`,
      height: `${crosshairSize * 5}px`,
      position: 'relative',
    },
    circle: {
      width: `${crosshairSize * 6}px`,
      height: `${crosshairSize * 6}px`,
      borderRadius: '50%',
      border: `2px solid ${crosshairColor}`,
    },
  };

  if (crosshairStyle === 'dot') {
    return (
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
        style={styles.dot}
      />
    );
  }

  if (crosshairStyle === 'cross') {
    return (
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
        style={styles.cross}
      >
        {/* 水平线 */}
        <div
          className="absolute top-1/2 left-0 w-full h-[2px] -translate-y-1/2"
          style={{ backgroundColor: crosshairColor }}
        />
        {/* 垂直线 */}
        <div
          className="absolute top-0 left-1/2 w-[2px] h-full -translate-x-1/2"
          style={{ backgroundColor: crosshairColor }}
        />
        {/* 中心点 */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[4px] h-[4px] rounded-full"
          style={{ backgroundColor: crosshairColor }}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
      style={styles.circle}
    />
  );
}
