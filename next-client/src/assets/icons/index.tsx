import { Link, Plus, Quote, ChevronRight } from "lucide-react";

import TopicSVG from "./Topic.svg";
import QuoteSVG from "./quote aoi.svg";
import ClaimSVG from "./Claim.svg";

import Image from "next/image";

const Icons = () => <></>;

const Copy = Link;

Icons.Copy = Copy;

Icons.Plus = Plus;

Icons.ChevronRight = ChevronRight;

// ! Go back through here and refigure this out

Icons.Topic = (props: { className?: string }) => (
  <Image {...props} src={TopicSVG} alt="topic icon" />
);

// ! Fill color doesn't seem to be working
Icons.Quote = (props: { className?: string }) => (
  <Image {...props} src={QuoteSVG} alt="topic icon" />
);

Icons.Claim = (props: { className?: string }) => (
  <Image {...props} src={ClaimSVG} alt="topic icon" />
);

export default Icons;
