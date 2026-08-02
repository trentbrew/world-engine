#!/usr/bin/env node
import { execSync } from 'node:child_process';

export function devPort() {
	return process.env.VITE_PORT ?? process.env.PW_PORT ?? '9292';
}

export function devHost() {
	return process.env.PW_HOST ?? '127.0.0.1';
}

export function devBaseUrl() {
	return process.env.PW_BASE_URL ?? `http://${devHost()}:${devPort()}`;
}

export function portOpen(host = devHost(), port = devPort()) {
	try {
		execSync(`nc -z ${host} ${port}`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/** True when Vite answers HTTP on the dev base URL (not just a bound port). */
export async function httpReady(url = devBaseUrl(), timeoutMs = 4_000) {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
		return res.status < 500;
	} catch {
		return false;
	}
}

export async function devServerUp() {
	// Vite may bind IPv6 localhost only; try configured host then ::1/localhost.
	const hosts = [devHost(), 'localhost', '127.0.0.1'].filter(
		(h, i, a) => a.indexOf(h) === i
	);
	for (const host of hosts) {
		if (!portOpen(host)) continue;
		if (await httpReady(`http://${host}:${devPort()}`)) return true;
	}
	return false;
}
