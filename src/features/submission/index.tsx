import Report from '../report';
import { Options, PipelineOutput, SourceRow, options } from "src/types";
import ToggleShowButton from "./components/ToggleShowButton";
import Papa from 'papaparse'
import { NextResponse } from "next/server";
import { formatData, placeholderFile, uniqueSlug } from "src/utils";
import { testGPT } from "src/gpt";
import { getUrl, storeHtml } from "src/storage";
import pipeline from "src/pipeline";
import styles from "src/styles";
import * as prettier from 'prettier'
import ServerSideToggleShowMoreButton from '../report/components/ToggleShowMoreButton/ServerSideToggleShowMore';
import ServerSideOpenClaimVideo from '../report/components/OpenClaimVideo/ServerSideOpenClaimVideo';

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
  const ReactDOMServer = (await import('react-dom/server')).default
  // const html:string = ReactDOMServer.renderToString(<Report data={json} ToggleShowMoreComponent={ServerSideToggleShowMoreButton} OpenClaimVideo={ServerSideOpenClaimVideo} />);
  const html:string = ReactDOMServer.renderToString(Report({data:json, ToggleShowMoreComponent:ServerSideToggleShowMoreButton, OpenClaimVideo:ServerSideOpenClaimVideo}));
  // const html = ''
  const parsedHtml = wrapHtml(html)
      .replace(/data-onclick/g, "onclick");
  return await prettier.format(parsedHtml, { parser: "html" })
}

export default function SubmissionForm() {

    const submitAction = async(formData:FormData) => {
      'use server'

      // parses csv file
      const parseCSV = async(file:File):Promise<SourceRow[]> => {
        const buffer = await file.arrayBuffer()
        return Papa.parse(Buffer.from(buffer).toString(), {header:true}).data as SourceRow[]
      }

      // if csv file is empty, return error
      const data = await parseCSV(formData.get('dataInput') as File)
      if (!data || !data.length) {
        return new NextResponse('Missing data. Check your csv file', {status:400})
      }

      const config:Options = options.parse({
        apiKey: formData.get('apiKey'),
        data: formatData(data),
        title: formData.get('title'),
        question: formData.get('question'),
        description: formData.get('description'),
        systemInstructions: formData.get('systemInstructions'),
        extractionInstructions: formData.get('extractionInstructions'),
        dedupInstructions: formData.get('dedupInstructions'),
      })

      if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
        // allow users to use our keys if they provided the password
        config.apiKey = process.env.OPENAI_API_KEY!;
      }
      if (!config.apiKey) {
        throw new Error("Missing key");
      }

      await testGPT(config.apiKey); // will fail is key is invalid
      config.filename = config.filename || uniqueSlug(config.title);
      const url = getUrl(config.filename);
      await storeHtml(config.filename, placeholderFile());
      const json = await pipeline(config);
      const html = await generateServerSideHTML(json)
      await storeHtml(config.filename, html, true);
      console.log("produced file: " + url);

    }

    return (
      <form id="reportForm" action={submitAction}>
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
        <textarea
          id="question"
          name="question"
          rows={3}
          cols={50}
        ></textarea
        ><br />

        <label htmlFor="description">Introduction paragraph:</label>
        <textarea
          id="description"
          name="description"
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
        <ToggleShowButton id="advanced" klass="open"><div>Hide advanced settings</div></ToggleShowButton>
      </div>

      <button id="generate" type="submit">
        Generate Report
      </button>
    </form>
    )
}

