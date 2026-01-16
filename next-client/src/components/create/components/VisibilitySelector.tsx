"use client";
import { Globe, Lock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/elements";
import { Col, Row } from "@/components/layout";
import type { FormItemState } from "../hooks/useFormState";

interface VisibilitySelectorProps {
  visibility: FormItemState<boolean>;
}

/**
 * Visibility selector for the Create Report form.
 * Allows user to choose between "Only me" (default) and "Anyone with the link".
 */
export function VisibilitySelector({ visibility }: VisibilitySelectorProps) {
  // visibility.state is isPublic: true = shared, false = only me
  const value = visibility.state ? "shared" : "private";

  const handleChange = (newValue: string) => {
    visibility.setState(newValue === "shared");
  };

  return (
    <>
      {/* Hidden input for form submission - only included when shared */}
      {visibility.state && <input type="hidden" name="isPublic" value="on" />}
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue>
            <Row gap={2} className="items-center">
              {value === "private" ? (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Only me</span>
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  <span>Anyone with the link</span>
                </>
              )}
            </Row>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="private">
            <Row gap={2} className="items-center">
              <Lock className="h-4 w-4" />
              <span>Only me</span>
            </Row>
          </SelectItem>
          <SelectItem value="shared">
            <Row gap={2} className="items-center">
              <Globe className="h-4 w-4" />
              <span>Anyone with the link</span>
            </Row>
          </SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

/**
 * Form section for visibility selection on the Create Report page.
 */
export function FormVisibility({
  visibility,
}: {
  visibility: FormItemState<boolean>;
}) {
  return (
    <Col gap={4}>
      <h4>Visibility</h4>
      <Col gap={2}>
        <VisibilitySelector visibility={visibility} />
        <p className="p2 text-muted-foreground">
          Choose between &ldquo;Only me&rdquo; (only you can see the report), or
          &ldquo;Anyone with the link&rdquo; (anyone with the link can view it).
          You can change this later from the Share button on the report page.
        </p>
      </Col>
    </Col>
  );
}
