import { PipelineOutput } from "tttc-common/schema";
import * as prettier from 'prettier'
import ReportSSR from "./Report";

// ! TODO styles
const wrapHtml = (htmlStr:string) => {
    return `<!DOCTYPE html>
    <html>
    <head>
        <title>Report</title>
        <style>
            
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

export const generateServerSideHTML = async(json: PipelineOutput) => {
    // TODO: Previously had to do dynamic import. See if we skip that later.
    const ReactDOMServer = (await import('react-dom/server')).default
    const html:string = ReactDOMServer.renderToString(ReportSSR({data:json}));
    const parsedHtml = wrapHtml(html)
            .replace(/data-onclick/g, "onclick");
        return await prettier.format(parsedHtml, { parser: "html" })
}