import {mod} from "./model.mjs";
import {default as dataStore} from "./data.mjs";
import {each, clone} from "./common.mjs";
import {loadDataFromFile, saveDataToFile, crop, roundRect} from "./sprite-editor.mjs";
import {h, observable, cacheable, ViewComponent} from "./view.mjs";
import {imageToCanvas, loadImage, createCanvas, toDPR, copyCanvas, Rect} from "./graphics.mjs";
import { openFile, readFile } from "./common.mjs";

function $select(h, title, options, model) {
	return h("label", null, null, h => [
		h("div", null, null, title),
		h("select", null, () => ({model}),
			h => options.map(item => h("option", item.id, {value: item.id}, item.value))
		)
	]);
}


class $input extends ViewComponent {
	view (h, d) {
		return h("label", null, null, h => {
			console.log("title", d.params.title);
			return [
				h("div", null, null, d.params.title),
				h("input", null, () => ({attrs: {type: "text"}, model: d.params.model})),
			];		
		});
	}
}

class $range extends ViewComponent {
	view (h, d) {
		return h("label", null, null, h => [
			h("div", null, null, h => `${d.params.title} ${d.params.model.get() != null ? `(${d.params.model.get()})` : ""}`),
			h("input", null, () => ({attrs: {type: "range", min: d.params.min, max: d.params.max, step: d.params.step}, model: d.params.model})),
		]);
	}
}


// function $input (h, title, model) {
// 	return h("label", "$input", null, h => {
// 		console.log("title", title);
// 		return [
// 			h("div", null, null, title),
// 			h("input", null, () => ({attrs: {type: "text"}, model})),
// 		];		
// 	});
// }

// function $range (h, title, min, max, model, step = 1) {
// 	return h("label", "$range", null, h => [
// 		h("div", null, null, h => `${title} ${model.get() != null ? `(${model.get()})` : ""}`),
// 		h("input", null, () => ({attrs: {type: "range", min, max, step}, model})),
// 	]);
// }

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
				// $range(h, "поворот", 0, 360, mod(d, "rotate")),
				// $range(h, "scale", 0.5, 1.5, mod(d, "scale"), 0.05),
			]
		},
		apply: (filter, canvas, srcImg) => {

		},
		single: true,
		removable: false,
		applyOnChange: true,
	},
	temp: {
		apply: async (filter, canvas, srcImg) => {
			const ctx = canvas.getContext("2d");
			await crop(canvas);
			const color = "white";
			let scale = 1;
			const vol = Math.sqrt(Math.pow(canvas.width, 2) + Math.pow(canvas.height, 2));
			const dd = canvas.width / canvas.height;
			const maxVol = (dd > 0.9 && dd < 1.1 ? 0.85 : 1) * 170 * dpr;
			const multi = maxVol / vol;
			const resz = copyCanvas(canvas);
			canvas.width = canvas.width * multi * scale;
			canvas.height = canvas.height * multi  * scale;
			ctx.drawImage(resz, 0, 0, canvas.width, canvas.height);

			let rh = Math.max(canvas.height, canvas.width / 4.5);
			if (rh > canvas.width * 0.65) {
				rh = canvas.width;
			}
			
			roundRect(canvas, new Rect({height: rh}), {
				// color: color2,
				color,
				padding: [8 * dpr, 12 * dpr],
				radius: 16,
				// sqare: true,
				center: true,
				fancyRadius: false,
			});
	

			await crop(canvas);
		},
	},
	fill: {

	},
	grow: {

	},
	rect: {

	},
	finish: {

	},
};

const dpr = 2;

function uiForEditing (h, d) {
	if (d.editing) {
		console.log("ui for editing", d.editing);
		return [
			...uiForParams(d, h),
			// ...(d.editing.filters || []).map(filter => uiForFilter(filter, h)),
		];
	}
	return [];
}

function uiForFilter (filter, h) {
	const ui = schema[filter.type].ui;
	if (ui) {
		const d = observable(filter);
		return h("section", null, {class: ["param-section"]}, h => [
			...ui(h, d),
		]);
	}
	return [];
}

function uiForParams (d, h) {
	return [
		h("section", "params-qq", {class: ["param-section"]}, h => [					
			h($range, null, () => ({title: "поворот", min: -30, max: 30, model: mod(d.editing.params, "rotate")})),
			h($input, null, () => ({title: "url" + d.editing.params.url, model: mod(d.editing.params, "url")})),
		])
	];
}

async function applyFilters (d, sprite) {
	let srcImg = await loadImage(sprite.src.url);
	const canvas = createCanvas(srcImg.width, srcImg.height);
	const ctx = canvas.getContext("2d");
	ctx.drawImage(srcImg, 0, 0, srcImg.width, srcImg.height);
	await sprite.filters.reduce(async (prev, filter) => {
		await prev;
		const apply = schema[filter.type].apply;
		if (apply) {
			await apply(filter, canvas, srcImg);
		}
	});
	const dpr1x = toDPR(canvas, dpr, 1);
	sprite.dest1x = {name: sprite.name, url: dpr1x.toDataURL("image/png"), w: dpr1x.width, h: dpr1x.height, width: dpr1x.width, height: dpr1x.height};
	sprite.dest2x = {name: sprite.name, url: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height, width: dpr1x.width, height: dpr1x.height};
	d.sprites.index[sprite.name] = sprite;
};

