import {h, observable, reaction, cacheable, ViewComponent, classList, accessor} from "./view.mjs";
const eachIdx = async (list, cb) => {
    const keys = Object.keys(list);
    for (let idx = 0; idx < keys.length; idx++) {
        await cb(idx);
    }
}

const eachKey = (list, cb) => {
    const keys = Object.keys(list);
    for (let idx = 0; idx < keys.length; idx++) {
        cb(keys[idx]);
    }
}

const each = (list, cb) => {
    const keys = Object.keys(list);
    const result = [];    
    for (let idx = 0; idx < keys.length; idx++) {        
        result.push(cb(accessor(() => list[keys[idx]])));
    }
    return result;
}

class $item extends ViewComponent {
	view (h, d) {
        return h("div", {class: classList("item"), on: {click: () => {
            console.log("click", d.params.value);
        }}}, d.params.value);
    }
}


const d = observable({
    items: sqnc((idx) => ({value: `item value = ${idx}`})).toArray(10),
});

h("div", {class: ["exp"]}, h => [
    ...each(d.items, item => h($item, item)),
    h("button", {attr: {type: "button"}}, "action"),
])(document.querySelector(".ui"));