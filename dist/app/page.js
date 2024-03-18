"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = HomePage;
exports.generateStaticParams = generateStaticParams;
// import '../styles'

function generateStaticParams() {
  return [{
    slug: ['']
  }];
}
function HomePage() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "intro"
  }, "Talk to the City (TttC) is a AI-powered summarization tool designed to generate insightful reports based on public consultation data."), /*#__PURE__*/React.createElement("form", {
    id: "reportForm"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "title"
  }, "Report title:"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    id: "title",
    name: "title",
    required: true
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("label", {
    htmlFor: "dataInput"
  }, "Data:"), /*#__PURE__*/React.createElement("small", null, "Upload a CSV file with a \"comment\" column."), /*#__PURE__*/React.createElement("input", {
    type: "file",
    id: "csvInput",
    name: "dataInput",
    accept: ".csv"
    // onChange="onFileChange(event)"
  }), /*#__PURE__*/React.createElement("div", {
    itemType: "file",
    id: "csvUploaded"
  }, /*#__PURE__*/React.createElement("span", {
    id: "filename"
  }), /*#__PURE__*/React.createElement("span", {
    className: "clickable"
    // onclick="unsetCsv()"
  }, "reset")), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("label", {
    htmlFor: "apiKey"
  }, "OpenAI key:"), /*#__PURE__*/React.createElement("small", null, "This key will only be stored on your device, not on our servers."), /*#__PURE__*/React.createElement("input", {
    type: "password",
    id: "apiKey",
    name: "apiKey",
    required: true
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("div", {
    id: "advance",
    className: "clickable"
    // onclick="toggle('advanced', 'open'); toggle('advance', 'hidden')"
  }, "Show advanced settings"), /*#__PURE__*/React.createElement("div", {
    id: "advanced"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "question"
  }, "Main question asked to participants:"), /*#__PURE__*/React.createElement("textarea", {
    id: "question",
    name: "claimExtractionInstructions",
    rows: 3,
    cols: 50
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("label", {
    htmlFor: "description"
  }, "Introduction paragraph:"), /*#__PURE__*/React.createElement("textarea", {
    id: "description",
    name: "claimExtractionInstructions",
    rows: 3,
    cols: 50
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("label", {
    htmlFor: "systemInstructions"
  }, "Instructions for the system prompt:"), /*#__PURE__*/React.createElement("textarea", {
    id: "systemInstructions",
    name: "systemInstructions",
    rows: 3,
    cols: 50
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("label", {
    htmlFor: "clusteringInstructions"
  }, "Instructions for the clustering step:"), /*#__PURE__*/React.createElement("textarea", {
    id: "clusteringInstructions",
    name: "clusteringInstructions",
    rows: 3,
    cols: 50
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("label", {
    htmlFor: "extractionInstructions"
  }, "Instructions for the claim extraction step:"), /*#__PURE__*/React.createElement("textarea", {
    id: "extractionInstructions",
    name: "extractionInstructions",
    rows: 3,
    cols: 50
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("label", {
    htmlFor: "dedupInstructions"
  }, "Instructions for the deduplication step:"), /*#__PURE__*/React.createElement("textarea", {
    id: "dedupInstructions",
    name: "dedupInstructions",
    rows: 3,
    cols: 50
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("div", {
    className: "clickable"
    //   onclick="toggle('advanced', 'open'); toggle('advance', 'hidden')"
  }, "Hide advanced settings")), /*#__PURE__*/React.createElement("button", {
    id: "generate",
    type: "button"
    //   onclick="submitForm(event)"
  }, "Generate Report")), /*#__PURE__*/React.createElement("div", {
    id: "messageModal",
    className: "modal hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-content"
  }, /*#__PURE__*/React.createElement("span", {
    className: "close-button"
    // onclick="closeModal()"
  }, "\xD7"), /*#__PURE__*/React.createElement("h2", {
    id: "modalTitle"
  }, "Message Title"), /*#__PURE__*/React.createElement("p", {
    id: "modalMessage"
  }, "Your message goes here."), /*#__PURE__*/React.createElement("a", {
    id: "modalLink"
  }))));
}