// Global variables
let currentData = null;
let currentChart = null;

// File upload handling
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const messagesDiv = document.getElementById("messages");

// Drag and drop functionality
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

// File processing
function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showMessage("Please select a CSV file.", "error");
    return;
  }

  showLoading(true);
  showMessage("Processing file...", "success");

  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.errors.length > 0) {
        showMessage("Error parsing CSV: " + results.errors[0].message, "error");
        showLoading(false);
        return;
      }

      currentData = results.data;
      populateColumnSelectors();
      displayDataPreview();
      generateStatistics();
      showMessage(
        `Successfully loaded ${currentData.length} rows of data!`,
        "success"
      );
      showLoading(false);
    },
    error: function (error) {
      showMessage("Error reading file: " + error.message, "error");
      showLoading(false);
    },
  });
}

// Populate column selectors
function populateColumnSelectors() {
  const xSelect = document.getElementById("xAxis");
  const ySelect = document.getElementById("yAxis");

  xSelect.innerHTML = '<option value="">Select X-Axis</option>';
  ySelect.innerHTML = '<option value="">Select Y-Axis</option>';

  if (currentData && currentData.length > 0) {
    const columns = Object.keys(currentData[0]);
    columns.forEach((col) => {
      xSelect.innerHTML += `<option value="${col}">${col}</option>`;
      ySelect.innerHTML += `<option value="${col}">${col}</option>`;
    });
  }
}

// Display data preview
function displayDataPreview() {
  const table = document.getElementById("dataTable");
  if (!currentData || currentData.length === 0) return;

  const headers = Object.keys(currentData[0]);
  const maxRows = Math.min(currentData.length, 10);

  let html = "<thead><tr>";
  headers.forEach((header) => {
    html += `<th>${header}</th>`;
  });
  html += "</tr></thead><tbody>";

  for (let i = 0; i < maxRows; i++) {
    html += "<tr>";
    headers.forEach((header) => {
      const value = currentData[i][header];
      html += `<td>${value !== null && value !== undefined ? value : ""}</td>`;
    });
    html += "</tr>";
  }

  html += "</tbody>";
  table.innerHTML = html;
}

// Generate statistics
function generateStatistics() {
  if (!currentData || currentData.length === 0) return;

  const statsGrid = document.getElementById("statsGrid");
  const headers = Object.keys(currentData[0]);
  let html = "";

  // Basic statistics
  html += `
                <div class="stat-card">
                    <span class="stat-value">${currentData.length}</span>
                    <div class="stat-label">Total Rows</div>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${headers.length}</span>
                    <div class="stat-label">Columns</div>
                </div>
            `;

  // Calculate statistics for numeric columns
  headers.forEach((header) => {
    const values = currentData
      .map((row) => row[header])
      .filter(
        (val) => val !== null && val !== undefined && !isNaN(val) && val !== ""
      );

    if (values.length > 0) {
      const numericValues = values.map(Number);
      const avg =
        numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      const max = Math.max(...numericValues);
      const min = Math.min(...numericValues);

      html += `
                        <div class="stat-card">
                            <span class="stat-value">${avg.toFixed(2)}</span>
                            <div class="stat-label">${header} (Avg)</div>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${max}</span>
                            <div class="stat-label">${header} (Max)</div>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${min}</span>
                            <div class="stat-label">${header} (Min)</div>
                        </div>
                    `;
    }
  });

  statsGrid.innerHTML = html;
}

// Perform analysis and create visualization
function performAnalysis() {
  if (!currentData || currentData.length === 0) {
    showMessage("Please upload data first.", "error");
    return;
  }

  const chartType = document.getElementById("chartType").value;
  const xAxis = document.getElementById("xAxis").value;
  const yAxis = document.getElementById("yAxis").value;

  if (!xAxis) {
    showMessage("Please select X-axis column.", "error");
    return;
  }

  showLoading(true);

  // Prepare data for visualization
  const chartData = prepareChartData(chartType, xAxis, yAxis);
  createVisualization(chartType, chartData, xAxis, yAxis);
  generateInsights(xAxis, yAxis);

  showLoading(false);
  showMessage("Analysis completed successfully!", "success");
}

// Prepare data for different chart types
function prepareChartData(chartType, xAxis, yAxis) {
  const data = {
    labels: [],
    datasets: [
      {
        label: yAxis || xAxis,
        data: [],
        backgroundColor: generateColors(currentData.length),
        borderColor: "#667eea",
        borderWidth: 2,
        fill: false,
      },
    ],
  };

  if (chartType === "pie") {
    // For pie charts, group by x-axis values
    const grouped = {};
    currentData.forEach((row) => {
      const key = row[xAxis];
      if (key) {
        grouped[key] =
          (grouped[key] || 0) + (yAxis ? Number(row[yAxis]) || 1 : 1);
      }
    });

    data.labels = Object.keys(grouped);
    data.datasets[0].data = Object.values(grouped);
  } else if (chartType === "histogram") {
    // For histograms, create bins
    const values = currentData
      .map((row) => Number(row[xAxis]))
      .filter((val) => !isNaN(val));
    const bins = createHistogramBins(values);
    data.labels = bins.labels;
    data.datasets[0].data = bins.counts;
  } else {
    // For other chart types
    const maxPoints = 50; // Limit points for performance
    const step = Math.ceil(currentData.length / maxPoints);

    for (let i = 0; i < currentData.length; i += step) {
      const row = currentData[i];
      data.labels.push(row[xAxis]);
      data.datasets[0].data.push(yAxis ? Number(row[yAxis]) || 0 : i);
    }
  }

  return data;
}

