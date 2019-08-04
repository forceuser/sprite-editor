import {flattenDeep} from "./common.mjs";

export function createCanvas (width, height) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

export function getContrast (color, threshold = 130) {
	const hexVal = colorToArray(color);
	const [r, g, b] = hexVal;
	const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
	return brightness > threshold ? "#000000" : "#ffffff";
}

export function toDPR (canvas, srcDpr = 1, destDpr = 1) {
	const w = (canvas.width / srcDpr) * destDpr;
	const h = (canvas.height / srcDpr) * destDpr;
	const dst = createCanvas(w, h);
	const ctx = dst.getContext("2d");
	ctx.drawImage(canvas, 0, 0, w, h);
	return dst;
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

export const getPoint = (x, y, imageData, alpha = true) => {
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

export const setPoint = (x, y, imageData, rgba) => {
	const data = imageData.data;
	const i = (y * imageData.width * 4) + (x * 4);
	data[i + 0] = rgba[0];
	data[i + 1] = rgba[1];
	data[i + 2] = rgba[2];
	data[i + 3] = rgba[3];
};

export const colorToArray = (color) => {
	const canvas = createCanvas(1, 1);
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 1, 1);

	return [...getImageData(canvas).data];
}

export function getCrop (imageData, gap = 0) {
	const w = imageData.width;
	const h = imageData.height;
	let x1 = w;
	let x2 = 0;
	let y1 = h;
	let y2 = 0;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (getPoint(x, y, imageData)[3] > 50) {
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

export class Rect {
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

export function correctRadius(r, w, h) {
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

export function doPadding (...value) {
	value = flattenDeep(value);

	switch (value.length) {
		case 0: return new Array(4).fill(0);
		case 1: return new Array(4).fill(value[0] || 0);
		case 2: return [value[0] || 0, value[1] || 0, value[0] || 0, value[1] || 0];
		case 3: return [value[0] || 0, value[0] || 0, value[0] || 0, value[0] || 0];
		case 4: return value.map(i => i || 0);
	}
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

export async function canvasToFile (canvas, filename) {
	return await new Promise(resolve => canvas.toBlob(blob => resolve(new File([blob], filename,{type: "image/png", lastModified: Date.now()})), "image/png"));
}
