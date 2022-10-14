import { writable, readable } from './core';
import { derived } from './derived';
import { pipableFrom } from './pipe';

describe('pipe', () => {
	test('pipableFrom', () => {
		const a = pipableFrom(4);
		const b = a.pipe(
			(_) => _ / 2,
			(_) => _ + 1,
			(_) => _.toString(),
			JSON.parse,
			(_) => ({ three: _ })
		);
		expect(b).toEqual({ three: 3 });
	});

	test('core & derived pipe', () => {
		const a = writable(4);
		const b = a.pipe(
			_ => readable(_),
		);
		const c = b.pipe(
			_ => derived(_, x => x / 2),
			_ => derived(_, x => x + 1)
		);
		const d = c.pipe(
			_ => derived(_, x => x.toString()),
			_ => derived(_, JSON.parse),
			_ => derived(_, three => ({ three }))
		);
		expect(d.get()).toEqual({ three: 3 });

		a.set(8);
		expect(d.get()).toEqual({ three: 5 });
	});
});
