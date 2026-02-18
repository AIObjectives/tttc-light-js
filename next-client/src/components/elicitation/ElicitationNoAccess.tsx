import { Center } from "@/components/layout";

export function ElicitationNoAccess() {
  return (
    <Center>
      <div className="flex max-w-2xl flex-col items-center gap-3 px-4 text-center">
        <h2>
          We can help you collect data!{" "}
          <span className="text-accent-foreground">Check it out.</span>
        </h2>
        <p className="text-muted-foreground">
          Do you think you should have access to this page? Contact{" "}
          <a
            href="mailto:t3c@objective.is"
            className="underline underline-offset-4 hover:text-primary"
          >
            t3c@objective.is
          </a>{" "}
          for help.
        </p>
      </div>
    </Center>
  );
}
