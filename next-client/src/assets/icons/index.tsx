import {
  Link,
  Plus,
  Minus,
  BookText,
  CircleUserRound,
  Calendar,
  ArrowUpDown,
  Github,
  Menu,
  CheckCircle,
  AlignLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import TopicSVG from "./TopicSvg";
import QuoteSVG from "./QuoteSvg";
import ClaimSVG from "./ClaimSvg";
// TODO:  Capitalize Chevron and Response SVG
import ChevronRightSvg from "./ChevronRightSvg";
import ChevronRight16SVG from "./ChevronRight16Svg";
import ResponseSvg from "./ResponseSvg";
import InfoSVG from "./InfoSvg";
import XSVG from "./XSvg";
import QuoteBubbleSVG from "./QuoteBubbleSvg";
import ResetSVG from "./Reset";

const Icons = () => <></>;

const Copy = Link;

Icons.Copy = Copy;

Icons.Plus = Plus;

Icons.Minus = Minus;

Icons.Theme = BookText;

Icons.People = CircleUserRound;

Icons.Date = Calendar;

Icons.Select = ArrowUpDown;

Icons.Github = Github;

Icons.Menu = Menu;

Icons.Success = CheckCircle;

Icons.Outline = AlignLeft;

Icons.OutlineExpanded = ChevronUp;

Icons.OutlineCollapsed = ChevronDown;

Icons.Info = (props: { className?: string }) => <InfoSVG {...props} />;

Icons.ChevronRight = (props: { className?: string }) => (
  <ChevronRightSvg {...props} />
);

Icons.ChevronRight16 = (props: { className?: string }) => (
  <ChevronRight16SVG {...props} />
);

Icons.Topic = (props: { className?: string }) => <TopicSVG {...props} />;

Icons.Quote = (props: { className?: string }) => <QuoteSVG {...props} />;

Icons.QuoteBubble = (props: { className?: string }) => (
  <QuoteBubbleSVG {...props} />
);

Icons.Claim = (props: { className?: string }) => <ClaimSVG {...props} />;

Icons.Response = (props: { className?: string }) => <ResponseSvg {...props} />;

Icons.X = (props: { className?: string }) => <XSVG {...props} />;

Icons.Reset = (props: { className?: string }) => <ResetSVG {...props} />;

export default Icons;
