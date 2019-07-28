import {get, set} from "./access.mjs";

function factory (mode) {
	return (oldVnode, vnode) => {
		const elm = vnode.elm;
		const model = vnode.data.model;// Object.getOwnPropertyDescriptor(vnode.data, "model");
		const tagName = elm.tagName.toLowerCase();

		if ("value" in vnode.data) {
			elm.setAttribute("value", vnode.data.value);
		}

		if (model && !vnode.data.modelData) {
			vnode.data.modelData = {
				inputHandler: event => {
					model.set(elm.value, elm);
				},
			}
			switch (tagName) {
				case "select":
					elm.addEventListener("change", vnode.data.modelData.inputHandler);
					break;
				default:
					elm.addEventListener("input", vnode.data.modelData.inputHandler);
					break;
			}
			let val = model.get(elm);
			elm.value = val == null ? "" : val;
			if (tagName === "select" && mode === "create") {
				elm.dispatchEvent(new Event("change"));
			}
		}
	}
}

export function mod (src, path) {
	return {
		get: () => get(src, path),
		set: (value) => set(src, path, value),
	};
}

export default {create: factory("create"), update: factory("update")};
