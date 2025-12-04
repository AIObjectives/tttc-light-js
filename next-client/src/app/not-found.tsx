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

export default function NotFound() {
  return (
    <Center>
      <Empty className="border-0 bg-background p-8 rounded-lg max-w-sm">
        <EmptyHeader>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            The page you're looking for doesn't exist or may have been moved.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/">Homepage</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </Center>
  );
}
