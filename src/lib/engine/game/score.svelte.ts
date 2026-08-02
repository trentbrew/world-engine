/** Local score for gameplay (e.g. coins collected). Resets on world load. */
class Score {
	value = $state(0);

	add(n = 1) {
		this.value += n;
	}

	reset() {
		this.value = 0;
	}
}

export const score = new Score();
