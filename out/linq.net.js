"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var System;
(function (System) {
    var Linq;
    (function (Linq) {
        function combinePredicates(predicate1, predicate2) {
            return function (x) { return predicate1(x) && predicate2(x); };
        }
        function combineSelectors(selector1, selector2) {
            return function (x) { return selector2(selector1(x)); };
        }
        function toArray(source) {
            var array = [];
            source.forEach(function (item) { return array.push(item); });
            return array;
        }
        var Iterator = (function () {
            function Iterator() {
                this._threadId = 0;
                this.__state = 0;
                this.__current = undefined;
                this._threadId = process.pid;
            }
            Iterator.prototype.dispose = function () {
                this.__current = undefined;
                this.__state = -1;
            };
            Iterator.prototype.getEnumerator = function () {
                if (this._threadId == process.pid && this.__state == 0) {
                    this.__state = 1;
                    return this;
                }
                var duplicate = this.clone();
                duplicate.__state = 1;
                return duplicate;
            };
            Object.defineProperty(Iterator.prototype, "current", {
                get: function () {
                    return this.__current;
                },
                enumerable: true,
                configurable: true
            });
            Iterator.prototype.reset = function () {
                throw new Error("Not Implemented");
            };
            Iterator.prototype.forEach = function (callback) {
                var enumerator = this.getEnumerator();
                while (enumerator.next()) {
                    callback(enumerator.current);
                }
            };
            Iterator.prototype.toArray = function () {
                return toArray(this);
            };
            Iterator.prototype.first = function (predicate) {
                var firstOrUndefined = this.firstOrUndefined(predicate);
                if (typeof firstOrUndefined === "undefined")
                    throw Error("Not found");
                return firstOrUndefined;
            };
            Iterator.prototype.firstOrUndefined = function (predicate) {
                var enumerator = this.getEnumerator();
                while (enumerator.next()) {
                    if (!predicate || predicate(enumerator.current)) {
                        return enumerator.current;
                    }
                }
                return undefined;
            };
            return Iterator;
        }());
        var WhereEnumerableIterator = (function (_super) {
            __extends(WhereEnumerableIterator, _super);
            function WhereEnumerableIterator(source, predicate) {
                _super.call(this);
                this._source = undefined;
                this._predicate = undefined;
                this._enumerator = undefined;
                this._source = source;
                this._predicate = predicate;
            }
            WhereEnumerableIterator.prototype.clone = function () {
                return new WhereEnumerableIterator(this._source, this._predicate);
            };
            WhereEnumerableIterator.prototype.dispose = function () {
                if (this._enumerator && this._enumerator.dispose)
                    this._enumerator.dispose();
                this._enumerator = undefined;
                _super.prototype.dispose.call(this);
            };
            WhereEnumerableIterator.prototype.next = function () {
                switch (this.__state) {
                    case 1:
                        this._enumerator = this._source.getEnumerator();
                        this.__state = 2;
                    case 2:
                        while (this._enumerator.next()) {
                            var item = this._enumerator.current;
                            if (this._predicate(item)) {
                                this.__current = item;
                                return true;
                            }
                        }
                        this.dispose();
                        break;
                }
                return false;
            };
            WhereEnumerableIterator.prototype.select = function (selector) {
                return new WhereSelectEnumerableIterator(this._source, this._predicate, selector);
            };
            WhereEnumerableIterator.prototype.where = function (predicate) {
                return new WhereEnumerableIterator(this._source, combinePredicates(this._predicate, predicate));
            };
            return WhereEnumerableIterator;
        }(Iterator));
        var WhereArrayIterator = (function (_super) {
            __extends(WhereArrayIterator, _super);
            function WhereArrayIterator(source, predicate) {
                _super.call(this);
                this._source = undefined;
                this._predicate = undefined;
                this._index = 0;
                this._source = source;
                this._predicate = predicate;
            }
            WhereArrayIterator.prototype.clone = function () {
                return new WhereArrayIterator(this._source, this._predicate);
            };
            WhereArrayIterator.prototype.next = function () {
                if (this.__state == 1) {
                    while (this._index < this._source.length) {
                        var item = this._source[this._index++];
                        if (!this._predicate || this._predicate(item)) {
                            this.__current = item;
                            return true;
                        }
                    }
                    this.dispose();
                }
                return false;
            };
            WhereArrayIterator.prototype.select = function (selector) {
                return new WhereSelectArrayIterator(this._source, this._predicate, selector);
            };
            WhereArrayIterator.prototype.where = function (predicate) {
                return new WhereArrayIterator(this._source, combinePredicates(this._predicate, predicate));
            };
            return WhereArrayIterator;
        }(Iterator));
        var WhereSelectEnumerableIterator = (function (_super) {
            __extends(WhereSelectEnumerableIterator, _super);
            function WhereSelectEnumerableIterator(source, predicate, selector) {
                _super.call(this);
                this._source = undefined;
                this._predicate = undefined;
                this._selector = undefined;
                this._enumerator = undefined;
                this._source = source;
                this._predicate = predicate;
                this._selector = selector;
            }
            WhereSelectEnumerableIterator.prototype.clone = function () {
                return new WhereSelectEnumerableIterator(this._source, this._predicate, this._selector);
            };
            WhereSelectEnumerableIterator.prototype.dispose = function () {
                if (this._enumerator && this._enumerator.dispose)
                    this._enumerator.dispose();
                this._enumerator = undefined;
                _super.prototype.dispose.call(this);
            };
            WhereSelectEnumerableIterator.prototype.next = function () {
                switch (this.__state) {
                    case 1:
                        this._enumerator = this._source.getEnumerator();
                        this.__state = 2;
                    case 2:
                        while (this._enumerator.next()) {
                            var item = this._enumerator.current;
                            if (!this._predicate || this._predicate(item)) {
                                this.__current = this._selector(item);
                                return true;
                            }
                        }
                        this.dispose();
                        break;
                }
                return false;
            };
            WhereSelectEnumerableIterator.prototype.select = function (selector) {
                return new WhereSelectEnumerableIterator(this._source, this._predicate, combineSelectors(this._selector, selector));
            };
            WhereSelectEnumerableIterator.prototype.where = function (predicate) {
                return new WhereEnumerableIterator(this, predicate);
            };
            return WhereSelectEnumerableIterator;
        }(Iterator));
        var WhereSelectArrayIterator = (function (_super) {
            __extends(WhereSelectArrayIterator, _super);
            function WhereSelectArrayIterator(source, predicate, selector) {
                _super.call(this);
                this._source = undefined;
                this._predicate = undefined;
                this._selector = undefined;
                this._index = 0;
                this._source = source;
                this._predicate = predicate;
                this._selector = selector;
            }
            WhereSelectArrayIterator.prototype.clone = function () {
                return new WhereSelectArrayIterator(this._source, this._predicate, this._selector);
            };
            WhereSelectArrayIterator.prototype.next = function () {
                if (this.__state == 1) {
                    while (this._index < this._source.length) {
                        var item = this._source[this._index++];
                        if (!this._predicate || this._predicate(item)) {
                            this.__current = this._selector(item);
                            return true;
                        }
                    }
                    this.dispose();
                }
                return false;
            };
            WhereSelectArrayIterator.prototype.select = function (selector) {
                return new WhereSelectArrayIterator(this._source, this._predicate, combineSelectors(this._selector, selector));
            };
            WhereSelectArrayIterator.prototype.where = function (predicate) {
                return new WhereEnumerableIterator(this, predicate);
            };
            return WhereSelectArrayIterator;
        }(Iterator));
        var Enumerable = (function () {
            function Enumerable(source) {
                this.getSource = function () { return source; };
            }
            Enumerable.prototype.getSource = function () {
                return undefined;
            };
            Enumerable.prototype.getEnumerator = function () {
                return new WhereArrayIterator(this.getSource(), null).getEnumerator();
            };
            Enumerable.prototype.where = function (predicate) {
                return new WhereArrayIterator(this.getSource(), predicate);
            };
            Enumerable.prototype.select = function (selector) {
                return new WhereSelectArrayIterator(this.getSource(), null, selector);
            };
            Enumerable.prototype.first = function (predicate) {
                return new WhereArrayIterator(this.getSource(), predicate).first();
            };
            Enumerable.prototype.firstOrUndefined = function (predicate) {
                return new WhereArrayIterator(this.getSource(), predicate).firstOrUndefined();
            };
            Enumerable.prototype.forEach = function (callback) {
                this.getSource().forEach(function (item) { return callback(item); });
            };
            Enumerable.prototype.toArray = function () {
                return this.getSource();
            };
            return Enumerable;
        }());
        Linq.Enumerable = Enumerable;
    })(Linq = System.Linq || (System.Linq = {}));
})(System = exports.System || (exports.System = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlucS5uZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvbGlucS5uZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBaUIsTUFBTSxDQTBZdEI7QUExWUQsV0FBaUIsTUFBTSxFQUFDLENBQUM7SUFnR3JCLElBQWlCLElBQUksQ0F5U3BCO0lBelNELFdBQWlCLElBQUksRUFBQyxDQUFDO1FBQ25CLDJCQUFvQyxVQUF3QyxFQUFFLFVBQXdDO1lBQ2xILE1BQU0sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQTlCLENBQThCLENBQUM7UUFDL0MsQ0FBQztRQUVELDBCQUFxRCxTQUF1QyxFQUFFLFNBQXVDO1lBQ2pJLE1BQU0sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBdkIsQ0FBdUIsQ0FBQztRQUN4QyxDQUFDO1FBRUQsaUJBQW9CLE1BQW1CO1lBQ25DLElBQUksS0FBSyxHQUFRLEVBQUUsQ0FBQztZQUNwQixNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBaEIsQ0FBZ0IsQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFDakIsQ0FBQztRQUVEO1lBS0k7Z0JBSlEsY0FBUyxHQUFXLENBQUMsQ0FBQztnQkFDcEIsWUFBTyxHQUFXLENBQUMsQ0FBQztnQkFDcEIsY0FBUyxHQUFZLFNBQVMsQ0FBQztnQkFHckMsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2pDLENBQUM7WUFJTSwwQkFBTyxHQUFkO2dCQUNJLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO2dCQUMzQixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FB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