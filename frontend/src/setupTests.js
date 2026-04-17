import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Start the MSW server before all tests, reset handlers between each test,
// and close after the test suite.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
