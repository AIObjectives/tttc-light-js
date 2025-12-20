import { Col } from "@/components/layout";

export const ContentGroup = ({ children }: React.PropsWithChildren) => (
  <Col gap={3}>{children}</Col>
);
