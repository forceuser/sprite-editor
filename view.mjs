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

export {observable, reaction};

function eachCB (list) {
	list.forEach(cb => cb());
	list.length = 0;
}

export function h (type, key, params, content) {
	if (key != null && typeof key !== "string") {
		content = params;
		params = key;
		key = null;
	}
	
	const cache = {
		data: {},
		dataNext: {},
		start () {
			this.idx = 0;
			this.dataNext = {};
		},
		end () {
			Object.keys(this.data).forEach(key => {
				const cached = this.data[key]
				if (!this.dataNext.hasOwnProperty(key) && cached.instance) {
					cached.instance.destroy();
				}
			})
			this.data = this.dataNext;
		},
		get (type, key) {
			this.idx++;			
			const $key = `${type}:${key}`;
			const result = this.data[$key];
			if (result) {
				this.dataNext[$key] = result;
			}
			return result;
		},
		set (type, key, value) {
			const $key = `${type}:${key}`;
			this.dataNext[$key] = value;
		}
	}

	const childH = (type, key, params, content) => {
		if (key != null && typeof key !== "string") {
			content = params;
			params = key;
			key = null;
		}

		key = key == null ? `index:${cache.idx + 1}` : key;
		let cached;
		if (typeof type === "function" && type.prototype instanceof ViewComponent) {
			const component = type;
			type = type.name;
			cached = cache.get(type, key);
			if (!cached) {
				cached = {};
				cached.instance = new component(h, key, params, content);
				cached.vnode = cached.instance.render()(cached.vnode);
				cache.set(type, key, cached);
			}			
		}
		else {
			cached = cache.get(type, key);
			if (!cached) {
				cached = {};
				cached.vnode = h(type, key, params, content)(cached.vnode, childH.onremove);
				cache.set(type, key, cached);
			}
		}
		return cached && cached.vnode;
	}

	childH.onremove = [];

	let staticContent;
	if (typeof content !== "function") {
		staticContent = content;
	}

	return (vnode, onremove) => {
		let isStaticParams = typeof params !== "function";

		const create = (emptyNode, vnode) => {
			if (typeof content === "function") {
				let contentVNode = vnode;				
				const updatable = reaction(() => {
					cache.start();
					try {
						let cont = content(childH);
						contentVNode = $patch(contentVNode, snabbdom.h(type, contentVNode.data, cont));
					}
					catch (error) {
						console.log("Error in view:", error);
					}	
					cache.end();
				});		
				onremove && onremove.push(() => {
					// console.log("updatable uninit -- content", vnode);
					updatable.uninit();
				});
			}
			let paramsVNode = vnode;
			if (!isStaticParams) {
				const updatable = reaction(() => {
					try {
						const p = getParams(params, key);
						// console.log("patch params", key);
						paramsVNode = $patch(paramsVNode, snabbdom.h(type, p, staticContent));
					}
					catch (error) {
						console.log("Error in view:", error);
					}
				});
				onremove && onremove.push(() => {
					// console.log("updatable uninit -- params", vnode);
					updatable.uninit();
				});
			}
			onremove && onremove.push(() => {
				// console.log("uninit childs", vnode, childH.onremove.length);
				eachCB(childH.onremove);
			});
		}

		const remove = (vnode, removeCallback) => {
			console.log("remove", vnode);
			eachCB(childH.onremove);
			removeCallback();
		}

		let $params = {key, hook: {create, remove}};
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


export function accessor (getterFn, setterFn) {
	return new Proxy ({}, {
		get: (target, propertyKey, context) => {
			if (getterFn) {
				const value = getterFn(propertyKey);
				return typeof value === "object" ? value[propertyKey] : value;
			}
			return undefined;
		},
		set: (target, propertyKey, value, context) => {
			if (setterFn) {
				setterFn(propertyKey, value);
			}
		},
	});
}

export class ViewComponent {
	constructor (h, key, params, content) {
		let staticParams;
		let staticContent;
		this.onremove = [];
		if (typeof params === "function") {
			// staticParams = params();
			const updatable = reaction(() => {			
				try {
					const p = params();											
					this && this.setParams(p);
				}
				catch (error) {
					console.log("Error in view:", error);
				}				
			});
			this.onremove.push(() => updatable.uninit());
		}
		else {
			staticParams = params;
		}
		if (typeof content === "function") {
			// staticContent = content();
			const updatable = reaction(() => {	
				try {
					const c = content();						
					this && this.setContent(c);		
				}
				catch (error) {
					console.log("Error in view:", error);
				}					
			});
			this.onremove.push(() => updatable.uninit());
		}
		else {
			staticContent = content;
		}

		this.d = observable({});
		this.key = key;
		this.d.params = staticParams || {};
		this.d.content = staticContent;
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
	destroy () {
		eachCB(this.onremove);
	}
}

export function classList (...args) {
	const result = {};
	args.forEach(arg => {
		if (typeof arg === "string") {
			result[arg] = true;
		}
		else if (Array.isArray(arg)) {
			arg.forEach(c => result[c] = true);
		}
		else {
			Object.assign(result, arg);
		}
	});
	return result;
}

export default h;