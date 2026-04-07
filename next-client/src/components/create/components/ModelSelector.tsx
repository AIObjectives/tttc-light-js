"use client";
import { SUPPORTED_MODELS, type SupportedModel } from "tttc-common/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/elements";
import { Col } from "@/components/layout";
import type { FormItemState } from "../hooks/useFormState";

interface ModelSelectorProps {
  selectedModel: FormItemState<SupportedModel>;
  show: boolean;
}

/**
 * Model selector for the Create Report form.
 * Allows the user to choose which AI model to use for report generation.
 * Only rendered when the model_selection_enabled feature flag is active.
 *
 * @param selectedModel - Form state item tracking the currently selected model
 * @param show - When false, renders nothing (including no hidden input)
 */
export function ModelSelector({ selectedModel, show }: ModelSelectorProps) {
  if (!show) return null;

  return (
    <>
      {/* Hidden input so selected model is included in FormData on submit */}
      <input type="hidden" name="model" value={selectedModel.state} />
      <Col gap={4}>
        <h4>AI Model</h4>
        <Col gap={2}>
          <label htmlFor="model" className="font-medium">
            Model
          </label>
          <p id="model-description" className="p2 text-muted-foreground">
            Choose the AI model to use for generating your report.
          </p>
          <Select
            value={selectedModel.state}
            onValueChange={(val: SupportedModel) => selectedModel.setState(val)}
          >
            <SelectTrigger
              className="w-full max-w-[250px]"
              id="model"
              aria-describedby="model-description"
            >
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_MODELS.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Col>
      </Col>
    </>
  );
}
