import { testGPT } from "src/gpt";
import pipeline from "src/pipeline";
import { getUrl, storeHtml } from "src/storage";
import { Options, PipelineOutput } from "src/types";
import { formatData, placeholderFile, uniqueSlug } from "src/utils";
// import * as ReactDOMServer from 'react-dom/server'
import Report from "src/features/report";
import json from '../../../../fixtures/report.json'
import * as prettier from 'prettier'
import styles from 'src/styles';
import ServerSideToggleShowMoreButton from "src/features/report/components/ToggleShowMoreButton/ServerSideToggleShowMore";
import ServerSideOpenClaimVideo from "src/features/report/components/OpenClaimVideo/ServerSideOpenClaimVideo";
import { NextResponse } from 'next/server'

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

// const generateServerSideHTML = async(json: PipelineOutput) => {
//     // const ReactDOMServer = (await import('react-dom/server')).default
//     // const html:string = ReactDOMServer.renderToString(<Report data={json} ToggleShowMoreComponent={ServerSideToggleShowMoreButton} OpenClaimVideo={ServerSideOpenClaimVideo} />);
//     const html:string = ReactDOMServer.renderToString(Report({data:json, ToggleShowMoreComponent:ServerSideToggleShowMoreButton, OpenClaimVideo:ServerSideOpenClaimVideo}));

//     const parsedHtml = wrapHtml(html)
//         .replace(/data-onclick/g, "onclick");
//     return await prettier.format(parsedHtml, { parser: "html" })
// }

/**
 * Should send back a file that the user downloads. However, at the momemt it only sends the heal-michigan example.
 */
export async function GET() {
    
    try {
        const ReactDOMServer = (await import('react-dom/server')).default
        const html:string = ReactDOMServer.renderToString(Report({data:json, ToggleShowMoreComponent:ServerSideToggleShowMoreButton, OpenClaimVideo:ServerSideOpenClaimVideo}));
        const parsedHtml = wrapHtml(html)
        .replace(/data-onclick/g, "onclick");
         const formattedHtml = await prettier.format(parsedHtml, { parser: "html" })
        
            const headers = new Headers({
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="download.html"',
              });
            
              return new Response(formattedHtml, { headers });
    } catch (err: any) { 
        return new NextResponse(err.message || "An unknown error occured", {status:500})
        
        
    }
}