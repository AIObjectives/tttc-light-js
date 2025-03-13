import Landing from "@/components/landing/Landing";

export function generateStaticParams() {
  return [{ slug: [""] }];
}

export default function HomePage() {
  return (
    <div>
      <Landing />
    </div>
  );
}
