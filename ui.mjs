import {mod} from "./model.mjs";
import {default as dataStore} from "./data.mjs";
import {loadDataFromFile, saveDataToFile, convertSprites, crop, roundRect, roundRectCustom, growEx, removeRest, joinWhite, fill, tint, replaceColor} from "./sprite-editor.mjs";
import {h, observable, reaction, cacheable, ViewComponent, classList} from "./view.mjs";
import {imageToCanvas, loadImage, createCanvas, toDPR, copyCanvas, Rect, doPadding} from "./graphics.mjs";
import {openFile, readFile, clone, each, toArray, uuid} from "./common.mjs";

class $select extends ViewComponent {
	view (h, d) {
		return h("label", {}, h => [
			...(d.params.title ? [h("div", {class: "input-title"}, d.params.title)] : []),
			h("select", null, () => ({model: d.params.model}),
				h => (d.params.options || []).map(item => h("option", item.id || item.key, {value: item.id || item.key}, item.value))
			),
		]);
	}
}


class $input extends ViewComponent {
	view (h, d) {
		return h("label", {}, h => {			
			return [
				...(d.params.title ? [h("div", {class: "input-title"}, d.params.title)] : []),
				h("input", null, () => ({attrs: {type: "text"}, model: d.params.model})),
			];		
		});
	}
}

class $colorpicker extends ViewComponent {
	view (h, d) {
		return h("label", {}, h => [		
			...(d.params.title ? [h("div", {class: "input-title"}, d.params.title)] : []),
			h("div", {class: "colorpicker"}, h => [
				h("input", () => ({attrs: {type: "text"}, model: d.params.model})),
				h("input", () => ({
					attrs: {type: "color"}, 
					params: {value: d.params.model.get()},
					// on: {change: event => d.params.model.set(event.target.value)},
					model: d.params.model,
				})),
				h("span", () => ({
					class: "box",
					style: {background: d.params.model.get()},
					on: {click: event => event.target.parentNode.querySelector(`input[type="color"]`).click()}
				})),
			]),
		]);
	}
}

class $range extends ViewComponent {
	view (h, d) {
		return h("label", {}, h => [
			h("div", {class: "input-title"}, h => `${d.params.title}${d.params.model.get() != null ? `: ${d.params.model.get()}` : ""}`),
			h("input", () => ({attrs: {type: "range", min: d.params.min, max: d.params.max, step: d.params.step}, model: d.params.model})),
		]);
	}
}

class $checkbox extends ViewComponent {
	view (h, d) {
		return h("label", () => ({attrs: {button: true}, class: ["inversed"]}), h => [
			h("input", () => ({attrs: {type: "checkbox", disabled: d.params.disabled}, model: d.params.model})),
			h("box"),
			h("span", {}, d.params.title || "")
		]);	
	}
}


class $button extends ViewComponent {
	view (h, d) {		
		return h("button", () => (Object.assign({class: {"button": true, active: d.params.active} , attrs: {type: "button"}, on: {click: d.params.click}}, d.params.other || {})), () => d.content);
	}
}

