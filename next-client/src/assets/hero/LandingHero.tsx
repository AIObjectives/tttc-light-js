"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/shadcn";

// Blur placeholder matching actual image aspect ratio (1764x1218 = 1.45:1)
const blurDataURL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAHAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAeEAACAQQDAQAAAAAAAAAAAAABAgADBBEFEiExE//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFREBAQAAAAAAAAAAAAAAAAAAAAH/2gAMAwEAAhEDEQA/AJ7QqJMCiuopKhKZwcnB+ZjjmRdNL8xKvz//2Q==";

export default function LandingHero({ className }: { className?: string }) {
  return (
    <div
      className={cn(className, "bg-slate-50")}
      style={{ aspectRatio: "1764/1218" }} // Reserve space, prevent layout shift
    >
      <Image
        src="/images/t3c-product-desktop-mobile.png"
        alt="Talk to the City product interface dashboard"
        width={1764}
        height={1218}
        priority // Hero images should load immediately
        quality={85} // Optimized for web: balances quality (85/100) with file size
        className="w-full h-auto"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1764px"
        placeholder="blur"
        blurDataURL={blurDataURL}
        onError={(e) => {
          console.error("Failed to load hero image:", e);
          // Fallback: hide the image container
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}
