export type ThemeId =
  | 'default'
  | 'midnight'
  | 'forest'
  | 'purple'
  | 'chinese'
  | 'light'
  | 'cream'
  | 'cool-light';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  preview: {
    bg: string;
    accent: string;
    text: string;
  };
}

export const THEMES: ThemeConfig[] = [
  // 深色主题
  {
    id: 'default',
    name: '深黑',
    nameEn: 'Deep Dark',
    description: '经典深黑背景，琥珀色强调',
    descriptionEn: 'Classic deep dark background, amber accent',
    preview: { bg: '#0a0a14', accent: '#f59e0b', text: '#e8e8f0' },
  },
  {
    id: 'midnight',
    name: '午夜蓝',
    nameEn: 'Midnight Blue',
    description: '深邃蓝色背景，蓝色强调',
    descriptionEn: 'Deep blue background, blue accent',
    preview: { bg: '#070b1a', accent: '#3b82f6', text: '#e0e8ff' },
  },
  {
    id: 'forest',
    name: '森林绿',
    nameEn: 'Forest Green',
    description: '暗绿色背景，翠绿强调',
    descriptionEn: 'Dark green background, emerald accent',
    preview: { bg: '#080f0a', accent: '#22c55e', text: '#e0f0e4' },
  },
  {
    id: 'purple',
    name: '皇家紫',
    nameEn: 'Royal Purple',
    description: '暗紫色背景，紫色强调',
    descriptionEn: 'Dark purple background, purple accent',
    preview: { bg: '#0d0815', accent: '#a855f7', text: '#ece0ff' },
  },
  {
    id: 'chinese',
    name: '中国红',
    nameEn: 'Chinese Red',
    description: '中国风红金配色，全中文界面',
    descriptionEn: 'Chinese-style red and gold palette',
    preview: { bg: '#140a0a', accent: '#dc2626', text: '#f0e8e0' },
  },
  // 浅色主题
  {
    id: 'light',
    name: '纯白',
    nameEn: 'Pure White',
    description: '简洁白色背景，蓝色强调',
    descriptionEn: 'Clean white background, blue accent',
    preview: { bg: '#ffffff', accent: '#2563eb', text: '#1e293b' },
  },
  {
    id: 'cream',
    name: '暖米',
    nameEn: 'Warm Cream',
    description: '温暖米色背景，橙色强调',
    descriptionEn: 'Warm cream background, orange accent',
    preview: { bg: '#fefcf3', accent: '#ea580c', text: '#292524' },
  },
  {
    id: 'cool-light',
    name: '冷灰',
    nameEn: 'Cool Gray',
    description: '冷色调浅灰背景，靛蓝强调',
    descriptionEn: 'Cool light gray background, indigo accent',
    preview: { bg: '#f1f5f9', accent: '#6366f1', text: '#0f172a' },
  },
];
