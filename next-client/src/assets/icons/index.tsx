import {
  Link,
  Plus,
  BookText,
  CircleUserRound,
  Calendar,
  ArrowUpDown,
} from "lucide-react";

import TopicSVG from "./Topic.svg";
import QuoteSVG from "./quote aoi.svg";
import ClaimSVG from "./Claim.svg";
import ChevronRight from "./ChevronRight.svg";

import Image from "next/image";

const Icons = () => <></>;

const Copy = Link;

Icons.Copy = Copy;

Icons.Plus = Plus;

Icons.Theme = BookText;

Icons.People = CircleUserRound;

Icons.Date = Calendar;

Icons.Select = ArrowUpDown;

Icons.ChevronRight = (props: { className?: string }) => (
  <Image {...props} src={ChevronRight} alt="chevron icon" />
);

Icons.Topic = (props: { className?: string }) => (
  <Image {...props} src={TopicSVG} alt="topic icon" />
);

Icons.Quote = (props: { className?: string }) => (
  <Image {...props} src={QuoteSVG} alt="topic icon" />
);

Icons.Claim = (props: { className?: string }) => (
  <Image {...props} src={ClaimSVG} alt="topic icon" />
);

export default Icons;
