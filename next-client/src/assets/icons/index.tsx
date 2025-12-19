import {
  AlignLeft,
  ArrowUpDown,
  BookText,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CircleUserRound,
  Github,
  Link,
  Menu,
  MessageCircle,
  Minus,
  PlaySquare,
  Plus,
  X,
} from "lucide-react";
import ChevronRight16SVG from "./ChevronRight16Svg";
// TODO:  Capitalize Chevron and Response SVG
import ChevronRightSvg from "./ChevronRightSvg";
import ClaimSVG from "./ClaimSvg";
import {
  ControversyHighIcon,
  ControversyIcon,
  ControversyLowIcon,
  ControversyModerateIcon,
} from "./ControversyIcons";
import InfoSvg from "./InfoSvg";
import LightbulbSvg from "./LightbulbSvg";
import LogoSvg from "./LogoSvg";
import MobileOutlineSvg from "./MobileOutlineSvg";
import QuoteBubbleSVG from "./QuoteBubbleSvg";
import QuoteSVG from "./QuoteSvg";
import ResetSVG from "./Reset";
import ResponseSvg from "./ResponseSvg";
import TopicSVG from "./TopicSvg";
import TTTC_SVG from "./TTTC";
import WhatsAppSvg from "./WhatsappSvg";
import X2SVG from "./X2Svg";
import XSVG from "./XSvg";

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

Icons.Play = PlaySquare;

export default Icons;
