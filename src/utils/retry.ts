export function sleep(timeMs: number): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, timeMs);
	});
}

export interface Options {
	forever?: boolean;
	times?: number;
	interval: number;
	task: () => Promise<any>;
}

export async function retry<T>(options: Options): Promise<T> {
	let result: any;

	const forever = options.forever || false;
	const times = options.times || 1;

	for (let i = 0; i <= times || forever; ++i) {
		try {
			result = await options.task();
			break;
		} catch (ex) {
			if (i === times && !forever) {
				throw ex;
			}

			await sleep(options.interval);
		}
	}

	return result;
}