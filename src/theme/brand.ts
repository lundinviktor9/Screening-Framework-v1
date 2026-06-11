/**
 * Brand color tokens for app and PPTX export.
 * Single source of truth for deal card styling.
 */

export const brand = {
  purple: '#7D5A7D',
  purpleLight: '#E6DCE6',
  ink: '#1F1F1F',
  cardBg: '#F5F4F6',
} as const;

export type BrandKey = keyof typeof brand;
