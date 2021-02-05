import {get as _get, set as _set} from "./access.mjs";

function factory (mode) {
	return (oldVnode, vnode) => {
		const elm = vnode.elm;
		const model = vnode.data.model;// Object.getOwnPropertyDescriptor(vnode.data, "model");
		const tagName = elm.tagName.toLowerCase();
		const type = elm.getAttribute("type");
		const change = tagName === "select" || type === "checkbox";
		
		if ("value" in vnode.data) {
			elm.setAttribute("value", vnode.data.value);
		}		

		if (model) {
			if (oldVnode && oldVnode.data.modelData) {
				elm.removeEventListener(change ? "change" : "input", oldVnode.data.modelData.inputHandler);
			}
			const initial = !vnode.data.modelData;

			vnode.data.modelData = {
				inputHandler: event => {
					if (type === "checkbox") {
						model.set(elm.checked, elm);
					}
					else {
						model.set(elm.value, elm);
					}
				},
			}
			elm.addEventListener(change ? "change" : "input", vnode.data.modelData.inputHandler);
			if (initial) {
				let val = model.get(elm);
				if (type === "checkbox") {
					elm.checked = !!val;
				}
				else {
					elm.value = val == null ? "" : val;
				}
				if (change && mode === "create") {
					elm.dispatchEvent(new Event("change"));
				}
			}
		}
	}
}

export function mod (src, path, init) {
	if (init) {
		_set(src, path, init(src));
	}
	return {
		get: () => _get(src, path),
		set: (value) => _set(src, path, value),
	};
}

export default {create: factory("create"), update: factory("update")};