// Create histogram bins
function createHistogramBins(values, binCount = 20) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount;

  const bins = Array(binCount).fill(0);
  const labels = [];

  for (let i = 0; i < binCount; i++) {
    labels.push(
      `${(min + i * binWidth).toFixed(2)} - ${(
        min +
        (i + 1) * binWidth
      ).toFixed(2)}`
    );
  }

  values.forEach((value) => {
    const binIndex = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
    );
    bins[binIndex]++;
  });

  return { labels, counts: bins };
}

// Create visualization
function createVisualization(chartType, data, xAxis, yAxis) {
  const ctx = document.getElementById("mainChart").getContext("2d");

  if (currentChart) {
    currentChart.destroy();
  }

  const config = {
    type: chartType === "histogram" ? "bar" : chartType,
    data: data,
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${
            chartType.charAt(0).toUpperCase() + chartType.slice(1)
          } Chart: ${xAxis} ${yAxis ? "vs " + yAxis : ""}`,
          font: { size: 16 },
        },
        legend: {
          display: chartType === "pie",
        },
      },
      scales:
        chartType !== "pie"
          ? {
              x: {
                title: {
                  display: true,
                  text: xAxis,
                },
              },
              y: {
                title: {
                  display: true,
                  text: yAxis || "Count",
                },
              },
            }
          : {},
    },
  };

  currentChart = new Chart(ctx, config);
}

// Generate color palette
function generateColors(count) {
  const colors = [
    "#667eea",
    "#764ba2",
    "#f093fb",
    "#f5576c",
    "#4facfe",
    "#00f2fe",
    "#43e97b",
    "#38f9d7",
    "#ffecd2",
    "#fcb69f",
    "#a8edea",
    "#fed6e3",
  ];

  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
}

// Generate AI insights
function generateInsights(xAxis, yAxis) {
  const insightsContainer = document.getElementById("insightsContainer");

  if (!currentData || currentData.length === 0) return;

  const insights = [];

  // Data quality insights
  const totalRows = currentData.length;
  const nullCounts = {};
  const headers = Object.keys(currentData[0]);

  headers.forEach((header) => {
    nullCounts[header] = currentData.filter(
      (row) =>
        row[header] === null || row[header] === undefined || row[header] === ""
    ).length;
  });

  insights.push(
    `ðŸ“Š Dataset contains ${totalRows} records with ${headers.length} features`
  );

  // Data quality analysis
  const highNullColumns = Object.entries(nullCounts)
    .filter(([col, count]) => count / totalRows > 0.1)
    .map(
      ([col, count]) =>
        `${col} (${((count / totalRows) * 100).toFixed(1)}% missing)`
    );

  if (highNullColumns.length > 0) {
    insights.push(`âš ï¸ High missing data in: ${highNullColumns.join(", ")}`);
  }

  // Numeric analysis
  if (yAxis) {
    const values = currentData
      .map((row) => Number(row[yAxis]))
      .filter((val) => !isNaN(val));
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const sorted = values.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];

      insights.push(
        `ðŸ“ˆ ${yAxis}: Mean = ${avg.toFixed(2)}, Median = ${median.toFixed(2)}`
      );

      if (avg > median * 1.2) {
        insights.push(
          `ðŸ” ${yAxis} shows positive skewness (right-tailed distribution)`
        );
      } else if (median > avg * 1.2) {
        insights.push(
          `ðŸ” ${yAxis} shows negative skewness (left-tailed distribution)`
        );
      }
    }
  }

  // Categorical analysis
  const uniqueValues = {};
  headers.forEach((header) => {
    const values = currentData
      .map((row) => row[header])
      .filter((val) => val !== null && val !== undefined);
    uniqueValues[header] = new Set(values).size;
  });

  const categoricalColumns = Object.entries(uniqueValues)
    .filter(([col, count]) => count < totalRows * 0.5 && count > 1)
    .map(([col, count]) => `${col} (${count} categories)`);

  if (categoricalColumns.length > 0) {
    insights.push(
      `ðŸ·ï¸ Categorical features detected: ${categoricalColumns.join(", ")}`
    );
  }

  // Display insights
  let html = "";
  insights.forEach((insight) => {
    html += `<div class="insight-card">${insight}</div>`;
  });

  insightsContainer.innerHTML =
    html || "<p>No specific insights generated for current analysis.</p>";
}

// Utility functions
function showMessage(message, type) {
  messagesDiv.innerHTML = `<div class="${type}">${message}</div>`;
  setTimeout(() => {
    messagesDiv.innerHTML = "";
  }, 5000);
}

function showLoading(show) {
  document.getElementById("loading").style.display = show ? "block" : "none";
}

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  showMessage(
    "Welcome to DataViz Pro! Upload a CSV file to get started.",
    "success"
  );
});
