define('qm8t', ['ko', 'underscore'], function (ko, _) {
    var res = function () {
        this.init.apply(this, arguments);
    };
    _.extend(res.prototype, {
        init: function (options) {
            var self = this;
            _.extend(self, {
                _owner: options.owner || {},
                _stateListeners: {sync: [], async: []},
                _currentStates: {},
                _stateBinders: {}
            });
            return self;
        },
        bindState: function (stateName) {
            var self = this, a = arguments;
            if (_.isString(stateName))
                return self._stateBinders[stateName] || (self._stateBinders[stateName] = ko.observable(self._syncState(stateName)));
            if (a.length === 2 && _.isArray(a[0]) && _.isArray(a[1]))
                stateName = _.reduce([].concat(a[0]).concat(a[1]), function (res, v) {
                    res[v] = _.contains(a[0], v);
                    return res;
                }, {});
            if (_.isObject(stateName)) {
                var stateKey = _.chain(stateName).map(function (v, k) {
                    return k + ':' + v;
                }).sortBy(function (a) {
                    return a;
                }).value().join(",");
                return self._stateBinders[stateKey] || (self._stateBinders[stateKey] = ko.computed(function () {
                    return _.reduce(stateName, function (res, v, k) {
                        return res && (v ? self.bindState(k)() : !self.bindState(k)());
                    }, true);
                }));
            }

        },
        changeState: function (stateName, value) {
            return this[value ? 'enterState' : 'leaveState'](stateName);
        },
        leaveStates: function (stateName, callback) {
            var self = this, states = {}
            if (_.isArray(stateName)) {
                states.states = stateName;
            } else if (_.isObject(stateName)) {

                states = stateName;
            } else
                debugger;

            if (stateName.states && _.size(stateName.states)) {
                var q = self.startQueue();
                _.each(stateName.states, function (stateN) {
                    q.add(function (next) {
                        self.leaveState(stateN, next);
                    });
                });
                q.runSync(function () {
                    callback && callback();
                });
            } else
                callback && callback();

            return self;
        },
        leaveState: function (stateName, callback) {
            var self = this;
            self._isInState(stateName)
                    ? self._changeState(stateName, true, function () {
                        self._syncState(stateName, false);
                        callback && callback();
                    })
                    : callback && callback();
            return self;
        },
        enterState: function (stateName, callback) {
            var self = this;
            self._changeState(stateName, false, function () {
                self._syncState(stateName, true);
                callback && callback();
            });
            return self;
        },
        startQueue: function () {
            var q = {
                items: [],
                add: function (item) {
                    q.items.push(item);
                    return q;
                },
                runAsync: function (next) {
                    var counter = q.items.length, check = function () {
                        if (--counter <= 0)
                            next();
                    };
                    counter ? _.each(q.items, function (item) {
                        item(check);
                    }) : check();
                },
                runSync: function (next) {
                    var items = q.items, check = function () {
                        if (items.length)
                            items.shift()(check);
                        else
                            next();
                    };
                    check();
                }
            };
            _.each(arguments, q.add);
            return q;
        },
        // <editor-fold desc="Event handlers">
        onBeforeStateOff: function (stateName, callback) {
            return this._onStateChange(stateName, callback, {
                sync: true,
                off: true
            });
        },
        onStateOff: function (stateName, callback) {
            return this._onStateChange(stateName, callback, {
                sync: false,
                off: true
            });
        },
        onBeforeStateOn: function (stateName, callback) {
            return this._onStateChange(stateName, callback, {
                sync: true,
                off: false
            });
        },
        onStateOn: function (stateName, callback) {
            return this._onStateChange(stateName, callback, {
                sync: false,
                off: false
            });
        },
        // </editor-fold>
        // <editor-fold desc="Private methods">
        _isInState: function (stateName) {
            var self = this;
            return !_.isUndefined(self._currentStates[stateName]);
        },
        _syncState: function (stateName, value) {
            var self = this;
            if (arguments.length > 1)
                value ? self._currentStates[stateName] = value : delete self._currentStates[stateName];
            var res = self._isInState(stateName);
            self._stateBinders[stateName] && self._stateBinders[stateName](res);
            return res;
        },
        _changeState: function (stateName, off, callback) {
            var self = this,
                    findListeners = function (d) {
                        return _.filter(self._stateListeners[d], function (e) {
                            return e.stateName === stateName && e.off === off;
                        });
                    },
                    listenersSync = findListeners('sync'),
                    veryNext = function () {
                        _.each(findListeners('async'), function (stateListener) {
                            stateListener.callback();
                        });
                        callback();
                    };
            if (_.size(listenersSync) > 0) {
                var q = self.startQueue();
                _.each(listenersSync, function (stateListener) {
                    q.add(stateListener.callback);
                });
                q.runAsync(veryNext);
                return self;
            }
            return veryNext();
        },
        _onStateChange: function (stateName, callback, options) {
            var self = this, options = options || {};
            if (!_.isFunction(callback))
                throw new Error("'callback' must be function");
            self._stateListeners[options.sync && 'sync' || options.async && 'async' || 'async'].push({
                stateName: stateName,
                callback: callback,
                off: options.off

            });
            return self;
        }
        // </editor-fold>
    });
    return res;
});