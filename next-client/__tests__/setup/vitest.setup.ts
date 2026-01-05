// Shared browser setup: console interception, mock cleanup, browser API mocks
import "tttc-common/test-utils/setup/browser";

// Project-specific custom matchers (jest-dom + toMatchReportState)
import "./matchers";

// Mock pointer capture APIs for Radix UI components (not supported in jsdom)
// See: https://github.com/radix-ui/primitives/issues/1822
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// Mock scrollIntoView (not supported in jsdom)
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
