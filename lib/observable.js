if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        var F = function () {
        };
        F.prototype = o;
        return new F();
    };
}

var observable = {};

observable.observable = function () {
    var that = {}, subscribers = {};
    var subscriberCounter = 0;

    that.subscribe = function (eventType, fn) {
        if (typeof eventType == 'object') { // assume it's an array
            var eventTypes = eventType;
            for ( var i = 0; i < eventTypes.length; i++) {
                subscriberCounter++;
                var eventType = eventTypes[i];
                if (!subscribers[eventType]) {
                    subscribers[eventType] = {};
                }
                subscribers[eventType][subscriberCounter] = fn;
            }
        } else {
            subscriberCounter++;
            if (!subscribers[eventType]) {
                subscribers[eventType] = {};
            }
            subscribers[eventType][subscriberCounter] = fn;
            return subscriberCounter;
        }
    };
    
    that.unsubscribe = function(eventType, subscriptionId) {
        delete subscribers[eventType][subscriptionId];
    }

    that.fire = function (eventType) {
        if (!subscribers[eventType]) { // No subscribers to this event type
            return;
        }
        //var subscriberLength = subscribers[eventType].length;
        for (var sid in subscribers[eventType]) {
            if(subscribers[eventType].hasOwnProperty(sid)) {
                subscribers[eventType][sid].apply(null, arguments);
            }
        }
    };

    return that;
};

observable.list = function (items, makeItemsObservable) {
    var that = observable.observable();
    items = items || [];
    if (makeItemsObservable) {
        for ( var i = 0; i < items.length; i++) {
            if (!items[i].subscribe) {
                items[i] = observable.object(items[i]);
            }
        }
    }

    that.add = function (elt) {
        if (makeItemsObservable && !elt.subscribe) {
            elt = observable.object(elt);
        }
        items.push(elt);
        that.fire("add", elt);
    };

    that.addAll = function (arr) {
        for ( var i = 0; i < arr.length; i++) {
            var elt = arr[i];
            if (makeItemsObservable && !elt.subscribe) {
                elt = observable.object(elt);
            }
            items.push(elt);
        }
        that.fire("addAll", arr);
    };

    that.removeAtIndex = function (idx, fireevt) {
        var part1 = items.slice(0, idx);
        var part2 = items.slice(idx + 1);
        items = part1.concat(part2);
        if (fireevt) {
            that.fire("removeAtIndex", idx);
        }
    };

    that.remove = function (elt) {
        var idx = $.inArray(elt, items);
        if (idx > -1) {
            that.removeAtIndex(idx, false);
            that.fire("remove", elt);
        }
    };

    that.get = function (idx) {
        that.fire("get", idx);
        return items[idx];
    };

    that.set = function (idx, value) {
        that.fire("set", idx, value);
        items[idx] = value;
    };

    that.array = function () {
        return items;
    };

    that.each = function (fn) {
        for ( var i = 0; i < items.length; i++) {
            fn(items[i]);
        }
    };

    that.length = function () {
        return items.length;
    }

    return that;
};

observable.object = function (o, observedProperties) {
    var that = observable.observable();
    var delegatedProperties = [];
    if (!observedProperties) {
        observedProperties = [];
        for ( var p in o) {
            if (o.hasOwnProperty(p) && typeof o[p] !== 'function') {
                observedProperties.push(p);
            } else if(typeof o[p] === 'function') {
                delegatedProperties.push(p);
            }
        }
    }
    for ( var i = 0; i < observedProperties.length; i++) {
        (function () { // Enforce a scope in order not to put 'p' in
            // getter/setter
            // closure
            var p = observedProperties[i];
            that.__defineSetter__(p, function (val) {
                o[p] = val;
                that.fire("set", p, val);
            });
            that.__defineGetter__(p, function () {
                that.fire("get", p);
                return o[p];
            });
        })();
    }
    for ( var i = 0; i < delegatedProperties.length; i++) {
        (function () { // Enforce a scope in order not to put 'p' in
            var p = delegatedProperties[i];
            that.__defineGetter__(p, function () {
                return o[p];
            });
        })();
    }
    return that;
};
