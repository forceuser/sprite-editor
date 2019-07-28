import {default as activeData, observable, reaction} from "//cdn.jsdelivr.net/npm/active-data@2.0.9/src/active-data.js";
import {default as model, mod} from "./model.mjs";
import classModule from "./class.mjs";
import {default as dataStore, openFile} from "./data.mjs";
import {createCanvas, loadImage, canvasToFile} from "./sprite-editor.mjs";

const $patch = snabbdom.init([
	...Object.keys(window).filter(i => i.startsWith("snabbdom_")).map(i => window[i].default),
	classModule,
	model,
]);

function getParams (params, key) {
	params = (typeof params === "function" ? params() : params) || {};
	params.key = key;
	delete params.hook;
	return params;
}

function h (type, key, params, content) {
	const cache = {
		data: {},
		dataNext: {},
		start () {
			this.idx = 0;
			this.dataNext = {};
		},
		end () {
			this.data = this.dataNext;
		},
		get (type, key) {
			this.idx++;
			const $key = `${type}:${key}`;
			const result = this.data[$key];
			if (result) {
				this.dataNext[$key] = result;
			}
		},
		set (type, key, value) {
			const $key = `${type}:${key}`;
			this.dataNext[$key] = value;
		}
	}

	const childH = (type, key, params, content) => {
		key = key == null ? `index:${cache.idx + 1}` : key;
		let vnode = cache.get(type, key);
		if (!vnode) {
			vnode = h(type, key, params, content)(vnode);
			cache.set(type, key, vnode);
		}
		return vnode;
	}

	let staticContent;
	if (typeof content !== "function") {
		staticContent = content;
	}

	return vnode => {
		let isStaticParams = typeof params !== "function";

		const create = (emptyNode, vnode) => {
			if (typeof content === "function") {
				let contentVNode = vnode;
				reaction(() => {
					cache.start();
					// console.log("patch content", key);
					contentVNode = $patch(contentVNode, snabbdom.h(type, contentVNode.data, content(childH)));
					cache.end();
				});
			}
			let paramsVNode = vnode;
			if (!isStaticParams) {
				reaction(() => {
					const p = getParams(params, key);
					// console.log("patch params", key);
					paramsVNode = $patch(paramsVNode, snabbdom.h(type, p, staticContent));
				});
			}
		}

		let $params = {key, hook: {create}};
		if (params && isStaticParams) {
			$params = Object.assign($params, params);
		}

		const newVNode = snabbdom.h(type, $params, staticContent);
		if (vnode) {
			vnode = $patch(vnode, newVNode);
		}
		else {
			vnode = newVNode;
		}
		return vnode;
	}
}



function $select(h, title, options, model) {
	return h("label", null, null, h => [
		h("div", null, null, title),
		h("select", null, () => ({model}),
			h => options.map(item => h("option", item.id, {value: item.id}, item.value))
		)
	]);
}

function $input (h, title, model) {
	return h("label", null, null, h => [
		h("div", null, null, title),
		h("input", null, () => ({attrs: {type: "text"}, model})),
	]);
}

function $range (h, title, min, max, model) {
	return h("label", null, null, h => [
		h("div", null, null, h => `${title} ${model.get() != null ? `(${model.get()})` : ""}`),
		h("input", null, () => ({attrs: {type: "range", min, max}, model})),
	]);
}

function $button (h, title, click) {
	return h("button", null, {class: ["button"], attrs: {type: "button"}, on: {click}}, title);
}

const schema = {
	main: {
		title: "основные параметры",
		init (d) {
			d.rotate = 0;
		},
		ui: (h, d) => {
			return [
				$range(h, "поворот", 0, 360, mod(d, "rotate")),
			]
		},
		apply: (d) => {

		},
		single: true,
		removable: false,
		applyOnChange: true,
	},
	fill: {

	},
	grow: {

	},
	rect: {

	},
};


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

async function loadDataFromFile () {
	const files = await openFile();
	const zip = await JSZip.loadAsync(files[0]);
	const str = await zip.file("resources/data/sprites.json").async("string");
	const sprites = JSON.parse(str);
	await dataStore.save(sprites);
	console.log("sprites", sprites);
}


