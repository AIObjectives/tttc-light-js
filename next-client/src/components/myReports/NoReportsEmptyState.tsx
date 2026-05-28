import Link from "next/link";

export default function NoReportsEmptyState() {
  return (
    <div className="max-w-4xl mx-auto px-8 lg:px-28 pt-24 pb-16 flex flex-col items-center gap-12">
      <h2 className="text-3xl font-semibold tracking-tight text-foreground text-center">
        Nothing to show yet!
      </h2>
      <div className="flex flex-col sm:flex-row gap-8">
        <EmptyStateTile href="/create" label="Create a report" />
        <EmptyStateTile href="/studies/new" label="Launch a study" />
      </div>
    </div>
  );
}

function EmptyStateTile({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="bg-white border border-border rounded-md shadow-sm hover:shadow-md transition-shadow w-[289px] h-[99px] flex items-center justify-center px-8 py-8"
    >
      <span className="text-xl font-semibold tracking-tight text-foreground text-center">
        {label}
      </span>
    </Link>
  );
}
