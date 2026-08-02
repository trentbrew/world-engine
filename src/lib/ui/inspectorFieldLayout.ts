export type FieldLayoutWidget = 'field' | 'range' | 'header';

export type FieldLayoutRow = {
	key: string;
	fields: string[];
	widget?: FieldLayoutWidget;
	/** Display label override (range rows, subsection headers). */
	label?: string;
};

const PLAYER_MOTOR_ROWS: FieldLayoutRow[] = [
	{ key: 'speed', fields: ['speed'] },
	{ key: 'color', fields: ['color'] },
	{ key: 'slope', fields: ['minSlope', 'maxSlope'], widget: 'range', label: 'slope' },
	{ key: 'groundAcc', fields: ['groundAcc'] },
	{ key: 'airAcc', fields: ['airAcc'] },
	{ key: 'airDrag', fields: ['airDrag'] },
	{ key: 'velocityClipThreshold', fields: ['velocityClipThreshold'] }
];

const PLAYER_VISUAL_ROWS: FieldLayoutRow[] = [
	{ key: 'visualsOffsetThreshold', fields: ['visualsOffsetThreshold'] },
	{ key: 'visualsLerpFactor', fields: ['visualsLerpFactor'] },
	{ key: 'maxVisualsOffset', fields: ['maxVisualsOffset'] },
	{ key: 'maxStepVisual', fields: ['maxStepVisual'] }
];

function rowAvailable(row: FieldLayoutRow, available: Set<string>): boolean {
	return row.fields.every((name) => available.has(name));
}

function layoutPlayerFields(fieldNames: string[]): FieldLayoutRow[] {
	const available = new Set(fieldNames);
	const rows = PLAYER_MOTOR_ROWS.filter((row) => rowAvailable(row, available));
	const visual = PLAYER_VISUAL_ROWS.filter((row) => rowAvailable(row, available));
	if (visual.length > 0) {
		rows.push({ key: 'visual-step', fields: [], widget: 'header', label: 'visual step' });
		rows.push(...visual);
	}
	return rows;
}

/** Map schema field names to inspector rows (supports composite widgets per component). */
export function layoutComponentFields(component: string, fieldNames: string[]): FieldLayoutRow[] {
	if (component === 'Player') return layoutPlayerFields(fieldNames);
	return fieldNames.map((field) => ({ key: field, fields: [field] }));
}
