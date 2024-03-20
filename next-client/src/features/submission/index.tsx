import ToggleShowButton from "./components/ToggleShowButton";
// import submitAction from './actions/SubmitAction';
import SubmitFormControl from "./components/SubmitFormControl";

export default function SubmissionForm() {
  return (
    <form id="reportForm">
      <SubmitFormControl>
        <label htmlFor="title">Report title:</label>
        <input type="text" id="title" name="title" required />
        <br />

        <label htmlFor="dataInput">Data:</label>
        <small>Upload a CSV file with a "comment" column.</small>
        <input
          type="file"
          id="csvInput"
          name="dataInput"
          accept=".csv"
          // onChange="onFileChange(event)"
        />
        {/* ! div was changed to input here. Check on this later */}
        <div itemType="file" id="csvUploaded">
          <span id="filename"></span>
          <span
            className="clickable"
            // onclick="unsetCsv()"
          >
            reset
          </span>
        </div>
        <br />

        <label htmlFor="apiKey">OpenAI key:</label>
        <small>
          This key will only be stored on your device, not on our servers.
        </small>
        <input type="password" id="apiKey" name="apiKey" required />
        <br />

        {/* <div
            id="advance"
            className="clickable"
            // onclick="toggle('advanced', 'open'); toggle('advance', 'hidden')"
          >
            Show advanced settings
          </div> */}
        <ToggleShowButton klass="open" id="advanced">
          <div id="advance">Show advanced settings</div>
        </ToggleShowButton>

        <div id="advanced">
          <label htmlFor="question">Main question asked to participants:</label>
          <textarea id="question" name="question" rows={3} cols={50}></textarea>
          <br />

          <label htmlFor="description">Introduction paragraph:</label>
          <textarea
            id="description"
            name="description"
            rows={3}
            cols={50}
          ></textarea>
          <br />

          <label htmlFor="systemInstructions">
            Instructions for the system prompt:
          </label>
          <textarea
            id="systemInstructions"
            name="systemInstructions"
            rows={3}
            cols={50}
          ></textarea>
          <br />

          <label htmlFor="clusteringInstructions">
            Instructions for the clustering step:
          </label>
          <textarea
            id="clusteringInstructions"
            name="clusteringInstructions"
            rows={3}
            cols={50}
          ></textarea>
          <br />

          <label htmlFor="extractionInstructions">
            Instructions for the claim extraction step:
          </label>
          <textarea
            id="extractionInstructions"
            name="extractionInstructions"
            rows={3}
            cols={50}
          ></textarea>
          <br />

          <label htmlFor="dedupInstructions">
            Instructions for the deduplication step:
          </label>
          <textarea
            id="dedupInstructions"
            name="dedupInstructions"
            rows={3}
            cols={50}
          ></textarea>
          <br />
          <ToggleShowButton id="advanced" klass="open">
            <div>Hide advanced settings</div>
          </ToggleShowButton>
        </div>

        <button id="generate" type="submit">
          Generate Report
        </button>
      </SubmitFormControl>
    </form>
  );
}