async function editSprite (d, sprite) {
	let add = false;
	if (!sprite) {
		add = true;
		const width = 240;
		const files = await openFile();
		const file = files[0];
		const url = await readFile(file, "blobUrl");
		const img = await loadImage(url, {width: width * dpr});
		const name = (file.name || "").replace(/([^\/\\]+)$/, "$1").split(".")[0];
		sprite = {
			name,
			src: {url: imageToCanvas(img).toDataURL("image/png"), w: img.width, h: img.height},
			params: {},
			filters: [
				{type: "main", rotate: 0, scale: 1, url: "https://welovemebel.com.ua/"},
				{type: "temp"},
			],
		};
	}
	d.editing = sprite;
	console.log("D.editing", d.editing);
	d.save = async () => {
		sprites[name] = d.editing;
	}
	d.cancel = async () => {
		d.editing = null;
	}
	if (add) {
		applyFilters(d, d.editing);
	}
}

async function main () {
	const sprites = await dataStore.load();
	
	// await dataStore.save(sprites);

	console.log("sprites", sprites);
	const d = observable({
		sprites,
		locale: "ru",
		geoIp: cacheable(() => {
			return fetch(`http://api.ipapi.com/check?access_key=4218ba4f6a44767cbfad04980e11bbd3&format=1&language=${d.locale}`, {
				credentials: "omit",
				headers: {
					"accept-language": d.locale,
				},
				// mode: "no-cors"
			})
				.then(response => response.json())
				.then(json => JSON.stringify(json, null, "\t"));
		}),
		mode: 1,
		rotate: 0,
		list: [
			{id: 1, value: "some text", title: "23123"},
			{id: 2, value: "other text"},
			{id: 3, value: "text 3"},
		]
	});

	window.d = d;
	console.log(sprites);

	h("div", "ui", {class: ["main"]}, h => [
		h("div", "mainbar", {class: ["mainbar"]}, h => [
			h("div", "mainbar-content", {class: ["mainbar-content"]}, h => [
				...each(d.sprites.index.$$watch, (sprite, name) => 
					h("div", name, () => ({
						class: ["sprite-block"], 
						style: {transform: `rotate(${sprite.params.rotate || 0}deg)`},
						on: {click: () => editSprite(d, sprite)},					
					}), h =>
						h("img", null, {attrs: {src: sprite.dest2x.url, width: sprite.dest2x.width, height: sprite.dest2x.height}})
					)),
				h("div", "block-add", {class: ["sprite-block-add"], on: {click: () => editSprite(d)}}, "Добавить +"),
				h("div", "block-rest", {class: ["sprite-block-rest"]})
			])
		]),
		h("div", "sidebar", {class: ["sidebar"]}, h => [
			h("section", "sect1", {class: ["param-section"]}, h => [
				$button(h, "Загрузить из файла", async () => {
					let sprites = await loadDataFromFile();
					if (!sprites.index) {
						sprites = {index: sprites};
						sprites.order = Object.keys(sprites.index);
					}
					each(sprites.index, sprite => {
						sprite.params = sprite.params || {};
					});
					d.sprites = sprites;
					await dataStore.save(sprites);
				}),
				$button(h, "Сохранить в файл", () => saveDataToFile(d.sprites)),
				$button(h, "Change locale", () => d.locale = d.locale === "en" ? "ru" : "en"),				
			]),
			...uiForEditing(h, d),
			h("section", "geoIpSection", {class: ["param-section"]}, h => [
				h("div", "geoIpLoading", {}, () => `loading: ${!(d.geoIp().resolved)}`),
				h("pre", "geoIp", {}, () => d.geoIp().value)
			]),
			// h("section", "sect2", {class: ["param-section"]}, h => [
			// 	h("div", "header", {class: ["param-section-header"]}, h => [
			// 		h("div", null, null, "Основные параметры"),
			// 		h("button", null, {attrs: {type: "button"}, class: ["close"]})
			// 	]),
			// 	...[
			// 		$input(h, "Input example", mod(d, "mode")),
			// 		$select(h, "Select example", d.list, mod(d, "mode")),
			// 		$select(h, "Select example 2", d.list, mod(d, "mode")),
			// 	],
			// 	...[
			// 		h("div", null, {style: {width: "100px", height: "100px", background: "#aaa", transform: `rotate(${d.rotate || 0}deg)`}}),
			// 		$range(h, "поворот", 0, 360, mod(d, "rotate")),
			// 	],
			// 	...[
			// 		h("hr"),
			// 		$button(h, "Привет", () => d.mode = 3),
			// 	],
			// ]),
		]),
	])(document.querySelector(".ui"));
}


main();
