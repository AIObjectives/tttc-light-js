"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  TextArea,
} from "@/components/elements";
import { fetchWithRequestId } from "@/lib/api/fetchWithRequestId";
import { useUserQuery } from "@/lib/query/useUserQuery";

interface ProfileSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (isFullyComplete: boolean) => void;
}

/**
 * ProfileSetupModal - Progressive Profiling
 *
 * Shown after signup to collect business context for CRM.
 * Key fields: Company and Use Case (required for "complete" status)
 * Optional fields: Title, Phone, Newsletter opt-in
 *
 * UX design:
 * - Skippable (not blocking)
 * - Clear value proposition
 * - Reprompts after 7 days if skipped, max 3 times
 */
export function ProfileSetupModal({
  isOpen,
  onClose,
  onComplete,
}: ProfileSetupModalProps) {
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [useCase, setUseCase] = useState("");
  // GDPR: Newsletter opt-in defaults to false (unchecked) - user must actively opt-in
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUserQuery();

  const handleSubmit = async () => {
    if (!user) {
      setError("You must be signed in to update your profile");
      return;
    }

    // At least one key field must be filled
    if (!company && !useCase) {
      setError("Please enter your company name or describe your use case");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetchWithRequestId("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company: company || undefined,
          title: title || undefined,
          phone: phone || undefined,
          useCase: useCase || undefined,
          newsletterOptIn,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error?.message || `Failed to update profile: ${response.status}`,
        );
      }

      // Only mark as fully complete if both key fields are filled
      const isFullyComplete = !!(company && useCase);
      onComplete(isFullyComplete);
      onClose();
    } catch (err) {
      console.error("Profile update failed:", err);
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent
        className="gap-8 p-6 max-w-sm z-100"
        overlayProps={{ className: "z-90" }}
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl">What are your needs</DialogTitle>
          <DialogDescription className="text-base font-medium">
            How will you use Talk to the City? It helps us offer better support
            and features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="company"
              className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Company or organization
            </label>
            <Input
              id="company"
              type="text"
              placeholder="Acme Corp"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={isSubmitting}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="title"
              className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Job title{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Input
              id="title"
              type="text"
              placeholder="Research director"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Phone{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 555-5555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="useCase"
              className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              How will you use Talk to the City?
            </label>
            <TextArea
              id="useCase"
              placeholder="e.g. Analyzing community feedback, research project, policy consultation"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              disabled={isSubmitting}
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Newsletter opt-in (GDPR: defaults to unchecked) */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="newsletterOptIn"
              checked={newsletterOptIn}
              onChange={(e) => setNewsletterOptIn(e.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-primary"
            />
            <label htmlFor="newsletterOptIn" className="text-sm font-medium">
              Subscribe to our newsletter
            </label>
          </div>

          {error && (
            <div className="text-sm text-destructive" role="alert">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="w-full"
          >
            Skip for now
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
