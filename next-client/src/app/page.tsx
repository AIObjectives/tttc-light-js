import Landing from "@src/components/landing/Landing";

export function generateStaticParams() {
  return [{ slug: [""] }];
}

export default function HomePage() {
  return (
    <div className="w-full justify-items-center">
      <Landing />
    </div>
  );
}