async function saveDataToFile () {
	const zip = new JSZip();
	const filename = "sprites";
	const folder = zip.folder("resources");
	// const folder = zip.folder(filename);
	const sprites = await dataStore.load();
	let css = ``;
	let html = ``;
	await [1, 2].reduce(async (result, dpr) => {
		await result;
		const boxes = Object.keys(sprites).map(name => sprites[name][`dest${dpr}x`]);
		const {w, h, fill} = potpack(boxes);
		const filename = `partner-sprite@${dpr}x.png`
		const canvas = createCanvas(w, h);
		const ctx = canvas.getContext("2d");
		if (dpr > 1) {
			css += `\n@media (min-resolution: 192dpi), (-webkit-min-device-pixel-ratio: 2), (min--moz-device-pixel-ratio: 2), (-o-min-device-pixel-ratio: 2/1), (min-device-pixel-ratio: 2), (min-resolution: 2dppx) {`
		}
		css += `\n.sprite-img {background-image: url("../img/partner-sprite/${filename}"); background-repeat: no-repeat;}`;
		await Object.keys(sprites).reduce(async (prev, name) => {
			await prev;
			const sprite = sprites[name];
			const box = sprite[`dest${dpr}x`];
			const img = await loadImage(box.url);
			css += `\n.sprite-img.sprite-img-${box.name} {
				background-position: ${w === box.w ? 0 : (box.x / (w - box.w) * 100).toPrecision(5)}% ${h === box.h ? 0 : (box.y / (h - box.h) * 100).toPrecision(5)}%;
				background-size: ${(w / box.w * 100).toPrecision(5)}% ${(h / box.h * 100).toPrecision(5)}%;
				width: ${box.width}px;
				height: ${box.height}px;
			}`;
			ctx.drawImage(img, box.x, box.y, box.w, box.h);
			if (dpr === 1) {
				html += `\n<a href="${sprite.link || "${" + transformKey(`logo-url-${name}`) + `!"#"}`}" class="sprite-img sprite-img-${box.name}" target="_blank" rel="noopener"></a>`;
			}
		}, null);
		if (dpr > 1) {
			css += `\n}`;
		}
		const file = await canvasToFile(canvas, `partner-sprite@${dpr}x.png`);
		folder.file(`static/dist/img/partner-sprite/${filename}`, file);
		return result;
	}, []);

	folder.file(`data/${filename}.json`, new Blob([JSON.stringify(sprites, null, "\t")], {type: "application/json"}));
	folder.file(`static/src/less/${filename}.less`, new Blob([css], {type: "text/css"}));
	folder.file(`templates/chast/${filename}.ftl`, new Blob([html], {type: "text/html"}));

	console.log("==== creating zip file =====");
	const content = await zip.generateAsync({type: "blob"});

	const url = URL.createObjectURL(content);
	let a = document.createElement("a");
	a.setAttribute("download", `${filename}.zip`);
	a.setAttribute("href", url);
	a.click();
	a = null;
};

function each (list, fn) {
	return Object.keys(list).map(key => fn(list[key], key));
}

async function main () {
	const sprites = await dataStore.load();
	console.log("sprites", sprites);
	const d = observable({
		sprites,
		mode: 1,
		rotate: 0,
		list: [
			{id: 1, value: "some text", title: "23123"},
			{id: 2, value: "other text"},
			{id: 3, value: "text 3"},
		]
	});

	window.d = d;


	h("div", "ui", {class: ["main"]}, h => [
		h("div", "mainbar", {class: ["mainbar"]}, h => [
			h("div", "mainbar-content", {class: ["mainbar-content"]}, h => [
				...each(d.sprites, (sprite, name) => h("div", name, {class: ["sprite-block"]}, h =>
					h("img", null, {attrs: {src: sprite.dest2x.url, width: sprite.dest2x.width, height: sprite.dest2x.height}})
				)),
				h("div", "block-add", {class: ["sprite-block-add"]}, "Добавить +"),
				h("div", "block-rest", {class: ["sprite-block-rest"]})
			])
		]),
		h("div", "sidebar", {class: ["sidebar"]}, h => [
			h("section", "sect1", {class: ["param-section"]}, h => [
				$button(h, "Загрузить из файла", () => loadDataFromFile()),
				$button(h, "Сохранить в файл", () => saveDataToFile()),
			]),
			h("section", "sect2", {class: ["param-section"]}, h => [
				h("div", "header", {class: ["param-section-header"]}, h => [
					h("div", null, null, "Основные параметры"),
					h("button", null, {attrs: {type: "button"}, class: ["close"]})
				]),
				...[
					$input(h, "Input example", mod(d, "mode")),
					$select(h, "Select example", d.list, mod(d, "mode")),
					$select(h, "Select example 2", d.list, mod(d, "mode")),
				],
				...[
					h("div", null, {style: {width: "100px", height: "100px", background: "#aaa", transform: `rotate(${d.rotate || 0}deg)`}}),
					$range(h, "поворот", 0, 360, mod(d, "rotate")),
				],
				...[
					h("hr"),
					$button(h, "Привет", () => d.mode = 3),
				],
			]),
		]),
	])(document.querySelector(".ui"));
}


main();
