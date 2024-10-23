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
import ChevronRightSvg from "./ChevronRightSvg";

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

Icons.ChevronRight = (props: { className?: string }) => (
  <ChevronRightSvg {...props} />
);

Icons.Topic = (props: { className?: string }) => <TopicSVG {...props} />;

Icons.Quote = (props: { className?: string }) => <QuoteSVG {...props} />;

Icons.Claim = (props: { className?: string }) => <ClaimSVG {...props} />;

export default Icons;
