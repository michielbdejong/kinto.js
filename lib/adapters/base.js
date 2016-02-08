"use strict";

/**
 * Base db adapter.
 *
 * @abstract
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BaseAdapter = function () {
  function BaseAdapter() {
    _classCallCheck(this, BaseAdapter);
  }

  _createClass(BaseAdapter, [{
    key: "open",

    /**
     * Opens a connection to the database.
     *
     * @abstract
     * @return {Promise}
     */
    value: function open() {
      return Promise.resolve();
    }

    /**
     * Closes current connection to the database.
     *
     * @abstract
     * @return {Promise}
     */

  }, {
    key: "close",
    value: function close() {
      return Promise.resolve();
    }

    /**
     * Deletes every records present in the database.
     *
     * @abstract
     * @return {Promise}
     */

  }, {
    key: "clear",
    value: function clear() {
      throw new Error("Not Implemented.");
    }

    /**
     * Executes a batch of operations within a single transaction.
     *
     * @abstract
     * @param  {Function} callback The operation callback.
     * @param  {Object}   options  The options object.
     * @return {Promise}
     */

  }, {
    key: "execute",
    value: function execute(callback) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? { preload: [] } : arguments[1];

      throw new Error("Not Implemented.");
    }

    /**
     * Retrieve a record by its primary key from the database.
     *
     * @abstract
     * @param  {String} id The record id.
     * @return {Promise}
     */

  }, {
    key: "get",
    value: function get(id) {
      throw new Error("Not Implemented.");
    }

    /**
     * Lists all records from the database.
     *
     * @abstract
     * @param  {Object} params  The filters and order to apply to the results.
     * @return {Promise}
     */

  }, {
    key: "list",
    value: function list() {
      var params = arguments.length <= 0 || arguments[0] === undefined ? { filters: {}, order: "" } : arguments[0];

      throw new Error("Not Implemented.");
    }

    /**
     * Store the lastModified value.
     *
     * @abstract
     * @param  {Number}  lastModified
     * @return {Promise}
     */

  }, {
    key: "saveLastModified",
    value: function saveLastModified(lastModified) {
      throw new Error("Not Implemented.");
    }

    /**
     * Retrieve saved lastModified value.
     *
     * @abstract
     * @return {Promise}
     */

  }, {
    key: "getLastModified",
    value: function getLastModified() {
      throw new Error("Not Implemented.");
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
      throw new Error("Not Implemented.");
    }
  }]);

  return BaseAdapter;
}();

exports.default = BaseAdapter;