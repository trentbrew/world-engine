/** Whether Sketchfab API auth is available in process env. */
const KEY = 'SKETCHFAB_API_KEY';

export function sketchfabConfigured(): boolean {
	return Boolean(process.env[KEY]?.trim());
}
