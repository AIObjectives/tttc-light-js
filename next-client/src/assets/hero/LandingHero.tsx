import Image from "next/image";
import { cn } from "@/lib/utils/shadcn";

export default function LandingHero({ className }: { className?: string }) {
  return (
    <div
      className={cn(className, "bg-slate-50")}
      style={{ aspectRatio: "1764/1218" }}
    >
      <Image
        src="/images/t3c-product-desktop-mobile.png"
        alt="Talk to the City product interface dashboard"
        priority
        quality={85}
        width={1764}
        height={1218}
        className="w-full h-auto"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1764px"
      />
    </div>
  );
}
