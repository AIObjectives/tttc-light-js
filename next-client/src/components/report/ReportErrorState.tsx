import Link from "next/link";
import { Button } from "@/components/elements/button/Button";
import { Center } from "@/components/layout/Center";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/elements/empty";
import { ExternalLink } from "lucide-react";

type ReportErrorType = "notFound" | "failed" | "loadError";

interface ReportErrorStateProps {
  type: ReportErrorType;
  message?: string;
}

const errorConfig: Record<
  ReportErrorType,
  { title: string; description: string }
> = {
  notFound: {
    title: "Report not found",
    description:
      "We couldn't find a report at this address. It may have been moved or deleted.",
  },
  failed: {
    title: "Report generation failed",
    description:
      "Something went wrong while generating this report. Please try creating it again.",
  },
  loadError: {
    title: "Unable to load report",
    description:
      "We couldn't load this report. There might be a temporary issue with our service.",
  },
};

export function ReportErrorState({ type, message }: ReportErrorStateProps) {
  const config = errorConfig[type];

  return (
    <Center>
      <Empty
        role="alert"
        className="border-0 bg-background p-8 rounded-lg max-w-sm"
      >
        <EmptyHeader>
          <EmptyTitle>{config.title}</EmptyTitle>
          <EmptyDescription>{message || config.description}</EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="flex gap-2">
            <Button asChild variant="default">
              <Link href="/my-reports">My reports</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/create">Create new</Link>
            </Button>
          </div>

          <Button asChild variant="link" className="text-muted-foreground">
            <a href="mailto:hello@aiobjectives.org">
              Email support
              <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </EmptyContent>
      </Empty>
    </Center>
  );
}
