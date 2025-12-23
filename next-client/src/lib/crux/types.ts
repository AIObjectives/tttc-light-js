/**
 * Shared types for controversy/crux functionality
 * Centralized to avoid duplication and circular import issues
 */

/**
 * Controversy levels matching the 5-bucket icon system
 *
 * - low: Agreement/consensus (0-20%) - filled shield + checkmark
 * - light: Leaning consensus (20-40%) - outline shield + checkmark
 * - mid: Mixed opinions (40-60%) - empty outline shield
 * - high: Leaning controversial (60-80%) - outline shield + X
 * - max: Maximum controversy (80-100%) - filled shield + X
 */
export type ControversyLevel = "low" | "light" | "mid" | "high" | "max";

/**
 * Controversy category with label, description, and level identifier
 */
export interface ControversyCategory {
  level: ControversyLevel;
  label: string;
  description: string;
}
