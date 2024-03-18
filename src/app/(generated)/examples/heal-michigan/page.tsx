import { ReportCSR } from "src/features/report";
import json from '../../../../../fixtures/report.json'

export default function HealMichiganPage() {
    return <ReportCSR data={json}/>
}