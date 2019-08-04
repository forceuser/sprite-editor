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

