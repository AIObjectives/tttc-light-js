import React from "react";
import { Col, Row } from "../layout";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
} from "../elements";
import Icons from "@/assets/icons";
import { BackgroundAccentClass, BorderClass } from "@/lib/hooks/useTopicTheme";
import LandingHero from "@/assets/hero/LandingHero";
import Image from "next/image";

export default function Landing() {
  return (
    <Col gap={4} className="max-w-[896px] mx-auto">
      <Title />
      <div className="px-4">
        <LandingHero className="w-full h-auto" />
      </div>
      <About />
      <AudreyTangQuote />
      <Organizations />
      <CaseStudies />
      <HowItWorks />
    </Col>
  );
}

const Title = () => (
  <Col className="p-8" gap={2}>
    <h2>Talk to the City</h2>
    <p className="text-muted-foreground">
      Talk to the City helps large groups of people coordinate by understanding
      each other better, faster, and in more depth.
    </p>
  </Col>
);

const About = () => (
  <Col className="p-8" gap={2}>
    <h4>About</h4>
    <p>
      An open-source AI tool that distills insights from large-scale public
      input, while preserving details of individual views. Leaders and
      policymakers need to understand the people they organize and govern, but
      traditional methods either sacrifice depth for scale or scale for depth.
      Talk to the City bridges this gap with an open-source AI platform that
      turns large-scale conversations into actionable insights while preserving
      individual perspectives—from local town halls to national policy
      discussions.
    </p>
    <p className="text-muted-foreground">
      Learn more:{" "}
      <a href="/about" className="underline">
        About Talk to the City
      </a>
    </p>
  </Col>
);

const AudreyTangQuote = () => (
  <Col gap={4} className="p-8 md:flex-row gap-x-4">
    <Avatar className="h-20 w-20">
      <AvatarImage src={"/images/audrey-tang.png"} />
      <AvatarFallback>Audrey</AvatarFallback>
    </Avatar>
    <Card>
      <CardContent className="sm:p-6">
        <Row gap={3}>
          <div className="self-start flex-shrink-0 py-[5px]">
            <Icons.Quote className={"h-4 w-4 fill-muted-foreground"} />
          </div>
          <Col>
            <p className="text-muted-foreground">
              “Ten years ago, the vTaiwan scope was limited, because stakeholder
              groups needed to adapt to the technology at the time. Today, this
              is being bridged with the advent of language models that can adapt
              to their needs. Back in 2014, it was impossible with the capacity
              of g0v contributors to interview a mini public of people and
              aggregate their ideas while preserving the full nuance. But now,
              with Talk to the City’s help, that cost has been reduced to
              essentially zero. It’s broad-listening and it can change the
              nature of this recursive public.”
            </p>
            <p className="text-muted-foreground">
              - Audrey Tang, Taiwan’s 1st Digital Minister and co-author of{" "}
              <a
                target="_blank"
                className="underline"
                href="https://www.plurality.net/"
              >
                Plurality.net
              </a>
            </p>
          </Col>
        </Row>
      </CardContent>
    </Card>
  </Col>
);

