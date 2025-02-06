import React from "react";
import * as api from "tttc-common/api";
import { Col } from "../layout";
import { Progress } from "../elements";

export default function ReportProgresss({
  status,
}: {
  status: api.ReportJobStatus;
}) {
  return (
    <Col className="w-full h-full flex-grow items-center justify-center">
      <Body status={status} />
    </Col>
  );
}

const Body = ({ status }: { status: api.ReportJobStatus }) => {
  switch (status) {
    case "failed":
      return <JobFailed />;
    case "finished":
      return <JobFinished />;
    case "notFound":
      return <JobNotFound />;
    default:
      return <ReportProcessing status={status} />;
  }
};

const JobFailed = () => <p>Your report failed</p>;

const JobFinished = () => (
  <p>
    Report finished but data not found - likely that resource was moved or
    deleted
  </p>
);

const JobNotFound = () => <p>Could not find a valid report with that uri</p>;

function ReportProcessing({ status }: { status: api.ReportJobStatus }) {
  return (
    <>
      <Progress value={statusToProgress(status)} className="w-[60%]" />
      {statusMessage(status)}
      <p>Note: You will need to refresh the page for updates</p>
    </>
  );
}

const statusToProgress = (status: api.ReportJobStatus) => {
  switch (status) {
    case "queued":
      return 0;
    case "clustering":
      return 20;
    case "extraction":
      return 40;
    case "sorting":
      return 50;
    case "dedup":
      return 60;
    case "wrappingup":
      return 80;
    case "finished":
      return 100;
    case "failed":
      throw new Error(`Report creation failed`);
    case "notFound":
      return -100;
    default: {
      if (process.env.NODE_ENV === "development") {
        throw new Error(`Unrecognized value in statusToProgress: ${status}`);
      } else {
        console.warn(
          "GOT AN UNEXPECTED VALUE IN REPORT PROGRESS statusToProgress",
        );
        return 90; // idk what to have, but at least it won't crash now. Fixme
      }
    }
  }
};

const statusMessage = (status: api.ReportJobStatus) => {
  switch (status) {
    case "queued":
      return "Your report is queued...";
    case "clustering":
      return "Clustering arguments...";
    case "extraction":
      return "Extracting claims...";
    case "sorting":
      return "Sorting claims";
    case "dedup":
      return "Removing duplicates...";
    case "wrappingup":
      return "Wrapping up...";
    case "finished":
      return "Report complete!";
    case "failed":
      return "Report failed :(";
    case "notFound":
      return "Not found :/";
    default:
      throw new Error("Unrecognized value in statusMessage");
  }
};
