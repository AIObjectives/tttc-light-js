// import Report from "@src/components/report/Report";
// import { getReportDataObj } from "tttc-common/morphisms/pipeline";
// import * as schema from "tttc-common/schema";
// import * as api from "tttc-common/api";
// import { z } from "zod";
// import ReportProgresss from "@src/components/reportProgress/ReportProgress";
// import Feedback from "@src/components/feedback/Feedback";

// const waitingMessage = z.object({
//   message: z.string(),
// });

// type PageProps = Promise<{
//   uri: string;
// }>;

// export default async function ReportPage({ params }: { params: PageProps }) {
//   const uri = (await params).uri;
//   const url = decodeURIComponent(uri);
//   const req = await fetch(url, {
//     headers: {
//       "Content-Type": "application/json",
//     },
//   });
//   let data = await req.json();

//   if (waitingMessage.safeParse(data).success) {
//     const statusResponse = await fetch(
//       z
//         .string()
//         .url()
//         .parse(
//           `${process.env.PIPELINE_EXPRESS_URL}/report/${encodeURIComponent(url)}`,
//         ),
//     );

//     const { status } = await statusResponse
//       .json()
//       .then(api.getReportResponse.parse);
//     return <ReportProgresss status={status as api.ReportJobStatus} />;
//   }

//   const reportData = schema.llmPipelineOutput.safeParse(data).success
//     ? getReportDataObj(data)
//     : schema.pipelineOutput.parse(data).data[1];
//   return (
//     <div>
//       <Report reportData={reportData} />
//       <Feedback className="hidden lg:block" />
//     </div>
//   );
// }




//





import Report from "@src/components/report/Report";
import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import { z } from "zod";
import ReportProgresss from "@src/components/reportProgress/ReportProgress";
import Feedback from "@src/components/feedback/Feedback";

// Import the client-only waiting game component
import WaitingGame from "./WaitingGame.client";

const waitingMessage = z.object({
  message: z.string(),
});

type PageProps = Promise<{
  uri: string;
}>;

export default async function ReportPage({ params }: { params: PageProps }) {
  const uri = (await params).uri;
  const url = decodeURIComponent(uri);

  try {
    const req = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Ensure the response is JSON before parsing.
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Unexpected response format:", await req.text());
      // If the response is not JSON, show the waiting game.
      return <WaitingGame />;
    }

    const data = await req.json();

    if (waitingMessage.safeParse(data).success) {
      // If the data indicates the report is not yet ready, show the waiting game.
      return <WaitingGame />;
    }

    // Otherwise, parse the report data accordingly.
    const reportData = schema.llmPipelineOutput.safeParse(data).success
      ? getReportDataObj(data)
      : schema.pipelineOutput.parse(data).data[1];

    return (
      <div>
        <Report reportData={reportData} />
        <Feedback className="hidden lg:block" />
      </div>
    );
  } catch (error) {
    console.error("Error loading report:", error);
    // On error, show the waiting game so users can refresh.
    return <WaitingGame />;
  }
}

