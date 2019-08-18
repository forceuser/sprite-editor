export class Deferred {
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

export function uuid () {
	return Array.from(crypto.getRandomValues(new Uint32Array(4))).map(n => n.toString(16)).join("-");
}

export const toArray = (obj) => Object.keys(obj).map(key => ({key, value: obj[key]}));

export function clone (obj) {
	return JSON.parse(JSON.stringify(obj));
}

export function transformKey (key, {format = "capitalize", delimiter = ""} = {}) {
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

export function each (list, fn) {
	return Object.keys(list).map(key => fn(list[key], key));
}

export function randomFloat (min, max) {
	return Math.random() * (max - min) + min;
}

export function randomInt (min, max) {
	let rand = min + Math.random() * (max + 1 - min);
	rand = Math.floor(rand);
	return rand;
}

export function flattenDeep (array, parent = []) {
    array.reduce((parent, item) => (Array.isArray(item) ? flattenDeep(item, parent) : parent.push(item), parent), parent);
    return parent;
}

export async function readFile (file, type = "text") {
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
		}[type] || "readAsText"](file);
	}

	return deferred.promise;
}

export function cycle (value, max, min = 0) {
	value = value - min;
	return (value < 0 ? ((max + (value % max)) % max) : value % max) + min;
}


export async function openFile () {
	const deferred = new Deferred();
	const $input = document.createElement("input");
	$input.type = "file";
	// $input.style.display = "none";
	// document.body.appendChild($input);

	$input.addEventListener("click", event => {
		event.stopPropagation();
	});
	$input.addEventListener("change", () => {
		console.log("FILES", $input.files);
		deferred.resolve([...$input.files]);
		$input.remove();
	});

	$input.click();

	return deferred.promise;
}

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