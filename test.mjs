import {default as activeData, observable, reaction, updatable} from "./active-data.mjs";//"//cdn.jsdelivr.net/npm/active-data@2.0.10/src/active-data.js";

const d = observable({
    x: {value: 1},
    y: () => ({value: d.z}),
});

reaction(() => {
    d.x = d.y();
    console.log(d.x);
});

window.d = d;