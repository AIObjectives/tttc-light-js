import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from "vitest";
import { LocalAnalyticsProvider } from "../providers/localProvider";
import {
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  CommonEvents,
} from "../types";

// Mock console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("LocalAnalyticsProvider", () => {
  let provider: LocalAnalyticsProvider;

  beforeAll(() => {
    // Mock console methods
    console.log = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterAll(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LocalAnalyticsProvider({ debug: true, enabled: true });
  });

  describe("Configuration", () => {
    it("should initialize with default configuration", () => {
      const defaultProvider = new LocalAnalyticsProvider();
      expect(defaultProvider).toBeInstanceOf(LocalAnalyticsProvider);
    });

    it("should respect debug configuration", () => {
      const debugProvider = new LocalAnalyticsProvider({ debug: true });
      const nonDebugProvider = new LocalAnalyticsProvider({ debug: false });

      expect(debugProvider).toBeInstanceOf(LocalAnalyticsProvider);
      expect(nonDebugProvider).toBeInstanceOf(LocalAnalyticsProvider);
    });

    it("should respect enabled configuration", () => {
      const enabledProvider = new LocalAnalyticsProvider({ enabled: true });
      const disabledProvider = new LocalAnalyticsProvider({ enabled: false });

      expect(enabledProvider).toBeInstanceOf(LocalAnalyticsProvider);
      expect(disabledProvider).toBeInstanceOf(LocalAnalyticsProvider);
    });
  });

  describe("Event Tracking", () => {
    it("should track simple events", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
          timestamp: "2023-01-01T00:00:00Z",
        },
      };

      await provider.track(event);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          name: CommonEvents.USER_SIGNIN,
          properties: event.properties,
        })
      );
    });

    it("should track events with full context", async () => {
      const context: AnalyticsContext = {
        user: {
          userId: "user123",
          email: "test@example.com",
          properties: { plan: "premium" },
        },
        sessionId: "session456",
        requestId: "req789",
        timestamp: new Date("2023-01-01T00:00:00Z"),
        environment: "test",
        version: "1.0.0",
      };

      const event: AnalyticsEvent = {
        name: CommonEvents.REPORT_CREATED,
        properties: {
          reportId: "report123",
          size: 1500,
        },
        context,
      };

      await provider.track(event);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          name: CommonEvents.REPORT_CREATED,
          properties: event.properties,
          context: expect.objectContaining({
            user: expect.objectContaining(context.user),
            sessionId: context.sessionId,
            requestId: context.requestId,
            environment: context.environment,
            version: context.version,
          }),
        })
      );
    });

    it("should handle events with null/undefined properties", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.API_REQUEST,
        properties: {
          endpoint: "/api/test",
          userId: null,
          metadata: undefined,
        },
      };

      await provider.track(event);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          name: CommonEvents.API_REQUEST,
          properties: event.properties,
        })
      );
    });

    it("should not track events when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ 
        debug: true, 
        enabled: false 
      });

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await disabledProvider.track(event);

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
    });

    it("should add timestamp when not provided", async () => {
      const beforeTime = new Date();
      
      const event: AnalyticsEvent = {
        name: CommonEvents.FEATURE_USED,
        properties: { feature: "dashboard" },
      };

      await provider.track(event);

      const afterTime = new Date();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );

      const logCalls = (console.log as any).mock.calls;
      const eventDataCall = logCalls.find((call: any, index: number) => 
        call[0] && typeof call[0] === 'object' && call[0].name === CommonEvents.FEATURE_USED
      );
      expect(eventDataCall).toBeDefined();

      const eventData = eventDataCall[0];
      expect(eventData.context.timestamp).toBeDefined();
      
      const eventTime = new Date(eventData.context.timestamp);
      expect(eventTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(eventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("User Identification", () => {
    it("should identify users", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          name: "John Doe",
          email: "john@example.com",
          plan: "enterprise",
        },
        context: {
          sessionId: "session456",
          environment: "test",
        },
      };

      await provider.identify(identify);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] User identified:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user123",
          traits: identify.traits,
          context: expect.objectContaining(identify.context),
        })
      );
    });

    it("should identify users without traits", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user456",
      };

      await provider.identify(identify);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] User identified:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user456",
          traits: undefined,
        })
      );
    });

    it("should not identify when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ 
        debug: true, 
        enabled: false 
      });

      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: { name: "John Doe" },
      };

      await disabledProvider.identify(identify);

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] User identified:")
      );
    });
  });

  describe("Page Tracking", () => {
    it("should track page views", async () => {
      const context: AnalyticsContext = {
        user: { userId: "user123" },
        sessionId: "session456",
      };

      await provider.page("Dashboard", { section: "reports" }, context);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Page tracked:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          page: "Dashboard",
          properties: { section: "reports" },
          context: expect.objectContaining(context),
        })
      );
    });

    it("should track page views without properties", async () => {
      await provider.page("Home");

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Page tracked:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          page: "Home",
          properties: undefined,
          context: expect.objectContaining({
            timestamp: expect.any(Date),
          }),
        })
      );
    });

    it("should not track pages when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ 
        debug: true, 
        enabled: false 
      });

      await disabledProvider.page("Dashboard");

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Page tracked:")
      );
    });
  });

  describe("Flush and Shutdown", () => {
    it("should handle flush gracefully", async () => {
      await provider.flush();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Flush requested")
      );
    });

    it("should handle shutdown gracefully", async () => {
      await provider.shutdown();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Analytics shutdown")
      );
    });

    it("should not log flush when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ 
        debug: true, 
        enabled: false 
      });

      await disabledProvider.flush();

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Flush requested")
      );
    });

    it("should not log shutdown when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ 
        debug: true, 
        enabled: false 
      });

      await disabledProvider.shutdown();

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Analytics shutdown")
      );
    });
  });

  describe("Debug Mode", () => {
    it("should log more details in debug mode", async () => {
      const debugProvider = new LocalAnalyticsProvider({ 
        debug: true, 
        enabled: true 
      });

      const event: AnalyticsEvent = {
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          errorType: "ValidationError",
          message: "Test error",
        },
      };

      await debugProvider.track(event);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
    });

    it("should log less details when debug is disabled", async () => {
      const nonDebugProvider = new LocalAnalyticsProvider({ 
        debug: false, 
        enabled: true 
      });

      const event: AnalyticsEvent = {
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          errorType: "ValidationError",
          message: "Test error",
        },
      };

      await nonDebugProvider.track(event);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event:")
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed event data gracefully", async () => {
      const malformedEvent = {
        name: null,
        properties: "invalid",
      } as any;

      await expect(provider.track(malformedEvent)).resolves.toBeUndefined();
    });

    it("should handle circular reference in properties", async () => {
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      const event: AnalyticsEvent = {
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          circular: circularObj,
        },
      };

      await expect(provider.track(event)).resolves.toBeUndefined();
    });

    it("should handle console errors gracefully", async () => {
      // Temporarily make console.log throw
      const originalLog = console.log;
      console.log = vi.fn().mockImplementation(() => {
        throw new Error("Console error");
      });

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await expect(provider.track(event)).resolves.toBeUndefined();

      // Restore console.log
      console.log = originalLog;
    });
  });
});