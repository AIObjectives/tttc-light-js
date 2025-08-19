# Analytics Module

A comprehensive analytics module that supports multiple providers (PostHog and Local) for tracking user events, behaviors, and system metrics. The module is designed to be extensible, well-tested, and production-ready.

## Features

- **Multiple Providers**: Support for PostHog and Local (console/file) analytics providers
- **Type Safety**: Comprehensive TypeScript types for all analytics operations
- **Error Handling**: Robust error handling with graceful fallbacks
- **Configuration**: Environment-based configuration with validation
- **Testing**: Comprehensive unit and integration tests
- **Extensible**: Easy to add new analytics providers
- **Production Ready**: Built-in retry logic, error logging, and resource cleanup

## Quick Start

### 1. Environment Configuration

Add these environment variables to your `.env` file:

```bash
# Analytics Provider Configuration
ANALYTICS_PROVIDER=local                    # Options: 'posthog' | 'local'
ANALYTICS_API_KEY=your_posthog_api_key     # Required for PostHog provider
ANALYTICS_HOST=https://app.posthog.com     # Optional: PostHog host URL
ANALYTICS_FLUSH_AT=20                      # Optional: Events to batch before flushing
ANALYTICS_FLUSH_INTERVAL=10000             # Optional: Flush interval in milliseconds
ANALYTICS_DEBUG=false                      # Optional: Enable debug logging
ANALYTICS_ENABLED=true                     # Optional: Enable/disable analytics
```

### 2. Initialize Analytics

```typescript
import { initializeAnalytics, createAnalyticsConfig } from './analytics';
import { validateEnv } from './types/context';

// Validate environment variables and create config
const env = validateEnv();
const analyticsConfig = createAnalyticsConfig(env);

// Initialize analytics system
initializeAnalytics(analyticsConfig);
```

### 3. Track Events

```typescript
import { trackEvent, CommonEvents, createAnalyticsContext } from './analytics';

// Create analytics context
const context = createAnalyticsContext(
  userId,
  sessionId,
  requestId,
  userEmail,
  { plan: 'premium', role: 'admin' }
);

// Track user sign-in
await trackEvent({
  name: CommonEvents.USER_SIGNIN,
  properties: {
    method: 'firebase',
    provider: 'google',
  },
  context,
});

// Track custom events
await trackEvent({
  name: 'report_generated',
  properties: {
    reportId: 'report123',
    reportType: 'analysis',
    processingTime: 45000,
    tokensUsed: 15000,
    cost: 0.75,
  },
  context,
});
```

## API Reference

### Core Functions

#### `initializeAnalytics(config: AnalyticsConfig): AnalyticsProvider`

Initializes the analytics system with the specified provider configuration.

```typescript
const provider = initializeAnalytics({
  provider: 'posthog',
  apiKey: 'your-api-key',
  host: 'https://app.posthog.com',
  flushAt: 20,
  flushInterval: 10000,
  debug: false,
  enabled: true,
});
```

#### `trackEvent(event: AnalyticsEvent): Promise<void>`

Tracks an analytics event with optional properties and context.

```typescript
await trackEvent({
  name: CommonEvents.PIPELINE_COMPLETED,
  properties: {
    pipelineId: 'pipeline123',
    duration: 285,
    tokensUsed: 15000,
    success: true,
  },
  context: {
    user: { userId: 'user123', email: 'user@example.com' },
    sessionId: 'session456',
    requestId: 'req789',
  },
});
```

#### `identifyUser(identify: AnalyticsIdentify): Promise<void>`

Identifies a user with traits for analytics tracking.

```typescript
await identifyUser({
  userId: 'user123',
  traits: {
    name: 'John Doe',
    email: 'john@example.com',
    plan: 'premium',
    company: 'Acme Corp',
    createdAt: '2023-01-01T00:00:00Z',
  },
  context: {
    sessionId: 'session456',
  },
});
```

#### `trackPage(name: string, properties?: AnalyticsProperties, context?: AnalyticsContext): Promise<void>`

Tracks page or screen views.

