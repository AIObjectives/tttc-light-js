import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadReportData } from "./downloadUtils";
import * as schema from "tttc-common/schema";

// Mock DOM APIs
const mockCreateElement = vi.fn();
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Mock document methods
  const mockLink = {
    href: "",
    download: "",
    click: mockClick,
  };

  mockCreateElement.mockReturnValue(mockLink);
  mockCreateObjectURL.mockReturnValue("blob:mock-url");

  // Mock global objects
  Object.defineProperty(global, "document", {
    value: {
      createElement: mockCreateElement,
      body: {
        appendChild: mockAppendChild,
        removeChild: mockRemoveChild,
      },
    },
    writable: true,
  });

  Object.defineProperty(global, "window", {
    value: {
      URL: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      },
    },
    writable: true,
  });

  Object.defineProperty(global, "Blob", {
    value: vi.fn((content, options) => ({
      content,
      type: options?.type,
    })),
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("downloadReportData", () => {
  const mockUIReportData: schema.UIReportData = {
    title: "Test Report",
    description: "A test report",
    date: "2025-01-01",
    topics: [],
    questionAnswers: [],
  };

  const mockPipelineOutput: schema.PipelineOutput = {
    data: ["v0.2", mockUIReportData],
    metadata: [
      "v0.2",
      {
        csvColumnNames: [],
        hasInterview: false,
        interviewName: null,
        claimExtractionPrompt: "test prompt",
        processingNote: null,
      },
    ],
  };

  it("should create a download link with correct filename and timestamp", () => {
    const filename = "test-report";
    const mockTimestamp = 1234567890;

    vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

    downloadReportData(mockPipelineOutput, filename);

    expect(mockCreateElement).toHaveBeenCalledWith("a");

    const mockLink = mockCreateElement.mock.results[0].value;
    expect(mockLink.download).toBe(`${filename}-${mockTimestamp}.json`);
    expect(mockLink.href).toBe("blob:mock-url");
  });

  it("should create a blob with correct JSON content and type", () => {
    const filename = "test-report";
    const mockTimestamp = 1234567890;

    vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

    downloadReportData(mockPipelineOutput, filename);

    expect(global.Blob).toHaveBeenCalledWith(
      [expect.stringContaining('"title": "Test Report"')],
      { type: "application/json" },
    );

    // Check that the blob content includes the PipelineOutput structure
    const blobCall = (global.Blob as any).mock.calls[0];
    const jsonContent = blobCall[0][0];
    const parsedContent = JSON.parse(jsonContent);

    expect(parsedContent).toEqual(mockPipelineOutput);
  });

  it("should create object URL from blob and set it as link href", () => {
    const filename = "test-report";

    downloadReportData(mockPipelineOutput, filename);

    expect(mockCreateObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "application/json",
      }),
    );

    const mockLink = mockCreateElement.mock.results[0].value;
    expect(mockLink.href).toBe("blob:mock-url");
  });

  it("should append link to document body, click it, then remove it", () => {
    const filename = "test-report";

    downloadReportData(mockPipelineOutput, filename);

    const mockLink = mockCreateElement.mock.results[0].value;

    expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
    expect(mockClick).toHaveBeenCalledOnce();
    expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
  });

  it("should clean up object URL after download", () => {
    const filename = "test-report";

    downloadReportData(mockPipelineOutput, filename);

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("should format JSON with proper indentation", () => {
    const filename = "test-report";

    downloadReportData(mockPipelineOutput, filename);

    const blobCall = (global.Blob as any).mock.calls[0];
    const jsonContent = blobCall[0][0];

    // Check that JSON is formatted with 2-space indentation
    expect(jsonContent).toContain('{\n  "data":');
    expect(jsonContent).toContain('  "metadata":');
    expect(jsonContent).toContain("\n}");
  });

  it("should handle complex report data correctly", () => {
    const complexReportData: schema.UIReportData = {
      title: "Complex Report",
      description: "A complex test report with special characters & symbols",
      date: "2025-01-01",
      topics: [
        {
          id: "topic-1",
          topicName: "Topic 1",
          topicShortDescription: "Short description",
          subtopics: [],
        },
      ],
      questionAnswers: [
        {
          question: "What is the purpose?",
          answer: "Testing complex data",
        },
      ],
    };

    const complexPipelineOutput: schema.PipelineOutput = {
      data: ["v0.2", complexReportData],
      metadata: [
        "v0.2",
        {
          csvColumnNames: [],
          hasInterview: false,
          interviewName: null,
          claimExtractionPrompt: "test prompt",
          processingNote: null,
        },
      ],
    };

    const filename = "complex-report";

    expect(() =>
      downloadReportData(complexPipelineOutput, filename),
    ).not.toThrow();

    const blobCall = (global.Blob as any).mock.calls[0];
    const jsonContent = blobCall[0][0];
    const parsedContent = JSON.parse(jsonContent);

    expect(parsedContent.data[1]).toEqual(complexReportData);
  });

  it("should throw error with descriptive message on failure", () => {
    const filename = "test-report";

    // Force JSON.stringify to throw an error
    const circularObj = {} as any;
    circularObj.self = circularObj;
    const badPipelineOutput = circularObj as schema.PipelineOutput;

    expect(() => downloadReportData(badPipelineOutput, filename)).toThrow(
      /Failed to download report data:/,
    );
  });

  it("should handle empty filename gracefully", () => {
    const filename = "";
    const mockTimestamp = 1234567890;

    vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

    downloadReportData(mockPipelineOutput, filename);

    const mockLink = mockCreateElement.mock.results[0].value;
    expect(mockLink.download).toBe(`-${mockTimestamp}.json`);
  });

  it("should handle filenames with special characters", () => {
    const filename = "report-with-special_chars@123";
    const mockTimestamp = 1234567890;

    vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

    downloadReportData(mockPipelineOutput, filename);

    const mockLink = mockCreateElement.mock.results[0].value;
    expect(mockLink.download).toBe(`${filename}-${mockTimestamp}.json`);
  });
});
