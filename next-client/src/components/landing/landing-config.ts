/**
 * Configuration constants for the landing page
 */

// Icon names - using const assertion for type safety
export const ICON_NAMES = {
  NETWORK: "network",
  SHIELD: "shield",
  OPEN: "open",
  PROVEN: "proven",
} as const;

export type IconName = (typeof ICON_NAMES)[keyof typeof ICON_NAMES];

// Sample Reports
export const SAMPLE_REPORTS = [
  {
    title: "AI Assemblies",
    imageUri: "/images/sample-ai-assemblies.jpg",
    resourceUrl: "/report/HAcEAQ3bTfXlWhtCXHa7",
    date: "February 21, 2024",
  },
  {
    title: "AI Manifestos",
    imageUri: "/images/sample-ai-manifestos.jpg",
    resourceUrl: "/report/QQ4zmwM85f43EejP3QDT",
    date: "November 5, 2024",
  },
  {
    title: "Deliberative Technologies in Polarized Contexts",
    imageUri: "/images/sample-deliberative.jpg",
    resourceUrl: "/report/iQ81mSpYfuGfZ4sy7r80",
    date: "June 26, 2024",
  },
  {
    title: "Recent views on DeepSeek",
    imageUri: "/images/sample-deepseek.jpg",
    resourceUrl: "/report/fnsO4ctahpFjbBmYE5Kq",
    date: "February 8, 2025",
  },
  {
    title: "Heal Michigan",
    imageUri: "/images/sample-heal-michigan.jpg",
    resourceUrl: "/report/678bPeGL1QdKJbveKiWY",
    date: "August 25, 2023",
  },
] as const;

// Media Cards
export const MEDIA_ITEMS = [
  {
    imageUri: "/images/media-1.png",
    title: "A Privacy Hero's Final Wish",
    source: "Wired",
    sourceIcon: "/images/icon-wired.png",
    url: "https://www.wired.com/story/peter-eckersley-ai-objectives-institute/",
  },
  {
    imageUri: "/images/media-2.png",
    title: "Scaling Deliberation",
    source: "Foresight Institute",
    sourceIcon: "/images/icon-foresight.png",
    url: "https://foresight.org/resource/colleen-mckenzie-scaling-deliberation-intelligent-cooperation-workshop/",
  },
  {
    imageUri: "/images/media-3.png",
    title: "AI Objectives Workshops",
    source: "Protocol Labs",
    sourceIcon: "/images/icon-protocol-labs.png",
    url: "https://www.youtube.com/watch?v=SJ6d3Lbe79M",
  },
  {
    imageUri: "/images/media-4.jpg",
    title: "Innovating for Peace",
    source: "CMI Finland",
    sourceIcon: "/images/icon-cmi.png",
    url: "https://www.youtube.com/watch?v=2u6XH3BV5kE&t=319s",
  },
  {
    imageUri: "/images/media-demo.png",
    title: "Talk to the City Demo",
    source: "AI Objectives Institute",
    sourceIcon: "/images/icon-aoi.png",
    url: "https://www.youtube.com/watch?v=DmkhGD_pK94",
    imageBgColor: "#EFEDF1",
  },
] as const;

// Partner Logos
export const PARTNERS = [
  {
    name: "Metagov",
    logoUri: "/images/logo-metagov.png",
    url: "https://metagov.org/",
  },
  {
    name: "Google.org",
    logoUri: "/images/logo-google-org.png",
    url: "https://www.google.org/",
  },
  {
    name: "Future of Life Institute",
    logoUri: "/images/logo-future-of-life.png",
    url: "https://futureoflife.org/",
  },
  {
    name: "moda",
    logoUri: "/images/logo-moda.png",
    url: "https://moda.gov.tw/",
  },
  {
    name: "Friedrich Naumann Foundation",
    logoUri: "/images/logo-friedrich-naumann.png",
    url: "https://www.freiheit.org/",
  },
  {
    name: "Plurality Institute",
    logoUri: "/images/logo-plurality-institute.png",
    url: "https://www.plurality.institute/",
  },
  {
    name: "Tokyo Metropolitan Government",
    logoUri: "/images/logo-tokyo-gov-1.png",
    url: "https://www.metro.tokyo.lg.jp/english/",
  },
  {
    name: "Jigsaw",
    logoUri: "/images/logo-jigsaw.png",
    url: "https://jigsaw.google.com/",
  },
  {
    name: "Common Ground",
    logoUri: "/images/logo-common-ground.png",
    url: "https://www.sfcg.org/",
  },
  {
    name: "Chatham House",
    logoUri: "/images/logo-chatham-house.png",
    url: "https://www.chathamhouse.org/",
  },
  {
    name: "Pax Strategies",
    logoUri: "/images/logo-pax-strategies.png",
    url: "https://paxstrategies.com/",
  },
] as const;

// External Links
export const EXTERNAL_LINKS = {
  PLURALITY_NET: "https://www.plurality.net/",
  CASE_STUDIES: "https://talktothe.city/about#case-studies",
  AI_OBJECTIVES_INSTITUTE: "https://ai.objectives.institute/",
  GITHUB_REPO: "https://github.com/AIObjectives/tttc-light-js",
  PRESS_KIT: "/T3C-Press-Kit.pdf",
} as const;

// Contact
export const CONTACT_EMAIL = "hello@aiobjectives.org";

// Spacing constants
export const SPACING = {
  BOTTOM_PADDING: "pb-72", // Equivalent to 18rem / 288px - using Tailwind's standard scale
} as const;

// Image sizes for responsive loading
export const IMAGE_SIZES = {
  CARD: "(max-width: 768px) 100vw, 260px", // Case studies, media cards
  ICON_SMALL: "36px", // Source logos in media cards
  PARTNER_LOGO: "128px", // Partner logos
} as const;
