import Report from 'src/features/report';
import json from '../../../../fixtures/report.json'
import styles from 'src/styles';
import ServerSideToggleShowMoreButton from 'src/features/report/components/ToggleShowMoreButton/ServerSideToggleShowMore';
import * as prettier from "prettier";


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


export default async function TempPage({ params }: { params: { slug: string } }) {
    const ReactDOMServer = (await import('react-dom/server')).default
    const html:string = ReactDOMServer.renderToString(<Report data={json} ToggleShowMoreComponent={ServerSideToggleShowMoreButton} />);
    const parsedHtml = wrapHtml(html)
        .replace(/data-onclick/g, "onclick");
    return await prettier.format(parsedHtml, { parser: "html" })
}
  