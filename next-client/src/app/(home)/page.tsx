import SubmissionForm from "src/features/submission";

export function generateStaticParams() {
  return [{ slug: [""] }];
}

export default function HomePage() {
  return (
    <>
      <p className="intro">
        Talk to the City (TttC) is a AI-powered summarization tool designed to
        generate insightful reports based on public consultation data.
      </p>

      <SubmissionForm />

      <div id="messageModal" className="modal hidden">
        <div className="modal-content">
          <span className="close-button">&times;</span>
          <h2 id="modalTitle">Message Title</h2>
          <p id="modalMessage">Your message goes here.</p>
          <a id="modalLink"></a>
        </div>
      </div>
    </>
  );
}
