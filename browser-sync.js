module.exports = {
    // host: 'my.awesome.host',
	ui: false,
	open: false,
	notify: false,
	// online: false,
	// localOnly: true,
	host: "sprite-editor.loc",
	port: 8121,
	files: "./",
	// watchEvents: ["change", "add", "unlink"],
	reloadDebounce: 10,
	ghostMode: {
		clicks: false,
		forms: false,
		scroll: false,
	},
	// watchOptions: {
	// 	awaitWriteFinish: true,
	// },
	single: true,
	server: {
		baseDir: "./",
		directory: true,

		index: "index.html",
	},
}
