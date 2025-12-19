import Image from "next/image";
import type React from "react";
import LandingHero from "@/assets/hero/LandingHero";
import Icons from "@/assets/icons";
import type { BackgroundAccentClass, BorderClass } from "@/lib/color";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
} from "../elements";
import { Col, Row } from "../layout";
import {
  CONTACT_EMAIL,
  EXTERNAL_LINKS,
  ICON_NAMES,
  type IconName,
  IMAGE_SIZES,
  MEDIA_ITEMS,
  PARTNERS,
  SAMPLE_REPORTS,
  SPACING,
} from "./landing-config";

export default function Landing() {
  return (
    <Col gap={4} className={`max-w-[896px] mx-auto ${SPACING.BOTTOM_PADDING}`}>
      <Title />
      <div className="px-4">
        <LandingHero className="w-full h-auto" />
      </div>
      <About />
      <Testimonials />
      <SampleReports />
      <HowItWorks />
      <WhoIsItFor />
      <WhyT3CIsDifferent />
      <Media />
      <FundersAndPartners />
    </Col>
  );
}

const Title = () => (
  <Col className="p-8" gap={4}>
    <h2>Talk to the City</h2>
    <p className="text-muted-foreground">
      An open-source AI tool that transforms large-scale public input into
      nuanced insights while preserving individual voices
    </p>
  </Col>
);

const About = () => (
  <Col className="p-8" gap={2}>
    <h4>About</h4>
    <p className="text-muted-foreground">
      Talk to the City (T3C) is an open-source tool that helps large groups of
      people coordinate by understanding each other better. It's designed for
      public consultations, civic dialogue, and collaborative
      problem-solving—any situation where many voices need to be heard and
      turned into actionable insights.
    </p>
    <p className="text-muted-foreground">
      Unlike most AI tools, which summarize text but risk producing errors or
      hallucinations, T3C is built for trust, and structures the summarized
      public input so that every theme or idea is grounded directly in
      participant quotes. Its reports allow decision-makers to see broad themes,
      then drill down to the exact statements behind them. This design makes the
      analysis not only more reliable, but also auditable—participants and
      stakeholders can check that their words are represented faithfully.
    </p>
  </Col>
);

const Testimonials = () => (
  <Col gap={6} className="p-8">
    <TestimonialCard
      quote="Back in 2014, it was impossible to interview a mini public of people and aggregate their ideas while preserving the full nuance. But now, with Talk to the City's help, that cost has been reduced to essentially zero. It's broad-listening, and it can change the nature of this recursive public."
      name="Audrey Tang"
      title={
        <>
          Taiwan's 1st Digital Minister and co-author of{" "}
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            href={EXTERNAL_LINKS.PLURALITY_NET}
            aria-label="Visit Plurality.net website"
          >
            Plurality.net
          </a>
        </>
      }
      avatarSrc="/images/audrey-tang.png"
      avatarFallback="AT"
    />
    <TestimonialCard
      quote="Talk to the City's analysis was crucial in identifying gender-specific challenges ... Having the data organized under specific themes, then being able to go through the interviewees actual statements, was powerful."
      name="Rizina Yadav"
      title="Young Women's Alliance"
      avatarSrc="/images/rizina-yadav.png"
      avatarFallback="RY"
    />
  </Col>
);

const TestimonialCard = ({
  quote,
  name,
  title,
  avatarSrc,
  avatarFallback,
}: {
  quote: string;
  name: string;
  title: React.ReactNode;
  avatarSrc: string;
  avatarFallback: string;
}) => (
  <Col gap={4} className="md:flex-row gap-x-4">
    <Avatar className="h-20 w-20">
      <AvatarImage src={avatarSrc} alt={`${name} portrait`} />
      <AvatarFallback>{avatarFallback}</AvatarFallback>
    </Avatar>
    <Card>
      <CardContent className="sm:p-6">
        <Row gap={3}>
          <div className="self-start flex-shrink-0 py-[5px]">
            <Icons.Quote className={"h-4 w-4 fill-muted-foreground"} />
          </div>
          <Col>
            <p className="text-muted-foreground">{quote}</p>
            <p className="text-muted-foreground">
              - {name}, {title}
            </p>
          </Col>
        </Row>
      </CardContent>
    </Card>
  </Col>
);