```typescript
await trackPage('Dashboard', {
  section: 'reports',
  reportCount: 15,
}, {
  user: { userId: 'user123' },
  sessionId: 'session456',
});
```

#### `createAnalyticsContext(...): AnalyticsContext`

Helper function to create analytics context from request data.

```typescript
const context = createAnalyticsContext(
  userId,           // string | undefined
  sessionId,        // string | undefined  
  requestId,        // string | undefined
  email,           // string | undefined
  additionalProps, // AnalyticsProperties | undefined
  environment,     // string | undefined
  version         // string | undefined
);
```

### Common Events

Pre-defined event names for consistency:

```typescript
export enum CommonEvents {
  USER_SIGNIN = 'user_signin',
  USER_SIGNOUT = 'user_signout',
  USER_REGISTRATION = 'user_registration',
  REPORT_CREATED = 'report_created',
  REPORT_VIEWED = 'report_viewed',
  REPORT_DOWNLOADED = 'report_downloaded',
  PIPELINE_STARTED = 'pipeline_started',
  PIPELINE_COMPLETED = 'pipeline_completed',
  PIPELINE_FAILED = 'pipeline_failed',
  API_REQUEST = 'api_request',
  ERROR_OCCURRED = 'error_occurred',
  FEATURE_USED = 'feature_used',
}
```

## Providers

### Local Provider

The local provider logs events to the console and structured logs. Ideal for development and testing.

**Features:**
- Console logging with structured output
- Debug mode for detailed event information
- No external dependencies
- Immediate event processing

**Configuration:**
```typescript
{
  provider: 'local',
  debug: true,     // Enable detailed console output
  enabled: true,   // Enable/disable the provider
}
```

### PostHog Provider

The PostHog provider sends events to PostHog analytics service for production usage.

**Features:**
- Real-time event tracking
- User identification and properties
- Automatic retry on failures
- Batching and flushing controls
- Support for custom PostHog hosts

**Configuration:**
```typescript
{
  provider: 'posthog',
  apiKey: 'phc_your_api_key',
  host: 'https://app.posthog.com',  // or custom host
  flushAt: 20,                      // Batch size
  flushInterval: 10000,             // Flush interval (ms)
  debug: false,                     // Debug logging
  enabled: true,                    // Enable/disable
}
```

## Usage Examples

### Express Middleware Integration

```typescript
import express from 'express';
import { trackEvent, CommonEvents, createAnalyticsContext } from './analytics';

const app = express();

// Analytics middleware
app.use((req, res, next) => {
  // Track API requests
  trackEvent({
    name: CommonEvents.API_REQUEST,
    properties: {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
    },
    context: createAnalyticsContext(
      req.user?.id,
      req.session?.id,
      req.id,
      req.user?.email
    ),
  });

  next();
});
```

### User Authentication Events

```typescript
// Sign in event
app.post('/auth/signin', async (req, res) => {
  const user = await authenticateUser(req.body);
  
  // Identify the user
  await identifyUser({
    userId: user.id,
    traits: {
      name: user.name,
      email: user.email,
      plan: user.subscription?.plan,
      lastLoginAt: new Date().toISOString(),
    },
  });

  // Track sign-in event
  await trackEvent({
    name: CommonEvents.USER_SIGNIN,
    properties: {
      method: req.body.method,
      provider: req.body.provider,
      deviceType: detectDeviceType(req.get('User-Agent')),
    },
    context: createAnalyticsContext(user.id, req.session.id, req.id, user.email),
  });

  res.json({ success: true });
});
```

### Pipeline Events

