import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered';
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hoverable = false, className = '', children, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      borderRadius: '0.5rem',
      padding: '1rem',
      backgroundColor: 'var(--color-bg-surface)',
      transition: hoverable ? 'all 0.3s ease' : undefined,
      cursor: hoverable ? 'pointer' : undefined,
      border: variant === 'bordered' ? '1px solid var(--color-bg-surface-hover)' : undefined,
      boxShadow: variant === 'elevated' ? 'var(--shadow-lg)' : undefined,
    };

    return (
      <div
        ref={ref}
        className={className}
        style={baseStyle}
        onMouseEnter={hoverable ? (e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface-hover)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
        } : undefined}
        onMouseLeave={hoverable ? (e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)';
          (e.currentTarget as HTMLElement).style.boxShadow = variant === 'elevated' ? 'var(--shadow-lg)' : 'none';
        } : undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-lg font-gaming font-semibold text-text-primary ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${className}`} {...props}>
      {children}
    </div>
  );
}
