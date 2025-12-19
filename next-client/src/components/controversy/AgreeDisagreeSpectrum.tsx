"use client";

import { useMemo } from "react";
import { Col } from "@/components/layout";
import { isValidSpeaker } from "@/lib/crux/utils";

export interface Speaker {
  id: string;
  name: string;
}

interface AgreeDisagreeSpectrumProps {
  /** Array of speakers who agree */
  agree: Speaker[];
  /** Array of speakers who disagree */
  disagree: Speaker[];
  /** Array of speakers with no clear position (optional) */
  noClearPosition?: Speaker[];
  /** Topic color for dots (hex color, e.g., "#FF5733") */
  topicColor?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Position configuration for each stance on the spectrum
 * Values represent percentage of width and spread range
 */
const POSITION_CONFIG = {
  disagree: { base: 5, spread: 25 }, // 5-30% of width
  noClear: { base: 40, spread: 20 }, // 40-60% of width
  agree: { base: 70, spread: 25 }, // 70-95% of width
} as const;

/**
 * Visualizes the distribution of speakers on an agree/disagree spectrum.
 * Shows dots clustered on left (disagree) and right (agree) sides.
 */
export function AgreeDisagreeSpectrum({
  agree,
  disagree,
  noClearPosition = [],
  topicColor,
  className,
}: AgreeDisagreeSpectrumProps) {
  // Memoize filtered speaker arrays to avoid redundant filtering
  // These are used both for dot generation and count calculations
  const validAgree = useMemo(() => agree.filter(isValidSpeaker), [agree]);
  const validDisagree = useMemo(
    () => disagree.filter(isValidSpeaker),
    [disagree],
  );
  const validNoClear = useMemo(
    () => noClearPosition.filter(isValidSpeaker),
    [noClearPosition],
  );

  // Generate dot positions with deterministic jitter based on speaker ID
  const dots = useMemo(() => {
    const allDots: {
      x: number;
      key: string;
      position: string;
      name: string;
    }[] = [];

    // Disagree dots cluster on left
    validDisagree.forEach((speaker, index) => {
      const { base: baseX, spread } = POSITION_CONFIG.disagree;
      // Use deterministic hash - overlapping dots show clustering
      const hash = simpleHash(speaker.id);
      const jitter = (hash % 100) / 100;
      const x = baseX + jitter * spread;
      allDots.push({
        x,
        key: `disagree-${index}`,
        position: "disagree",
        name: speaker.name,
      });
    });

    // No clear position dots cluster in middle
    validNoClear.forEach((speaker, index) => {
      const { base: baseX, spread } = POSITION_CONFIG.noClear;
      // Use deterministic hash - overlapping dots show clustering
      const hash = simpleHash(speaker.id);
      const jitter = (hash % 100) / 100;
      const x = baseX + jitter * spread;
      allDots.push({
        x,
        key: `unclear-${index}`,
        position: "no clear",
        name: speaker.name,
      });
    });

    // Agree dots cluster on right
    validAgree.forEach((speaker, index) => {
      const { base: baseX, spread } = POSITION_CONFIG.agree;
      // Use deterministic hash - overlapping dots show clustering
      const hash = simpleHash(speaker.id);
      const jitter = (hash % 100) / 100;
      const x = baseX + jitter * spread;
      allDots.push({
        x,
        key: `agree-${index}`,
        position: "agree",
        name: speaker.name,
      });
    });

    return allDots;
  }, [validAgree, validDisagree, validNoClear]);

  // Don't render if no data
  if (dots.length === 0) {
    return null;
  }

  // Count speakers by position for accessibility label
  // Use memoized filtered arrays (no re-filtering needed)
  const agreeCount = validAgree.length;
  const disagreeCount = validDisagree.length;
  const noClearCount = validNoClear.length;
  const totalCount = disagreeCount + noClearCount + agreeCount;

  return (
    <Col
      className={`w-full ${className ?? ""}`}
      data-testid="agree-disagree-spectrum"
    >
      {/* Spectrum line with dots */}
      <div
        className="relative h-5 w-full"
        data-testid="spectrum-container"
        role="figure"
        aria-label={`Controversy visualization showing how ${totalCount} speakers are distributed: ${disagreeCount} disagree on left, ${noClearCount} in center with no clear position, ${agreeCount} agree on right`}
      >
        {/* Background line */}
        <div
          className="absolute top-1/2 left-0 right-0 h-[2px] bg-border -translate-y-1/2"
          data-testid="spectrum-line"
        />

        {/* Left end bar */}
        <div
          className="absolute left-0 top-1/2 w-[2px] h-3 bg-border -translate-y-1/2"
          data-testid="spectrum-left-bar"
        />

        {/* Right end bar */}
        <div
          className="absolute right-0 top-1/2 w-[2px] h-3 bg-border -translate-y-1/2"
          data-testid="spectrum-right-bar"
        />

        {/* Dots */}
        {dots.map((dot) => (
          <div
            key={dot.key}
            data-testid="spectrum-dot"
            className="absolute top-1/2 w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-default"
            role="img"
            aria-label={`${dot.name} - ${dot.position} position`}
            title={dot.name}
            style={{
              left: `${dot.x}%`,
              backgroundColor: topicColor
                ? `hsl(var(--theme-${topicColor}-accent))`
                : "hsl(var(--accent))",
              borderColor: topicColor
                ? `hsl(var(--theme-${topicColor}))`
                : "hsl(var(--primary))",
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1" data-testid="spectrum-labels">
        <span
          className="text-sm text-muted-foreground"
          data-testid="label-disagree"
        >
          Disagree
        </span>
        <span
          className="text-sm text-muted-foreground"
          data-testid="label-agree"
        >
          Agree
        </span>
      </div>
    </Col>
  );
}

/**
 * Simple hash function for deterministic positioning.
 * Uses FNV-1a algorithm which provides better distribution than djb2,
 * especially for sequential IDs (tested via chi-squared uniformity test).
 *
 * FNV-1a characteristics:
 * - Fast, simple, and well-tested
 * - Good avalanche properties (small input changes → large hash changes)
 * - Uniform distribution for sequential inputs
 * - Better than djb2 for avoiding visual clustering
 *
 * @param str - String to hash
 * @returns Positive integer hash value
 * @public Exported for testing
 */
export function simpleHash(str: string): number {
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i); // XOR with byte
    hash = Math.imul(hash, 16777619); // Multiply by FNV prime (32-bit)
  }
  return Math.abs(hash);
}

export default AgreeDisagreeSpectrum;
