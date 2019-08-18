import {mod} from "./model.mjs";
import {default as dataStore} from "./data.mjs";
import {loadDataFromFile, saveDataToFile, convertSprites, crop, roundRect, growEx, removeRest, joinWhite, fill} from "./sprite-editor.mjs";
import {h, observable, reaction, cacheable, ViewComponent, classList} from "./view.mjs";
import {imageToCanvas, loadImage, createCanvas, toDPR, copyCanvas, Rect} from "./graphics.mjs";
import {openFile, readFile, clone, each, toArray, uuid} from "./common.mjs";

class $select extends ViewComponent {
	view (h, d) {
		return h("label", null, null, h => [
			h("div", null, null, () => d.params.title),
			h("select", null, () => ({model: d.params.model}),
				h => (d.params.options || []).map(item => h("option", item.id || item.key, {value: item.id || item.key}, item.value))
			),
		]);
	}
}


class $input extends ViewComponent {
	view (h, d) {
		return h("label", null, null, h => {			
			return [
				h("div", null, null, d.params.title),
				h("input", null, () => ({attrs: {type: "text"}, model: d.params.model})),
			];		
		});
	}
}

class $range extends ViewComponent {
	view (h, d) {
		return h("label", {}, h => [
			h("div", {}, h => `${d.params.title}${d.params.model.get() != null ? `: ${d.params.model.get()}` : ""}`),
			h("input", () => ({attrs: {type: "range", min: d.params.min, max: d.params.max, step: d.params.step}, model: d.params.model})),
		]);
	}
}


class $button extends ViewComponent {
	view (h, d) {		
		return h("button", () => ({class: {"button": true, active: d.params.active} , attrs: {type: "button"}, on: {click: d.params.click}}), () => d.content);
	}
}

const schema = {
	start: {		
		defaultValues: {
			scale: 1,
		},
		init: filter => {			
		},
		ui: (h, d, filter) => {
			console.log("filter", filter);
			return [
				h($range, () => ({title: "scale", min: 0.5, max: 1.5, step: 0.01, model: mod(filter, "scale")})),
			];
		},
		apply: async (filter, canvas, srcImg) => {
			const ctx = canvas.getContext("2d");
			await crop(canvas);			
			let scale = filter.scale || 1;
			const vol = Math.sqrt(Math.pow(canvas.width, 2) + Math.pow(canvas.height, 2));
			const dd = canvas.width / canvas.height;
			const maxVol = (dd > 0.9 && dd < 1.1 ? 0.85 : 1) * 170 * dpr;
			const multi = maxVol / vol;
			const resz = copyCanvas(canvas);
			canvas.width = canvas.width * multi * scale;
			canvas.height = canvas.height * multi  * scale;
			ctx.drawImage(resz, 0, 0, canvas.width, canvas.height);
		}
	},	
	fill: {
		apply: async (filter, canvas, srcImg) => {						
			await fill(canvas, 30);		
		},
	},
	grow: {
		apply: async (filter, canvas, srcImg) => {						
			const color = "white";		
			await growEx(canvas, {size: 20, smooth: 0, color, fast: false});
			await joinWhite(canvas, {dir: "h", dst: 10, color});
			await joinWhite(canvas, {dir: "v", dst: 10, color});
			// await removeRest(canvas, {dir: "h"});
			// await removeRest(canvas, {dir: "v"});			
		},
	},
	rect: {
		defaultValues: {
			radius: 16,
			color: "#fff",
		},
		ui: (h, d, filter) => {			
			return [
				h($input, () => ({title: "color", model: mod(filter, "color")})),
				h($range, () => ({title: "radius", min: 0, max: 64, step: 8, model: mod(filter, "radius")})),
			];
		},
		apply: async (filter, canvas, srcImg) => {
			const color = filter.color;
			let rh = Math.max(canvas.height, canvas.width / 4.5);
			if (rh > canvas.width * 0.65) {
				rh = canvas.width;
			}
			
			roundRect(canvas, new Rect({height: rh}), {
				// color: color2,
				color,
				padding: [8 * dpr, 12 * dpr],
				radius: +filter.radius,
				// square: true,
				center: true,
				fancyRadius: false,
			});
		}
	},
	crop: {

	},
	finish: {
		order: +Infinity,
		closeable: false,
		single: true,
		apply: async (filter, canvas, srcImg) => {
			const ctx = canvas.getContext("2d");	
			await crop(canvas);
		},
	},
};

