export type DebugConsoleTab = 'input' | 'stats' | 'sync' | 'logs';

export type DebugLogLevel = 'log' | 'warn' | 'error';

export type DebugLogEntry = {
	id: number;
	level: DebugLogLevel;
	text: string;
	ts: number;
};
