import json from "src/fixtures/report.json";
import { Report } from "src/features/report";

export default function HealMichiganPage() {
  return <Report data={json} />;
}
