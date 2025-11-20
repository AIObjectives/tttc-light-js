/**
 * Shared types for controversy/crux functionality
 * Centralized to avoid duplication and circular import issues
 */

/**
 * Controversy levels matching the icon system
 */
export type ControversyLevel = "low" | "moderate" | "high";

/**
 * Controversy category with label, description, and level identifier
 */
export interface ControversyCategory {
  level: ControversyLevel;
  label: string;
  description: string;
}
