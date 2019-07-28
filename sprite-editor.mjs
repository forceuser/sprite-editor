import dataStore from "./data.mjs";

class Deferred {
	constructor () {
		this.promise = new Promise((resolve, reject) => {
			this.ctrl = {resolve, reject};
		});
	}
	resolve (...args) {
		return this.ctrl.resolve(...args);
	}
	reject (...args) {
		return this.ctrl.reject(...args);
	}
}

async function readFile (file, type = "text") {
	const deferred = new Deferred();
	if (type === "blobUrl") {
		deferred.resolve(URL.createObjectURL(file));
	}
	else {
		const reader = new FileReader();
		reader.onload = event => {
			deferred.resolve(event.target.result);
		};
		reader[{
			"arrayBuffer": "readAsArrayBuffer",
			"binaryString": "readAsBinaryString",
			"dataURL": "readAsDataURL",
			"text": "readAsText",
		}[type] || "text"]();
	}

	return deferred.promise;
}


export function createCanvas (width, height) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

export function randomFloat (min, max) {
	return Math.random() * (max - min) + min;
}

export function randomInt (min, max) {
	let rand = min + Math.random() * (max + 1 - min);
	rand = Math.floor(rand);
	return rand;
}

export function cycle (value, max, min = 0) {
	value = value - min;
	return (value < 0 ? ((max + (value % max)) % max) : value % max) + min;
}

export function getContrast (color, threshold = 130) {
	const hexVal = colorToArray(color);
	const [r, g, b] = hexVal;
	const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
	return brightness > threshold ? "#000000" : "#ffffff";
}

const $p = (x, y, imageData) => {
	const data = imageData.data;
	const i = (y * imageData.width * 4) + (x * 4);
	return [
		data[i + 0],
		data[i + 1],
		data[i + 2],
		data[i + 3],
	];
};

export function getCrop (imageData, gap = 0) {
	const w = imageData.width;
	const h = imageData.height;
	let x1 = w;
	let x2 = 0;
	let y1 = h;
	let y2 = 0;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if ($p(x, y, imageData)[3] > 50) {
				if (y < y1) {y1 = y;}
				if (y > y2) {y2 = y;}
				if (x < x1) {x1 = x;}
				if (x > x2) {x2 = x;}
			}
		}
	}
	const cropData = {
		left: Math.max(0, x1 - gap),
		top: Math.max(0, y1 - gap),
		right: Math.min(w, x2 + gap * 2),
		bottom: Math.min(h, y2 + gap * 2),
	};
	cropData.width = cropData.right - cropData.left;
	cropData.height = cropData.bottom - cropData.top;
	return cropData;
}

export function imageToCanvas (img, dpr = 1) {
	const w = img._width == null ? img.width : img._width;
	const h = img._height == null ? img.height : img._height;
	const canvas = createCanvas(w * dpr, h * dpr);
	const ctx = canvas.getContext("2d");
	ctx.drawImage(img, 0, 0, w * dpr, h * dpr);
	return canvas;
}

