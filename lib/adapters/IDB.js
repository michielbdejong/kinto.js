"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _base = require("./base.js");

var _base2 = _interopRequireDefault(_base);

var _utils = require("../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var INDEXED_FIELDS = ["id", "_status", "last_modified"];

/**
 * IDB cursor handlers.
 * @type {Object}
 */
var cursorHandlers = {
  all: function all(done) {
    var results = [];
    return function (event) {
      var cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        done(results);
      }
    };
  },
  in: function _in(values, done) {
    var sortedValues = [].slice.call(values).sort();
    var results = [];
    return function (event) {
      var cursor = event.target.result;
      if (!cursor) {
        done(results);
        return;
      }
      var key = cursor.key;
      var value = cursor.value;

      var i = 0;
      while (key > sortedValues[i]) {
        // The cursor has passed beyond this key. Check next.
        ++i;
        if (i === sortedValues.length) {
          done(results); // There is no next. Stop searching.
          return;
        }
      }
      if (key === sortedValues[i]) {
        results.push(value);
        cursor.continue();
      } else {
        cursor.continue(sortedValues[i]);
      }
    };
  }
};

/**
 * Extract from filters definition the first indexed field. Since indexes were
 * created on single-columns, extracting a single one makes sense.
 *
 * @param  {Object} filters The filters object.
 * @return {String|undefined}
 */
function findIndexedField(filters) {
  var filteredFields = Object.keys(filters);
  var indexedFields = filteredFields.filter(function (field) {
    return INDEXED_FIELDS.indexOf(field) !== -1;
  });
  return indexedFields[0];
}

/**
 * Creates an IDB request and attach it the appropriate cursor event handler to
 * perform a list query.
 *
 * Multiple matching values are handled by passing an array.
 *
 * @param  {IDBStore}         store      The IDB store.
 * @param  {String|undefined} indexField The indexed field to query, if any.
 * @param  {Any}              value      The value to filter, if any.
 * @param  {Function}         done       The operation completion handler.
 * @return {IDBRequest}
 */
function createListRequest(store, indexField, value, done) {
  if (!indexField) {
    // Get all records.
    var _request = store.openCursor();
    _request.onsuccess = cursorHandlers.all(done);
    return _request;
  }

  // WHERE IN equivalent clause
  if (Array.isArray(value)) {
    var _request2 = store.index(indexField).openCursor();
    _request2.onsuccess = cursorHandlers.in(value, done);
    return _request2;
  }

  // WHERE field = value clause
  var request = store.index(indexField).openCursor(IDBKeyRange.only(value));
  request.onsuccess = cursorHandlers.all(done);
  return request;
}

/**
 * IndexedDB adapter.
 */

