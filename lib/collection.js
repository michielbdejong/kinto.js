"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SyncResultObject = undefined;

var _base = require("./adapters/base");

var _base2 = _interopRequireDefault(_base);

var _utils = require("./utils");

var _api = require("./api");

var _uuid = require("uuid");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Synchronization result object.
 */

var SyncResultObject = exports.SyncResultObject = function () {
  _createClass(SyncResultObject, null, [{
    key: "defaults",

    /**
     * Object default values.
     * @type {Object}
     */
    get: function get() {
      return {
        ok: true,
        lastModified: null,
        errors: [],
        created: [],
        updated: [],
        deleted: [],
        published: [],
        conflicts: [],
        skipped: [],
        resolved: []
      };
    }

    /**
     * Public constructor.
     */

  }]);

  function SyncResultObject() {
    _classCallCheck(this, SyncResultObject);

    /**
     * Current synchronization result status; becomes `false` when conflicts or
     * errors are registered.
     * @type {Boolean}
     */
    this.ok = true;
    Object.assign(this, SyncResultObject.defaults);
  }

  /**
   * Adds entries for a given result type.
   *
   * @param {String} type    The result type.
   * @param {Array}  entries The result entries.
   * @return {SyncResultObject}
   */

  _createClass(SyncResultObject, [{
    key: "add",
    value: function add(type, entries) {
      if (!Array.isArray(this[type])) {
        return;
      }
      this[type] = this[type].concat(entries);
      this.ok = this.errors.length + this.conflicts.length === 0;
      return this;
    }

    /**
     * Reinitializes result entries for a given result type.
     *
     * @param  {String} type The result type.
     * @return {SyncResultObject}
     */

  }, {
    key: "reset",
    value: function reset(type) {
      this[type] = SyncResultObject.defaults[type];
      this.ok = this.errors.length + this.conflicts.length === 0;
      return this;
    }
  }]);

  return SyncResultObject;
}();

function createUUIDSchema() {
  return {
    generate: function generate() {
      return (0, _uuid.v4)();
    },
    validate: function validate(id) {
      return (0, _utils.isUUID)(id);
    }
  };
}

function markStatus(record, status) {
  return Object.assign({}, record, { _status: status });
}

function markDeleted(record) {
  return markStatus(record, "deleted");
}

function markSynced(record) {
  return markStatus(record, "synced");
}

/**
 * Import a remote change into the local database.
 *
 * @param  {IDBTransactionProxy} transaction The transaction handler.
 * @param  {Object}              remote      The remote change object to import.
 * @return {Object}
 */
function importChange(transaction, remote) {
  var local = transaction.get(remote.id);
  if (!local) {
    // Not found locally but remote change is marked as deleted; skip to
    // avoid recreation.
    if (remote.deleted) {
      return { type: "skipped", data: remote };
    }
    var _synced = markSynced(remote);
    transaction.create(_synced);
    return { type: "created", data: _synced };
  }
  var identical = (0, _utils.deepEquals)((0, _api.cleanRecord)(local), (0, _api.cleanRecord)(remote));
  if (local._status !== "synced") {
    // Locally deleted, unsynced: scheduled for remote deletion.
    if (local._status === "deleted") {
      return { type: "skipped", data: local };
    }
    if (identical) {
      // If records are identical, import anyway, so we bump the
      // local last_modified value from the server and set record
      // status to "synced".
      var _synced2 = markSynced(remote);
      transaction.update(_synced2);
      return { type: "updated", data: _synced2 };
    }
    return {
      type: "conflicts",
      data: { type: "incoming", local: local, remote: remote }
    };
  }
  if (remote.deleted) {
    transaction.delete(remote.id);
    return { type: "deleted", data: { id: local.id } };
  }
  var synced = markSynced(remote);
  transaction.update(synced);
  // if identical, simply exclude it from all lists
  var type = identical ? "void" : "updated";
  return { type: type, data: synced };
}

/**
 * Abstracts a collection of records stored in the local database, providing
 * CRUD operations and synchronization helpers.
 */

