"use client";
import { ChevronDown, Link } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/elements";
import { Col, Row } from "@/components/layout";
import { useReportVisibility } from "@/hooks/useReportVisibility";

interface ShareDropdownProps {
  reportId: string;
}

/**
 * Share dialog for the report toolbar.
 * Allows report owners to:
 * - Change visibility ("Only me" / "Anyone with the link") - auto-saves on change
 * - Copy the report URL
 *
 * Only renders for authenticated report owners.
 */
export function ShareDropdown({ reportId }: ShareDropdownProps) {
  const { isPublic, isOwner, isLoading, updateVisibility } =
    useReportVisibility(reportId);

  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Auto-save visibility change when dropdown selection changes
  const handleVisibilityChange = useCallback(
    async (value: string) => {
      const newIsPublic = value === "public";

      // Skip if no actual change or already updating
      if (newIsPublic === isPublic || isUpdating) return;

      setIsUpdating(true);
      try {
        await updateVisibility(newIsPublic);
        if (newIsPublic) {
          toast.success("Report is now shareable with anyone who has the link");
        } else {
          toast.success("Report is now private");
        }
      } catch {
        toast.error("Failed to update visibility");
      } finally {
        setIsUpdating(false);
      }
    },
    [isPublic, isUpdating, updateVisibility],
  );

  // Copy URL to clipboard (independent of visibility)
  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);

      if (isPublic) {
        toast.success("Link copied to clipboard");
      } else {
        toast.success("Link copied to clipboard", {
          description:
            "Note: This report is private. Others won't be able to view it.",
        });
      }
    } catch {
      toast.error("Failed to copy link");
    }

    setIsOpen(false);
  }, [isPublic]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Don't render if not the owner or still loading ownership status
  if (isLoading || !isOwner) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          className="gap-1.5"
          aria-label={`Share settings. Report is currently ${isPublic ? "shared with anyone who has the link" : "private, only visible to you"}`}
        >
          <Link className="h-4 w-4" aria-hidden="true" />
          <span>Share</span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 p-4"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Prevent closing when interacting with the Select popover
          // (which renders in a portal outside the dropdown)
          const target = e.target as HTMLElement;
          if (target.closest('[role="listbox"]')) {
            e.preventDefault();
          }
        }}
      >
        <Col gap={4}>
          {/* Header */}
          <span className="text-sm font-medium">Visibility</span>

          {/* Visibility selector - auto-saves on change */}
          <Select
            value={isPublic ? "public" : "private"}
            onValueChange={handleVisibilityChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Only me</SelectItem>
              <SelectItem value="public">Anyone with the link</SelectItem>
            </SelectContent>
          </Select>

          {/* Footer buttons */}
          <Row gap={2} className="justify-end mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant={isPublic ? "default" : "secondary"}
              size="sm"
              onClick={handleCopyUrl}
              disabled={isUpdating}
            >
              Copy URL
            </Button>
          </Row>
        </Col>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
