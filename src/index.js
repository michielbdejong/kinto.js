"use strict";

import "babel/polyfill";
import "isomorphic-fetch";

import { EventEmitter } from "events";
import Api from "./api";
import Collection from "./collection";
import BaseAdapter from "./adapters/base";
import LocalStorage from "./adapters/LocalStorage";
import IDB from "./adapters/IDB";

const DEFAULT_BUCKET_NAME = "default";
const DEFAULT_REMOTE = "http://localhost:8888/v1";

/**
 * Kinto class.
 */
export default class Kinto {
  /**
   * Provides a public access to the BaseAdapter class, so that users can create
   * their DB adapter.
   * @return {BaseAdapter}
   */
  static get adapters() {
    return {
      BaseAdapter: BaseAdapter,
      LocalStorage: LocalStorage,
      IDB: IDB,
    }
  }

  /**
   * Constructor.
   *
   * Options:
   * - {String}       remote   The server URL to use.
   * - {String}       bucket   The collection bucket name.
   * - {EventEmitter} events   Events handler.
   * - {BaseAdapter}  adapter  The base DB adapter class.
   * - {String}       prefixDB The DB name prefix.
   * - {Object}       headers  The HTTP headers to use.
   * - {String}       requestMode The HTTP CORS mode to use.
   *
   * @param  {Object} options The options object.
   */
  constructor(options={}) {
    const defaults = {
      adapter: Kinto.adapters.IDB,
      bucket: DEFAULT_BUCKET_NAME,
      events: new EventEmitter(),
      remote: DEFAULT_REMOTE,
    };
    this._options = Object.assign(defaults, options);
    this._collections = {};
    // public properties
    this.events = this._options.events;
  }

  /**
   * Creates or retrieve a Collection instance.
   *
   * @param  {String} collName The collection name.
   * @return {Collection}
   */
  collection(collName) {
    if (!collName)
      throw new Error("missing collection name");

    const remote = this._options.remote;
    const api = new Api(remote, {
      headers:     this._options.headers,
      events:      this._options.events,
      requestMode: this._options.requestMode,
    });

    if (!this._collections.hasOwnProperty(collName)) {
      const bucket = this._options.bucket;
      this._collections[collName] = new Collection(bucket, collName, api, {
        events:   this._options.events,
        adapter:  this._options.adapter,
        prefixDB: this._options.prefixDB,
      });
    }

    return this._collections[collName];
  }
}
