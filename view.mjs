import {default as activeData, observable, reaction, updatable} from "./active-data.mjs";//"//cdn.jsdelivr.net/npm/active-data@2.0.10/src/active-data.js";
import {default as model, mod} from "./model.mjs";
import {flattenDeep} from "./common.mjs";
import classModule from "./class.mjs";

const $patch = snabbdom.init([
	...Object.keys(window).filter(i => i.startsWith("snabbdom_")).map(i => window[i].default),
	classModule,
	model,
]);

function getParams (params, key) {
	params = (typeof params === "function" ? params() : params) || {};
	// params = await params;
	params.key = key;
	delete params.hook;
	return params;
}

const cacheableMap = new WeakMap();
export function cacheable (toCache) {
	if (cacheableMap.has(toCache)) {
		return cacheableMap.get(toCache);
	}

	const deferred = {};	
	let result = updatable(() => {
		result.resolved = false;
		const {resolve, reject} = deferred;		
		let val = toCache;
		if (typeof val === "function") {
			val = val();
		}		
		if (val && typeof val.then === "function") {
			resolve(val.then((val) => {
				result.resolved = true;
				result.value = val;							
			}));
		}
		else {
			result.value = val;
			result.resolved = true;
			resolve(result.value);
		}		
		return result;
	});
	result = observable(result);

	const reset = () => {		
		result.promise = new Promise((resolve, reject) => {
			deferred.resolve = resolve;
			deferred.reject = reject;
		});
		result.then = result.promise.then.bind(result.promise);
		result.value = undefined;
		result.resolved = false;
	}	
	
	result.update = () => {
		reset();
		result.invalidate();
		return result();
	};
	reset();
	cacheableMap.set(toCache, result);
	return result;
}

export {observable};

export function h (type, key, params, content) {

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
		let vnode;
		if (typeof type === "function" && type.prototype instanceof ViewComponent) {
			const component = type;
			type = type.name;
			let instance;
			vnode = cache.get(type, key);
			if (!vnode) {
				let staticParams;
				let staticContent;
				if (typeof params === "function") {
					staticParams = params();
					reaction(() => {
						activeData.ignoreWrite = true;
						instance && instance.setParams(params());
						activeData.ignoreWrite = false;
					});
				}
				else {
					staticParams = params;
				}
				if (typeof content === "function") {
					staticContent = content();
					reaction(() => {
						activeData.ignoreWrite = true;
						instance && instance.setContent(content());
						activeData.ignoreWrite = false;
					});
				}
				else {
					staticContent = content;
				}
				instance = new component(h, key, staticParams, staticContent);
				vnode = instance.render()(vnode);
			}			
		}
		else {
			vnode = cache.get(type, key);
			if (!vnode) {
				vnode = h(type, key, params, content)(vnode);
				cache.set(type, key, vnode);
			}
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
					let cont = content(childH);
					// if (Array.isArray(cont)) {
					// 	cont = flattenDeep(cont);						
					// }
					contentVNode = $patch(contentVNode, snabbdom.h(type, contentVNode.data, cont));
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


export class ViewComponent {
	constructor (h, key, params, content) {
		this.d = observable({});
		this.key = key;
		this.d.params = params || {};
		this.d.content = content;
		this.render = () => this.view(h, this.d);
	}
	setParams (params) {
		this.d.params = params;		
	}
	setContent (content) {
		this.d.content = content;
	}
	view (h, d) {
		return;
	}
}

export default h;