const schema = {
	start: {		
		title: "Подготовка изображения",
		defaultValues: {
			scale: 1,
		},
		init: filter => {			
		},
		ui: (h, d, filter) => {			
			return [
				h($range, () => ({title: "Масштабирование", min: 0.5, max: 1.5, step: 0.01, model: mod(filter, "scale")})),
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
		title: "Убрать фоновый цвет",
		defaultValues: {
			threshold: 30,			
		},
		ui: (h, d, filter) => {			
			return [				
				h($range, () => ({title: "Граница определения фонового цвета", min: 0, max: 256, step: 1, model: mod(filter, "threshold")})),
			];
		},
		apply: async (filter, canvas, srcImg) => {						
			await fill(canvas, filter.threshold);		
		},
	},
	grow: {
		title: "Обводка",
		defaultValues: {
			color: "#fff",
			size: 12,			
			smooth: 0,
			joinWhiteHorisontal: true,
			joinWhiteVertical: true,
			removeRestHorisontal: true,
			removeRestVertical: true,
			joinWhiteHorisontalDistance: 10,
			joinWhiteVerticalDistance: 10,
			joinWhiteHorisontalDistance2: 200,
			joinWhiteVerticalDistance2: 200,
		},
		ui: (h, d, filter) => {			
			return [
				h($colorpicker, () => ({title: "Цвет", model: mod(filter, "color")})),
				h($range, () => ({title: "Размер", min: 0, max: 80, step: 1, model: mod(filter, "size")})),
				h($range, () => ({title: "Сглаживание", min: 0, max: 5, step: 1, model: mod(filter, "smooth")})),
				h($checkbox, {title: "Слияние границ по горизонтали", model: mod(filter, "joinWhiteHorisontal")}),
				h($range, () => ({title: "Расстояние слияния по горизонтали", min: 0, max: 300, step: 1, model: mod(filter, "joinWhiteHorisontalDistance2")})),
				// h($range, () => ({title: "Расстояние слияния по горизонтали2", min: 0, max: 300, step: 1, model: mod(filter, "joinWhiteHorisontalDistance2")})),
				h($checkbox, {title: "Слияние границ по вертикали", model: mod(filter, "joinWhiteVertical")}),
				h($range, () => ({title: "Расстояние слияния по вертикали", min: 0, max: 300, step: 1, model: mod(filter, "joinWhiteVerticalDistance2")})),
				// h($range, () => ({title: "Расстояние слияния по вертикали2", min: 0, max: 300, step: 1, model: mod(filter, "joinWhiteVerticalDistance2")})),
				h($checkbox, {title: "Убрать неровности на вертикалях", model: mod(filter, "removeRestHorisontal")}),
				h($checkbox, {title: "Убрать неровности на горизонталях", model: mod(filter, "removeRestVertical")}),
			];
		},
		apply: async (filter, canvas, srcImg) => {										
			await growEx(canvas, {size: filter.size, smooth: filter.smooth, color: filter.color, fast: false});
			if (filter.joinWhiteHorisontal) {
				await joinWhite(canvas, {dir: "h", dst: filter.joinWhiteHorisontalDistance, dst2: filter.joinWhiteHorisontalDistance2, color: filter.color});
			}
			if (filter.joinWhiteVertical) {
				await joinWhite(canvas, {dir: "v", dst: filter.joinWhiteVerticalDistance, dst2: filter.joinWhiteVerticalDistance2, color: filter.color});
			}
			if (filter.removeRestHorisontal) {
				await removeRest(canvas, {dir: "h"});
			}
			if (filter.removeRestVertical) {
				await removeRest(canvas, {dir: "v"});			
			}
		},
	},
	tint: {
		title: "Применить оттенок",
		defaultValues: {
			color: "#fff",
		},
		ui: (h, d, filter) => {			
			return [
				h($colorpicker, () => ({title: "Цвет", model: mod(filter, "color")})),
			];
		},
		apply: async (filter, canvas, srcImg) => {
			if (filter.color) {
				tint(canvas, filter.color);
			}
		}
	},	
	replaceColor: {
		title: "Замена цвета",
		defaultValues: {
			srcColor: "#fff",
			destColor: "#000",
			invert: false,
		},
		ui: (h, d, filter) => {			
			return [
				h($colorpicker, () => ({title: "Исходный цвет", model: mod(filter, "srcColor")})),
				h($colorpicker, () => ({title: "Цвет для замены", model: mod(filter, "destColor")})),
				h($checkbox, {title: "invert", model: mod(filter, "invert")}),
			];
		},
		apply: async (filter, canvas, srcImg) => {
			if (filter.srcColor && filter.destColor) {
				replaceColor(canvas, filter.srcColor, filter.destColor, filter.invert);
			}
		}
	},
	rectCustom: {
		title: "Подложка произвольного размера",
		defaultValues: {
			radius: 16,
			margin: 0,
			color: "#fff",		
			top: 0,
			left: 0,
			width: 100,
			height: 100,
		},
		ui: (h, d, filter) => {			
			return [
				h($colorpicker, () => ({title: "Цвет", model: mod(filter, "color")})),				
				h($input, () => ({title: "radius", model: mod(filter, "radius")})),
				h($input, () => ({title: "margin", model: mod(filter, "margin")})),
				h($range, () => ({title: "top", min: -50, max: 150, step: 1, model: mod(filter, "top")})),
				h($range, () => ({title: "left", min: -50, max: 150, step: 1, model: mod(filter, "left")})),
				h($range, () => ({title: "height", min: -50, max: 150, step: 1, model: mod(filter, "height")})),
				h($range, () => ({title: "width", min: -50, max: 150, step: 1, model: mod(filter, "width")})),
			];
		},
		apply: async (filter, canvas, srcImg) => {			
			const color = filter.color;
			
			roundRectCustom(canvas, {top: filter.top, left: filter.left, height: filter.height, width: filter.width}, {				
				color,				
				margin: filter.margin,
				radius: filter.radius,				
			});
		}
	},
	rect: {
		title: "Подложка",
		defaultValues: {
			radius: 16,
			color: "#fff",
			padding: "20",
			center: true,
		},
		ui: (h, d, filter) => {			
			return [
				h($colorpicker, () => ({title: "Цвет", model: mod(filter, "color")})),
				h($input, () => ({title: "padding", model: mod(filter, "padding")})),
				h($range, () => ({title: "radius", min: 0, max: 128, step: 8, model: mod(filter, "radius")})),
				h($checkbox, {title: "Квадрат", model: mod(filter, "square")}),
				h($checkbox, {title: "Центрировать", model: mod(filter, "center")}),
				h($checkbox, {title: "Использовать как маску", model: mod(filter, "mask")}),
				h($checkbox, {title: "Странные скругления", model: mod(filter, "fancyRadius")}),
			];
		},
		apply: async (filter, canvas, srcImg) => {
			// console.log("crop", canvas.width, canvas.height);
			const color = filter.color;
			// let rh = Math.max(canvas.height, canvas.width / 4.5);
			// if (rh > canvas.width * 0.65) {
			// 	rh = canvas.width;
			// }
			
			roundRect(canvas, new Rect({height: canvas.height}), {
				// color: color2,
				color,
				padding: doPadding(filter.padding),
				radius: +filter.radius,
				square: filter.square,
				center: filter.center,
				mask: filter.mask,
				fancyRadius: filter.fancyRadius,
			});
		}
	},
	crop: {
		title: "Обрезать лишнее",
		apply: async (filter, canvas, srcImg) => {			
			await crop(canvas);
			console.log("crop", canvas.width, canvas.height);
		},
	},
};

const dpr = 2;

function uiForEditing (h, d) {
	if (d.editing) {	
		console.log("d.editing");
		return [
			...uiForParams(d, h),
			...(d.editing.filters || []).map(filter => uiForFilter(d, filter, h)).filter(i => i),
			h("section", "add-filter", {class: ["param-section"]}, h => [
				h("div", () => ({class: ["param-section-header"]}), h => [
					h("div", {}, "Добавить фильтр"),
				]),
				h($select, () => ({model: mod(d, "filterToAdd"), options: Object.keys(schema).map(key => ({id: key, value: schema[key].title || key}))})),
				h($button, {click: () => addFilter(d, d.editing, d.filterToAdd)}, "Добавить"),				
			]),
			h("section", "apply-filter", {class: ["param-section", "apply-filter"]}, h => [				
				h($button, {click: () => applyFilters(d.editing)}, "Применить фильтры"),
			]),
		];
	}
	return [];
}

function removeFilter (d, filter) {
	const idx = d.editing.filters.indexOf(filter);
	d.editing.filters.splice(idx, 1);
	applyFilters(d.editing);
}

async function reloadSpriteImage (d, sprite) {	
	const width = 240;
	const files = await openFile();
	const file = files[0];
	const url = await readFile(file, "blobUrl");
	const img = await loadImage(url, {width: width * dpr});
	const name = (file.name || "").replace(/([^\/\\]+)$/, "$1").split(".")[0];
	// console.log("sprite.src", sprite.src);
	sprite.src = {url: imageToCanvas(img).toDataURL("image/png"), w: img.width, h: img.height};
	applyFilters(sprite);
}

function addFilter(d, sprite, filterToAdd) {	
	sprite.filters = sprite.filters || [];
	const init = schema[filterToAdd].init;
	let filter = Object.assign({id: uuid(), type: filterToAdd}, schema[filterToAdd].defaultValues || {});
	init && init(filter);
	sprite.filters.push(filter);
	applyFilters(sprite);
}

function uiForFilter (d, _filter, h) {
	const item = d.editing;
	let filter = observable(_filter);
	let t;
	reaction(() => {
		clearTimeout(t);
		filter.$$watchDeep;
		t = setTimeout(() => {
			applyFilters(d.editing);
		}, 100);
	})
	const params = schema[filter.type];
	const ui = params && params.ui;		
	return h("section", `filter~${filter.type}~${filter.id}`, {class: ["param-section"]}, h => [
		h("div", () => ({class: ["param-section-header"]}), h => [
			h("div", {}, () => schema[filter.type].title || filter.type),
			h("div", {class: "action-buttons"}, h => [
				h("button", {
					style: {transform: "rotate(90deg)"},
					on: {click: event => {
						const idx = d.editing.filters.indexOf(_filter);		
						d.editing.filters.splice(idx, 1);
						d.editing.filters.splice(Math.max(0, idx - 1), 0 , _filter);
						applyFilters(d.editing);
						setTimeout(() => event.target.closest(".param-section").scrollIntoView({block: "center", behaviour: "smooth"}), 20);
					}},
				}, "‹"),
				h("button",{
					style: {transform: "rotate(90deg)"},
					on: {click: event => {
						const idx = d.editing.filters.indexOf(_filter);		
						d.editing.filters.splice(idx, 1);
						d.editing.filters.splice(Math.min(d.editing.filters.length, idx + 1), 0 , _filter);
						applyFilters(d.editing);
						setTimeout(() => event.target.closest(".param-section").scrollIntoView({block: "center", behaviour: "smooth"}), 20);
					}
				}}, "›"),
				h("button", () => ({on: {click: () => removeFilter(d, filter)}}), "×"),
			]),
		]),
		...(ui ? ui(h, d, filter.$$watch) : []),
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
			h("div", {class: ["button-group", "order-button-group"]}, h => [
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
			h($button, {click: () => reloadSpriteImage(d, d.editing)}, "Заменить изображение"),
		])
	];
}

async function applyFilters (sprite) {
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
};


async function removeSprite (d, sprite) {
	const idx = d.sprites.order.indexOf(sprite.id);
	d.sprites.order.splice(idx, 1);
	delete d.sprites.index[sprite.id];
	d.editing = null;
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
		addFilter(d, sprite, "start");
		d.sprites.index[sprite.id] = sprite;
		d.sprites.order.push(sprite.id);

	}
	d.editing = sprite;
	
	if (add) {
		applyFilters(d.editing);
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
								h("img", null, () => (console.log("reset"), {attrs: {src: d.sprites.index[key].dest2x.url, width: d.sprites.index[key].dest2x.width}}))
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
						d.editing = null;
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
