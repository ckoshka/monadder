// deno-lint-ignore-file no-explicit-any ban-types

// take two functions, head and tail. execute each in a list, passing results from one to another. when mapping, simply concatenate the last two functions into a single function that does them synchronously and pass that as the first parameter. if initialising with just one, then make the second a simple identity function.
export type AnyFn = (...args: any[]) => any;

export type AnyAsyncFn = (a0?: any) => Promise<any>;

export type IO<T> = {
	map<B>(fn: (a0: T) => B): IO<B>;
	fmap<B>(fn: (a0: T) => IO<B>): IO<B>;
	get(): T;
};

export type Monad<T> = {
	map<B>(fn: (a0: T) => B): Monad<B>;
	fmap<B>(fn: (a0: T) => Monad<B>): Monad<B>;
	get(): T;
};

export type Future<T> = {
	map<B>(fn: (a0: T) => B): Future<B>;
	fmap<B>(fn: (a0: T) => Future<B>): Future<B>;
	get(): T;
};

export type Maybe<T> = {
	map<B>(fn: (a0: T) => B): Maybe<B>;
	fmap<B>(fn: (a0: T) => Maybe<B>): Maybe<B>;
	get(): T;
	getOrElse(fn: () => T): T;
	isNone: () => boolean;
	isSome: () => boolean;
};

export const ErrorSymbol = Symbol("Error");
export type ErrType<T> = { [ErrorSymbol]: T };
export const oops = <T>(d: T) => ({ [ErrorSymbol]: d });

export type Either<T, E1> = {
	map<B extends {}, E2>(
		fn: (a0: T) => B | ErrType<E2>,
	): Either<B, E1 | E2>;
	fmap<B extends {}, E2>(
		fn: (a0: T) => Either<B, E2>,
	): Either<B, E1 | E2>;
	mapErr<B>(fn: (a0: E1) => B): Either<T, B>;
	get(): T | ErrType<E1>;
	getOrElse(fn: () => T): T;
	isErr: () => boolean;
	isOk: () => boolean;
};

export const Either = {
	new: <T extends {}, Err>(
		value: T | ErrType<Err>,
	): Either<T, Err> => {

		const isT = (val: {}): val is T => !Object.hasOwn(val, ErrorSymbol);

		return {

			map: <B extends {}, E2>(
				fn: (a0: T) => B | ErrType<E2>,
			) => !isT(value)
				? Either.new<B, Err | E2>(value)
				: Either.new(fn(value)),

			fmap: <B extends {}, E2>(
				fn: (a0: T) => Either<B, E2>,
			) => isT(value)
				? Either.new<B, Err | E2>(fn(value).get())
				: Either.new<B, Err>(value),

			mapErr: <B>(fn: (a0: Err) => B) =>
				!isT(value)
					? Either.new<T, B>({
						[ErrorSymbol]: fn(value[ErrorSymbol]),
					})
					: Either.new<T, B>(value),

			get: () => value,

			getOrElse: (fn) => isT(value) ? value : fn(),

			isErr: () => !isT(value),

			isOk: () => isT(value),
		};
	},
};

/*console.log(Either.new(1).map(n => {
	return n > 2 ? n : oops("too small!")
}).map(n => {
	console.log("I am a side effect", n);
	return n;
}).map(n => n * 5).get())*/

export const composeM = (m2: <B>(a0: B) => Monad<B>) => {
	const monad = <T>(value: Monad<T>) => ({
		map: <B>(fn: (a0: T) => B): Monad<B> =>
			monad(value.map(fn).map((b) => m2(b).get())),
		fmap: <B>(fn: (a0: T) => Monad<B>): Monad<B> =>
			monad(value.map(fn).fmap(m2).get()),
		get: () => value.get(),
	});
	return monad;
};