const CaseStudies = () => (
  <Col gap={4} className="p-8">
    <h4>Case studies</h4>
    <Col gap={6}>
      <Col gap={4} className="md:flex-row gap-x-4 items-center">
        <CaseStudy
          title={"AI Assemblies"}
          imageUri={"/images/case-study_ai-assemblies.jpg"}
          resourceUrl="/report/https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-newbucket%2Fai_assembly_2023_t3c.json"
          date={new Date("Februrary 21, 2024").toDateString()}
        />
        <CaseStudy
          title="Recent views on DeepSeek"
          imageUri="/images/case-study_deep-seek_archaique-chang-unsplash.jpg"
          resourceUrl="/report/https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2F7b8053b6ccbc5f85d10770281696281a421309f6c6e0aecc461cb82ac65b4777"
          date={new Date("Feb 8, 2025").toDateString()}
        />
        <CaseStudy
          title="Deliberative Technologies in Polarized Contexts"
          imageUri="/images/case-study_polarizing-crop.jpg"
          resourceUrl="/report/https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-newbucket%2Fdeliberative_tech_polarized_context_t3c.json"
          date={new Date("June 26, 2024").toDateString()}
        />
      </Col>
      <Col gap={4} className="md:flex-row gap-x-4 items-center">
        <CaseStudy
          title="AI Manifestos"
          imageUri="/images/case-study_ai-manifestos_marcus-woodbridge_unsplash.jpg"
          resourceUrl="/report/https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-newbucket%2Fai_manifestos_10s_12K.json"
          date={new Date("Nov 5, 2024").toDateString()}
        />
        <CaseStudy
          title="Heal Michigan"
          imageUri="/images/case-study_heal-michigan-crop.jpg"
          resourceUrl="/report/https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-newbucket%2Fheal_michigan_t3c.json"
          date={new Date("August 25, 2023").toDateString()}
        />
      </Col>
    </Col>
  </Col>
);

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
  <a href={resourceUrl} target="blank">
    <Card className="max-w-[260px] transition-transform duration-200 transform hover:opacity-90">
      <div className="w-[260px] h-[171px] relative">
        <Image
          src={imageUri}
          alt={`${title} image`}
          layout="fill"
          className="rounded-t-sm"
        />
      </div>
      <Col gap={2} className="p-3 justify-between h-24">
        <p className="p2 line-clamp-2">{title}</p>
        <p className="p2 text-muted-foreground">{date}</p>
      </Col>
    </Card>
  </a>
);

const Organizations = () => (
  <Col gap={6} className="p-8">
    <h4>Organizations</h4>
    <Col gap={4} className="md:flex-row gap-x-6">
      <OrgCard
        backgroundColor="bg-theme_purple-accent"
        borderColor="border-theme_purple"
        title="Membership-based organizations"
        points={[
          "Raise topics for deliberaton",
          "Allow members to participate in shaping the organization",
          "Streamline decision making processes",
        ]}
        footer="Example orgs: Unions, DAOs, Grassroots organizing"
      />
      <OrgCard
        backgroundColor="bg-theme_greenLeaf-accent"
        borderColor="border-theme_greenLeaf"
        title="Government and policy"
        points={[
          "Understand what your public believes and needs",
          "Increase speed and clarity of decision making",
          "Decrease cost and time of analyzing large amounts of qualitative data",
        ]}
        footer="Example orgs: Public officials, Policy analysts & evaluators"
      />
      <OrgCard
        backgroundColor="bg-theme_blueSky-accent"
        borderColor="border-theme_blueSky"
        title="Enterprise"
        points={[
          "Make faster, more agile decisions",
          "Keep a finger on the pulse of your organization",
          "Empower staff to participate in decision-making",
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
  footer: string;
}) => (
  <Col
    gap={3}
    className={`flex-1 py-4 px-[18px] ${backgroundColor} ${borderColor} border-[1px]`}
  >
    <p className="p-medium">{title}</p>
    <ul className="list-disc pl-4 flex-grow">
      {points.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
    <p className="p2">{footer}</p>
  </Col>
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
      <p className="p-medium">Gather</p>
    </Row>
    <p className="text-muted-foreground">
      Gather and analyze qualitative data from a group of any size. Process
      unstructured text, long form responses, and video interviews, or prompt
      participants over Whatsapp with a custom chatbot.
    </p>

    <Row gap={2} className="items-center">
      <NumSignpost
        backgroundColor="bg-theme_blueSea-accent"
        borderColor="border-theme_blueSea"
        num={2}
      />
      <p className="p-medium">Explore</p>
    </Row>

    <p className="text-muted-foreground">
      Explore from core themes within the data all the way down to individual
      claims and quotes made by each participant.
    </p>

    <Row gap={2} className="items-center">
      <NumSignpost
        backgroundColor="bg-theme_purple-accent"
        borderColor="border-theme_purple"
        num={3}
      />
      <p className="p-medium">Share</p>
    </Row>

    <p className="text-muted-foreground">
      Share your findings and the voices within your communities to inform
      direction and decision making.
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
    className={`h-6 w-6 rounded-sm ${borderColor} ${backgroundColor} border-[1px]`}
  >
    <p className="p-medium justify-self-center">{num}</p>
  </div>
);
