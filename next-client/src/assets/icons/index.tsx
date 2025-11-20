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
  MessageCircle,
  X,
} from "lucide-react";

import TopicSVG from "./TopicSvg";
import QuoteSVG from "./QuoteSvg";
import ClaimSVG from "./ClaimSvg";
// TODO:  Capitalize Chevron and Response SVG
import ChevronRightSvg from "./ChevronRightSvg";
import ChevronRight16SVG from "./ChevronRight16Svg";
import ResponseSvg from "./ResponseSvg";
import LightbulbSvg from "./LightbulbSvg";
import XSVG from "./XSvg";
import X2SVG from "./X2Svg";
import QuoteBubbleSVG from "./QuoteBubbleSvg";
import ResetSVG from "./Reset";
import InfoSvg from "./InfoSvg";
import LogoSvg from "./LogoSvg";
import TTTC_SVG from "./TTTC";
import MobileOutlineSvg from "./MobileOutlineSvg";
import WhatsAppSvg from "./WhatsappSvg";
import {
  ControversyIcon,
  ControversyLowIcon,
  ControversyModerateIcon,
  ControversyHighIcon,
} from "./ControversyIcons";

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

Icons.Feedback = MessageCircle;

Icons.Lightbulb = (props: { className?: string }) => (
  <LightbulbSvg {...props} />
);

Icons.Logo = (props: { className?: string }) => <LogoSvg {...props} />;

Icons.TTTC = (props: { className?: string }) => <TTTC_SVG {...props} />;

Icons.Info = (props: { className?: string }) => <InfoSvg {...props} />;

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

Icons.X2 = (props: { className?: string }) => <X2SVG {...props} />;

Icons.Reset = (props: { className?: string }) => <ResetSVG {...props} />;

Icons.MobileOutline = (props: { className?: string }) => (
  <MobileOutlineSvg {...props} />
);

Icons.WhatsApp = (props: { className?: string }) => <WhatsAppSvg {...props} />;

Icons.Controversy = ControversyIcon;
Icons.ControversyLow = ControversyLowIcon;
Icons.ControversyModerate = ControversyModerateIcon;
Icons.ControversyHigh = ControversyHighIcon;

export default Icons;