```typescript
// Track pipeline lifecycle
async function runPipeline(pipelineId: string, userId: string, inputData: any) {
  const context = createAnalyticsContext(userId);

  // Pipeline started
  await trackEvent({
    name: CommonEvents.PIPELINE_STARTED,
    properties: {
      pipelineId,
      inputSize: inputData.length,
      estimatedDuration: estimateProcessingTime(inputData),
    },
    context,
  });

  try {
    const startTime = Date.now();
    const result = await processPipeline(inputData);
    const duration = Date.now() - startTime;

    // Pipeline completed
    await trackEvent({
      name: CommonEvents.PIPELINE_COMPLETED,
      properties: {
        pipelineId,
        duration,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        outputSize: result.data.length,
      },
      context,
    });

    return result;
  } catch (error) {
    // Pipeline failed
    await trackEvent({
      name: CommonEvents.PIPELINE_FAILED,
      properties: {
        pipelineId,
        errorType: error.constructor.name,
        errorMessage: error.message,
        duration: Date.now() - startTime,
      },
      context,
    });

    throw error;
  }
}
```

### Error Tracking

```typescript
// Global error handler with analytics
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Track the error
  trackEvent({
    name: CommonEvents.ERROR_OCCURRED,
    properties: {
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorStack: error.stack,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
    },
    context: createAnalyticsContext(
      req.user?.id,
      req.session?.id,
      req.id,
      req.user?.email
    ),
  });

  // Send error response
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id,
  });
});
```

### Graceful Shutdown

```typescript
// Graceful shutdown with analytics cleanup
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  
  // Flush any pending analytics data
  await flushAnalytics();
  
  // Shutdown analytics providers
  await shutdownAnalytics();
  
  // Close other resources
  await closeDatabase();
  
  process.exit(0);
});
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANALYTICS_PROVIDER` | No | `local` | Analytics provider (`posthog` \| `local`) |
| `ANALYTICS_API_KEY` | PostHog only | - | PostHog API key |
| `ANALYTICS_HOST` | No | `https://app.posthog.com` | PostHog host URL |
| `ANALYTICS_FLUSH_AT` | No | `20` | Number of events to batch before flushing |
| `ANALYTICS_FLUSH_INTERVAL` | No | `10000` | Flush interval in milliseconds |
| `ANALYTICS_DEBUG` | No | `false` | Enable debug logging |
| `ANALYTICS_ENABLED` | No | `true` | Enable/disable analytics |

## Error Handling

The analytics module includes comprehensive error handling:

1. **Provider Initialization**: Validates configuration and throws meaningful errors
2. **Event Tracking**: Catches and logs errors without disrupting application flow
3. **Network Failures**: Implements retry logic for PostHog API calls
4. **Graceful Degradation**: Continues operation even if analytics fails

```typescript
// All analytics functions handle errors gracefully
await trackEvent({ name: 'test_event' }); // Never throws
await identifyUser({ userId: 'user123' }); // Never throws
await trackPage('Test Page'); // Never throws
```

## Testing

The module includes comprehensive test coverage:

- **Unit Tests**: Test individual providers and components
- **Integration Tests**: Test complete workflows and provider switching
- **Configuration Tests**: Validate environment variable handling
- **Error Scenarios**: Test error handling and edge cases

Run tests with:
```bash
npm test
```

## Best Practices

1. **Initialize Early**: Initialize analytics during application startup
2. **Use Context**: Always provide context for better event attribution
3. **Common Events**: Use predefined `CommonEvents` for consistency
4. **Error Tracking**: Track errors and exceptions for debugging
5. **User Identification**: Identify users early in the session
6. **Page Tracking**: Track page views for user journey analysis
7. **Custom Properties**: Include relevant properties for analysis
8. **Graceful Shutdown**: Flush analytics data during shutdown

## Extending with New Providers

To add a new analytics provider:

1. **Implement Interface**: Create a class implementing `AnalyticsProvider`
2. **Update Types**: Add the provider to the `AnalyticsConfig` type
3. **Update Factory**: Add provider creation logic to `initializeAnalytics`
4. **Add Configuration**: Update environment validation
5. **Write Tests**: Create unit and integration tests
6. **Update Documentation**: Document the new provider

Example:
```typescript
export class CustomAnalyticsProvider implements AnalyticsProvider {
  async track(event: AnalyticsEvent): Promise<void> {
    // Implementation
  }
  
  async identify(identify: AnalyticsIdentify): Promise<void> {
    // Implementation
  }
  
  // ... other methods
}
```

## License

This analytics module is part of the TTTC project and follows the project's licensing terms.