"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// TIP: install the VSCODE plugin `vscode-styled-components` to
// get CSS syntax highlighting and IntelliSense in this file.
const css = parts => parts[0];
var _default = exports.default = css`
  body {
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    margin: 10px;
    max-width: 800px;
    margin: auto;
    padding: 10px;
    background-color: #f9f9f9;
    color: #333;
    font-size: 13px;
  }

  #title {
    font-size: 19px;
    color: #006699;
  }

  h2 {
    margin-top: 30px;
    margin-bottom: 11px;
    font-size: 19px;
  }
  h3 {
    margin-bottom: 5px;
    margin-top: 7px;
    font-size: 13px;
  }

  .claim {
    color: gray;
    cursor: pointer;
    text-decoration: underline;
  }

  .report-description {
    font-style: italic;
  }

  .details {
    display: none;
  }

  .open > .details {
    display: block;
    margin-bottom: 1em;
  }

  .quote {
    font-style: italic;
  }

  .count {
    font-weight: normal;
    opacity: 0.5;
  }

  .video {
    border: none;
  }

  #outline table {
    /* width: 100%; Makes the table use the full width of its container */
    border-collapse: collapse; /* Collapses borders between table cells */
    table-layout: fixed; /* Helps with consistent column sizing */
    margin-top: 20px;
  }

  #outline th,
  #outline td {
    border: 1px solid #ddd; /* Light grey border */
    padding: 4px; /* Spacing inside cells */
    padding-left: 10px;
    padding-right: 10px;
    text-align: right; /* Aligns text to the right */
    min-width: 70px; /* Minimum width for each cell */
  }
  #outline th:first-child,
  #outline td:first-child {
    text-align: left;
  }
  #outline thead th {
    font-size: 85%;
    background-color: #f2f2f2; /* Light grey background */
    color: black; /* Text color */
    padding-top: 12px;
    padding-bottom: 12px;
  }
  #outline tbody tr:nth-child(odd) {
    background-color: #f9f9f9;
  }
  #outline tbody tr:hover {
    background-color: #eaeaea;
  }

  .outline-topic-row {
    font-weight: bold;
    font-size: 85%;
  }
  .outline-subtopic-row {
    font-size: 70%;
  }

  .subtopic .more {
    display: none;
  }
  .subtopic .showless-button {
    display: none;
  }
  .subtopic.showmore .more {
    display: list-item;
  }
  .subtopic.showmore .showmore-button {
    display: none;
  }
  .subtopic.showmore .showless-button {
    display: block;
  }
  .showless-button,
  .showmore-button {
    border: none;
    background: none;
    text-decoration: underline;
    padding: 0;
    padding-top: 10px;
    font-style: italic;
  }
`;