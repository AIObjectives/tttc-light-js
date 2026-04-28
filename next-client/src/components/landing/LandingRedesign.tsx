"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { EXTERNAL_LINKS, PARTNERS } from "./landing-config";

const AUDIENCE_WORDS = [
  "city",
  "people",
  "country",
  "voters",
  "union",
  "community",
  "expert",
  "field",
  "patient",
  "client",
  "partners",
  "grantee",
  "industry",
];

const WORD_DURATION_MS = 1500;

export default function LandingRedesign() {
  return (
    <div className="overflow-x-hidden">
      <HeroSection />
      <TestimonialsSection />
    </div>
  );
}

function HeroSection() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % AUDIENCE_WORDS.length);
    }, WORD_DURATION_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="bg-white px-8 lg:px-20 py-16 text-center">
      <h1 className="text-5xl lg:text-7xl font-medium tracking-tight leading-tight mb-8">
        Talk to the [
        <span className="inline-grid justify-items-center">
          <span className="invisible col-start-1 row-start-1">community</span>
          <span className="col-start-1 row-start-1 text-indigo-600">
            {AUDIENCE_WORDS[wordIndex]}
          </span>
        </span>
        ]
      </h1>
      <p className="text-xl lg:text-2xl text-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
        Capture human perspectives at any scale and generate insightful reports
        grounded in individual voices. Open-source, affordable and transparent.
      </p>
      <div className="max-w-5xl mx-auto mb-12">
        <Image
          src="/images/t3c-product-desktop-mobile.png"
          alt="Talk to the City product interface"
          width={1200}
          height={800}
          className="w-full h-auto"
        />
      </div>
      <p className="text-xl text-foreground mb-8">
        Trusted and funded by governments, organizations and communities:
      </p>
      <LogosGrid />
    </section>
  );
}

const LOGO_OPACITY: Record<string, number> = {
  "Future of Life Institute": 0.86,
  moda: 0.8,
  Jigsaw: 0.7,
  "Chatham House": 0.6,
  "Pax Strategies": 0.7,
};

function LogosGrid() {
  return (
    <div className="w-fit mx-auto grid grid-cols-[repeat(2,280px)] sm:grid-cols-[repeat(3,280px)] lg:grid-cols-[repeat(4,280px)] gap-x-1 gap-y-0">
      {PARTNERS.map((partner) => (
        <a
          key={partner.name}
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-[140px] grayscale hover:grayscale-0 transition-all"
          style={{ opacity: LOGO_OPACITY[partner.name] ?? 1 }}
        >
          <Image
            src={partner.logoUri}
            alt={partner.name}
            width={270}
            height={130}
            className="max-h-[130px] w-auto object-contain"
          />
        </a>
      ))}
    </div>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-16 px-8 bg-white">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <TestimonialCard
          photo="/images/audrey-tang.png"
          name="Audrey Tang"
          quote="Back in 2014, it was impossible to interview a mini public of people and aggregate their ideas while preserving the full nuance. But now, with Talk to the City's help, that cost has been reduced to essentially zero. It's broad-listening, and it can change the nature of this recursive public."
          attribution={
            <>
              {`– Audrey Tang, Taiwan's 1st Digital Minister and co-author of `}
              <a
                href={EXTERNAL_LINKS.PLURALITY_NET}
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Plurality.net
              </a>
            </>
          }
        />
        <TestimonialCard
          photo="/images/rizina-yadav.png"
          name="Rizina Yadav"
          quote="Talk to the City's analysis was crucial in identifying gender-specific challenges ... Having the data organized under specific themes, then being able to go through the interviewees actual statements, was powerful"
          attribution="– Rizina Yadav, Young Women's Alliance"
        />
      </div>
    </section>
  );
}

function TestimonialCard({
  photo,
  name,
  quote,
  attribution,
}: {
  photo: string;
  name: string;
  quote: string;
  attribution: ReactNode;
}) {
  return (
    <div className="flex gap-4 items-start">
      <Image
        src={photo}
        alt={name}
        width={96}
        height={96}
        className="rounded-full shrink-0 object-cover size-24"
      />
      <div className="flex-1 border border-border rounded-lg shadow-md p-4">
        <div className="flex gap-3 items-start">
          <span className="text-muted-foreground text-xl shrink-0">
            &ldquo;
          </span>
          <p className="text-muted-foreground text-base leading-6">
            {quote}
            <br />
            {attribution}
          </p>
        </div>
      </div>
    </div>
  );
}
