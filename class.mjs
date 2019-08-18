
function updateClass (oldVnode, vnode) {
	let cur; let name; const elm = vnode.elm;
	let oldClass = oldVnode.data.class;
	let klass = vnode.data.class;

	if (!oldClass && !klass) {return;}
	if (oldClass === klass) {return;}
	oldClass = oldClass || {};
	klass = klass || {};
	if (typeof oldClass === "string") {
		oldClass = {[oldClass]: true};		
	}

	if (typeof klass === "string") {
		klass = {[klass]: true};		
	}

	if (Array.isArray(oldClass)) {
		oldClass = oldClass.reduce((res, i) => (res[i] = true, res), {});
	}
	if (Array.isArray(klass)) {
		klass = klass.reduce((res, i) => (res[i] = true, res), {});
	}

	for (name in oldClass) {
		if (!klass[name]) {
			elm.classList.remove(name);
		}
	}
	for (name in klass) {
		cur = klass[name];
		if (cur !== oldClass[name]) {
			elm.classList[cur ? "add" : "remove"](name);
		}
	}
}

export default {create: updateClass, update: updateClass};
