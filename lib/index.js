"use strict";

import { EventEmitter } from "events";

import "babel-polyfill";
import "isomorphic-fetch";

import BaseAdapter from "./adapters/base";
import LocalStorage from "./adapters/LocalStorage";
import IDB from "./adapters/IDB";

import KintoBase from "./KintoBase";

export default class Kinto extends KintoBase {
  /**
   * Provides a public access to the base adapter classes. Users can create
   * a custom DB adapter by extending BaseAdapter.
   *
   * @type {Object}
   */
  static get adapters() {
    return {
      BaseAdapter: BaseAdapter,
      LocalStorage: LocalStorage,
      IDB: IDB
    };
  }

  constructor(options = {}) {
    const defaults = {
      adapter: Kinto.adapters.IDB,
      events: new EventEmitter()
    };

    super(Object.assign({}, defaults, options));
  }
}

// This fixes compatibility with CommonJS required by browserify.
// See http://stackoverflow.com/questions/33505992/babel-6-changes-how-it-exports-default/33683495#33683495
if (typeof module === "object") {
  module.exports = Kinto;
}