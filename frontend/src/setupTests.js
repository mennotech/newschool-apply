import '@testing-library/jest-dom';
import { server } from './mocks/server';

// jsdom does not implement canvas APIs; provide a minimal context for signature pad tests.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
	value: jest.fn(() => ({
		fillStyle: '#ffffff',
		strokeStyle: '#000000',
		lineWidth: 1,
		lineCap: 'round',
		beginPath: jest.fn(),
		moveTo: jest.fn(),
		lineTo: jest.fn(),
		stroke: jest.fn(),
		fillRect: jest.fn(),
		clearRect: jest.fn(),
	})),
});

// Start the MSW server before all tests, reset handlers between each test,
// and close after the test suite.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
