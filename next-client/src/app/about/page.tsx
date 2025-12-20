import type React from "react";
import Icons from "@/assets/icons";
import { Col, Row } from "@/components/layout";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";
import {
  CaseStudies,
  DemoVideo,
  HowItWorks,
  Overview,
} from "./components/AboutSections";
import { ContentGroup } from "./components/ContentGroup";
import { FAQ, ReportCreationFAQ } from "./components/FAQSections";
import { PrivacySecurity } from "./components/PrivacySecurity";

const ContentGroupContainer = ({ children }: React.PropsWithChildren) => (
  <Col gap={6}>{children}</Col>
);

const Outline = () => (
  <Col gap={2}>
    <Row gap={1} className="items-center">
      <Icons.Outline className="stroke-muted-foreground" size={16} />
      <p className="text-muted-foreground text-sm tracking-wide">Outline</p>
    </Row>
    <ul className="text-muted-foreground text-sm leading-5 pl-2 space-y-2">
      <li>
        – <a href="#overview">Overview</a>
      </li>
      <li>
        – <a href="#how-it-works">How it works</a>
      </li>
      <li>
        – <a href="#demo-video">Demonstration video</a>
      </li>
      <li>
        – <a href="#case-studies">Case studies</a>
      </li>
      <li>
        – <a href="#faq">FAQ</a>
      </li>
      <li>
        – <a href="#tutorial">Report creation FAQ</a>
      </li>
      <li>
        – <a href="#privacy-security">Privacy & security</a>
      </li>
    </ul>
  </Col>
);

export default async function AboutPage() {
  const analytics = await serverSideAnalyticsClient();
  await analytics.page("About");
  return (
    <Col className="p-4 sm:p-8 max-w-[896px] m-auto">
      <ContentGroupContainer>
        <ContentGroup>
          <h2>About</h2>
          <Outline />
        </ContentGroup>
        <Overview />
        <HowItWorks />
        <DemoVideo />
        <CaseStudies />
        <FAQ />
        <ReportCreationFAQ />
        <PrivacySecurity />
      </ContentGroupContainer>
    </Col>
  );
}
