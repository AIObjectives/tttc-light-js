
export default function ReportPage({ params }: { params: { slug: string } }) {
    return <div>My Post: {params.slug}</div>
  }