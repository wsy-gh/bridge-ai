// Set test environment variables before anything else
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/bridge_ai_test';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