var IDB = function (_BaseAdapter) {
  _inherits(IDB, _BaseAdapter);

  /**
   * Constructor.
   *
   * @param  {String} dbname The database nale.
   */

  function IDB(dbname) {
    _classCallCheck(this, IDB);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(IDB).call(this));

    _this._db = null;
    // public properties
    /**
     * The database name.
     * @type {String}
     */
    _this.dbname = dbname;
    return _this;
  }

  _createClass(IDB, [{
    key: "_handleError",
    value: function _handleError(method) {
      return function (err) {
        var error = new Error(method + "() " + err.message);
        error.stack = err.stack;
        throw error;
      };
    }

    /**
     * Ensures a connection to the IndexedDB database has been opened.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "open",
    value: function open() {
      var _this2 = this;

      if (this._db) {
        return Promise.resolve(this);
      }
      return new Promise(function (resolve, reject) {
        var request = indexedDB.open(_this2.dbname, 1);
        request.onupgradeneeded = function (event) {
          // DB object
          var db = event.target.result;
          // Main collection store
          var collStore = db.createObjectStore(_this2.dbname, {
            keyPath: "id"
          });
          // Primary key (generated by IdSchema, UUID by default)
          collStore.createIndex("id", "id", { unique: true });
          // Local record status ("synced", "created", "updated", "deleted")
          collStore.createIndex("_status", "_status");
          // Last modified field
          collStore.createIndex("last_modified", "last_modified");

          // Metadata store
          var metaStore = db.createObjectStore("__meta__", {
            keyPath: "name"
          });
          metaStore.createIndex("name", "name", { unique: true });
        };
        request.onerror = function (event) {
          return reject(event.target.error);
        };
        request.onsuccess = function (event) {
          _this2._db = event.target.result;
          resolve(_this2);
        };
      });
    }

    /**
     * Closes current connection to the database.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "close",
    value: function close() {
      if (this._db) {
        this._db.close(); // indexedDB.close is synchronous
        this._db = null;
      }
      return _get(Object.getPrototypeOf(IDB.prototype), "close", this).call(this);
    }

    /**
     * Returns a transaction and a store objects for this collection.
     *
     * To determine if a transaction has completed successfully, we should rather
     * listen to the transaction’s complete event rather than the IDBObjectStore
     * request’s success event, because the transaction may still fail after the
     * success event fires.
     *
     * @param  {String}      mode  Transaction mode ("readwrite" or undefined)
     * @param  {String|null} name  Store name (defaults to coll name)
     * @return {Object}
     */

  }, {
    key: "prepare",
    value: function prepare() {
      var mode = arguments.length <= 0 || arguments[0] === undefined ? undefined : arguments[0];
      var name = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var storeName = name || this.dbname;
      // On Safari, calling IDBDatabase.transaction with mode == undefined raises
      // a TypeError.
      var transaction = mode ? this._db.transaction([storeName], mode) : this._db.transaction([storeName]);
      var store = transaction.objectStore(storeName);
      return { transaction: transaction, store: store };
    }

    /**
     * Deletes every records in the current collection.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "clear",
    value: function clear() {
      var _this3 = this;

      return this.open().then(function () {
        return new Promise(function (resolve, reject) {
          var _prepare = _this3.prepare("readwrite");

          var transaction = _prepare.transaction;
          var store = _prepare.store;

          store.clear();
          transaction.onerror = function (event) {
            return reject(new Error(event.target.error));
          };
          transaction.oncomplete = function () {
            return resolve();
          };
        });
      }).catch(this._handleError("clear"));
    }

    /**
     * Executes the set of synchronous CRUD operations described in the provided
     * callback within an IndexedDB transaction, for current db store.
     *
     * The callback will be provided an object exposing the following synchronous
     * CRUD operation methods: get, create, update, delete.
     *
     * Important note: because limitations in IndexedDB implementations, no
     * asynchronous code should be performed within the provided callback; the
     * promise will therefore be rejected if the callback returns a Promise.
     *
     * Options:
     * - {Array} preload: The list of records to make available to
     *   the transaction object get() method (default: [])
     *
     * @example
     * const db = new IDB("example");
     * db.execute(transaction => {
     *   transaction.create({id: 1, title: "foo"});
     *   transaction.update({id: 2, title: "bar"});
     *   transaction.delete(3);
     *   return "foo";
     * })
     *   .catch(console.error.bind(console));
     *   .then(console.log.bind(console)); // => "foo"
     *
     * @param  {Function} callback The operation description callback.
     * @param  {Object}   options  The options object.
     * @return {Promise}
     */

  }, {
    key: "execute",
    value: function execute(callback) {
      var _this4 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? { preload: [] } : arguments[1];

      var preloaded = options.preload.reduce(function (acc, record) {
        acc[record.id] = record;
        return acc;
      }, {});
      return this.open().then(function (_) {
        return new Promise(function (resolve, reject) {
          var _prepare2 = _this4.prepare("readwrite");

          var transaction = _prepare2.transaction;
          var store = _prepare2.store;

          var proxy = transactionProxy(store, preloaded);
          var result = undefined;
          try {
            result = callback(proxy);
          } catch (e) {
            transaction.abort();
            reject(e);
          }
          if (result instanceof Promise) {
            // XXX: investigate how to provide documentation details in error.
            reject(new Error("execute() callback should not return a Promise."));
          }
          // XXX unsure if we should manually abort the transaction on error
          transaction.onerror = function (event) {
            return reject(new Error(event.target.error));
          };
          transaction.oncomplete = function (event) {
            return resolve(result);
          };
        });
      });
    }

    /**
     * Retrieve a record by its primary key from the IndexedDB database.
     *
     * @override
     * @param  {String} id The record id.
     * @return {Promise}
     */

  }, {
    key: "get",
    value: function get(id) {
      var _this5 = this;

      return this.open().then(function () {
        return new Promise(function (resolve, reject) {
          var _prepare3 = _this5.prepare();

          var transaction = _prepare3.transaction;
          var store = _prepare3.store;

          var request = store.get(id);
          transaction.onerror = function (event) {
            return reject(new Error(event.target.error));
          };
          transaction.oncomplete = function () {
            return resolve(request.result);
          };
        });
      }).catch(this._handleError("get"));
    }

    /**
     * Lists all records from the IndexedDB database.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "list",
    value: function list() {
      var _this6 = this;

      var params = arguments.length <= 0 || arguments[0] === undefined ? { filters: {} } : arguments[0];
      var filters = params.filters;

      var indexField = findIndexedField(filters);
      var value = filters[indexField];
      return this.open().then(function () {
        return new Promise(function (resolve, reject) {
          var results = [];

          var _prepare4 = _this6.prepare();

          var transaction = _prepare4.transaction;
          var store = _prepare4.store;

          createListRequest(store, indexField, value, function (_results) {
            // we have received all requested records, parking them within
            // current scope
            results = _results;
          });
          transaction.onerror = function (event) {
            return reject(new Error(event.target.error));
          };
          transaction.oncomplete = function (event) {
            return resolve(results);
          };
        });
      }).then(function (results) {
        // The resulting list of records is filtered and sorted.
        var remainingFilters = Object.assign({}, filters);
        // If `indexField` was used already, don't filter again.
        delete remainingFilters[indexField];
        // XXX: with some efforts, this could be fully implemented using IDB API.
        return (0, _utils.reduceRecords)(remainingFilters, params.order, results);
      }).catch(this._handleError("list"));
    }

    /**
     * Store the lastModified value into metadata store.
     *
     * @override
     * @param  {Number}  lastModified
     * @return {Promise}
     */

  }, {
    key: "saveLastModified",
    value: function saveLastModified(lastModified) {
      var _this7 = this;

      var value = parseInt(lastModified, 10) || null;
      return this.open().then(function () {
        return new Promise(function (resolve, reject) {
          var _prepare5 = _this7.prepare("readwrite", "__meta__");

          var transaction = _prepare5.transaction;
          var store = _prepare5.store;

          store.put({ name: "lastModified", value: value });
          transaction.onerror = function (event) {
            return reject(event.target.error);
          };
          transaction.oncomplete = function (event) {
            return resolve(value);
          };
        });
      });
    }

    /**
     * Retrieve saved lastModified value.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "getLastModified",
    value: function getLastModified() {
      var _this8 = this;

      return this.open().then(function () {
        return new Promise(function (resolve, reject) {
          var _prepare6 = _this8.prepare(undefined, "__meta__");

          var transaction = _prepare6.transaction;
          var store = _prepare6.store;

          var request = store.get("lastModified");
          transaction.onerror = function (event) {
            return reject(event.target.error);
          };
          transaction.oncomplete = function (event) {
            resolve(request.result && request.result.value || null);
          };
        });
      });
    }

    /**
     * Load a dump of records exported from a server.
     *
     * @abstract
     * @return {Promise}
     */

  }, {
    key: "loadDump",
    value: function loadDump(records) {
      var _this9 = this;

      return this.execute(function (transaction) {
        records.forEach(function (record) {
          return transaction.update(record);
        });
      }).then(function () {
        return _this9.getLastModified();
      }).then(function (previousLastModified) {
        var _Math;

        var lastModified = (_Math = Math).max.apply(_Math, _toConsumableArray(records.map(function (record) {
          return record.last_modified;
        })));
        if (lastModified > previousLastModified) {
          return _this9.saveLastModified(lastModified);
        }
      }).then(function () {
        return records;
      }).catch(this._handleError("loadDump"));
    }
  }]);

  return IDB;
}(_base2.default);

/**
 * IDB transaction proxy.
 *
 * @param  {IDBStore} store     The IndexedDB database store.
 * @param  {Array}    preloaded The list of records to make available to
 *                              get() (default: []).
 * @return {Object}
 */

exports.default = IDB;
function transactionProxy(store) {
  var preloaded = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

  return {
    create: function create(record) {
      store.add(record);
    },
    update: function update(record) {
      store.put(record);
    },
    delete: function _delete(id) {
      store.delete(id);
    },
    get: function get(id) {
      return preloaded[id];
    }
  };
}