const SampleReports = () => {
  // Split reports into two rows (3 in first row, 2 in second)
  const firstRow = SAMPLE_REPORTS.slice(0, 3);
  const secondRow = SAMPLE_REPORTS.slice(3);

  return (
    <Col gap={4} className="p-8">
      <h4>Sample reports</h4>
      <Col gap={6}>
        <Col gap={4} className="md:flex-row gap-x-4 items-center">
          {firstRow.map((report) => (
            <CaseStudy key={report.title} {...report} />
          ))}
        </Col>
        <Col gap={4} className="md:flex-row gap-x-4 items-center">
          {secondRow.map((report) => (
            <CaseStudy key={report.title} {...report} />
          ))}
        </Col>
      </Col>
    </Col>
  );
};

const CaseStudy = ({
  title,
  imageUri,
  date,
  resourceUrl,
}: {
  title: string;
  imageUri: string;
  date: string;
  resourceUrl: string;
}) => (
  <Card className="w-full md:max-w-[260px] transition-transform duration-200 transform hover:opacity-90">
    <a
      href={resourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${title} report`}
    >
      <div className="w-full aspect-[1.5] md:max-w-[260px] md:max-h-[171px] relative">
        <Image
          src={imageUri}
          alt={`${title} preview`}
          fill
          sizes={IMAGE_SIZES.CARD}
          className="object-cover rounded-t-sm"
          loading="lazy"
        />
      </div>
      <Col gap={2} className="p-3 justify-between h-24">
        <p className="p2 line-clamp-2">{title}</p>
        <p className="p2 text-muted-foreground">{date}</p>
      </Col>
    </a>
  </Card>
);

const HowItWorks = () => (
  <Col className="p-8" gap={2}>
    <h4 className="mb-4">How it works</h4>
    <Row gap={2} className="items-center">
      <NumSignpost
        backgroundColor="bg-theme_yellow-accent"
        borderColor="border-theme_violet"
        num={1}
      />
      <p className="p-medium">Collect voices at scale</p>
    </Row>
    <p className="text-muted-foreground">
      Input can be survey responses, interviews, meeting transcripts, social
      media discussions, or structured conversations with T3C's survey AI-driven
      tool through WhatsApp.
    </p>

    <Row gap={2} className="items-center">
      <NumSignpost
        backgroundColor="bg-theme_blueSea-accent"
        borderColor="border-theme_blueSea"
        num={2}
      />
      <p className="p-medium">Analyze with Large Language Models (LLM)</p>
    </Row>

    <p className="text-muted-foreground">
      T3C uses large language models to identify themes and summarize specific
      claims.
    </p>

    <Row gap={2} className="items-center">
      <NumSignpost
        backgroundColor="bg-theme_purple-accent"
        borderColor="border-theme_purple"
        num={3}
      />
      <p className="p-medium">Ground insights in quotes</p>
    </Row>

    <p className="text-muted-foreground">
      Each summary links back to participant statements, so you can always see
      the source.
    </p>

    <Row gap={2} className="items-center">
      <NumSignpost
        backgroundColor="bg-theme_blueSky-accent"
        borderColor="border-theme_blueSky"
        num={4}
      />
      <p className="p-medium">Interactive reports</p>
    </Row>
    <p className="text-muted-foreground">
      Results are shared in an online report, where you can explore themes and
      dive into the details behind them.
    </p>
  </Col>
);

const NumSignpost = ({
  backgroundColor,
  borderColor,
  num,
}: {
  backgroundColor: BackgroundAccentClass;
  borderColor: BorderClass;
  num: number;
}) => (
  <div
    className={`h-6 w-6 rounded-sm ${borderColor} ${backgroundColor} border-[1px] flex`}
  >
    <p className="p-medium mx-auto">{num}</p>
  </div>
);

const WhoIsItFor = () => (
  <Col gap={6} className="p-8">
    <h4>Who is it for</h4>
    <Col gap={4} className="md:flex-row gap-x-6">
      <OrgCard
        backgroundColor="bg-theme_purple-accent"
        borderColor="border-theme_purple"
        title="Communities and networks"
        points={[
          "Raise topics for deliberation",
          "Empower members to participate in shaping the organization",
          "Streamline decision making processes",
        ]}
        footer="Example orgs: Activist, Grass roots, DAOs"
      />
      <OrgCard
        backgroundColor="bg-theme_greenLeaf-accent"
        borderColor="border-theme_greenLeaf"
        title="Public sector and policy makers"
        points={[
          "Understand what your public believes and needs to inform policy",
          "Increase speed and clarity of decision making",
          "Decrease cost and time of analyzing large amounts of qualitative data",
        ]}
        footer="Example orgs: Gov groups, Policy analysts and evaluators"
      />
      <OrgCard
        backgroundColor="bg-theme_blueSky-accent"
        borderColor="border-theme_blueSky"
        title="Enterprises and teams"
        points={[
          "Make faster, more agile decisions",
          "Keep a finger on the pulse of your organization",
          "Empower staff to participate in shaping the organization",
        ]}
        footer="Example orgs: Executives, HR, Analysts"
      />
    </Col>
  </Col>
);

const OrgCard = ({
  title,
  points,
  footer,
  backgroundColor,
  borderColor,
}: {
  title: string;
  points: string[];
  backgroundColor: BackgroundAccentClass;
  borderColor: BorderClass;
  footer?: string;
}) => (
  <Col
    gap={3}
    className={`flex-1 py-4 px-[18px] ${backgroundColor} ${borderColor} border-[1px] rounded-sm`}
  >
    <p className="p-medium">{title}</p>
    <ul className="list-disc pl-4 flex-grow">
      {points.map((point) => (
        <li key={point} className="text-muted-foreground">
          {point}
        </li>
      ))}
    </ul>
    {footer && <p className="p2 text-muted-subtle">{footer}</p>}
  </Col>
);

const WhyT3CIsDifferent = () => (
  <Col gap={4} className="p-8">
    <h4>Why T3C is different</h4>

    <Col gap={4}>
      <DifferentiatorItem
        icon={ICON_NAMES.NETWORK}
        title="Depth and scale, together"
        description="Focus groups capture nuance, and polls capture scale. T3C does both."
      />

      <DifferentiatorItem
        icon={ICON_NAMES.SHIELD}
        title="More trustworthy than standard AI"
        description="By grounding every claim in verified quotes, T3C minimizes the hallucination problem that plagues other LLM tools."
      />

      <DifferentiatorItem
        icon={ICON_NAMES.OPEN}
        title="Open-source and public-interest driven"
        description="Built by the nonprofit AI Objectives Institute, T3C is open-source and transparent by design."
      />

      <DifferentiatorItem
        icon={ICON_NAMES.PROVEN}
        title="Proven in practice"
        description="Governments, unions, and advocacy groups have already used T3C to turn thousands of individual voices into clear, actionable agendas."
      />
    </Col>

    <p className="text-muted-foreground">
      Previous versions of Talk to the City have been used by the Taiwanese
      government and the Taiwan AI Assembly, unions, policy makers and more. See
      our{" "}
      <a
        href={EXTERNAL_LINKS.CASE_STUDIES}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View case studies"
      >
        case studies
      </a>{" "}
      for more details.
    </p>
    <p className="text-muted-foreground">
      Built by the{" "}
      <a
        href={EXTERNAL_LINKS.AI_OBJECTIVES_INSTITUTE}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit AI Objectives Institute website"
      >
        AI Objectives Institute
      </a>
      . All code is open-source on{" "}
      <a
        href={EXTERNAL_LINKS.GITHUB_REPO}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source code on GitHub"
      >
        Github
      </a>
      .
    </p>
    <p className="text-muted-foreground">
      Have a question we didn't answer here, or interested in direct support in
      using Talk to the City? Reach out at {CONTACT_EMAIL}.
    </p>
  </Col>
);

const DIFFERENTIATOR_ICONS: Record<IconName, React.ReactNode> = {
  [ICON_NAMES.NETWORK]: (
    <Image
      src="/images/icon-network.png"
      alt=""
      width={20}
      height={20}
      unoptimized
    />
  ),
  [ICON_NAMES.SHIELD]: (
    <Image
      src="/images/icon-shield.png"
      alt=""
      width={20}
      height={20}
      unoptimized
    />
  ),
  [ICON_NAMES.OPEN]: (
    <Image
      src="/images/icon-copyright.png"
      alt=""
      width={20}
      height={20}
      unoptimized
    />
  ),
  [ICON_NAMES.PROVEN]: (
    <Image
      src="/images/icon-gear.png"
      alt=""
      width={20}
      height={20}
      unoptimized
    />
  ),
};

const DifferentiatorItem = ({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) => {
  return (
    <Row gap={3} className="items-start">
      <div className="h-6 w-6 flex items-center justify-center flex-shrink-0 mt-1">
        {DIFFERENTIATOR_ICONS[icon]}
      </div>
      <Col gap={1}>
        <p className="p-medium">{title}</p>
        <p className="text-muted-foreground">{description}</p>
      </Col>
    </Row>
  );
};

const Media = () => {
  // Split media items into rows (3 in first row, rest in second)
  const firstRow = MEDIA_ITEMS.slice(0, 3);
  const secondRow = MEDIA_ITEMS.slice(3);

  return (
    <Col gap={4} className="p-8">
      <h4>Media</h4>
      <Col gap={6}>
        <Col gap={4} className="md:flex-row gap-x-4 items-start">
          {firstRow.map((item) => (
            <MediaCard key={item.title} {...item} />
          ))}
        </Col>
        {secondRow.length > 0 && (
          <Col gap={4} className="md:flex-row gap-x-4 items-start">
            {secondRow.map((item) => (
              <MediaCard key={item.title} {...item} />
            ))}
          </Col>
        )}
      </Col>
      <p className="text-muted-foreground mt-2">
        See all our media assets in our{" "}
        <a
          href={EXTERNAL_LINKS.PRESS_KIT}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-subtle underline hover:text-foreground"
          aria-label="Download press kit PDF"
        >
          Press Kit
        </a>
      </p>
    </Col>
  );
};

const MediaCard = ({
  imageUri,
  title,
  source,
  sourceIcon,
  url,
  imageBgColor,
}: {
  imageUri: string;
  title: string;
  source: string;
  sourceIcon: string;
  url: string;
  imageBgColor?: string;
}) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="w-full md:max-w-[260px]"
    aria-label={`Read article: ${title}`}
  >
    <Card className="w-full transition-transform duration-200 transform hover:opacity-90">
      <div className="w-full aspect-[1.5] md:max-w-[260px] md:max-h-[171px] relative rounded-t-sm">
        <Image
          src={imageUri}
          alt={`${title} article cover`}
          fill
          sizes={IMAGE_SIZES.CARD}
          className="object-cover rounded-t-sm"
          loading="lazy"
        />
        {imageBgColor && (
          <div
            className="absolute inset-0 rounded-t-sm pointer-events-none"
            style={{ backgroundColor: imageBgColor, opacity: 0.4 }}
          />
        )}
      </div>
      {/* Title section with padding */}
      <div className="pt-3 px-3">
        <p className="p2">{title}</p>
      </div>
      {/* Logo section with padding */}
      <div className="pt-2 px-3 pb-3">
        <Row className="items-center">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
            <div className="w-10 h-10 relative">
              <Image
                src={sourceIcon}
                alt={`${source} logo`}
                fill
                sizes={IMAGE_SIZES.ICON_SMALL}
                className="object-contain rounded-full"
              />
            </div>
          </div>
          <p className="p-medium ml-2">{source}</p>
        </Row>
      </div>
    </Card>
  </a>
);

const FundersAndPartners = () => (
  <Col gap={6} className="p-8">
    <h4>Funders and partners</h4>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
      {PARTNERS.map((partner) => (
        <PartnerLogo key={partner.name} {...partner} />
      ))}
    </div>
  </Col>
);

const PartnerLogo = ({
  name,
  logoUri,
  url,
}: {
  name: string;
  logoUri: string;
  url: string;
}) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="w-32 h-16 relative flex items-center justify-center"
    aria-label={`Visit ${name} website`}
  >
    <Image
      src={logoUri}
      alt={`${name} logo`}
      fill
      sizes={IMAGE_SIZES.PARTNER_LOGO}
      className="object-contain opacity-70 hover:opacity-100 transition-opacity"
      loading="lazy"
    />
  </a>
);
