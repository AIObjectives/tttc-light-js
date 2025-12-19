import React from "react";
import Icons from "@/assets/icons";
import { Button, TextArea } from "@/components/elements";
import { Col, Row } from "@/components/layout";
import type { FormItemState } from "../hooks/useFormState";

export function CustomizePromptSection({
  title,
  subheader,
  inputName,
  show = true,
  formState,
}: {
  title: string;
  subheader: string;
  inputName: string;
  show?: boolean;
  formState: FormItemState<string>;
}) {
  return (
    <Col gap={3} className={`${show ? "block" : "hidden"}`}>
      <Col gap={1}>
        <p className="font-medium">{title}</p>
        <p className="p2 text-muted-foreground">{subheader}</p>
      </Col>
      <TextArea
        id={inputName}
        name={inputName}
        value={formState.state}
        onChange={(e) => formState.setState(e.target.value)}
        className={`${formState.initialValue === formState.state && "text-muted-foreground"} ${formState.status.tag === "failure" && "border-destructive"}`}
        required
      />
      {formState.status.tag === "failure" && (
        <p className="text-destructive text-sm">
          {formState.status.error.message}
        </p>
      )}
      <div>
        <Button
          variant={"outline"}
          disabled={formState.initialValue === formState.state}
          onClick={() => formState.setState(formState.initialValue || "")}
          type="button"
        >
          <Row gap={2} className="items-center">
            <Icons.Reset />
            Reset to default
          </Row>
        </Button>
      </div>
    </Col>
  );
}
