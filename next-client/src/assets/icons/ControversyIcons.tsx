import * as React from "react";
import Image from "next/image";
import type { ControversyLevel } from "@/lib/crux/types";

interface ControversyIconProps {
  className?: string;
  size?: number;
}

// Re-export for convenience
export type { ControversyLevel };

/**
 * Controversy level icons - shield variants indicating different levels of disagreement
 * Uses PNG images from public/images/controversy/ with Next.js Image optimization
 */

export const ControversyLowIcon = ({
  className,
  size = 16,
}: ControversyIconProps) => (
  <Image
    src="/images/controversy/low@2x.png"
    alt="Low controversy"
    width={size}
    height={size}
    className={className}
  />
);

export const ControversyModerateIcon = ({
  className,
  size = 16,
}: ControversyIconProps) => (
  <Image
    src="/images/controversy/moderate@2x.png"
    alt="Moderate controversy"
    width={size}
    height={size}
    className={className}
  />
);

export const ControversyHighIcon = ({
  className,
  size = 16,
}: ControversyIconProps) => (
  <Image
    src="/images/controversy/high@2x.png"
    alt="High controversy"
    width={size}
    height={size}
    className={className}
  />
);

/**
 * Dynamic icon component that renders the appropriate icon based on level
 * Uses CSS mask to apply color styling from text color
 */
export const ControversyIcon = ({
  level,
  className,
  size = 16,
}: ControversyIconProps & { level: ControversyLevel }) => {
  const getImageSrc = () => {
    switch (level) {
      case "low":
        return "/images/controversy/low@2x.png";
      case "moderate":
        return "/images/controversy/moderate@2x.png";
      case "high":
        return "/images/controversy/high@2x.png";
      default:
        console.error(`[ControversyIcon] Unknown controversy level: ${level}`);
        return "/images/controversy/low@2x.png";
    }
  };

  return (
    <div
      className={`inline-block ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${getImageSrc()})`,
        maskImage: `url(${getImageSrc()})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
};
