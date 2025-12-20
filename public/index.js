function toggle(id, klass) {
  document.getElementById(id).classList.toggle(klass);
}

const fields = [
  "apiKey",
  "title",
  "question",
  "description",
  "systemInstructions",
  "clusteringInstructions",
  "extractionInstructions",
  "dedupInstructions",
];

function getFormData() {
  const data = {};
  fields.forEach((field) => {
    data[field] = document.getElementById(field).value;
  });
  return data;
}

function loadAllFields() {
  fields.forEach((field) => {
    const value = localStorage.getItem(field);
    if (value) {
      try {
        document.getElementById(field).value = value;
      } catch (e) {
        console.error(field);
        throw e;
      }
    }
  });
}

function saveAllFields() {
  fields.forEach((field) => {
    try {
      const value = document.getElementById(field).value;
      localStorage.setItem(field, value);
    } catch (e) {
      console.error(field);
      throw e;
    }
  });
}

function failure(message) {
  document.getElementById("modalMessage").innerText = message;
  toggle("messageModal", "open");
}

function success(message) {
  document.getElementById("modalMessage").innerText = message;
  toggle("messageModal", "open");
}

function onFileChange(event) {
  var file = event.target.files[0];
  if (file) {
    var reader = new FileReader();
    reader.onload = (event) => {
      var csvData = event.target.result;
      Papa.parse(csvData, {
        complete: (results) => {
          localStorage.data = JSON.stringify(results.data);
          localStorage.dataLength = String(results.data.length);
          localStorage.uploadedFile = file.name;
          updateDataField();
        },
        header: true,
      });
    };
    reader.readAsText(file);
  }
}

function unsetCsv() {
  delete localStorage.data;
  delete localStorage.uploadedFile;
  document.getElementById("csvInput").value = "";
  updateDataField();
}

function updateDataField() {
  const uploadedFile = localStorage.getItem("uploadedFile");
  const dataLength = localStorage.getItem("dataLength");
  if (uploadedFile) {
    document.getElementById("csvInput").classList.add("hidden");
    document.getElementById("csvUploaded").classList.remove("hidden");
    document.getElementById("filename").innerText =
      `uploaded: ${uploadedFile} (${dataLength} rows)`;
  } else {
    document.getElementById("csvInput").classList.remove("hidden");
    document.getElementById("csvUploaded").classList.add("hidden");
  }
}

function submitForm(event) {
  console.log("submitForm");
  event.preventDefault();
  saveAllFields();
  const config = getFormData();
  config.data = JSON.parse(localStorage.data || "[]");
  const url = window.location.origin + "/generate";
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  })
    .then((response) => response.json())
    .then((json) => {
      if (json.error) {
        showErrorModal(json.error.message);
      } else {
        showSuccessModal(
          `Your report is being prepared at <a href="${json.url}">${json.filename}</a>. Make sure to open and bookmark this link!`,
        );
      }
      console.log(json);
    });
}

function showErrorModal(message) {
  document.getElementById("modalTitle").innerText = "Error";
  document.getElementById("modalMessage").innerText = message;
  document.getElementById("messageModal").classList.remove("hidden");
  document.getElementById("modalLink").classList.add("hidden");
}

function showSuccessModal(message) {
  document.getElementById("modalTitle").innerText = "Success";
  document.getElementById("modalMessage").innerHTML = message;
  document.getElementById("messageModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("messageModal").classList.add("hidden");
}
