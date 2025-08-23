import ReportById from "./ReportById";

interface ReportByIdPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportByIdPage({ params }: ReportByIdPageProps) {
  const { id } = await params;
  return <ReportById reportId={id} />;
}
