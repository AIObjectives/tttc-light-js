import { Progress } from "@/components/elements";
import { Col } from "@/components/layout";

export default function ReportLoading() {
  return (
    <Col className="w-full h-full flex-grow items-center justify-center">
      <Progress value={0} className="w-[60%]" />
      <p>Your report is queued...</p>
    </Col>
  );
}
