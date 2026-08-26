import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
  className?: string;
}

/** Chrome-on-ink placeholder block — never a spinner. */
export default function Skeleton({ width, height, style, className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={{ width, height, ...style }} />;
}