export function getImageData (img) {
	const canvas = imageToCanvas(img);
	const ctx = canvas.getContext("2d");
	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function copyCanvas (canvas) {
	const c = createCanvas(canvas.width, canvas.height);
	c.getContext("2d").drawImage(canvas, 0, 0);
	return c;
}

export function normRect (rect) {
	let shiftx = Math.min(rect.left, rect.right, 0);
	if (shiftx < 0) {
		rect.left += -shiftx;
		rect.right += -shiftx;
	}
	let shifty = Math.min(rect.top, rect.bottom, 0);
	if (shifty < 0) {
		rect.top += -shifty;
		rect.bottom += -shifty;
	}
	return rect;
}

export function resize (canvas, rect) {
	const ctx = canvas.getContext("2d");
	const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const cpy = copyCanvas(canvas);

	const w = canvas.width;
	const h = canvas.height;
	canvas.width = Math.max(canvas.width, rect.right - rect.left);
	canvas.height = Math.max(canvas.height, rect.bottom - rect.top);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(cpy, 0, 0, w, h, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

export function grow (canvas, {size = 0} = {}) {
	resize(canvas, {x1: -size, y1: -size, x2: canvas.width + size, y2: canvas.height + size});
	const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const cpy = copyCanvas(canvas);
	for (let y = 0, h = canvas.height; y < h; y++) {
		for (let x = 0, w = canvas.width; x < w; x++) {
			const find = () => {
				for (let yi = y - 1; yi <= y + 1; yi++) {
					for (let xi = x - 1; xi <= x + 1; xi++) {
						if (xi !== x && yi !== y && xi >= 0 && yi >= 0 && xi < w && yi < h) {
							if (p(xi, yi, ref)[3] < 50) {
								return true;
							}
						}
					}
				}
				return false;
			};

			if (p(x, y, ref)[3] > 50 && find()) {
				ctx.beginPath();
				ctx.arc(x, y, size, 0, 2 * Math.PI, false);
				ctx.fillStyle = "#ffffff";
				ctx.fill();
			}
		}
	}
	ctx.drawImage(cpy, 0, 0);
}

const colorToArray = (color) => {
	const canvas = createCanvas(1, 1);
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 1, 1);

	return [...getImageData(canvas).data];
}

function doPadding (...value) {
	function flattenDeep (array, parent = []) {
		array.reduce((parent, item) => (Array.isArray(item) ? flattenDeep(item, parent) : parent.push(item), parent), parent);
		return parent;
	}
	value = flattenDeep(value);

	switch (value.length) {
		case 0: return new Array(4).fill(0);
		case 1: return new Array(4).fill(value[0] || 0);
		case 2: return [value[0] || 0, value[1] || 0, value[0] || 0, value[1] || 0];
		case 3: return [value[0] || 0, value[0] || 0, value[0] || 0, value[0] || 0];
		case 4: return value.map(i => i || 0);
	}
}


class Rect {
	constructor (data = {}) {
		this.data = {};
		this.left = data.left;
		this.top = data.top;
		this.width = data.width == null ? (data.right || 0) - (data.left || 0) : (data.width || 0);
		this.height = data.height == null ? (data.bottom || 0) - (data.top || 0) : (data.height || 0);
	}
	set left (value = 0) {
		this.data.left = value;
	}
	set top (value = 0) {
		this.data.top = value;
	}
	set right (value = 0) {
		this.data.width = value - this.data.left;
	}
	set bottom (value = 0) {
		this.data.height = value - this.data.right;
	}
	set height (value = 0) {
		this.data.height = value;
	}
	set width (value = 0) {
		this.data.width = value;
	}
	get top () {return this.data.top || 0}
	get left () {return this.data.left || 0}
	get right () {return (this.data.left || 0) + (this.data.width || 0)}
	get bottom () {return (this.data.top || 0) + (this.data.height || 0)}
	get width () {return this.data.width || 0}
	get height () {return this.data.height || 0}
}

function correctRadius(r, w, h) {
	if (r[0] + r[1] > w) {
		r[0] -= (r[0] + r[1] - w) / 2;
		r[1] = w - r[0];
	}
	if (r[3] + r[2] > w) {
		r[2] -= (r[2] + r[3] - w) / 2;
		r[3] = w - r[2];
	}
	if (r[0] + r[3] > h) {
		r[0] -= (r[0] + r[3] - h) / 2;
		r[3] = h - r[0];
	}
	if (r[1] + r[2] > h) {
		r[1] -= (r[1] + r[2] - h) / 2;
		r[2] = h - r[1];
	}
	return r;
}

function roundRect (canvas, rect, {radius = 0, padding = 0, color = "white", sqare, center, fancyRadius = false, mask = false} = {}) {
	radius = doPadding(radius);
	padding = doPadding(padding);
	rect.width = (rect.width || canvas.width) + padding[1] + padding[3];
	rect.height =  (rect.height || canvas.height) + padding[0] + padding[2];

	if (sqare) {
		rect.width = Math.max(rect.width, rect.height);
		rect.height = rect.width;
	}

	rect = normRect(rect)
	const bgRect = new Rect({width: Math.max(canvas.width, rect.width), height: Math.max(canvas.height, rect.height)});
	const cpy = copyCanvas(canvas);
	const ctx = canvas.getContext("2d");

	resize(canvas, bgRect);
	resize(canvas, rect);
	radius = correctRadius(radius, rect.width, rect.height);

	const minRadius = Math.min(rect.width, rect.height) / 2;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (fancyRadius) {
		ctx.moveTo(rect.left + Math.min(radius[0], minRadius), rect.top);
		ctx.lineTo(rect.right - Math.min(radius[1], minRadius), rect.top);
		ctx.quadraticCurveTo(rect.right, rect.top, rect.right, rect.top + Math.min(radius[1], minRadius));
		ctx.lineTo(rect.right, rect.bottom - Math.min(radius[2], minRadius));
		ctx.quadraticCurveTo(rect.right, rect.bottom, rect.right - Math.min(radius[2], minRadius), rect.bottom);
		ctx.lineTo(rect.left + Math.min(radius[3], minRadius), rect.bottom);
		ctx.quadraticCurveTo(rect.left, rect.bottom, rect.left, rect.bottom - Math.min(radius[3], minRadius));
		ctx.lineTo(rect.left, rect.top + Math.min(radius[0], minRadius));
		ctx.quadraticCurveTo(rect.left, rect.top, rect.left + Math.min(radius[0], minRadius), rect.top);
	}
	else {
		ctx.beginPath();
		ctx.moveTo(rect.left, rect.top);
		ctx.arcTo(rect.right, rect.top, rect.right, rect.bottom, radius[1]);
		ctx.arcTo(rect.right, rect.bottom, rect.left, rect.bottom, radius[2]);
		ctx.arcTo(rect.left, rect.bottom, rect.left, rect.top, radius[3]);
		ctx.arcTo(rect.left, rect.top, rect.right, rect.top, radius[0]);
	}


	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.save();
	if (mask) {
		ctx.globalCompositeOperation = "source-in";
	}
	ctx.drawImage(cpy, center ? (canvas.width - cpy.width) / 2 : padding[3], center ? (canvas.height - cpy.height) / 2 : padding[0]);
	ctx.restore();
}

function growEx (canvas, {size = 0, dpr = 1, smooth = 0, color = "white", removeBorder = false, fast = false} = {}) {
	size = size * dpr;
	const ctx = canvas.getContext("2d");
	resize(canvas, normRect({left: -size, top: -size, right: canvas.width + size, bottom: canvas.height + size}));
	const cpy = copyCanvas(canvas);
	const threshold = 50;
	const colorArr = colorToArray(color);



	if (fast) {

		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx.shadowBlur = size;
		ctx.shadowColor = "rgb(191, 255, 0)";
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(cpy, 0, 0);
		const chromaKey = [191, 255, 0];
		const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
		for (let y = 0; y < ref.height; y++) {
			for (let x = 0; x < ref.width; x++) {
				if (colorDistance(p(x, y, ref, false), chromaKey) < 70) {
					s(x, y, ref, colorArr);
				}
			}
		}
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.putImageData(ref, 0, 0);
	}
	else {
		const canvasContour = copyCanvas(canvas);
		const ctxContour = canvasContour.getContext("2d");
		ctxContour.clearRect(0, 0, canvasContour.width, canvasContour.height);
		const refContour = ctxContour.getImageData(0, 0, canvasContour.width, canvasContour.height);

		const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const circle = [
			{x: 0, y: -1},
			{x: 1, y: -1},
			{x: 1, y: 0},
			{x: 1, y: 1},
			{x: 0, y: 1},
			{x: -1, y: 1},
			{x: -1, y: 0},
			{x: -1, y: -1},
		];
		const circleLength = circle.length;
		const circleIdx = ({x, y}) => circle.findIndex(p => p.x === x && p.y === y);
		const doSmooth = (data, idx, count, getFn) => {
			const l = data.length;
			const from = idx - Math.floor(count / 2);
			const to = idx + Math.ceil(count / 2);
			let x = 0;
			let y = 0;
			let c = 0;
			for (let i = from; i <= to; i++) {
				const $i = cycle(i, l);

				try {
					x += getFn ? getFn($i).x : data[$i].x;
					y += getFn ? getFn($i).y : data[$i].y;
					c++;
				}
				catch (error) {
					//
				}
			}
			return {x: Math.round(x / c), y: Math.round(y / c)};
		};
		const isp = ({x, y}) => p(x, y, refContour)[0] === 255;
		const ssp = ({x, y}) => s(x, y, refContour, [255, 0, 0, 255]);

		const getContourPoints = ({x, y}) => {
			const points = [];
			// const canvasContour = copyCanvas(canvas);
			// const ctxContour = canvasContour.getContext("2d");
			// ctxContour.clearRect(0, 0, canvasContour.width, canvasContour.height);
			// const refContour = ctxContour.getImageData(0, 0, canvasContour.width, canvasContour.height);
			// const isp = ({x, y}) => p(x, y, refContour)[0] === 255;
			// const ssp = ({x, y}) => s(x, y, refContour, [255, 0, 0, 255]);
			// const isProcessed = ({x, y}) => !!points.find(p => p.x === x && p.y === y);
			let point = {x, y};
			let prevPoint = point;
			let vector = {x: -1, y: 0};
			do {
				if (point) {
					points.push(point);
					// $ssp(point);
					ssp(point);
				}
				point = null;
				const idx = circleIdx(vector);
				const shift = (vector.x === 0 || vector.y === 0) ? 2 : 1;
				for (let i = 0; i < circleLength; i++) {
					const $idx = cycle(i + idx + shift, circleLength);
					const t = {x: prevPoint.x + circle[$idx].x, y: prevPoint.y + circle[$idx].y};
					if ($p(t.x, t.y, ref)[3] > threshold) {
						point = t;
						break;
					}
				}
				if (point) {
					vector = {x: prevPoint.x - point.x, y: prevPoint.y - point.y};
					prevPoint = point;
				}
			}
			while (point && !isp(point));
			return points;
		};
		const contours = [];
		const inContours = ({x, y}) => contours.some(contour => contour.some(p => p.x === x && p.y === y));
		for (let y = 0, h = canvas.height; y < h; y++) {
			let prevP;
			let p;
			for (let x = 0, w = canvas.width; x < w; x++) {
				p = $p(x, y, ref);
				if (p[3] > threshold && (!prevP || prevP[3] <= threshold) && !isp({x, y})) {
					contours.push(getContourPoints({x, y}));
				}
				prevP = p;
			}
		}

		let border;
		if (removeBorder) {
			border = ctx.getImageData(0, 0, canvas.width, canvas.height);
		}

		contours.forEach(contour => {
			if (smooth >= 1) {
				contour = contour.map((p, idx) => {
					return doSmooth(contour, idx, 3 * dpr);
				});
			}
			if (smooth >= 2) {
				contour = contour.map((p, idx) => {
					return doSmooth(contour, idx, 7 * dpr);
				});
			}

			if (smooth >= 3) {
				contour = contour.map((p, idx) => {
					return doSmooth(contour, idx, 12 * dpr);
				});
			}

			if (smooth >= 4) {
				contour = contour.map((p, idx) => {
					return doSmooth(contour, idx, 17 * dpr);
				});
			}


			contour.forEach(({x, y}) => {
				if (removeBorder) {
					s(x, y, border, [0, 0, 0, 0]);
				}
				else {
					ctx.beginPath();
					ctx.arc(x, y, size, 0, 2 * Math.PI, false);
					ctx.fillStyle = color;
					ctx.fill();
					ctx.closePath();
				}

			});
		});

		if (removeBorder) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.putImageData(border, 0, 0);
		}
		else {
			ctx.drawImage(cpy, 0, 0);
		}
	}

	return canvas;
}

async function storeData (gistid, token) {
	// const host = `https://api.github.com/`;
	// const user = "forceuser";
	// const listUrl = `${host}users/${user}`

	// fetch (`${host}gists/${gistid}`, {
	// 	type: 'PATCH',
	// 	headers: {
	// 		"authorization": `token ${token}`
	// 	}
	// })
}

export async function loadImage (url, {width, height} = {}) {
	const img = document.createElement("img");
	// img.crossOrigin = "anonymous";
	img.src = url;

	return new Promise(resolve => {
		img.onload = () => {
			img.width = img.naturalWidth;
			img.height = img.naturalHeight;
			if (width) {
				img.width = width;
				if (!height) {
					img.height = Math.floor(img.naturalHeight * (width / img.naturalWidth));
				}
			}
			if (height) {
				img.height = height;
				if (!width) {
					img.width = Math.floor(img.naturalWidth * (height / img.naturalHeight));
				}
			}
			resolve(img);
		};
	});
}

async function openFile () {
	const deferred = new Deferred();
	const $input = document.createElement("input");
	$input.type = "file";
	// $input.style.display = "none";
	document.body.appendChild($input);

	// $input.addEventListener("click", event => {
	// 	event.stopPropagation();
	// });
	$input.addEventListener("change", () => {
		console.log("FILES", $input.files);
		deferred.resolve([...$input.files]);
		$input.remove();
	});

	// $input.click();

	return deferred.promise;
}

function colorDistance (v1, v2) {
	let i;
	let d = 0;
	for (i = 0; i < v1.length; i++) {
		d += Math.pow(v1[i] - v2[i], 2);
	}

	const result = Math.sqrt(d);
	return result;
}

function colorAvg (colors) {
	const acc = colors.reduce((acc, i) => {
		for (let n = 0; n < 4; n++) {
			acc[n] += i[n];
		}
		return acc;
	}, [0, 0, 0, 0]);
	for (let n = 0; n < 4; n++) {
		acc[n] = Math.round(acc[n] / colors.length);
	}
	return acc;
}

const p = (x, y, imageData, alpha = true) => {
	const data = imageData.data;
	const i = (y * imageData.width * 4) + (x * 4);
	if (alpha) {
		return [
			data[i + 0],
			data[i + 1],
			data[i + 2],
			data[i + 3],
		];
	}
	else {
		return [
			data[i + 0],
			data[i + 1],
			data[i + 2],
		];
	}
};
const s = (x, y, imageData, rgba) => {
	const data = imageData.data;
	const i = (y * imageData.width * 4) + (x * 4);
	data[i + 0] = rgba[0];
	data[i + 1] = rgba[1];
	data[i + 2] = rgba[2];
	data[i + 3] = rgba[3];
};

async function keypress (key) {
	const deferred = new Deferred();
	function onKeypress (event) {
		event.preventDefault();
		event.stopPropagation();
		if (event.key === key) {
			document.removeEventListener("keydown", onKeypress);
			deferred.resolve();
		}
	}
	document.addEventListener("keydown", onKeypress);
	return deferred.promise;
}

function avgColor () {
	const topLeft = ctx.getImageData(0, 0, 1, 1).data;
	const bottomLeft = ctx.getImageData(0, canvas.height - 1, 1, 1).data;
	const topRight = ctx.getImageData(canvas.width - 1, 0, 1, 1).data;
	const bottomRight = ctx.getImageData(canvas.width - 1, canvas.height - 1, 1, 1).data;
	const avg = colorAvg([topLeft, bottomLeft, topRight, bottomRight]);
	return avg;
}

function crop (canvas) {
	const ctx = canvas.getContext("2d");
	const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const cpy = copyCanvas(canvas);
	const rect = getCrop(ref, 2);
	canvas.width = rect.width;
	canvas.height = rect.height;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(cpy, rect.left, rect.top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
}


function fill (canvas, fuzz = 100) {
	const ctx = canvas.getContext("2d");
	const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const w = canvas.width;
	const h = canvas.height;
	const pixelStack = [];
	let color;
	for (let i = 0; i < 2; i++) {
		for (let j = 0; j < 2; j++) {
			const x = [0, canvas.width - 1][i];
			const y = [0, canvas.height - 1][j];
			const c = p(x, y, ref);
			if (c[3] < 50 || (i === 1 && j == 1)) {
				pixelStack.push([x, y]);
				color = c;
			}
		}
	}

	while (pixelStack.length) {
		let reachLeft;
		let reachRight;
		const newPos = pixelStack.pop();
		const x = newPos[0];
		let y = newPos[1];

		while (y >= 0 && colorDistance(p(x, y, ref), color) < fuzz) {
			y--;
		}
		++y;
		reachLeft = false;
		reachRight = false;
		while (y < h && colorDistance(p(x, y, ref), color) < fuzz) {
			s(x, y, ref, [122, 122, 122, 0]);

			if (x > 0) {
				if (colorDistance(p(x - 1, y, ref), color) < fuzz) {
					if (!reachLeft) {
						pixelStack.push([x - 1, y]);
						reachLeft = true;
					}
				}
				else if (reachLeft) {
					reachLeft = false;
				}
			}

			if (x < w - 1) {
				if (colorDistance(p(x + 1, y, ref), color) < fuzz) {
					if (!reachRight) {
						pixelStack.push([x + 1, y]);
						reachRight = true;
					}
				}
				else if (reachRight) {
					reachRight = false;
				}
			}
			y++;
		}
	}
	for (let y = 0; y < ref.height; y++) {
		for (let x = 0; x < ref.width; x++) {
			if (p(x, y, ref)[3] < 50) {
				s(x, y, ref, [0, 0, 0, 0]);
			}
		}
	}
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.putImageData(ref, 0, 0);
}

function createDimObj (x, y, width, height, dir) {
	const obj = {
		x, y, width, height,
		get md () {
			return this[dir === "h" ? "x" : "y"];
		},
		set md (val) {
			this[dir === "h" ? "x" : "y"] = val;
		},
		get ad () {
			return this[dir === "h" ? "y" : "x"];
		},
		set ad (val) {
			this[dir === "h" ? "y" : "x"] = val;
		},
		get ms () {
			return this[dir === "h" ? "width" : "height"];
		},
		set ms (val) {
			this[dir === "h" ? "width" : "height"] = val;
		},
		get as () {
			return this[dir === "h" ? "height" : "width"];
		},
		set as (val) {
			this[dir === "h" ? "height" : "width"] = val;
		},
	};
	return obj;
}

async function joinWhite (canvas, {dir = "h", dst = 30, color = "white"}) {
	const ctx = canvas.getContext("2d");
	const rgbColor = colorToArray(color);
	const th = 254;
	const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const $p = (x, y, ...rest) => p(dir === "h" ? x : y, dir === "h" ? y : x, ...rest);
	const $s = (x, y, ...rest) => s(dir === "h" ? x : y, dir === "h" ? y : x, ...rest);
	let lastx;
	const fillGap = async (x, y, up = true) => {
		const stack = [];
		let dist = 0;
		let samedist = 0;
		let lastdist = 0;
		const $ = createDimObj(x, y, ref.width, ref.height, dir);

		while ($.ad >= 0 && $.ad < $.as) {
			const st = $.md;

			while (p($.x, $.y, ref)[3] >= th && Math.abs(st - $.md) < (dist || 3)) {
				$.md--;
			}

			let px = 0;
			while (p($.x, $.y, ref)[3] < th) {
				$.md--;
				px++;
			}

			if (px === 0) {
				break;
			}
			$.md++;
			const start = $.md;
			while (p($.x, $.y, ref)[3] < th && $.md < $.ms && $.md - start - dist < dst) {
				$.md++;
			}
			if ($.md === $.ms || $.md <= 0) {
				break;
			}

			if ($.md - start - dist >= dst) {
				break;
			}
			lastdist = dist;
			dist = $.md - start;
			if (dist > 200) {
				return;
			}
			if (lastdist === dist) {
				samedist++;
			}
			else {
				samedist = 0;
			}
			if (samedist >= dist && dist > 20) {
				return;
			}
			stack.push([start, $.md, $.ad]);
			$.ad = up ? $.ad - 1 : $.ad + 1;
		}
		while (stack.length) {
			const [x1, x2, y] = stack.pop();
			for (let x = x1 - 1; x <= x2; x++) {
				s(dir === "h" ? x : y, dir === "h" ? y : x, ref, rgbColor);
			}
		}

	};

	const $ = createDimObj(0, 0, ref.width, ref.height, dir);
	for ($.ad = 0; $.ad < $.as; $.ad++) {
		lastx = null;
		let boundFromTop = false;
		let boundFromBottom = false;
		let isWhite = false;
		for ($.md = 0; $.md < $.ms; $.md++) {
			const lastIsWhite = isWhite;
			isWhite = colorDistance(p($.x, $.y, ref), rgbColor) < 10;
			if (lastIsWhite && p($.x, $.y, ref)[3] < th) {
				boundFromTop = ($.ad >= 0 && $p($.md, $.ad - 1, ref)[3] >= th);
				boundFromBottom = ($.ad < $.as && $p($.md, $.ad + 1, ref)[3] >= th);
			}
			else {
				if (!($.ad >= 0 && $p($.md, $.ad - 1, ref)[3] >= th)) {
					boundFromTop = false;
				}
				if (!($.ad < $.as && $p($.md, $.ad + 1, ref)[3] >= th)) {
					boundFromBottom = false;
				}
			}

			if (lastIsWhite && p($.x, $.y, ref)[3] < th && (boundFromTop || boundFromBottom)) {
				lastx = $.md - 1;
				// await debugPoint($.x, $.y);
			}
			else if (lastx != null && p($.x, $.y, ref)[3] >= th) {
				// await debugPoint($.x, $.y);
				if (lastx >= $.md - 40 && lastx <= $.md && (boundFromTop || boundFromBottom)) {
					if (dir === "h") {
						await fillGap($.x - 1, $.y, boundFromBottom);
					}
					else {
						await fillGap($.x, $.y - 1, boundFromBottom);
					}
				}
				lastx = null;
				boundFromTop = false;
				boundFromBottom = false;
			}
		}
	}
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.putImageData(ref, 0, 0);


}

async function removeRest (canvas, {dir = "h", threshold = 120} = {}) {
	const ctx = canvas.getContext("2d");
	const ref = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const $p = (x, y, ...rest) => p(dir === "h" ? x : y, dir === "h" ? y : x, ...rest);
	const $s = (x, y, ...rest) => s(dir === "h" ? x : y, dir === "h" ? y : x, ...rest);
	const $ = createDimObj(0, 0, ref.width, ref.height, dir);

	const lines = [];

	const removeFill = async (x, y, boundFromTop, boundFromBottom, {threshold = 20} = {}) => {
		// await debugPoint(x, y, "green");
		const $ = createDimObj(x, y, ref.width, ref.height, dir);
		const stack = [[$.x, $.y]];
		const miny = Math.max(0, boundFromTop ? $.ad - 1 : $.ad - 15);
		const maxy = Math.min($.as - 1, boundFromTop ? $.ad + 15 : $.ad);
		const proc = {};
		const isInBounds = () => $.ad >= miny && $.ad <= maxy;
		while (stack.length) {
			const [x, y] = stack.pop();
			$.x = x;
			$.y = y;
			if (!proc[`${$.x}:${$.y}`]) {
				while ($.ad > miny && p($.x, $.y, ref)[3] >= threshold) {
					$.ad--;
				}
				$.ad++;
				while (isInBounds() && p($.x, $.y, ref)[3] >= threshold) {
					proc[`${$.x}:${$.y}`] = true;
					// ctx.fillStyle = "blue";
					// ctx.fillRect($.x, $.y, 1, 1);

					if (dir === "h") {
						if ($.md > 0 && !proc[`${$.x - 1}:${$.y}`] && p($.x - 1, $.y, ref)[3] >= 1) {
							stack.push([$.x - 1, $.y]);
						}
						if ($.md < $.ms - 1 && !proc[`${$.x + 1}:${$.y}`] && p($.x + 1, $.y, ref)[3] >= 1) {
							stack.push([$.x + 1, $.y]);
						}
					}
					else {
						if ($.md > 0 && !proc[`${$.x}:${$.y - 1}`] && p($.x, $.y - 1, ref)[3] >= 1) {
							stack.push([$.x, $.y - 1]);
						}
						if ($.md < $.ms - 1 && !proc[`${$.x}:${$.y + 1}`] && p($.x, $.y + 1, ref)[3] >= 1) {
							stack.push([$.x, $.y + 1]);
						}
					}

					$.ad += boundFromTop ? 1 : -1;
					if (!isInBounds()) {
						return false;
					}
				}
			}
		}
		Object.keys(proc).forEach(key => {
			const [x, y] = key.split(":");
			s(x, y, ref, [0, 0, 0, 0]);
		});
	};

	for ($.ad = 0; $.ad < $.as; $.ad++) {
		const line = [];
		let boundFromTop = false;
		let boundFromBottom = false;
		let boundLength = 0;
		let startBound = null;
		let lastBound = null;



		for ($.md = 0; $.md < $.ms; $.md++) {
			let colTop;
			let colBot;
			const _boundFromTop = boundFromTop;
			const _boundFromBottom = boundFromBottom;
			boundFromTop = ($.ad >= 0 && (colTop = $p($.md, $.ad - 1, ref), colTop[3]) >= threshold);
			boundFromBottom = ($.ad < $.as && (colBot = $p($.md, $.ad + 1, ref), colBot[3]) >= threshold);

			let type;
			const col = p($.x, $.y, ref)
			if (col[3] < threshold) { // transparent
				if (boundFromBottom || boundFromTop) {
					type = "t";
				}
				else {
					type = "e";
				}
			}
			else { //filled
				type = "w";
			}

			const last = line[line.length - 1];
			if (!last || (last.type !== type)) {
				if (last) {
					last.end = $.md;
				}
				const item = {type, start: $.md, end: $.md};
				if (type === "w") {
					item.p = {md: $.md, ad: $.ad, x: $.x, y: $.y};
					item.boundFromTop = _boundFromTop;
					item.boundFromBottom = _boundFromBottom;
				}
				line.push(item);
			}
			else {
				line[line.length - 1].end = $.md;
			}
		}
		lines.push(line);
		// console.log("line", line, line.reduce((res, i) => (res[i.type] += i.end - i.start, res), {w: 0, t: 0, e: 0}));

		// 2-pass line
	}

	for (let [ad, line] of lines.entries()) {
		if (!line || !line.length) {
			continue;
		}

		let start = 0;
		let end = 0;
		let ws = [];
		let t; // blue
		let w; // green
		let e; // red
		const reset = (el, isEnd) => {
			if (ws.length) {
				const start = ws[0].start;
				const end = ws[ws.length - 1].end;
				if (w > 50 && w > t * 2) {
				}
				else if (end - start > 20 && t * 3 > w) {
					console.log("RESET", {t, w, e}, ws);
					console.log(line, ad, start, end);
					ws.forEach(i => {
						if (i.type === "w") {
							removeFill(i.p.x, i.p.y, i.boundFromTop, i.boundFromBottom);
						}
					})

				}
			}
			t = 0;
			e = 0;
			w = 0;
			ws = [];
		}
		for (let [idx, el] of line.entries()) {
			if (idx === 0) {
				reset(el);
			}
			if (el.type === "w") {
				w += el.end - el.start;
				if (w > 50 && w > t * 2) {
					reset(el);
					continue;
				}
				else {
					ws.push(el);
				}
			}
			if (el.type === "t") {
				t += el.end - el.start;
				ws.push(el);
			}
			if (el.type === "e") {
				e += el.end - el.start;
				if (e > 5)  {
					reset(el);
					continue;
				}
				else {
					ws.push(el);
				}
			}
			if (idx === line.length - 1) {
				reset(el);
				continue;
			}
		}


	}
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.putImageData(ref, 0, 0);
}

async function debugPoint (x, y, color = "red", key = "Enter") {
	ctx.fillStyle = color;
	ctx.fillRect(x, y, 1, 1);
	if (key) {
		await keypress("Enter");
	}
}

function rgbToHsv (r, g, b) {
	r = Math.max(0, Math.min(r / 255, 1));
	g = Math.max(0, Math.min(g / 255, 1));
	b = Math.max(0, Math.min(b / 255, 1));

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h;
	const v = max;

	const d = max - min;
	const s = max === 0 ? 0 : d / max;

	if (max == min) {
		h = 0; // achromatic
	}
	else {
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return {h, s, v};
}

function hsvToRgb (h, s, v) {
	h = Math.max(0, Math.min(h, 360)) * 6;
	s = Math.max(0, Math.min(s, 100));
	v = Math.max(0, Math.min(v, 100));

	const i = Math.floor(h);
	const f = h - i;
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);
	const mod = i % 6;
	const r = [v, q, p, p, t, v][mod];
	const g = [t, v, v, q, p, p][mod];
	const b = [p, p, t, v, v, q][mod];

	return {r: r * 255, g: g * 255, b: b * 255};
}

function hue (img, _h, _s, _v) {
	const w = img.width;
	const h = img.height;
	_h = _h || 0;
	_s = _s || 0;
	_v = _v || 0;
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	ctx.translate(w / 2, h / 2);
	ctx.drawImage(img, -w / 2, -h / 2, w, h);
	ctx.translate(-w / 2, -h / 2);

	const imageData = ctx.getImageData(0, 0, w, h);
	const pixels = imageData.data;
	let rgb;
	let hsv;
	for (let i = 0, len = pixels.length; i < len; i += 4) {
		hsv = rgbToHsv(pixels[i], pixels[i + 1], pixels[i + 2]);
		rgb = hsvToRgb((hsv.h + _h) % 1, Math.max(Math.min(hsv.s + _s, 1), 0), Math.max(Math.min(hsv.v + _v, 1), 0));
		pixels[i] = rgb.r;
		pixels[i + 1] = rgb.g;
		pixels[i + 2] = rgb.b;
	}

	ctx.putImageData(imageData, 0, 0);
	return {url: canvas.toDataURL(), imageData};
}

function tint (canvas, color, opacity = 1) {
	const ctx = canvas.getContext("2d");
	const bwcanvas = createCanvas(canvas.width, canvas.height);
	const bwctx = bwcanvas.getContext("2d");
	const {imageData} = hue(canvas, 0, -1, 0);
	bwctx.putImageData(imageData, 0, 0);
	ctx.save();
	ctx.fillStyle = color;
	if (opacity != null) {ctx.globalAlpha = opacity;}
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.globalCompositeOperation = "destination-atop";
	ctx.globalAlpha = 1;
	ctx.drawImage(bwcanvas, 0, 0);
	ctx.restore();
	return canvas;
}

function replaceColor (canvas, srcColor, destColor, invert = false) {
	const srcColorArr = colorToArray(srcColor);
	const [r, g, b, alpha] = srcColorArr;
	const rgb = [r, g, b];
	const destColorArr = colorToArray(destColor);
	const ref = getImageData(canvas);
	const ctx = canvas.getContext("2d");

	for (let y = 0; y < ref.height; y++) {
		for (let x = 0; x < ref.width; x++) {
			const d = colorDistance(p(x, y, ref, false), rgb);
			if (invert ? d > 0 : d < 120) {
				s(x, y, ref, destColor);
			}
		}
	}
	ctx.putImageData(ref, 0, 0);
}

function toDPR (canvas, srcDpr = 1, destDpr = 1) {
	const w = (canvas.width / srcDpr) * destDpr;
	const h = (canvas.height / srcDpr) * destDpr;
	const dst = createCanvas(w, h);
	const ctx = dst.getContext("2d");
	ctx.drawImage(canvas, 0, 0, w, h);
	return dst;
}

async function run (params = {}) {
	const {width = 300, dpr = 1} = params;
	const sprites = await dataStore.load();
	const files = await openFile();
	const canvas = document.querySelector("canvas");
	if (canvas) {
		canvas.remove();
	}
	run(params);
	await files.reduce(async (prev, file) => {
		// const gradientColors = ["purple", "black"];
		// const gradient = ctx.createLinearGradient(0, 0, canvas.width * 2, 0);
		// gradientColors.forEach((color, idx) => {
		// 	gradient.addColorStop(idx / gradientColors.length, color);
		// })


		await prev;
		const url = await readFile(file, "blobUrl");
		let img = await loadImage(url, {width: width * dpr});

		const canvas = createCanvas(img.width, img.height);
		// canvas.style.width = "300px";
		document.body.appendChild(canvas);

		const ctx = canvas.getContext("2d");
		ctx.drawImage(img, 0, 0, img.width, img.height);

		// const color = "#075D90";
		const color = "white";
		// await fill(canvas, 30);
		await crop(canvas);
		// const tryWidth = (img.width - canvas.width) / img.width * width + width;
		// img = await loadImage(url, {width: tryWidth * dpr});
		// canvas.width = img.width;
		// canvas.height = img.height;
		// ctx.clearRect(0, 0, canvas.width, canvas.height);
		// ctx.drawImage(img, 0, 0, img.width, img.height);
		// await fill(canvas, 30);
		// await crop(canvas);

		// await growEx(canvas, {smooth: 0, removeBorder: true});
		let scale = 1;
		// let scale = 0.5;
		const vol = Math.sqrt(Math.pow(canvas.width, 2) + Math.pow(canvas.height, 2));
		const dd = canvas.width / canvas.height;
		const maxVol = (dd > 0.9 && dd < 1.1 ? 0.85 : 1) * 170 * dpr;
		const multi = maxVol / vol;
		const resz = copyCanvas(canvas);
		canvas.width = canvas.width * multi * scale;
		canvas.height = canvas.height * multi  * scale;
		ctx.drawImage(resz, 0, 0, canvas.width, canvas.height);

		// console.log("angle", Math.asin(canvas.height / vol) * (180 / Math.PI));



		// tint(canvas, "#fff");

		let rh = Math.max(canvas.height, canvas.width / 4.5);
		if (rh > canvas.width * 0.65) {
			rh = canvas.width;
		}

		// roundRect(canvas, new Rect({height: rh}), {
		// 	color: "black",
		// 	padding: [0],
		// 	radius: 8 * dpr,
		// 	// sqare: true,
		// 	center: true,
		// 	fancyRadius: false,
		// 	mask: true,
		// });

		// const color2 = "#075D90";
		roundRect(canvas, new Rect({height: rh}), {
			// color: color2,
			color,
			padding: [8 * dpr, 12 * dpr],
			radius: 16,
			// sqare: true,
			center: true,
			fancyRadius: false,
		});

		// await growEx(canvas, {size: 12, smooth: 0, color, fast: false});
		// await joinWhite(canvas, {dir: "h", dst: 10, color});
		// await joinWhite(canvas, {dir: "v", dst: 10, color});
		// await removeRest(canvas, {dir: "h"});
		// await removeRest(canvas, {dir: "v"});





		// replaceColor(canvas, color, "rgba(0, 0, 0, 0)", true);
		// await crop(canvas);
		const dpr1x = toDPR(canvas, dpr, 1);
		// const dpr2x = toDPR(canvas, dpr, 2);
		const name = (file.name || "").replace(/([^\/\\]+)$/, "$1").split(".")[0];
		sprites[name] = {
			name: file.filename,
			src: {url: imageToCanvas(img).toDataURL("image/png"), w: img.width, h: img.height},
			dest1x: {name, url: dpr1x.toDataURL("image/png"), w: dpr1x.width, h: dpr1x.height, width: dpr1x.width, height: dpr1x.height},
			dest2x: {name, url: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height, width: dpr1x.width, height: dpr1x.height},
		};

		await dataStore.save(sprites);
		console.log("SAVED");




		// await removeRest(canvas, {dir: "v"});


		// crop();
		// rect(30, 100);
		// crop();

		// for (let x = 0, len = pixels.length; i < len; i += 4) {
		// 	if (ref[i + 3] > 50 && )
		// 	pixels[i] = pixels[i + 3] > 50 ? 255 : 0;
		// 	pixels[i + 1] = pixels[i + 3] > 50 ? 255 : 0;
		// 	pixels[i + 2] = pixels[i + 3] > 50 ? 255 : 0;
		// }
		// ctx.putImageData(imageData, 0, 0);
		// ctx.shadowOffsetX = 0;
		// ctx.shadowOffsetY = 0;
		// ctx.shadowBlur = 50;
		// ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
		// ctx.drawImage(img, 0, 0, img.width, img.height);
		window.sprites = sprites;
	}, {});
}

// document.addEventListener("click", onClick);
run({width: 240, dpr: 2});
window.dataStore = dataStore;

export async function canvasToFile (canvas, filename) {
	const file = await new Promise(resolve => canvas.toBlob(blob => resolve(new File([blob], filename,{type: "image/png", lastModified: Date.now()})), "image/png"));
	return file
}


function transformKey (key, {format = "capitalize", delimiter = ""} = {}) {
	const parts = key.toLowerCase().split(/[A-Z-_]/g);
	return parts.map((part, idx) => {
		switch (format) {
			case "lowercase": {
				return part.toLowerCase();
			}
			case "uppercase": {
				return part.toUpperCase();
			}
			case "capitalize": {
				return idx > 0 ? part.substr(0, 1).toUpperCase() + part.substr(1) : part;
			}
		}
	}).join(delimiter);
}


// window.compileSprite = async () => {
// 	const zip = new JSZip();
// 	const filename = "sprites";
// 	const folder = zip.folder("resources");
// 	// const folder = zip.folder(filename);
// 	const sprites = await dataStore.load();
// 	let css = ``;
// 	let html = ``;
// 	await [1, 2].reduce(async (result, dpr) => {
// 		await result;
// 		const boxes = Object.keys(sprites).map(name => sprites[name][`dest${dpr}x`]);
// 		const {w, h, fill} = potpack(boxes);
// 		const filename = `partner-sprite@${dpr}x.png`
// 		const canvas = createCanvas(w, h);
// 		const ctx = canvas.getContext("2d");
// 		if (dpr > 1) {
// 			css += `\n@media (min-resolution: 192dpi), (-webkit-min-device-pixel-ratio: 2), (min--moz-device-pixel-ratio: 2), (-o-min-device-pixel-ratio: 2/1), (min-device-pixel-ratio: 2), (min-resolution: 2dppx) {`
// 		}
// 		css += `\n.sprite-img {background-image: url("../img/partner-sprite/${filename}"); background-repeat: no-repeat;}`;
// 		await Object.keys(sprites).reduce(async (prev, name) => {
// 			await prev;
// 			const sprite = sprites[name];
// 			const box = sprite[`dest${dpr}x`];
// 			const img = await loadImage(box.url);
// 			css += `\n.sprite-img.sprite-img-${box.name} {
// 				background-position: ${w === box.w ? 0 : (box.x / (w - box.w) * 100).toPrecision(5)}% ${h === box.h ? 0 : (box.y / (h - box.h) * 100).toPrecision(5)}%;
// 				background-size: ${(w / box.w * 100).toPrecision(5)}% ${(h / box.h * 100).toPrecision(5)}%;
// 				width: ${box.width}px;
// 				height: ${box.height}px;
// 			}`;
// 			ctx.drawImage(img, box.x, box.y, box.w, box.h);
// 			if (dpr === 1) {
// 				html += `\n<a href="${sprite.link || "${" + transformKey(`logo-url-${name}`) + `!"#"}`}" class="sprite-img sprite-img-${box.name}" target="_blank" rel="noopener"></a>`;
// 			}
// 		}, null);
// 		if (dpr > 1) {
// 			css += `\n}`;
// 		}
// 		const file = await canvasToFile(canvas, `partner-sprite@${dpr}x.png`);
// 		folder.file(`static/dist/img/partner-sprite/${filename}`, file);
// 		return result;
// 	}, []);

// 	folder.file(`data/${filename}.json`, new Blob([JSON.stringify(sprites, null, "\t")], {type: "application/json"}));
// 	folder.file(`static/src/less/${filename}.less`, new Blob([css], {type: "text/css"}));
// 	folder.file(`templates/chast/${filename}.ftl`, new Blob([html], {type: "text/html"}));

// 	console.log("==== creating zip file =====");
// 	const content = await zip.generateAsync({type: "blob"});

// 	const url = URL.createObjectURL(content);
// 	let a = document.createElement("a");
// 	a.setAttribute("download", `${filename}.zip`);
// 	a.setAttribute("href", url);
// 	a.click();
// 	a = null;
// };
