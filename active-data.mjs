/* global process */

const privateMap = new WeakMap();
const initPrivate = target => privateMap.set(target, {});
const $ = target => privateMap.get(target);

/**
 * Reactive data manager that observes data changes and performs actions in response.
 * Observation is lazy, data is updated only when required.
 *
 * @param {ManagerOptions} [options] Manager options
 */
export class Manager {
	constructor (options) {
		const manager = this;
		initPrivate(manager);
		const $$ = $(manager);
		$$.gen = 0;
		$$.intentToRun = 0;
		$$.dataSourceKey = Symbol("dataSource");
		$$.observables = new WeakMap();
		$$.options = {
			enabled: true,
			immediateReaction: false,
			maxIterations: 10,
			watchKey: "$$watch",
			watchDeepKey: "$$watchDeep",
			afterRun: null,
			timeLimit: 50,
			getTime: typeof performance !== "undefined" ? () => performance.now() : () => Date.now(),
		};
		$$.callStack = [];
		$$.reactionsToUpdate = new Set();

		manager.setOptions(options);
		manager.makeObservable = manager.makeObservable.bind(manager);
		manager.makeReaction = manager.makeReaction.bind(manager);
		manager.makeComputed = manager.makeComputed.bind(manager);
		manager.makeUpdatable = manager.makeUpdatable.bind(manager);
		manager.mapProperties = manager.mapProperties.bind(manager);

		manager.isObservable = manager.isObservable.bind(manager);
		manager.getDataSource = manager.getDataSource.bind(manager);
		// aliases
		manager.observable = manager.makeObservable;
		manager.reaction = manager.makeReaction;
		manager.computed = manager.makeComputed;
		manager.updatable = manager.makeUpdatable;
		/* istanbul ignore next */
		if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
			manager.$$ = $$;
		}
	}

	/**
	 * Maps properties from `source` to `target`
	 *
	 * @param {Observable} source
	 * @param {Observable} target
	 * @param {(Array|String)} [propertyKeys] property keys of `source` object to map to `target` object, if not set then all keys will be mapped
	 */
	mapProperties (source, target, propertyKeys) {
		[].concat(propertyKeys || Object.keys(source)).forEach(propertyKey => {
			Object.defineProperty(target, propertyKey, {
				enumerable: true,
				get () {
					return Reflect.get(source, propertyKey, this);
				},
				set (value) {
					return Reflect.set(source, propertyKey, value, this);
				},
			});
		});
	}

	/**
	 * Dynamically sets the options of the data manager
	 *
	 * @param {ManagerOptions} [options] Manager options
	 */
	setOptions (options = {}) {
		$(this).options = Object.assign($(this).options, options);
	}

	/**
	 * Gets the options of the data manager
	 *
	 * @return {ManagerOptions} Manager options
	 */
	getOptions () {
		return Object.assign({}, $(this).options);
	}

	/**
	 * Creates {@link Observable} object for the specified dataSource
	 *
	 * @param {(Object|Array)} dataSource data source
	 * @return {Observable} observable object
	 */
	makeObservable (dataSource) {
		const manager = this;
		const $$ = $(manager);
		if (!dataSource) {
			return dataSource;
		}
		if (
			dataSource.constructor !== Object
			&&	dataSource.constructor !== Array
			&&	typeof dataSource !== "function"
		) {
			return dataSource;
		}

		if (manager.isObservable(dataSource)) {
			return dataSource;
		}
		const isArray = Array.isArray(dataSource);
		let observable = $$.observables.get(dataSource);
		if (!observable) {
			const toUpdate = new Map();
			const computedProperties = {};

			Object.keys(dataSource).forEach(propertyKey => {
				const propertyDescriptor = Object.getOwnPropertyDescriptor(dataSource, propertyKey);
				if (propertyDescriptor && typeof propertyDescriptor.get === "function") {
					computedProperties[propertyKey] = manager.makeUpdatable(propertyDescriptor.get);
				}
			});

			const invalidateDeps = updatableState => {
				updatableState.invalidIteration = true;
				updatableState.onInvalidate && updatableState.onInvalidate();
				if (updatableState.valid) {
					updatableState.valid = false;
					updatableState.deps.forEach(updatableState =>
						invalidateDeps(updatableState)
					);
				}
				updatableState.deps.clear();
			};

			const initUpdates = propertyKey => {
				const updatableStates = new Set();
				toUpdate.set(propertyKey, updatableStates);
				return updatableStates;
			};
			let watchDeepSection = false;
			const registerRead = (updatableState, propertyKey) => {
				const currentKey = propertyKey === $$.options.watchDeepKey ? $$.options.watchKey : propertyKey;
				if (propertyKey === $$.options.watchDeepKey) {
					if (watchDeepSection) {
						return;
					}
					watchDeepSection = true;
					Object.keys(dataSource).forEach(key => {
						if (typeof dataSource[key] === "object") {
							const obs = manager.makeObservable(dataSource[key]);
							obs[$$.options.watchDeepKey];
						}
					});
					watchDeepSection = false;
				}
				if (currentKey === $$.options.watchKey) {
					Object.keys(computedProperties).forEach(key => {
						computedProperties[key].call(observable);
					});
				}

				const updatableStates = toUpdate.get(currentKey) || initUpdates(currentKey);
				if (!updatableStates.has(updatableState)) {
					updatableStates.add(updatableState);
					updatableState.uninitMap.set(dataSource, updatableState => {
						updatableStates.delete(updatableState);
						if (updatableStates.size === 0) {
							toUpdate.delete(currentKey);
						}
					});
				}
			};

			const ctrl = {toUpdate, dataSource, registerRead};

			const updateProperty = (propertyKey) => {
				const invalidatorFn = updatableState => invalidateDeps(updatableState);
				if (propertyKey == null) {
					[...ctrl.toUpdate.values()]
						.forEach(updatableStates => updatableStates.forEach(invalidatorFn));
				}
				else {
					const updatableStates = ctrl.toUpdate.get(propertyKey);
					updatableStates && updatableStates.forEach(invalidatorFn);
					const updatableStatesWatch = ctrl.toUpdate.get($$.options.watchKey);
					updatableStatesWatch && updatableStatesWatch.forEach(invalidatorFn);
				}

				if (!$$.inRunSection && $$.intentToRun === 1 && !manager.ignoreWrite) {
					if ($$.options.immediateReaction) {
						manager.run();
					}
					else {
						manager.runDeferred();
					}
				}
			};

			observable = new Proxy(dataSource, {
				get: (target, propertyKey, context) => {
					if (propertyKey === $$.dataSourceKey) {
						return dataSource;
					}

					let updatableState;
					if ($$.callStack.length) {
						updatableState = $$.callStack[$$.callStack.length - 1];
						registerRead(updatableState, propertyKey);
					}

					if (
						propertyKey === $$.options.watchKey ||
						propertyKey === $$.options.watchDeepKey
					) {
						return context;
					}

					const value = Reflect.get(target, propertyKey, context);
					if (isArray && typeof value === "function" && propertyKey !== "constructor") {
						return new Proxy(value, {
							apply: (target, thisArg, argumentsList) => {
								if (["copyWithin", "fill", "pop", "push", "reverse", "shift", "sort", "splice", "unshift"].includes(propertyKey)) {
									$$.intentToRun++;
									try {
										updateProperty();
									}
									finally {
										$$.intentToRun--;
									}
									return target.apply(dataSource, argumentsList);
								}
								return target.apply(thisArg, argumentsList);
							},
						});
					}

					if (typeof value === "object") {
						return manager.makeObservable(value);
					}
					return value;
				},
				set: (target, propertyKey, value, context) => {

					const oldValue = Reflect.get(target, propertyKey, context);
					if (
						value !== oldValue ||
						(Array.isArray(target) && propertyKey === "length")
					) {
						$$.intentToRun++;
						try {
							Reflect.set(target, propertyKey, value, context);
							updateProperty(propertyKey);
						}
						finally {
							$$.intentToRun--;
						}
					}
					return true;
				},
				defineProperty: (target, propertyKey, propertyDescriptor) => {
					if (propertyDescriptor && typeof propertyDescriptor.get === "function") {
						computedProperties[propertyKey] = manager.makeUpdatable(propertyDescriptor.get);
					}
					return Reflect.defineProperty(target, propertyKey, propertyDescriptor);
				},
				deleteProperty: (target, propertyKey) => {
					$$.intentToRun++;
					try {
						if (propertyKey in computedProperties) {
							delete computedProperties[propertyKey];
						}
						updateProperty(propertyKey);
					}
					finally {
						$$.intentToRun--;
					}
					return Reflect.deleteProperty(target, propertyKey);
				},
			});
			$$.observables.set(dataSource, observable);
		}
		return observable;
	}

	/**
	 * Creates {@link UpdatableFunction}
	 * Used for internal purposes
	 *
	 * @param {Function} fn function that will be called from {@link UpdatableFunction}
	 * @param {UpdatableSettings} settings settings for updatable function
	 * @return {UpdatableFunction}
	 */
	makeUpdatable (fn, settings = {}) {
		if (fn.originalFn) {
			return fn;
		}
		const onInvalidate = settings.onInvalidate;
		const onUninit = settings.onUninit;

		const manager = this;
		const $$ = $(manager);

		const updatableState = {
			id: ++$$.gen,
			active: true,
			valid: false,
			onInvalidate,
			onUninit,
			value: undefined,
			deps: new Set(),
			uninitMap: new Map(),
			uninit: () => {
				[...updatableState.uninitMap.values()].forEach(uninitCall => uninitCall(updatableState));
				updatableState.uninitMap.clear();
			},
		};

		const updatableFunction = function () {
			if (!updatableState.active) {
				return fn.call(this, this);
			}
			if (updatableState.computing) {
				console.warn(
					`Detected cross reference inside computed properties!` +
						` "undefined" will be returned to prevent infinite loop`
				);
				return undefined;
			}
			if ($$.callStack.length) {
				updatableState.deps.add($$.callStack[$$.callStack.length - 1]);
			}

			if (updatableState.valid) {
				return updatableState.value;
			}
			updatableState.computing = true;
			updatableState.uninit();

			$$.callStack.push(updatableState);
			try {
				const context = this ? $$.observables.get(this) || this : null;
				updatableState.invalidIteration = false;
				const value = fn.call(context, context);

				updatableState.valid = !updatableState.invalidIteration; // check if it was invalidated inside call
				updatableState.value = value;
				return value;
			}
			finally {
				updatableState.computing = false;
				$$.callStack.pop();
			}
		};
		updatableFunction.uninit = () => {
			updatableState.uninit();
			updatableState.active = false;
			onUninit && onUninit();
		};
		updatableFunction.invalidate = () => {
			updatableState.valid = false;
		};
		updatableFunction.originalFn = fn;
		return updatableFunction;
	}

	/**
	 * Creates computed property
	 *
	 * @param {Object} target The object for which the calculated property will be created
	 * @param {String} propertyKey Name of calculated property
	 * @param {Function} getter The function to be executed when accessing the property
	 * @param {Function} [setter] The function that will be executed when setting the value of the property
	 */
	makeComputed (target, propertyKey, getter, setter) {
		Object.defineProperty(target, propertyKey, {
			enumerable: true,
			configurable: true,
			get: this.makeUpdatable(getter),
			set: setter,
		});
	}

	/**
	 * Creates {@link UpdatableFunction} that will be automatically
	 * executed when one of it's dependencies are changed
	 *
	 * @param {Function} call
	 * Function to call {@link UpdatableFunction}
	 * 'call' will be executed when some of {@link Observable} that was used on previous call
	 * are changed
	 *
	 * @param {Boolean} run
	 * Run function immediately after it's registration
	 * If {@link ManagerOptions.immediateReaction} is not set
	 * then it will be called on the next tick.
	 * @return {UpdatableFunction}
	 */
	makeReaction (call, run = true) {
		const manager = this;
		const $$ = $(manager);
		const updatable = manager.makeUpdatable(call, {
			onInvalidate: () => $$.reactionsToUpdate.add(updatable),
			onUninit: () => $$.reactionsToUpdate.delete(updatable),
		});
		if (run) {
            $$.reactionsToUpdate.add(updatable);
			if ($$.options.immediateReaction) {
				manager.run();
			}
			else {
				manager.runDeferred();
			}
		}
		return updatable;
	}

	/**
	 * Returns original source of {@link Observable}
	 *
	 * @return {(Object|Array)}
	 */
	getDataSource (target) {
		return target[$(this).dataSourceKey];
	}

	/**
	 * Checks if the object is {@link Observable}
	 *
	 * @param {(Observable|Object|Array)} target
	 */
	isObservable (target) {
		return target[$(this).dataSourceKey] != null;
	}

	/**
	 * Executes all reactions that marked with invalid state
	 *
	 * @param {Function} [action]
	 * Changes of {@link Observable} that happens inside 'action' function
	 * will not trigger immediate execution of dependent reactions
	 * If {@link ManagerOptions.immediateReaction} is set then reactions
	 * will be executed after exiting the 'action' function
	 */
	run (action) {
		const manager = this;
		const $$ = $(manager);
		if (!$$.options.enabled) {
			return;
		}
		$$.inRunSection = true;
		try {
			if (typeof action === "function") {
				action();
			}
			$$.runScheduled = false;
			let iterations = 0;
			while ($$.reactionsToUpdate.size) {
				if (iterations > $$.options.maxIterations) {
					$$.reactionsToUpdate.clear();
					throw new Error("Max iterations exceeded!");
				}
				iterations++;
				const startTime = $$.options.getTime();
				const reactions = [...$$.reactionsToUpdate.values()];
				for (const updatable of reactions) {
					$$.reactionsToUpdate.delete(updatable);
					updatable();
					if ($$.options.getTime() - startTime >= $$.options.timeLimit) {
						break;
					}
				}
				if ($$.reactionsToUpdate.size) {
					manager.runDeferred();
				}
			}
			typeof $$.options.afterRun === "function" && $$.options.afterRun();
		}
		finally {
			$$.inRunSection = false;
		}
	}

	/**
	 * Executes all reactions that marked as invalid
	 * Unlike {@link run}, 'runDeferred' makes it not immediately but after 'timeout'
	 *
	 * @param {Function} [action] changes of {@link Observable} that happens inside 'action' function
	 * will not trigger immediate execution of dependent reactions
	 * @param {Number} [timeout=0] reactions execution delay
	 */
	runDeferred (action, timeout = 0) {
		const manager = this;
		const $$ = $(manager);
		if (!$$.options.enabled) {
			return;
		}
		$$.inRunSection = true;
		try {
			if (!$$.runScheduled) {
				$$.runScheduled = setTimeout(() => this.run(), timeout);
			}
			if (typeof action === "function") {
				action();
			}
		}
		finally {
			$$.inRunSection = false;
		}
	}
}

