/** Harden SparkRenderer teardown — async driveSort can outlive dispose (HMR / scene swap). */
import type { SparkRenderer } from '@sparkjsdev/spark';

type SparkInternals = {
	autoUpdate: boolean;
	sortDirty: boolean;
	sorting: boolean;
	updateTimeoutId: number;
	sortTimeoutId: number;
	current?: { target?: unknown };
	driveSort: () => Promise<void>;
	onDirty?: () => void;
};

export function installSparkRendererGuards(spark: SparkRenderer): () => void {
	const s = spark as unknown as SparkInternals;
	let alive = true;

	const origDriveSort = s.driveSort.bind(s);
	s.driveSort = async function driveSortGuarded() {
		if (!alive || !s.current?.target) {
			s.sortDirty = false;
			s.sorting = false;
			return;
		}
		try {
			await origDriveSort();
		} catch (err) {
			if (!alive || (err instanceof Error && err.message === 'No target')) {
				s.sortDirty = false;
				s.sorting = false;
				return;
			}
			throw err;
		}
	};

	const origOnDirty = s.onDirty;
	s.onDirty = () => {
		if (!alive) return;
		origOnDirty?.();
	};

	return () => {
		alive = false;
		s.autoUpdate = false;
		s.sortDirty = false;
		s.sorting = false;
		s.onDirty = undefined;
		if (s.updateTimeoutId !== -1) {
			clearTimeout(s.updateTimeoutId);
			s.updateTimeoutId = -1;
		}
		if (s.sortTimeoutId !== -1) {
			clearTimeout(s.sortTimeoutId);
			s.sortTimeoutId = -1;
		}
	};
}
