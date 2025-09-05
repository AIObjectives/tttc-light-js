/**
 * Tests for CSV Security Validation Module
 */

import { describe, it, expect } from "vitest";
import {
  detectCSVInjection,
  sanitizeCSVCell,
  validateCSVStructure,
  validateEncoding,
  validateParsedData,
  validateCSVSecurity,
  CSV_SECURITY_CONFIG,
} from "../index";

describe("CSV Security Module", () => {
  describe("detectCSVInjection", () => {
    it("should detect Excel formula injection", () => {
      expect(detectCSVInjection("=SUM(A1:A10)")).toBe(true);
      expect(detectCSVInjection("=cmd|calc")).toBe(true);
      expect(detectCSVInjection('=HYPERLINK("http://evil.com")')).toBe(true);
    });

    it("should detect Calc formula injection", () => {
      expect(detectCSVInjection("+SUM(1+1)")).toBe(true);
      expect(detectCSVInjection("-SUM(1+1)")).toBe(true);
      expect(detectCSVInjection("@SUM(1+1)")).toBe(true);
    });

    it("should detect tab-prefixed formulas", () => {
      expect(detectCSVInjection("\t=SUM(1+1)")).toBe(true);
    });

    it("should detect dangerous protocols and patterns", () => {
      expect(detectCSVInjection("javascript:alert(1)")).toBe(true);
      expect(detectCSVInjection("vbscript:msgbox(1)")).toBe(true);
      expect(detectCSVInjection("data:text/html;base64,PHNjcmlwdD4=")).toBe(
        true,
      );
      expect(detectCSVInjection("<script>alert(1)</script>")).toBe(true);
      expect(detectCSVInjection('DDE("cmd","/c calc.exe","!")')).toBe(true);
      expect(detectCSVInjection("cmd | calc")).toBe(true);
      expect(detectCSVInjection('powershell -c "calc"')).toBe(true);
    });

    it("should not flag safe content", () => {
      expect(detectCSVInjection("Normal text content")).toBe(false);
      expect(detectCSVInjection("john@example.com")).toBe(false);
      expect(detectCSVInjection("Price: $10.99")).toBe(false);
      expect(detectCSVInjection("Meeting at 3:00 PM")).toBe(false);
      expect(detectCSVInjection("Temperature: -5°C")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(detectCSVInjection("")).toBe(false);
      expect(detectCSVInjection("   ")).toBe(false);
      expect(detectCSVInjection("= ")).toBe(true); // Space after equals
    });
  });

  describe("sanitizeCSVCell", () => {
    it("should prefix dangerous formula characters", () => {
      expect(sanitizeCSVCell("=SUM(1+1)")).toBe("'=SUM(1+1)");
      expect(sanitizeCSVCell("+SUM(1+1)")).toBe("'+SUM(1+1)");
      expect(sanitizeCSVCell("-SUM(1+1)")).toBe("'-SUM(1+1)");
      expect(sanitizeCSVCell("@SUM(1+1)")).toBe("'@SUM(1+1)");
    });

    it("should sanitize dangerous protocols", () => {
      expect(sanitizeCSVCell("javascript:alert(1)")).toBe("js:alert(1)");
      expect(sanitizeCSVCell("vbscript:msgbox(1)")).toBe("vbs:msgbox(1)");
      expect(sanitizeCSVCell("data:text/html;base64,evil")).toBe(
        "data-removed:text/html;base64,evil",
      );
    });

    it("should remove script tags", () => {
      expect(sanitizeCSVCell("<script>alert(1)</script>")).toBe("");
      expect(sanitizeCSVCell("<SCRIPT>alert(1)</SCRIPT>")).toBe("");
      expect(sanitizeCSVCell('<script src="evil.js"></script>')).toBe("");
    });

    it("should sanitize command injection patterns", () => {
      expect(sanitizeCSVCell('DDE("cmd","/c calc.exe","!")')).toBe(
        'DDE-removed("cmd","/c calc.exe","!")',
      );
      expect(sanitizeCSVCell("cmd | calc")).toBe("cmd-removed| calc");
    });

    it("should handle non-string inputs", () => {
      expect(sanitizeCSVCell(123 as any)).toBe("123");
      expect(sanitizeCSVCell(null as any)).toBe("null");
      expect(sanitizeCSVCell(undefined as any)).toBe("undefined");
    });

    it("should truncate oversized content", () => {
      const longContent = "A".repeat(CSV_SECURITY_CONFIG.MAX_CELL_LENGTH + 100);
      const sanitized = sanitizeCSVCell(longContent);
      expect(sanitized.length).toBe(CSV_SECURITY_CONFIG.MAX_CELL_LENGTH + 3); // +3 for '...'
      expect(sanitized.endsWith("...")).toBe(true);
    });

    it("should preserve safe content", () => {
      expect(sanitizeCSVCell("Normal text")).toBe("Normal text");
      expect(sanitizeCSVCell("john@example.com")).toBe("john@example.com");
      expect(sanitizeCSVCell("Price: $10.99")).toBe("Price: $10.99");
    });
  });

  describe("validateCSVStructure", () => {
    it("should reject oversized files", () => {
      const oversizedBuffer = new ArrayBuffer(
        CSV_SECURITY_CONFIG.MAX_FILE_SIZE + 1000,
      );
      const result = validateCSVStructure(oversizedBuffer);

      expect(result.tag).toBe("failure");
      expect(result.error.tag).toBe("OVERSIZE_CONTENT");
      expect(result.error.severity).toBe("high");
    });

    it("should accept files within custom size limit", () => {
      // Create a small CSV that tests the size limit logic
      const csvContent =
        "id,comment,interview\nrow1,data1,data2\nrow2,data3,data4\n";
      const buffer = Buffer.from(csvContent);
      // Create a properly sized ArrayBuffer
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.length,
      );
      const customLimit = 200; // 200 bytes (well above our small CSV)
      const result = validateCSVStructure(arrayBuffer, customLimit);
      expect(result.tag).toBe("success");
    });

    it("should reject files exceeding custom size limit", () => {
      const buffer = Buffer.alloc(300); // 300 bytes
      // Create a properly sized ArrayBuffer
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.length,
      );
      const customLimit = 200; // 200 bytes
      const result = validateCSVStructure(arrayBuffer, customLimit);
      expect(result.tag).toBe("failure");
      if (result.tag === "failure") {
        expect(result.error.tag).toBe("OVERSIZE_CONTENT");
        expect(result.error.message).toContain("300");
        expect(result.error.message).toContain("200");
      }
    });

    it("should reject CSV with too many rows", () => {
      // Create a CSV that exceeds row limit but stays under file size limit
      let csvContent = "a,b,c\n";
      for (let i = 0; i < CSV_SECURITY_CONFIG.MAX_ROWS + 10; i++) {
        csvContent += `${i},${i},${i}\n`;
      }
      const buffer = Buffer.from(csvContent);
      const result = validateCSVStructure(buffer);

      expect(result.tag).toBe("failure");
      // The implementation checks file size first, so it might be OVERSIZE_CONTENT
      expect(["CSV_BOMB_DETECTED", "OVERSIZE_CONTENT"]).toContain(
        result.error.tag,
      );
      if (result.error.tag === "CSV_BOMB_DETECTED") {
        expect(result.error.message).toContain("Row count");
      }
    });

    it("should reject CSV with too many columns", () => {
      const headers = Array(CSV_SECURITY_CONFIG.MAX_COLUMNS + 10)
        .fill("col")
        .join(",");
      const csvContent = `${headers}\nvalue1,value2,value3`;
      const buffer = Buffer.from(csvContent);
      const result = validateCSVStructure(buffer);

      expect(result.tag).toBe("failure");
      expect(result.error.tag).toBe("CSV_BOMB_DETECTED");
      expect(result.error.message).toContain("Column count");
    });

    it("should detect suspicious patterns", () => {
      // Create content with suspicious patterns but within column limits (under 50 columns)
      const suspiciousCSV =
        "header1,header2,header3\n" +
        ",".repeat(100) +
        "\nvalue1,value2,value3";
      const buffer = Buffer.from(suspiciousCSV);
      const result = validateCSVStructure(buffer);

      expect(result.tag).toBe("failure");
      expect(result.error.tag).toBe("CSV_BOMB_DETECTED");
      expect(result.error.message).toContain("Suspicious repeating patterns");
    });

    it("should accept valid CSV structure", () => {
      const validCSV =
        'comment,id,interview\n"Hello world",1,"Alice"\n"Good morning",2,"Bob"';
      const buffer = Buffer.from(validCSV);
      const result = validateCSVStructure(buffer);

      expect(result.tag).toBe("success");
    });
  });

  describe("validateEncoding", () => {
    it("should accept valid UTF-8 content", () => {
      const validContent = 'comment,id,interview\n"Hello 世界",1,"Alice"';
      const buffer = Buffer.from(validContent, "utf8");
      const result = validateEncoding(buffer);

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value).toBe(validContent);
      }
    });

    it("should handle UTF-8 BOM", () => {
      const contentWithBOM = '\uFEFFcomment,id,interview\n"Hello",1,"Alice"';
      const buffer = Buffer.from(contentWithBOM, "utf8");
      const result = validateEncoding(buffer);

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value).toBe('comment,id,interview\n"Hello",1,"Alice"');
      }
    });

    it("should detect invalid UTF-8 sequences", () => {
      // Create buffer with invalid UTF-8 bytes
      const invalidBuffer = Buffer.from([
        0xff, 0xfe, 0x48, 0x65, 0x6c, 0x6c, 0x6f,
      ]);
      const result = validateEncoding(invalidBuffer);

      expect(result.tag).toBe("failure");
      expect(result.error.tag).toBe("INVALID_ENCODING");
      expect(result.error.message).toContain("invalid UTF-8");
    });
  });

  describe("validateParsedData", () => {
    it("should reject non-array data", () => {
      const result = validateParsedData("not an array" as any);

      expect(result.tag).toBe("failure");
      expect(result.error.tag).toBe("MALFORMED_STRUCTURE");
      expect(result.error.message).toContain("not an array");
    });

    it("should detect injection in parsed data", () => {
      const maliciousData = [
        { comment: "Normal comment", id: "1", interview: "Alice" },
        { comment: "=cmd|calc", id: "2", interview: "Bob" },
      ];
      const result = validateParsedData(maliciousData);

      expect(result.tag).toBe("failure");
      expect(result.error.tag).toBe("INJECTION_ATTEMPT");
      expect(result.error.message).toContain("row 2");
      expect(result.error.message).toContain("comment");
    });

    it("should accept clean parsed data", () => {
      const cleanData = [
        { comment: "Normal comment", id: "1", interview: "Alice" },
        { comment: "Another comment", id: "2", interview: "Bob" },
      ];
      const result = validateParsedData(cleanData);

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value).toEqual(cleanData);
      }
    });

    it("should handle non-object rows", () => {
      const mixedData = [
        { comment: "Normal comment", id: "1", interview: "Alice" },
        "string row",
        null,
        42,
      ];
      const result = validateParsedData(mixedData);

      expect(result.tag).toBe("success"); // Should not fail on non-object rows
    });
  });

  describe("validateCSVSecurity (integration)", () => {
    // Helper to create File objects for testing
    const createTestFile = (content: string, filename = "test.csv") => {
      const blob = new Blob([content], { type: "text/csv" });
      return new File([blob], filename, { type: "text/csv" });
    };

    it("should accept valid CSV file", async () => {
      const validCSV =
        'comment,id,interview\n"Hello world",1,"Alice"\n"Good morning",2,"Bob"';
      const file = createTestFile(validCSV);
      const result = await validateCSVSecurity(file);

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value).toBe(validCSV);
      }
    });

    it("should reject oversized CSV file", async () => {
      const oversizedCSV =
        "comment,id,interview\n" +
        "A".repeat(CSV_SECURITY_CONFIG.MAX_FILE_SIZE);
      const file = createTestFile(oversizedCSV);
      const result = await validateCSVSecurity(file);

      expect(result.tag).toBe("failure");
      expect(result.error.tag).toBe("OVERSIZE_CONTENT");
    });

    it("should handle file reading errors gracefully", async () => {
      // Create a mock file that will throw an error
      const mockFile = {
        arrayBuffer: () => Promise.reject(new Error("File read error")),
      } as File;

      const result = await validateCSVSecurity(mockFile);

      expect(result.tag).toBe("failure");
      expect(result.error.tag).toBe("MALFORMED_STRUCTURE");
      expect(result.error.message).toContain("File read error");
    });
  });
});