Manager.default = new Manager();
Manager.default.Manager = Manager;

export default Manager.default;
export const observable = Manager.default.observable;
export const reaction = Manager.default.reaction;
export const computed = Manager.default.computed;
export const updatable = Manager.default.updatable;

/**
 * @typedef ManagerOptions
 * @name ManagerOptions
 * @type {Object}
 * @property {Boolean} [immediateReaction=false] if set to `true` reactions will be executed immediately on same event loop
 * otherwise it will be executed after zero timeout (on next event loop)
 * @property {Boolean} [enabled=true] - state of data manager, if it is disabled then reactions will not be executed
 */

/**
 * @typedef Observable
 * @name Observable
 * @description Object or array that will be observed for changes.
 * When the property of type {@link Object} or {@link Array} of {@link Observable}
 * are accessed it automaticaly becomes {@link Observable}
 */

/**
 * @typedef UpdatableFunction
 * @name UpdatableFunction
 * @property {Function} uninit
 * @description function that caches result of its execution and returns cached value if function state is valid
 * function state can be invalidated if some of {@link Observable} objects that were accessed on previous call are changed
 */

/**
  * @typedef UpdatableSettings
  * @name UpdatableSettings
  * @type {Object}
  * @property {Function} onInvalidate callback function that will be executed when UpdatableState of {@link UpdatableFunction} becomes invalid
  * @property {Function} onUninit callback function that will be executed after {@link UpdatableFunction#uninit} is called
  * @description Settings to create {@link UpdatableFunction}
  */