var Collection = function () {
  /**
   * Constructor.
   *
   * Options:
   * - `{BaseAdapter} adapter` The DB adapter (default: `IDB`)
   * - `{String} dbPrefix`     The DB name prefix (default: `""`)
   *
   * @param  {String} bucket  The bucket identifier.
   * @param  {String} name    The collection name.
   * @param  {Api}    api     The Api instance.
   * @param  {Object} options The options object.
   */

  function Collection(bucket, name, api) {
    var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

    _classCallCheck(this, Collection);

    this._bucket = bucket;
    this._name = name;
    this._lastModified = null;

    var DBAdapter = options.adapter;
    if (!DBAdapter) {
      throw new Error("No adapter provided");
    }
    var dbPrefix = options.dbPrefix || "";
    var db = new DBAdapter("" + dbPrefix + bucket + "/" + name);
    if (!(db instanceof _base2.default)) {
      throw new Error("Unsupported adapter.");
    }
    // public properties
    /**
     * The db adapter instance
     * @type {BaseAdapter}
     */
    this.db = db;
    /**
     * The Api instance.
     * @type {Api}
     */
    this.api = api;
    /**
     * The event emitter instance.
     * @type {EventEmitter}
     */
    this.events = options.events;
    /**
     * The IdSchema instance.
     * @type {Object}
     */
    this.idSchema = this._validateIdSchema(options.idSchema);
    /**
     * The list of remote transformers.
     * @type {Array}
     */
    this.remoteTransformers = this._validateRemoteTransformers(options.remoteTransformers);
  }

  /**
   * The collection name.
   * @type {String}
   */

  _createClass(Collection, [{
    key: "_validateIdSchema",

    /**
     * Validates an idSchema.
     *
     * @param  {Object|undefined} idSchema
     * @return {Object}
     */
    value: function _validateIdSchema(idSchema) {
      if (typeof idSchema === "undefined") {
        return createUUIDSchema();
      }
      if ((typeof idSchema === "undefined" ? "undefined" : _typeof(idSchema)) !== "object") {
        throw new Error("idSchema must be an object.");
      } else if (typeof idSchema.generate !== "function") {
        throw new Error("idSchema must provide a generate function.");
      } else if (typeof idSchema.validate !== "function") {
        throw new Error("idSchema must provide a validate function.");
      }
      return idSchema;
    }

    /**
     * Validates a list of remote transformers.
     *
     * @param  {Array|undefined} remoteTransformers
     * @return {Array}
     */

  }, {
    key: "_validateRemoteTransformers",
    value: function _validateRemoteTransformers(remoteTransformers) {
      if (typeof remoteTransformers === "undefined") {
        return [];
      }
      if (!Array.isArray(remoteTransformers)) {
        throw new Error("remoteTransformers should be an array.");
      }
      return remoteTransformers.map(function (transformer) {
        if ((typeof transformer === "undefined" ? "undefined" : _typeof(transformer)) !== "object") {
          throw new Error("A transformer must be an object.");
        } else if (typeof transformer.encode !== "function") {
          throw new Error("A transformer must provide an encode function.");
        } else if (typeof transformer.decode !== "function") {
          throw new Error("A transformer must provide a decode function.");
        }
        return transformer;
      });
    }

    /**
     * Deletes every records in the current collection and marks the collection as
     * never synced.
     *
     * @return {Promise}
     */

  }, {
    key: "clear",
    value: function clear() {
      var _this = this;

      return this.db.clear().then(function (_) {
        return _this.db.saveLastModified(null);
      }).then(function (_) {
        return { data: [], permissions: {} };
      });
    }

    /**
     * Encodes a record.
     *
     * @param  {String} type   Either "remote" or "local".
     * @param  {Object} record The record object to encode.
     * @return {Promise}
     */

  }, {
    key: "_encodeRecord",
    value: function _encodeRecord(type, record) {
      if (!this[type + "Transformers"].length) {
        return Promise.resolve(record);
      }
      return (0, _utils.waterfall)(this[type + "Transformers"].map(function (transformer) {
        return function (record) {
          return transformer.encode(record);
        };
      }), record);
    }

    /**
     * Decodes a record.
     *
     * @param  {String} type   Either "remote" or "local".
     * @param  {Object} record The record object to decode.
     * @return {Promise}
     */

  }, {
    key: "_decodeRecord",
    value: function _decodeRecord(type, record) {
      if (!this[type + "Transformers"].length) {
        return Promise.resolve(record);
      }
      return (0, _utils.waterfall)(this[type + "Transformers"].reverse().map(function (transformer) {
        return function (record) {
          return transformer.decode(record);
        };
      }), record);
    }

    /**
     * Adds a record to the local database.
     *
     * Note: If either the `useRecordId` or `synced` options are true, then the
     * record object must contain the id field to be validated. If none of these
     * options are true, an id is generated using the current IdSchema; in this
     * case, the record passed must not have an id.
     *
     * Options:
     * - {Boolean} synced       Sets record status to "synced" (default: `false`).
     * - {Boolean} useRecordId  Forces the `id` field from the record to be used,
     *                          instead of one that is generated automatically
     *                          (default: `false`).
     *
     * @param  {Object} record
     * @param  {Object} options
     * @return {Promise}
     */

  }, {
    key: "create",
    value: function create(record) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? { useRecordId: false, synced: false } : arguments[1];

      var reject = function reject(msg) {
        return Promise.reject(new Error(msg));
      };
      if ((typeof record === "undefined" ? "undefined" : _typeof(record)) !== "object") {
        return reject("Record is not an object.");
      }
      if ((options.synced || options.useRecordId) && !record.id) {
        return reject("Missing required Id; synced and useRecordId options require one");
      }
      if (!options.synced && !options.useRecordId && record.id) {
        return reject("Extraneous Id; can't create a record having one set.");
      }
      var newRecord = Object.assign({}, record, {
        id: options.synced || options.useRecordId ? record.id : this.idSchema.generate(),
        _status: options.synced ? "synced" : "created"
      });
      if (!this.idSchema.validate(newRecord.id)) {
        return reject("Invalid Id: " + newRecord.id);
      }
      return this.db.execute(function (transaction) {
        transaction.create(newRecord);
        return { data: newRecord, permissions: {} };
      }).catch(function (err) {
        if (options.useRecordId) {
          throw new Error("Couldn't create record. It may have been virtually deleted.");
        }
        throw err;
      });
    }

    /**
     * Updates a record from the local database.
     *
     * Options:
     * - {Boolean} synced: Sets record status to "synced" (default: false)
     * - {Boolean} patch:  Extends the existing record instead of overwriting it
     *   (default: false)
     *
     * @param  {Object} record
     * @param  {Object} options
     * @return {Promise}
     */

  }, {
    key: "update",
    value: function update(record) {
      var _this2 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? { synced: false, patch: false } : arguments[1];

      if ((typeof record === "undefined" ? "undefined" : _typeof(record)) !== "object") {
        return Promise.reject(new Error("Record is not an object."));
      }
      if (!record.id) {
        return Promise.reject(new Error("Cannot update a record missing id."));
      }
      if (!this.idSchema.validate(record.id)) {
        return Promise.reject(new Error("Invalid Id: " + record.id));
      }
      return this.get(record.id).then(function (res) {
        var existing = res.data;
        var newStatus = "updated";
        if (record._status === "deleted") {
          newStatus = "deleted";
        } else if (options.synced) {
          newStatus = "synced";
        }
        return _this2.db.execute(function (transaction) {
          var source = options.patch ? Object.assign({}, existing, record) : record;
          var updated = markStatus(source, newStatus);
          if (existing.last_modified && !updated.last_modified) {
            updated.last_modified = existing.last_modified;
          }
          transaction.update(updated);
          return { data: updated, permissions: {} };
        });
      });
    }

    /**
     * Retrieve a record by its id from the local database.
     *
     * @param  {String} id
     * @param  {Object} options
     * @return {Promise}
     */

  }, {
    key: "get",
    value: function get(id) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? { includeDeleted: false } : arguments[1];

      if (!this.idSchema.validate(id)) {
        return Promise.reject(Error("Invalid Id: " + id));
      }
      return this.db.get(id).then(function (record) {
        if (!record || !options.includeDeleted && record._status === "deleted") {
          throw new Error("Record with id=" + id + " not found.");
        } else {
          return { data: record, permissions: {} };
        }
      });
    }

    /**
     * Deletes a record from the local database.
     *
     * Options:
     * - {Boolean} virtual: When set to `true`, doesn't actually delete the record,
     *   update its `_status` attribute to `deleted` instead (default: true)
     *
     * @param  {String} id       The record's Id.
     * @param  {Object} options  The options object.
     * @return {Promise}
     */

  }, {
    key: "delete",
    value: function _delete(id) {
      var _this3 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? { virtual: true } : arguments[1];

      if (!this.idSchema.validate(id)) {
        return Promise.reject(new Error("Invalid Id: " + id));
      }
      // Ensure the record actually exists.
      return this.get(id, { includeDeleted: true }).then(function (res) {
        var existing = res.data;
        return _this3.db.execute(function (transaction) {
          // Virtual updates status.
          if (options.virtual) {
            transaction.update(markDeleted(existing));
          } else {
            // Delete for real.
            transaction.delete(id);
          }
          return { data: { id: id }, permissions: {} };
        });
      });
    }

    /**
     * Lists records from the local database.
     *
     * Params:
     * - {Object} filters Filter the results (default: `{}`).
     * - {String} order   The order to apply   (default: `-last_modified`).
     *
     * Options:
     * - {Boolean} includeDeleted: Include virtually deleted records.
     *
     * @param  {Object} params  The filters and order to apply to the results.
     * @param  {Object} options The options object.
     * @return {Promise}
     */

  }, {
    key: "list",
    value: function list() {
      var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
      var options = arguments.length <= 1 || arguments[1] === undefined ? { includeDeleted: false } : arguments[1];

      params = Object.assign({ order: "-last_modified", filters: {} }, params);
      return this.db.list(params).then(function (results) {
        var data = results;
        if (!options.includeDeleted) {
          data = results.filter(function (record) {
            return record._status !== "deleted";
          });
        }
        return { data: data, permissions: {} };
      });
    }

    /**
     * Import changes into the local database.
     *
     * @param  {SyncResultObject} syncResultObject The sync result object.
     * @param  {Object}           changeObject     The change object.
     * @return {Promise}
     */

  }, {
    key: "importChanges",
    value: function importChanges(syncResultObject, changeObject) {
      var _this4 = this;

      return Promise.all(changeObject.changes.map(function (change) {
        if (change.deleted) {
          return Promise.resolve(change);
        }
        return _this4._decodeRecord("remote", change);
      })).then(function (decodedChanges) {
        // No change, nothing to import.
        if (decodedChanges.length === 0) {
          return Promise.resolve(syncResultObject);
        }
        // Retrieve records matching change ids.
        var remoteIds = decodedChanges.map(function (change) {
          return change.id;
        });
        return _this4.list({ filters: { id: remoteIds }, order: "" }, { includeDeleted: true }).then(function (res) {
          return { decodedChanges: decodedChanges, existingRecords: res.data };
        }).then(function (_ref) {
          var decodedChanges = _ref.decodedChanges;
          var existingRecords = _ref.existingRecords;

          return _this4.db.execute(function (transaction) {
            return decodedChanges.map(function (remote) {
              // Store remote change into local database.
              return importChange(transaction, remote);
            });
          }, { preload: existingRecords });
        }).catch(function (err) {
          // XXX todo
          err.type = "incoming";
          // XXX one error of the whole transaction instead of per atomic op
          return [{ type: "errors", data: err }];
        }).then(function (imports) {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = imports[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var imported = _step.value;

              if (imported.type !== "void") {
                syncResultObject.add(imported.type, imported.data);
              }
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }

          return syncResultObject;
        });
      }).then(function (syncResultObject) {
        syncResultObject.lastModified = changeObject.lastModified;
        // Don't persist lastModified value if any conflict or error occured
        if (!syncResultObject.ok) {
          return syncResultObject;
        }
        // No conflict occured, persist collection's lastModified value
        return _this4.db.saveLastModified(syncResultObject.lastModified).then(function (lastModified) {
          _this4._lastModified = lastModified;
          return syncResultObject;
        });
      });
    }

    /**
     * Resets the local records as if they were never synced; existing records are
     * marked as newly created, deleted records are dropped.
     *
     * A next call to {@link Collection.sync} will thus republish the whole
     * content of the local collection to the server.
     *
     * @return {Promise} Resolves with the number of processed records.
     */

  }, {
    key: "resetSyncStatus",
    value: function resetSyncStatus() {
      var _this5 = this;

      var _count = undefined;
      return this.list({ filters: { _status: ["deleted", "synced"] }, order: "" }, { includeDeleted: true }).then(function (unsynced) {
        return _this5.db.execute(function (transaction) {
          _count = unsynced.data.length;
          unsynced.data.forEach(function (record) {
            if (record._status === "deleted") {
              // Garbage collect deleted records.
              transaction.delete(record.id);
            } else {
              // Records that were synced become «created».
              transaction.update(Object.assign({}, record, {
                last_modified: undefined,
                _status: "created"
              }));
            }
          });
        });
      }).then(function () {
        return _this5.db.saveLastModified(null);
      }).then(function () {
        return _count;
      });
    }

    /**
     * Returns an object containing two lists:
     *
     * - `toDelete`: unsynced deleted records we can safely delete;
     * - `toSync`: local updates to send to the server.
     *
     * @return {Object}
     */

  }, {
    key: "gatherLocalChanges",
    value: function gatherLocalChanges() {
      var _this6 = this;

      var _toDelete = undefined;
      return Promise.all([this.list({ filters: { _status: ["created", "updated"] }, order: "" }), this.list({ filters: { _status: "deleted" }, order: "" }, { includeDeleted: true })]).then(function (_ref2) {
        var _ref3 = _slicedToArray(_ref2, 2);

        var unsynced = _ref3[0];
        var deleted = _ref3[1];

        _toDelete = deleted.data;
        // Encode unsynced records.
        return Promise.all(unsynced.data.map(_this6._encodeRecord.bind(_this6, "remote")));
      }).then(function (toSync) {
        return { toDelete: _toDelete, toSync: toSync };
      });
    }

    /**
     * Fetch remote changes, import them to the local database, and handle
     * conflicts according to `options.strategy`. Then, updates the passed
     * {@link SyncResultObject} with import results.
     *
     * Options:
     * - {String} strategy: The selected sync strategy.
     *
     * @param  {SyncResultObject} syncResultObject
     * @param  {Object}           options
     * @return {Promise}
     */

  }, {
    key: "pullChanges",
    value: function pullChanges(syncResultObject) {
      var _this7 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!syncResultObject.ok) {
        return Promise.resolve(syncResultObject);
      }
      options = Object.assign({
        strategy: Collection.strategy.MANUAL,
        lastModified: this.lastModified,
        headers: {}
      }, options);
      // First fetch remote changes from the server
      return this.api.fetchChangesSince(this.bucket, this.name, {
        lastModified: options.lastModified,
        headers: options.headers
      })
      // Reflect these changes locally
      .then(function (changes) {
        return _this7.importChanges(syncResultObject, changes);
      })
      // Handle conflicts, if any
      .then(function (result) {
        return _this7._handleConflicts(result, options.strategy);
      });
    }

    /**
     * Publish local changes to the remote server and updates the passed
     * {@link SyncResultObject} with publication results.
     *
     * @param  {SyncResultObject} syncResultObject The sync result object.
     * @param  {Object}           options          The options object.
     * @return {Promise}
     */

  }, {
    key: "pushChanges",
    value: function pushChanges(syncResultObject) {
      var _this8 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!syncResultObject.ok) {
        return Promise.resolve(syncResultObject);
      }
      var safe = options.strategy === Collection.SERVER_WINS;
      options = Object.assign({ safe: safe }, options);

      // Fetch local changes
      return this.gatherLocalChanges().then(function (_ref4) {
        var toDelete = _ref4.toDelete;
        var toSync = _ref4.toSync;

        return Promise.all([
        // Delete never synced records marked for deletion
        _this8.db.execute(function (transaction) {
          toDelete.forEach(function (record) {
            transaction.delete(record.id);
          });
        }),
        // Send batch update requests
        _this8.api.batch(_this8.bucket, _this8.name, toSync, options)]);
      })
      // Update published local records
      .then(function (_ref5) {
        var _ref6 = _slicedToArray(_ref5, 2);

        var deleted = _ref6[0];
        var synced = _ref6[1];
        var errors = synced.errors;
        var conflicts = synced.conflicts;
        var published = synced.published;
        var skipped = synced.skipped;
        // Merge outgoing errors into sync result object

        syncResultObject.add("errors", errors.map(function (error) {
          error.type = "outgoing";
          return error;
        }));
        // Merge outgoing conflicts into sync result object
        syncResultObject.add("conflicts", conflicts);
        // Reflect publication results locally
        var missingRemotely = skipped.map(function (r) {
          return Object.assign({}, r, { deleted: true });
        });
        var toApplyLocally = published.concat(missingRemotely);
        // Deleted records are distributed accross local and missing records
        var toDeleteLocally = toApplyLocally.filter(function (r) {
          return r.deleted;
        });
        var toUpdateLocally = toApplyLocally.filter(function (r) {
          return !r.deleted;
        });
        // First, apply the decode transformers, if any
        return Promise.all(toUpdateLocally.map(function (record) {
          return _this8._decodeRecord("remote", record);
        }))
        // Process everything within a single transaction
        .then(function (results) {
          return _this8.db.execute(function (transaction) {
            var updated = results.map(function (record) {
              var synced = markSynced(record);
              transaction.update(synced);
              return { data: synced };
            });
            var deleted = toDeleteLocally.map(function (record) {
              transaction.delete(record.id);
              // Amend result data with the deleted attribute set
              return { data: { id: record.id, deleted: true } };
            });
            return updated.concat(deleted);
          });
        }).then(function (published) {
          syncResultObject.add("published", published.map(function (res) {
            return res.data;
          }));
          return syncResultObject;
        });
      })
      // Handle conflicts, if any
      .then(function (result) {
        return _this8._handleConflicts(result, options.strategy);
      }).then(function (result) {
        var resolvedUnsynced = result.resolved.filter(function (record) {
          return record._status !== "synced";
        });
        // No resolved conflict to reflect anywhere
        if (resolvedUnsynced.length === 0 || options.resolved) {
          return result;
        } else if (options.strategy === Collection.strategy.CLIENT_WINS && !options.resolved) {
          // We need to push local versions of the records to the server
          return _this8.pushChanges(result, Object.assign({}, options, { resolved: true }));
        } else if (options.strategy === Collection.strategy.SERVER_WINS) {
          // If records have been automatically resolved according to strategy and
          // are in non-synced status, mark them as synced.
          return _this8.db.execute(function (transaction) {
            resolvedUnsynced.forEach(function (record) {
              transaction.update(markSynced(record));
            });
            return result;
          });
        }
      });
    }

    /**
     * Resolves a conflict, updating local record according to proposed
     * resolution — keeping remote record `last_modified` value as a reference for
     * further batch sending.
     *
     * @param  {Object} conflict   The conflict object.
     * @param  {Object} resolution The proposed record.
     * @return {Promise}
     */

  }, {
    key: "resolve",
    value: function resolve(conflict, resolution) {
      return this.update(Object.assign({}, resolution, {
        // Ensure local record has the latest authoritative timestamp
        last_modified: conflict.remote.last_modified
      }));
    }

    /**
     * Handles synchronization conflicts according to specified strategy.
     *
     * @param  {SyncResultObject} result    The sync result object.
     * @param  {String}           strategy  The {@link Collection.strategy}.
     * @return {Promise}
     */

  }, {
    key: "_handleConflicts",
    value: function _handleConflicts(result) {
      var _this9 = this;

      var strategy = arguments.length <= 1 || arguments[1] === undefined ? Collection.strategy.MANUAL : arguments[1];

      if (strategy === Collection.strategy.MANUAL || result.conflicts.length === 0) {
        return Promise.resolve(result);
      }
      return Promise.all(result.conflicts.map(function (conflict) {
        var resolution = strategy === Collection.strategy.CLIENT_WINS ? conflict.local : conflict.remote;
        return _this9.resolve(conflict, resolution);
      })).then(function (imports) {
        return result.reset("conflicts").add("resolved", imports.map(function (res) {
          return res.data;
        }));
      });
    }

    /**
     * Synchronize remote and local data. The promise will resolve with a
     * {@link SyncResultObject}, though will reject:
     *
     * - if the server is currently backed off;
     * - if the server has been detected flushed.
     *
     * Options:
     * - {Object} headers: HTTP headers to attach to outgoing requests.
     * - {Collection.strategy} strategy: See {@link Collection.strategy}.
     * - {Boolean} ignoreBackoff: Force synchronization even if server is currently
     *   backed off.
     * - {String} remote The remote Kinto server endpoint to use (default: null).
     *
     * @param  {Object} options Options.
     * @return {Promise}
     * @throws {Error} If an invalid remote option is passed.
     */

  }, {
    key: "sync",
    value: function sync() {
      var _this10 = this;

      var options = arguments.length <= 0 || arguments[0] === undefined ? {
        strategy: Collection.strategy.MANUAL,
        headers: {},
        ignoreBackoff: false,
        remote: null
      } : arguments[0];

      var previousRemote = this.api.remote;
      if (options.remote) {
        // Note: setting the remote ensures it's valid, throws when invalid.
        this.api.remote = options.remote;
      }
      if (!options.ignoreBackoff && this.api.backoff > 0) {
        var seconds = Math.ceil(this.api.backoff / 1000);
        return Promise.reject(new Error("Server is backed off; retry in " + seconds + "s or use the ignoreBackoff option."));
      }
      var result = new SyncResultObject();
      var syncPromise = this.db.getLastModified().then(function (lastModified) {
        return _this10._lastModified = lastModified;
      }).then(function (_) {
        return _this10.pullChanges(result, options);
      }).then(function (result) {
        return _this10.pushChanges(result, options);
      }).then(function (result) {
        // Avoid performing a last pull if nothing has been published.
        if (result.published.length === 0) {
          return result;
        }
        return _this10.pullChanges(result, options);
      });
      // Ensure API default remote is reverted if a custom one's been used
      return (0, _utils.pFinally)(syncPromise, function () {
        return _this10.api.remote = previousRemote;
      });
    }

    /**
     * Load a list of records already synced with the remote server.
     *
     * The local records which are unsynced or whose timestamp is either missing
     * or superior to those being loaded will be ignored.
     *
     * @param  {Array} records The previously exported list of records to load.
     * @return {Promise} with the effectively imported records.
     */

  }, {
    key: "loadDump",
    value: function loadDump(records) {
      var _this11 = this;

      var reject = function reject(msg) {
        return Promise.reject(new Error(msg));
      };
      if (!Array.isArray(records)) {
        return reject("Records is not an array.");
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = records[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var record = _step2.value;

          if (!record.id || !this.idSchema.validate(record.id)) {
            return reject("Record has invalid ID: " + JSON.stringify(record));
          }

          if (!record.last_modified) {
            return reject("Record has no last_modified value: " + JSON.stringify(record));
          }
        }

        // Fetch all existing records from local database,
        // and skip those who are newer or not marked as synced.

        // XXX filter by status / ids in records
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return this.list({}, { includeDeleted: true }).then(function (res) {
        return res.data.reduce(function (acc, record) {
          acc[record.id] = record;
          return acc;
        }, {});
      }).then(function (existingById) {
        return records.filter(function (record) {
          var localRecord = existingById[record.id];
          var shouldKeep =
          // No local record with this id.
          localRecord === undefined ||
          // Or local record is synced
          localRecord._status === "synced" &&
          // And was synced from server
          localRecord.last_modified !== undefined &&
          // And is older than imported one.
          record.last_modified > localRecord.last_modified;
          return shouldKeep;
        });
      }).then(function (newRecords) {
        return newRecords.map(markSynced);
      }).then(function (newRecords) {
        return _this11.db.loadDump(newRecords);
      });
    }
  }, {
    key: "name",
    get: function get() {
      return this._name;
    }

    /**
     * The bucket name.
     * @type {String}
     */

  }, {
    key: "bucket",
    get: function get() {
      return this._bucket;
    }

    /**
     * The last modified timestamp.
     * @type {Number}
     */

  }, {
    key: "lastModified",
    get: function get() {
      return this._lastModified;
    }

    /**
     * Synchronization strategies. Available strategies are:
     *
     * - `MANUAL`: Conflicts will be reported in a dedicated array.
     * - `SERVER_WINS`: Conflicts are resolved using remote data.
     * - `CLIENT_WINS`: Conflicts are resolved using local data.
     *
     * @type {Object}
     */

  }], [{
    key: "strategy",
    get: function get() {
      return {
        CLIENT_WINS: "client_wins",
        SERVER_WINS: "server_wins",
        MANUAL: "manual"
      };
    }
  }]);

  return Collection;
}();

exports.default = Collection;