import React from "react";
import ReactDOMServer from "react-dom/server";
import Report from "./rendering/compiled/Report.js";

const str = ReactDOMServer.renderToString(React.createElement(Report));

console.log(str);
