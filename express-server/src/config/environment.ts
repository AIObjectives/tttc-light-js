export const config = {
  useMocks: process.env.USE_MOCKS === 'true',
  openaiApiKey: process.env.OPENAI_API_KEY,
  environment: process.env.NODE_ENV || 'development'
}; 