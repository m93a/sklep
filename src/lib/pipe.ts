export interface Pipe<A> {
	<Z>(f: (item: A) => Z): Z;
	<B, Z>(f: (item: A) => B, g: (item: B) => Z): Z;
	<B, C, Z>(f: (item: A) => B, g: (item: B) => C, h: (item: C) => Z): Z;
	<B, C, D, Z>(f: (item: A) => B, g: (item: B) => C, h: (item: C) => D, i: (item: D) => Z): Z;
	<B, C, D, E, Z>(
		f: (item: A) => B,
		g: (item: B) => C,
		h: (item: C) => D,
		i: (item: D) => E,
		j: (item: E) => Z
	): Z;
	<B, C, D, E, F, Z>(
		f: (item: A) => B,
		g: (item: B) => C,
		h: (item: C) => D,
		i: (item: D) => E,
		j: (item: E) => F,
		k: (item: F) => Z
	): Z;
	<B, C, D, E, F, G, Z>(
		f: (item: A) => B,
		g: (item: B) => C,
		h: (item: C) => D,
		i: (item: D) => E,
		j: (item: E) => F,
		k: (item: F) => G,
		l: (item: G) => Z
	): Z;
	<B, C, D, E, F, G, H, Z>(
		f: (item: A) => B,
		g: (item: B) => C,
		h: (item: C) => D,
		i: (item: D) => E,
		j: (item: E) => F,
		k: (item: F) => G,
		l: (item: G) => H,
		m: (item: H) => Z
	): Z;
	<B, C, D, E, F, G, H, I, Z>(
		f: (item: A) => B,
		g: (item: B) => C,
		h: (item: C) => D,
		i: (item: D) => E,
		j: (item: E) => F,
		k: (item: F) => G,
		l: (item: G) => H,
		m: (item: H) => I,
		n: (item: I) => Z
	): Z;
	<B, C, D, E, F, G, H, I, J, Z>(
		f: (item: A) => B,
		g: (item: B) => C,
		h: (item: C) => D,
		i: (item: D) => E,
		j: (item: E) => F,
		k: (item: F) => G,
		l: (item: G) => H,
		m: (item: H) => I,
		n: (item: I) => J,
		o: (item: J) => Z
	): Z;
	<B, C, D, E, F, G, H, I, J, K>(
		f: (item: A) => B,
		g: (item: B) => C,
		h: (item: C) => D,
		i: (item: D) => E,
		j: (item: E) => F,
		k: (item: F) => G,
		l: (item: G) => H,
		m: (item: H) => I,
		n: (item: I) => J,
		o: (item: J) => K,
		...fns: Array<(item: any) => any>
	): any;
}

export function pipableFrom<T>(x: T): { pipe: Pipe<T> } {
    return {
        pipe(...fns: Array<(item: any) => any>) {
            return fns.reduce((previousValue, f) => f(previousValue), x);
        }
    };
}