const dpr = 2;

function uiForEditing (h, d) {
	if (d.editing) {		
		return [
			...uiForParams(d, h),
			...(d.editing.filters || []).map(filter => uiForFilter(d, filter, h)).filter(i => i),
			h("section", "add-filter", {class: ["param-section"]}, h => [
				h($select, () => ({title: "добавить фильтр", model: mod(d, "filterToAdd"), options: Object.keys(schema).map(key => ({id: key, value: key}))})),
				h($button, {click: () => addFilter(d)}, "Добавить"),
				h($button, {click: () => applyFilters(d, d.editing)}, "Применить фильтры"),
			]),
		];
	}
	return [];
}

function removeFilter (d, filter) {
	const idx = d.editing.filters.indexOf(filter);
	d.editing.filters.splice(idx, 1);
	applyFilters(d, d.editing);
}


function addFilter(d) {
	console.log("d.filterToAdd", d.filterToAdd);
	d.editing.filters = d.editing.filters || [];
	const init = schema[d.filterToAdd].init;
	let filter = Object.assign({id: uuid(), type: d.filterToAdd}, schema[d.filterToAdd].defaultValues || {});
	init && init(filter);
	d.editing.filters.push(filter);
	applyFilters(d, d.editing);
}

function uiForFilter (d, filter, h) {
	const params = schema[filter.type];
	const ui = params && params.ui;	
	console.log("ui for filter", filter);
	return h("section", `filter~${filter.type}~${filter.id}`, {class: ["param-section"]}, h => [
		h("div", () => ({class: ["param-section-header"]}), h => [
			h("div", {}, () => filter.type),
			h("button", () => ({class: ["close"], on: {click: () => removeFilter(d, filter)}})),
		]),
		...(ui ? ui(h, d, filter) : []),
	]);	
	return;
}

function uiForParams (d, h) {
	return [
		h("section", "param-section", {class: ["param-section"]}, h => [					
			// h($input, () => ({title: "id", model: mod(d.editing, "id")})),
			h($input, () => ({title: "имя", model: mod(d.editing, "name")})),
			h($input, () => ({title: "url", model: mod(d.editing.params, "url")})),
			h($select, () => ({title: "категория", options: d.categories, model: mod(d.editing.params, "category")})),
			h($range, () => ({title: "поворот", min: -30, max: 30, model: mod(d.editing.params, "rotate")})),
			h("label", {class: "input-title"}, "порядок"),
			h("div", {class: ["button-group", "order-button-group"]}, [
				h($button, {click: () => {
					const idx = d.sprites.order.indexOf(d.editing.id);		
					d.sprites.order.splice(idx, 1);
					d.sprites.order.splice(Math.max(0, idx - 1), 0 , d.editing.id);
				}}, "‹"),
				h("span", {}, () => d.sprites.order.indexOf(d.editing.id)),
				h($button, {click: () => {
					const idx = d.sprites.order.indexOf(d.editing.id);		
					d.sprites.order.splice(idx, 1);
					d.sprites.order.splice(Math.min(d.sprites.order.length, idx + 1), 0 , d.editing.id);
				}}, "›"),
			]),
			h($button, {click: () => removeSprite(d, d.editing)}, "Удалить"),
		])
	];
}

