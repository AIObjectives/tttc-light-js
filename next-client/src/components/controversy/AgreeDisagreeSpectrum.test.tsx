/**
 * Tests for AgreeDisagreeSpectrum component
 *
 * Tests the visualization of speaker distribution across agree/disagree spectrum,
 * including deterministic hash-based positioning.
 */

import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  AgreeDisagreeSpectrum,
  simpleHash,
  type Speaker,
} from "./AgreeDisagreeSpectrum";

// Helper function to convert speaker strings to Speaker objects for tests
function toSpeakers(speakerStrings: string[]): Speaker[] {
  return speakerStrings.map((s) => {
    const [id, ...nameParts] = s.split(":");
    return {
      id: id || "",
      name: nameParts.join(":") || "Unknown",
    };
  });
}

describe("AgreeDisagreeSpectrum", () => {
  // Clean up after each test to prevent DOM accumulation
  afterEach(() => {
    cleanup();
  });

  describe("Basic rendering", () => {
    it("renders with agree and disagree speakers", () => {
      const { getByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice", "2:Bob"])}
          disagree={toSpeakers(["3:Charlie"])}
        />,
      );

      // Check for spectrum components using stable test IDs
      expect(getByTestId("agree-disagree-spectrum")).toBeTruthy();
      expect(getByTestId("spectrum-line")).toBeTruthy();
      expect(getByTestId("label-disagree")).toHaveTextContent("Disagree");
      expect(getByTestId("label-agree")).toHaveTextContent("Agree");
    });

    it("renders with all three position types", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice"])}
          disagree={toSpeakers(["2:Bob"])}
          noClearPosition={toSpeakers(["3:Charlie"])}
        />,
      );

      // Should render dots (3 speakers = 3 dots)
      const dots = getAllByTestId("spectrum-dot");
      expect(dots.length).toBe(3);
    });

    it("renders nothing when all arrays are empty", () => {
      const { container } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers([])}
          disagree={toSpeakers([])}
        />,
      );

      // Should return null - no content rendered
      expect(container.firstChild).toBeNull();
    });

    it("applies custom className", () => {
      const { getByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice"])}
          disagree={toSpeakers(["2:Bob"])}
          className="custom-test-class"
        />,
      );

      expect(getByTestId("agree-disagree-spectrum")).toHaveClass(
        "custom-test-class",
      );
    });
  });

  describe("Speaker filtering", () => {
    it("filters out empty speaker IDs", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice", "", "2:Bob"])}
          disagree={toSpeakers(["", "3:Charlie"])}
        />,
      );

      // Should render 3 dots (2 agree + 1 disagree, empty strings filtered)
      const dots = getAllByTestId("spectrum-dot");
      expect(dots.length).toBe(3);
    });

    it("filters out whitespace-only speaker IDs", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice", "   ", "2:Bob"])}
          disagree={toSpeakers(["3:Charlie"])}
        />,
      );

      // Should render 3 dots (whitespace filtered)
      const dots = getAllByTestId("spectrum-dot");
      expect(dots.length).toBe(3);
    });
  });

  describe("Deterministic positioning (hash function)", () => {
    it("renders same speaker at same position on multiple renders", () => {
      const speakerId = "42:TestSpeaker";

      // First render
      const { getByTestId: getByTestId1 } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers([speakerId])}
          disagree={toSpeakers([])}
        />,
      );
      const dot1 = getByTestId1("spectrum-dot") as HTMLElement;
      const position1 = dot1.style.left;

      // Clean up first render before second render
      cleanup();

      // Second render with same speaker
      const { getByTestId: getByTestId2 } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers([speakerId])}
          disagree={toSpeakers([])}
        />,
      );
      const dot2 = getByTestId2("spectrum-dot") as HTMLElement;
      const position2 = dot2.style.left;

      // Positions should be identical
      expect(position1).toBe(position2);
    });

    it("renders different speakers at different positions", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice", "2:Bob", "3:Charlie"])}
          disagree={toSpeakers([])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      const positions = dots.map((dot) => dot.style.left);

      // All positions should be unique (different speakers → different hash → different position)
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(3);
    });

    it("positions agree speakers in right region (70-95%)", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice", "2:Bob", "3:Charlie"])}
          disagree={toSpeakers([])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      dots.forEach((dot) => {
        const leftPercent = parseFloat(dot.style.left);
        expect(leftPercent).toBeGreaterThanOrEqual(70);
        expect(leftPercent).toBeLessThanOrEqual(95);
      });
    });

    it("positions disagree speakers in left region (5-30%)", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers([])}
          disagree={toSpeakers(["1:Alice", "2:Bob"])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      dots.forEach((dot) => {
        const leftPercent = parseFloat(dot.style.left);
        expect(leftPercent).toBeGreaterThanOrEqual(5);
        expect(leftPercent).toBeLessThanOrEqual(30);
      });
    });

    it("positions no clear position speakers in middle region (40-60%)", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers([])}
          disagree={toSpeakers([])}
          noClearPosition={toSpeakers(["1:Alice", "2:Bob"])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      dots.forEach((dot) => {
        const leftPercent = parseFloat(dot.style.left);
        expect(leftPercent).toBeGreaterThanOrEqual(40);
        expect(leftPercent).toBeLessThanOrEqual(60);
      });
    });

    it("creates visual spread within each region", () => {
      // Create many speakers to test spread
      const manyAgree = Array.from(
        { length: 20 },
        (_, i) => `${i}:Speaker${i}`,
      );

      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(manyAgree)}
          disagree={toSpeakers([])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      const positions = dots.map((dot) => parseFloat(dot.style.left));

      // Calculate spread (standard deviation)
      const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
      const variance =
        positions.reduce((sum, pos) => sum + Math.pow(pos - mean, 2), 0) /
        positions.length;
      const stdDev = Math.sqrt(variance);

      // Should have reasonable spread (not all dots at same position)
      expect(stdDev).toBeGreaterThan(0.5); // At least 0.5% spread
    });
  });

  describe("Hash function properties", () => {
    it("creates consistent distribution for common ID patterns", () => {
      // Test common patterns: numeric IDs
      const numericIds = ["1:User", "2:User", "3:User", "100:User", "999:User"];

      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(numericIds)}
          disagree={toSpeakers([])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      const positions = dots.map((dot) => parseFloat(dot.style.left));

      // All should be in agree region (70-95%)
      positions.forEach((pos) => {
        expect(pos).toBeGreaterThanOrEqual(70);
        expect(pos).toBeLessThanOrEqual(95);
      });

      // Should have variety (not all identical)
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBeGreaterThan(1);
    });

    it("handles UUID-like speaker IDs", () => {
      const uuidIds = [
        "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d:Alice",
        "f1e2d3c4-b5a6-4978-8069-1a2b3c4d5e6f:Bob",
      ];

      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(uuidIds)}
          disagree={toSpeakers([])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      expect(dots.length).toBe(2);

      // Check they're in agree region
      const positions = dots.map((dot) => parseFloat(dot.style.left));
      positions.forEach((pos) => {
        expect(pos).toBeGreaterThanOrEqual(70);
        expect(pos).toBeLessThanOrEqual(95);
      });
    });

    it("handles speaker IDs with special characters", () => {
      const specialIds = [
        "user@example.com:User1",
        "user+tag@example.com:User2",
        "user_123:User3",
      ];

      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(specialIds)}
          disagree={toSpeakers([])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot");
      expect(dots.length).toBe(3);
    });

    it("produces different results for similar IDs", () => {
      const similarIds = ["user1:Name", "user2:Name", "user3:Name"];

      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(similarIds)}
          disagree={toSpeakers([])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      const positions = dots.map((dot) => parseFloat(dot.style.left));

      // Similar IDs should still produce different positions
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(3);
    });

    it("validates hash quality with many speakers", () => {
      const manyIds = Array.from({ length: 50 }, (_, i) => `${i}:Speaker${i}`);

      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(manyIds)}
          disagree={toSpeakers([])}
        />,
      );

      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      expect(dots.length).toBe(50);

      // Test hash distribution - should have good variety even with collisions
      // (positions are discretized to 100 possible values within the 25% spread)
      const positions = dots.map((dot) => parseFloat(dot.style.left));
      const uniquePositions = new Set(positions);

      // Should have at least 50% unique positions (good distribution)
      expect(uniquePositions.size).toBeGreaterThanOrEqual(25);
    });
  });

  describe("Topic color styling", () => {
    it("applies default color when no topicColor provided", () => {
      const { getByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice"])}
          disagree={toSpeakers([])}
        />,
      );

      const dot = getByTestId("spectrum-dot") as HTMLElement;

      // Should use default accent color
      expect(dot.style.backgroundColor).toContain("--accent");
    });

    it("applies custom topic color", () => {
      const { getByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice"])}
          disagree={toSpeakers([])}
          topicColor="blue"
        />,
      );

      const dot = getByTestId("spectrum-dot") as HTMLElement;

      // Should use custom theme color
      expect(dot.style.backgroundColor).toContain("--theme-blue");
      expect(dot.style.borderColor).toContain("--theme-blue");
    });
  });

  describe("Real-world usage scenarios", () => {
    it("handles typical crux with mixed positions", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice", "2:Bob", "3:Charlie"])}
          disagree={toSpeakers(["4:Diana", "5:Eve"])}
          noClearPosition={toSpeakers(["6:Frank"])}
        />,
      );

      // Should render 6 dots total
      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      expect(dots.length).toBe(6);

      // Verify positions are distributed across spectrum
      const positions = dots.map((dot) => parseFloat(dot.style.left));

      // Should have dots in all three regions
      const hasLeftRegion = positions.some((p) => p >= 5 && p <= 30);
      const hasMiddleRegion = positions.some((p) => p >= 40 && p <= 60);
      const hasRightRegion = positions.some((p) => p >= 70 && p <= 95);

      expect(hasLeftRegion).toBe(true);
      expect(hasMiddleRegion).toBe(true);
      expect(hasRightRegion).toBe(true);
    });

    it("handles highly polarized crux (no middle ground)", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice", "2:Bob", "3:Charlie"])}
          disagree={toSpeakers(["4:Diana", "5:Eve", "6:Frank"])}
        />,
      );

      // Should render 6 dots (3 left, 3 right, 0 middle)
      const dots = getAllByTestId("spectrum-dot") as HTMLElement[];
      expect(dots.length).toBe(6);

      // Verify no dots in middle region
      const positions = dots.map((dot) => parseFloat(dot.style.left));
      const hasMiddleRegion = positions.some((p) => p >= 40 && p <= 60);
      expect(hasMiddleRegion).toBe(false);
    });

    it("handles consensus with mostly no clear position", () => {
      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(["1:Alice"])}
          disagree={toSpeakers([])}
          noClearPosition={toSpeakers([
            "2:Bob",
            "3:Charlie",
            "4:Diana",
            "5:Eve",
          ])}
        />,
      );

      // Should render 5 dots (1 right, 4 middle)
      const dots = getAllByTestId("spectrum-dot");
      expect(dots.length).toBe(5);
    });

    it("handles large datasets with many speakers", () => {
      const manyAgree = Array.from({ length: 50 }, (_, i) => `${i}:Agree${i}`);
      const manyDisagree = Array.from(
        { length: 50 },
        (_, i) => `${i + 50}:Disagree${i}`,
      );

      const { getAllByTestId } = render(
        <AgreeDisagreeSpectrum
          agree={toSpeakers(manyAgree)}
          disagree={toSpeakers(manyDisagree)}
        />,
      );

      // Should render all 100 dots (50 agree + 50 disagree)
      const dots = getAllByTestId("spectrum-dot");
      expect(dots.length).toBe(100);
    });
  });

  describe("simpleHash utility", () => {
    it("returns consistent hash for same input", () => {
      const hash1 = simpleHash("Alice");
      const hash2 = simpleHash("Alice");
      expect(hash1).toBe(hash2);
      expect(hash1).toBeGreaterThan(0);
    });

    it("returns different hashes for different inputs", () => {
      const hashAlice = simpleHash("Alice");
      const hashBob = simpleHash("Bob");
      expect(hashAlice).not.toBe(hashBob);
    });

    it("handles empty string", () => {
      const hash = simpleHash("");
      // FNV-1a returns the offset basis for empty strings
      expect(hash).toBe(2166136261);
      expect(hash).toBeGreaterThan(0);
    });

    it("returns positive integer for all inputs", () => {
      const inputs = ["test", "1:Alice", "123:Bob | 0.8", "Special!@#$%"];
      inputs.forEach((input) => {
        const hash = simpleHash(input);
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(hash)).toBe(true);
      });
    });

    it("produces well-distributed hashes for speaker IDs", () => {
      // Test that hashes for sequential IDs are well-distributed
      const hashes = Array.from({ length: 100 }, (_, i) =>
        simpleHash(`${i}:Speaker${i}`),
      );

      // Check that we get a variety of hash values (no duplicate hashes)
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(100);
    });

    it("handles unicode characters", () => {
      const hash1 = simpleHash("αβγ");
      const hash2 = simpleHash("你好");
      const hash3 = simpleHash("🎉");

      // Each should produce a valid positive integer
      [hash1, hash2, hash3].forEach((hash) => {
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(hash)).toBe(true);
      });
    });

    /**
     * Chi-squared test for uniform distribution
     *
     * Tests that sequential speaker IDs (1, 2, 3, ...) produce uniformly
     * distributed positions across spectrum regions, avoiding visual clustering.
     *
     * Uses chi-squared goodness-of-fit test with 10 equal-sized buckets.
     * A uniform distribution should have roughly equal counts in each bucket.
     *
     * The chi-squared statistic measures how observed counts differ from expected:
     * χ² = Σ((observed - expected)² / expected)
     *
     * For 10 buckets with df=9 (degrees of freedom), critical value at p=0.05 is 16.919.
     * If χ² > 16.919, distribution is significantly non-uniform (reject null hypothesis).
     *
     * Example interpretation:
     * - χ² = 5.2  → Good uniform distribution (< 16.919)
     * - χ² = 25.3 → Clustering detected (> 16.919)
     */
    it("produces uniform distribution (chi-squared test for sequential IDs)", () => {
      // Test with 200 sequential speaker IDs
      const sampleSize = 200;
      const numBuckets = 10;

      // Generate sequential IDs and map to positions within agree region (70-95%)
      const positions = Array.from({ length: sampleSize }, (_, i) => {
        const speakerId = `${i}:Speaker${i}`;
        const hash = simpleHash(speakerId);
        const jitter = (hash % 100) / 100; // 0-1 range
        const agreeBase = 70;
        const agreeSpread = 25;
        return agreeBase + jitter * agreeSpread;
      });

      // Divide agree region (70-95%) into 10 equal buckets
      const regionMin = 70;
      const regionMax = 95;
      const bucketWidth = (regionMax - regionMin) / numBuckets;

      // Count how many positions fall in each bucket
      const buckets = new Array(numBuckets).fill(0);
      positions.forEach((pos) => {
        const bucketIndex = Math.min(
          Math.floor((pos - regionMin) / bucketWidth),
          numBuckets - 1,
        );
        buckets[bucketIndex]++;
      });

      // Expected count per bucket for uniform distribution
      const expectedPerBucket = sampleSize / numBuckets;

      // Calculate chi-squared statistic
      // χ² = Σ((observed - expected)² / expected)
      const chiSquared = buckets.reduce((sum, observed) => {
        const diff = observed - expectedPerBucket;
        return sum + (diff * diff) / expectedPerBucket;
      }, 0);

      // Critical value for chi-squared with df=9, p=0.05 is 16.919
      // If χ² > 16.919, distribution is significantly non-uniform
      const criticalValue = 16.919;

      // Log distribution for debugging (only on failure)
      if (chiSquared > criticalValue) {
        console.log("Chi-squared test failed - distribution details:");
        console.log(`χ² statistic: ${chiSquared.toFixed(2)}`);
        console.log(`Critical value (p=0.05): ${criticalValue}`);
        console.log(
          `Bucket counts (expected ${expectedPerBucket} per bucket):`,
        );
        buckets.forEach((count, i) => {
          const bucketStart = regionMin + i * bucketWidth;
          const bucketEnd = bucketStart + bucketWidth;
          console.log(
            `  Bucket ${i} [${bucketStart.toFixed(1)}-${bucketEnd.toFixed(1)}%]: ${count}`,
          );
        });
      }

      // Assert uniform distribution
      expect(chiSquared).toBeLessThan(criticalValue);

      // Additional sanity checks:
      // 1. No bucket should be empty (would indicate severe clustering)
      buckets.forEach((count, i) => {
        expect(count).toBeGreaterThan(0);
      });

      // 2. No bucket should have >2x expected count (moderate clustering check)
      buckets.forEach((count) => {
        expect(count).toBeLessThan(expectedPerBucket * 2);
      });
    });
  });
});
