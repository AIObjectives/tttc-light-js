// 'use server'
// import {ReportSSR} from 'src/features/report';
// import { Options, PipelineOutput, SourceRow, options } from "src/types";
// import Papa from 'papaparse'
// import { NextResponse } from "next/server";
// import { formatData, placeholderFile, uniqueSlug } from "src/utils";
// import { testGPT } from "src/gpt";
// import { getUrl, storeHtml } from "src/storage";
// import pipeline from "src/pipeline";
// import styles from "src/styles";
// import * as prettier from 'prettier'
// import ServerSideToggleShowMoreButton from 'src/features/report/components/ToggleShowMoreButton/ServerSideToggleShowMore';
// import ServerSideOpenClaimVideo from 'src/features/report/components/OpenClaimVideo/ServerSideOpenClaimVideo';

// const wrapHtml = (htmlStr:string) => {
//     return `<!DOCTYPE html>
//     <html>
//     <head>
//         <title>Report</title>
//         <style>
//             ${styles}
//         </style>
//     </head>
//     <body>
//         ${htmlStr}
//         <script>
//             // Inline JS or link to external JS
//         </script>
//     </body>
//     </html>`;
//   }

//   const generateServerSideHTML = async(json: PipelineOutput) => {
//     const ReactDOMServer = (await import('react-dom/server')).default
//     // const html:string = ReactDOMServer.renderToString(<Report data={json} ToggleShowMoreComponent={ServerSideToggleShowMoreButton} OpenClaimVideo={ServerSideOpenClaimVideo} />);
//     const html:string = ReactDOMServer.renderToString(ReportSSR({data:json}));
//     // const html = ''
//     const parsedHtml = wrapHtml(html)
//         .replace(/data-onclick/g, "onclick");
//     return await prettier.format(parsedHtml, { parser: "html" })
//   }

//   export default async function submitAction(formData:FormData) {
//     'use server'

//     // parses csv file
//     const parseCSV = async(file:File):Promise<SourceRow[]> => {
//       const buffer = await file.arrayBuffer()
//       return Papa.parse(Buffer.from(buffer).toString(), {header:true}).data as SourceRow[]
//     }

//     // if csv file is empty, return error
//     const data = await parseCSV(formData.get('dataInput') as File)
//     if (!data || !data.length) {
//       return new NextResponse('Missing data. Check your csv file', {status:400})
//     }

//     const config:Options = options.parse({
//       apiKey: formData.get('apiKey'),
//       data: formatData(data),
//       title: formData.get('title'),
//       question: formData.get('question'),
//       description: formData.get('description'),
//       systemInstructions: formData.get('systemInstructions'),
//       extractionInstructions: formData.get('extractionInstructions'),
//       dedupInstructions: formData.get('dedupInstructions'),
//     })

//     if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
//       // allow users to use our keys if they provided the password
//       config.apiKey = process.env.OPENAI_API_KEY!;
//     }
//     if (!config.apiKey) {
//       throw new Error("Missing key");
//     }

//     await testGPT(config.apiKey); // will fail is key is invalid
//     config.filename = config.filename || uniqueSlug(config.title);
//     const url = getUrl(config.filename);
//     await storeHtml(config.filename, placeholderFile());
//     const json = await pipeline(config);
//     const html = await generateServerSideHTML(json)
//     await storeHtml(config.filename, html, true);
//     console.log("produced file: " + url);

//   }
