export function isPrimitive(val: unknown): boolean {
	switch (typeof val) {
		case 'boolean':
		case 'number':
		case 'bigint':
		case 'string':
		case 'symbol':
		case 'undefined':
			return true;

		case 'object':
		case 'function':
			return val === null;
	}
}

export function shouldUpdate(
	oldVal: unknown,
	newVal: unknown,
	skip: 'never' | 'primitive' | 'always'
): boolean {
	if (newVal !== oldVal) return true;
	switch (skip) {
		case 'never':
			return true;
		case 'always':
			return false;
		case 'primitive':
			return !isPrimitive(newVal);
	}
}
