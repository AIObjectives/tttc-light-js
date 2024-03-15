// import * as ReactDOMServer from 'react-dom/server'
import * as prettier from 'prettier'
import Report from 'src/features/report'
import ServerSideOpenClaimVideo from 'src/features/report/components/OpenClaimVideo/ServerSideOpenClaimVideo'
import ServerSideToggleShowMoreButton from 'src/features/report/components/ToggleShowMoreButton/ServerSideToggleShowMore'
import { Options, PipelineOutput, options, submissionFormData } from 'src/types'
import styles from 'src/styles'
import SubmissionForm from 'src/features/submission'

export function generateStaticParams() {
    return [{slug: ['']}]
}



export default function HomePage() {
    const submitAction = async(formData:FormData) => {
      'use server'
      const config = options.parse({
        apiKey: formData.get('apiKey'),
        data: formData.get('dataInput'),
        title: formData.get('title'),
        question: formData.get('question'),
        description: formData.get('description'),
        systemInstructions: formData.get('systemInstructions'),
        extractionInstructions: formData.get('extractionInstructions'),
        dedupInstructions: formData.get('dedupInstructions'),
      })
      console.log(config)

    }
    return (
        <>
        <p className="intro">
      Talk to the City (TttC) is a AI-powered summarization tool designed to
      generate insightful reports based on public consultation data.
    </p>

    {/* <form id="reportForm" action={submitAction}>
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

      <button id="generate" type="submit" 
    //   onclick="submitForm(event)"
      >
        Generate Report
      </button>
    </form> */}

    <SubmissionForm />

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

const wrapHtml = (htmlStr:string) => {
    return `<!DOCTYPE html>
    <html>
    <head>
        <title>Report</title>
        <style>
            ${styles}
        </style>
    </head>
    <body>
        ${htmlStr}
        <script>
            // Inline JS or link to external JS
        </script>
    </body>
    </html>`;
}

const generateServerSideHTML = async(json: PipelineOutput) => {
    // const ReactDOMServer = (await import('react-dom/server')).default
    // const html:string = ReactDOMServer.renderToString(<Report data={json} ToggleShowMoreComponent={ServerSideToggleShowMoreButton} OpenClaimVideo={ServerSideOpenClaimVideo} />);
    // const html:string = ReactDOMServer.renderToString(Report({data:json, ToggleShowMoreComponent:ServerSideToggleShowMoreButton, OpenClaimVideo:ServerSideOpenClaimVideo}));
    const html = ''
    const parsedHtml = wrapHtml(html)
        .replace(/data-onclick/g, "onclick");
    return await prettier.format(parsedHtml, { parser: "html" })
}