import '../styles'

export function generateStaticParams() {
    return [{slug: ['']}]
}

export default function HomePage() {
    return (
        <>
        <p className="intro">
      Talk to the City (TttC) is a AI-powered summarization tool designed to
      generate insightful reports based on public consultation data.
    </p>

    <form id="reportForm">
      <label htmlFor="title">Report title:</label>
      <input type="text" id="title" name="title" required /><br />

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
        <span className="clickable" 
        // onclick="unsetCsv()"
        >
            reset
            </span>
      </div>
      <br />

      <label htmlFor="apiKey">OpenAI key:</label>
      <small
        >This key will only be stored on your device, not on our servers.</small
      >
      <input type="password" id="apiKey" name="apiKey" required /><br />

      <div
        id="advance"
        className="clickable"
        // onclick="toggle('advanced', 'open'); toggle('advance', 'hidden')"
      >
        Show advanced settings
      </div>

      <div id="advanced">
        <label htmlFor="question">Main question asked to participants:</label>
        <textarea
          id="question"
          name="claimExtractionInstructions"
          rows={3}
          cols={50}
        ></textarea
        ><br />

        <label htmlFor="description">Introduction paragraph:</label>
        <textarea
          id="description"
          name="claimExtractionInstructions"
          rows={3}
          cols={50}
        ></textarea
        ><br />

        <label htmlFor="systemInstructions"
          >Instructions for the system prompt:</label
        >
        <textarea
          id="systemInstructions"
          name="systemInstructions"
          rows={3}
          cols={50}
        ></textarea
        ><br />

        <label htmlFor="clusteringInstructions"
          >Instructions for the clustering step:</label
        >
        <textarea
          id="clusteringInstructions"
          name="clusteringInstructions"
          rows={3}
          cols={50}
        ></textarea
        ><br />

        <label htmlFor="extractionInstructions"
          >Instructions for the claim extraction step:</label
        >
        <textarea
          id="extractionInstructions"
          name="extractionInstructions"
          rows={3}
          cols={50}
        ></textarea
        ><br />

        <label htmlFor="dedupInstructions"
          >Instructions for the deduplication step:</label
        >
        <textarea
          id="dedupInstructions"
          name="dedupInstructions"
          rows={3}
          cols={50}
        ></textarea
        ><br />
        <div
          className="clickable"
        //   onclick="toggle('advanced', 'open'); toggle('advance', 'hidden')"
        >
          Hide advanced settings
        </div>
      </div>

      <button id="generate" type="button" 
    //   onclick="submitForm(event)"
      >
        Generate Report
      </button>
    </form>

    <div id="messageModal" className="modal hidden">
      <div className="modal-content">
        <span className="close-button" 
        // onclick="closeModal()"
        >&times;
        </span>
        <h2 id="modalTitle">Message Title</h2>
        <p id="modalMessage">Your message goes here.</p>
        <a id="modalLink"></a>
      </div>
    </div>
        </>
    )
}