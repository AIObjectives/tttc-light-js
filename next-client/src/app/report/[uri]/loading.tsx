import { Spinner } from "@/components/elements";
import { Col } from "@/components/layout";

export default function ReportLoading() {
  return (
    <Col className="w-full h-full flex-grow items-center justify-center">
      <Spinner className="size-8" label="Loading report" />
    </Col>
  );
}
