import {Report, ReportProps} from 'tttc-common/components'
import ClientSideOpenClaimVideo from "./components/OpenClaimVideo/ClientSideOpenClaimVideo";
import ClientSideToggleShowMoreButton from "./components/ToggleShowMoreButton/ClientSideToggleShowMore";

export function ReportCSR(props:ReportProps) {
  return <Report {...props} ToggleShowMoreComponent={ClientSideToggleShowMoreButton} 
  OpenClaimVideo={ClientSideOpenClaimVideo} />
}

