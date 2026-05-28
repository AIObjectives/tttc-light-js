export default function WorkWithUsRedesign() {
  return (
    <div className="overflow-x-hidden bg-white">
      <HeroSection />
      <ContentSection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 lg:px-28 pt-16 pb-8">
      <h1 className="text-7xl lg:text-[96px] font-medium tracking-wide leading-tight">
        Work with us
      </h1>
    </section>
  );
}

function ContentSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 lg:px-28 pb-16">
      <p className="text-xl text-foreground leading-[31px] mb-4">
        We are an open source tool that you can use from our Github. However,
        working with us directly means that you can ignore a number of
        logistics, from running LLMs to sending WhatsApp messages to
        participants. We can support everything from small surveys to days-long
        conferences and big studies.
      </p>
      <p className="text-xl text-foreground leading-[31px]">
        Interested? Please reach out to{" "}
        <a
          href="mailto:t3c@objective.is"
          className="text-indigo-600 hover:underline font-medium"
        >
          t3c@objective.is
        </a>{" "}
        to talk pricing and projects.
      </p>
    </section>
  );
}