export const IO = {
	new: <T>(fns: [...AnyFn[], (a0?: any) => T]): IO<T> => {
		return {
			map: <B>(fn: (a0: T) => B) => {
				return IO.new<B>([...fns, fn]);
			},
			get: (): T => {
				const localFns = [...fns];
				let task = localFns.shift();
				let result;
				if (task !== undefined) {
					result = task();
				} else {
					return undefined as unknown as T;
				}
				for (;;) {
					task = localFns.shift();
					if (task !== undefined) {
						result = task(result);
					} else {
						break;
					}
				}
				return result;
			},
			fmap: <B>(fn: (a0: T) => IO<B>): IO<B> => {
				return IO.new<B>([...fns, fn, (a: IO<B>) => a.get()]);
			},
		};
	},
	of: <K>(fn: () => K): IO<K> => {
		return IO.new([fn]);
	},
};

export const Maybe = {
	new: <T extends NonNullable<any>>(val: T | null | undefined): Maybe<T> => {
		const nullguarder = <B>(fn: (a0: T) => B | null): Maybe<B> =>
			val === undefined || val === null ? Maybe.none() : (() => {
				const newVal = fn(val);
				return newVal === null || newVal === undefined
					? Maybe.none()
					: Maybe.some(newVal);
			})();
		return {
			map: <B>(fn: (a0: T) => B | null): Maybe<B> => {
				return nullguarder<B>(fn);
			},
			get: (): T => {
				return val as unknown as T;
			},
			fmap: <B>(fn: (a0: T) => Maybe<B> | Maybe<null>): Maybe<B> => {
				return nullguarder<B>((v) => fn(v).get());
			},
			getOrElse: (fn: () => T): T => {
				return val === undefined || val === null ? fn() : val;
			},
			isNone: () => val === null || val === undefined,
			isSome: () => !(val === null || val === undefined),
		};
	},
	some: <K>(val: K): Maybe<K> => {
		return Maybe.new(val);
	},
	none: (): Maybe<never> => {
		return Maybe.new<never>(null);
	},
};

export type Maybeified<T> = {
	[K in keyof T]: T[K] extends AnyFn ? Maybe<NonNullable<T[K]>>
		: T[K] extends { [key: string]: any } ? Maybeified<T[K]>
		: Maybe<NonNullable<T[K]>>;
};

export const keys = <T>(obj: T) => Object.keys(obj) as (keyof T & string)[];

export type Nullable<T> = { [K in keyof T]: T[K] | null | undefined };

export type Demaybied<T> = T extends Maybe<infer K> ? K : T;

export const Future = {
	new: <T, A>(
		originalValue: T,
		stepsToApply: [(a0: T) => any, ...((a0: any) => any)[], (a0: any) => A],
	): Future<A> => ({
		map: <B>(fn: (a0: A) => B): Future<B> => {
			return Future.new(originalValue, [...stepsToApply, fn]);
		},
		get: (): A => {
			return stepsToApply.reduce(
				(prev, curr) => curr(prev),
				originalValue,
			) as unknown as A;
		},
		fmap: <B>(fn: (a0: A) => Future<B>): Future<B> => {
			return Future.new(originalValue, [
				...stepsToApply,
				fn,
				(m) => m.get(),
			]);
		},
	}),
};


export const DoNothing = IO.of(() => undefined);
export type Module = { [key: string]: ((...args: any[]) => any) | any };
export type Lifter = <T>(a0: () => T) => Monad<T>;
export type Lifted<Mod> = {
	[K in keyof Mod]: Mod[K] extends (...args: any[]) => any
		? (...args: Parameters<Mod[K]>) => ReturnType<Mod[K]>
		: Mod[K] extends Module ? Lifted<Mod[K]>
		: Mod[K];
};
// Mod[K]
//  : M extends new (...args: ConstructorParameters<infer T>) => infer T ? new (...args: ConstructorParameters<T>) => Pure<T> : never;

export const lift =
	(monadFn: <T>(a0: () => T) => Monad<T>) =>
	<M extends Module>(module: M): Lifted<M> => {
		const pureModule = new Object() as Module;
		Object.keys(module).forEach((k: string) => {
			const val = module[k];
			if (typeof val == "function") {
				pureModule[k] = (...args: Parameters<typeof val>) =>
					monadFn(() => val(...args));
			}
		});
		return pureModule as Lifted<M>;
	};

//const task = purefs.readFileSync("src/purify.ts").flatMap(pureConsole.log)
//task.run()
// collect into log, then provide an impure function at the end
