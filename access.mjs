export function get (src, path) {
	if (src == null) {
		return undefined;
	}
	const p = path.replace(/["']/g, "").replace(/\[/g, ".").replace(/\]/g, "").split(".");
	let c = src;
	if (p[0]) {
		for (let i = 0; i < p.length; i++) {
			if (i === p.length - 1) {
				return c[p[i]];
			}
			c = c[p[i]];
			if (c == null || typeof c !== "object") {
				return undefined;
			}
		}
	}
	return c;
};

export function set (src, path, value) {
	const p = path.replace(/["']/g, "").replace(/\[/g, ".").replace(/\]/g, "").split(".");
	let c = src;
	if (p[0]) {
		for (let i = 0; i < p.length; i++) {
			if (i !== p.length - 1 && typeof c[p[i]] !== "object") {
				c[p[i]] = {};
			}
			if (i === p.length - 1) {
				c[p[i]] = value;
			}
			else {
				c = c[p[i]];
			}
		}
	}
	return src;
};