async function applyFilters (d, sprite) {
	let srcImg = await loadImage(sprite.src.url);
	const canvas = createCanvas(srcImg.width, srcImg.height);
	const ctx = canvas.getContext("2d");
	ctx.drawImage(srcImg, 0, 0, srcImg.width, srcImg.height);
	await (sprite.filters || []).reduce(async (prev, filter) => {
		await prev;
		const apply = schema[filter.type].apply;
		if (apply) {
			await apply(filter, canvas, srcImg);
		}
	}, {});
	const dpr1x = toDPR(canvas, dpr, 1);
	sprite.dest1x = {url: dpr1x.toDataURL("image/png"), w: dpr1x.width, h: dpr1x.height, width: dpr1x.width, height: dpr1x.height};
	sprite.dest2x = {url: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height, width: dpr1x.width, height: dpr1x.height};
	sprite.params.square = sprite.dest2x.width - sprite.dest2x.height < (sprite.dest2x.width / 100 * 10);
	d.sprites.index[sprite.id] = sprite;
};


async function removeSprite (d, sprite) {
	const idx = d.sprites.order.indexOf(sprite.id);
	d.sprites.order.splice(idx, 1);
	delete d.sprites.index[sprite.id];
}

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
			id: (++d.sprites.id).toString(),
			name,
			src: {url: imageToCanvas(img).toDataURL("image/png"), w: img.width, h: img.height},
			params: {},
			filters: [
				// {type: "main", rotate: 0, scale: 1, url: "https://welovemebel.com.ua/"},
				// {type: "temp"},
			],
		};
		d.sprites.order.push(sprite.id);
	}
	d.editing = sprite;
	
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
	const sprites = await convertSprites(await dataStore.load());
	const d = observable({
		sprites,
		mode: "desktop",
		categories: [
			{id: "electronic", value: "Электроника"},
			{id: "sport", value: "Спорт"},
			{id: "education", value: "Образование"},
			{id: "auto", value: "Авто"},
			{id: "home", value: "Для дома"},
			{id: "other", value: "Другое"},
		],
	});

	reaction(async () => {
		await dataStore.save(clone(d.sprites.$$watchDeep));
	});

	h("div", "ui", {class: ["main"]}, h => [
		h("div", "mainbar", {class: ["mainbar"]}, h => [
			h("div", "mainbar-title", {class: ["mainbar-title"]}, h => [
				h($button, () => ({active: d.mode === "mobile", click: () => d.mode = "mobile"}), "Mobile"),
				h($button, () => ({active: d.mode === "desktop", click: () => d.mode = "desktop"}), "Desktop"),
			]),
			h("div", () => ({class: classList("mainbar-content-wrapper", {mobile: d.mode})}), h => [
				h("div", "mainbar-content", () => ({class: classList(["mainbar-content"], {mobile: d.mode === "mobile"})}), h => [
					...toArray(d.sprites.index.$$watch)
						.sort((a, b) => d.sprites.order.indexOf(a.value.id) -  d.sprites.order.indexOf(b.value.id))
						.map(({key, value}) => {
							const sprite = value;
							return h("div", key, () => ({
								class: classList(["sprite-block"], {square: sprite.params.square}), 
								style: {transform: `rotate(${sprite.params.rotate || 0}deg)`},
								on: {click: () => editSprite(d, sprite)},					
							}), h =>
								h("img", null, () => ({attrs: {src: sprite.dest2x.url, width: sprite.dest2x.width}}))
							)
						}),
					h("div", "block-add", {class: ["sprite-block-add"], on: {click: () => editSprite(d)}}, "Добавить +"),
					h("div", "block-rest", {class: ["sprite-block-rest"]})
				]),
			]),
		]),
		h("div", "sidebar", {class: ["sidebar"]}, h => [
			h("section", "sect1", {class: ["param-section", "main-buttons"]}, h => [
				h($button, {
					click: async () => {
						let sprites = await loadDataFromFile();											
						d.sprites = sprites;
						await dataStore.save(sprites);
					}
				}, "Загрузить из файла"),
				h($button, {click: () => saveDataToFile(d.sprites)}, "Сохранить в файл"),				
			]),
			...uiForEditing(h, d),			
		]),
	])(document.querySelector(".ui"));
}


main();
