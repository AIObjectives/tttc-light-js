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
 *
 * 5-bucket system:
 * - low: filled shield + checkmark (agreement - draws attention)
 * - light: outline shield + checkmark (leaning consensus)
 * - mid: empty outline shield (mixed opinions)
 * - high: outline shield + X (leaning controversial)
 * - max: filled shield + X (maximum controversy - draws attention)
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

export const ControversyLightIcon = ({
  className,
  size = 16,
}: ControversyIconProps) => (
  <Image
    src="/images/controversy/light@2x.png"
    alt="Light controversy"
    width={size}
    height={size}
    className={className}
  />
);

export const ControversyMidIcon = ({
  className,
  size = 16,
}: ControversyIconProps) => (
  <Image
    src="/images/controversy/mid@2x.png"
    alt="Mid controversy"
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

export const ControversyMaxIcon = ({
  className,
  size = 16,
}: ControversyIconProps) => (
  <Image
    src="/images/controversy/max@2x.png"
    alt="Max controversy"
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
      case "light":
        return "/images/controversy/light@2x.png";
      case "mid":
        return "/images/controversy/mid@2x.png";
      case "high":
        return "/images/controversy/high@2x.png";
      case "max":
        return "/images/controversy/max@2x.png";
      default:
        console.error(`[ControversyIcon] Unknown controversy level: ${level}`);
        return "/images/controversy/mid@2x.png";
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
