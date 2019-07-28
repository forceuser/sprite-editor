const indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
const IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
const dbVersion = 4;

export default {
	async init () {
		const request = indexedDB.open("sprite-editor", dbVersion);
		return new Promise (resolve => {
			request.onsuccess = event => {
				const db = event.target.result;

				db.onerror = event => {
					console.log("Error creating/accessing IndexedDB database");
				};

				resolve(db);
			};

			request.onupgradeneeded = event => {
				const db = event.target.result;
				db.createObjectStore("sprites");
			};

		});
	},
	async save (data) {
		const store = (await this.init()).transaction(["sprites"], "readwrite").objectStore("sprites");
		return new Promise(resolve => {
			store.put(data, "sprites").onsuccess = event => resolve(event.target.result);
		});
	},
	async load () {
		const store = (await this.init()).transaction(["sprites"], "readonly").objectStore("sprites");
		return new Promise(resolve => {
			store.get("sprites").onsuccess = event => resolve(event.target.result || {});
		});
	},
	async clear () {
		const store = (await this.init()).transaction(["sprites"], "readwrite").objectStore("sprites");
		return new Promise(resolve => {
			store.clear().onsuccess = event => resolve(event.target.result);
		});
	}
};

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
		}[type] || "text"]();
	}

	return deferred.promise;
}

export async function openFile () {
	const deferred = new Deferred();
	const $input = document.createElement("input");
	$input.type = "file";
	$input.style.display = "none";
	document.body.appendChild($input);

	$input.addEventListener("click", event => {
		event.stopPropagation();
	});
	$input.addEventListener("change", () => {
		deferred.resolve([...$input.files]);
		$input.remove();
	});

	$input.click();

	return deferred.promise;
}

// Create/open database

