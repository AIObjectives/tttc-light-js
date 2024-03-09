import json from '../../../../../fixtures/report.json'
import Report from 'src/features/report'
import ClientSideToggleShowMoreButton from 'src/features/report/components/ToggleShowMoreButton/ClientSideToggleShowMore'

export default function ReportPage({ params }: { params: { slug: string } }) {
    return (
      <>
        <Report data={json} ToggleShowMoreComponent={ClientSideToggleShowMoreButton} />
      </>
    )
  }