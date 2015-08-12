"use strict";

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { EventEmitter } from "events";
import { v4 as uuid4 } from "uuid";
import { SUPPORTED_PROTOCOL_VERSION as SPV } from "../src/api";

import BaseAdapter from "../src/adapters/base";
import LocalStorage from "../src/adapters/LocalStorage";
import IDB from "../src/adapters/IDB";
import Kinto from "../src";
import Collection from "../src/collection";

chai.use(chaiAsPromised);
chai.should();
chai.config.includeStack = true;

const TEST_BUCKET_NAME = "kinto-test";
const TEST_COLLECTION_NAME = "kinto-test";
const FAKE_SERVER_URL = "http://fake-server"

describe("Kinto", () => {
  var sandbox;

  function testCollection() {
    const db = new Kinto({bucket: TEST_BUCKET_NAME});
    return db.collection(TEST_COLLECTION_NAME);
  }

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    return testCollection().clear();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("static properties", () => {
    it("should provide an adapters static getter", () => {
      expect(Kinto.adapters).to.be.an("object")
    });

    it("should provide an adapters.BaseAdapter getter", () => {
      expect(Kinto.adapters.BaseAdapter).to.eql(BaseAdapter);
    });

    it("should provide an adapters.LocalStorage getter", () => {
      expect(Kinto.adapters.LocalStorage).to.eql(LocalStorage);
    });

    it("should provide an adapters.IDB getter", () => {
      expect(Kinto.adapters.IDB).to.eql(IDB);
    });
  });

  describe("#constructor", () => {
    it("should expose a passed events instance", () => {
      const events = new EventEmitter();
      expect(new Kinto({events}).events).to.eql(events);
    });

    it("should create an events property if none passed", () => {
      expect(new Kinto().events).to.be.an.instanceOf(EventEmitter);
    });

    it("should propagate its events property to child dependencies", () => {
      const kinto = new Kinto();
      expect(kinto.collection("x").events).eql(kinto.events);
      expect(kinto.collection("x").api.events).eql(kinto.events);
      expect(kinto.collection("x").api.http.events).eql(kinto.events);
    });

    it("should propagate the requestMode option to child dependencies", () => {
      const requestMode = "no-cors";
      expect(new Kinto({requestMode}).collection("x").api.http.requestMode)
        .eql(requestMode);
    });

    it("should propagate the prefixDB option to child dependencies", () => {
      expect(new Kinto({prefixDB: "app--"}).collection("x").db.dbname)
        .eql("app--default/x");
    });
  });

  describe("#collection()", () => {
    it("should return a Collection", () => {
      expect(testCollection()).to.be.a("object");
    });

    it("should resolve to a named collection instance", () => {
      expect(testCollection().name).eql(TEST_COLLECTION_NAME);
    });

    it("should use specified bucket name if specified", () => {
      expect(testCollection().bucket).eql(TEST_BUCKET_NAME);
    })

    it("should use default bucket if not specified", () => {
      const coll = new Kinto().collection(TEST_COLLECTION_NAME);
      expect(coll.bucket).eql("default");
    })

    it("should cache collection instance", () => {
      const db = new Kinto();
      expect(db.collection("a") == db.collection("a")).eql(true);
    });

    it("should reject on missing collection name", () => {
      expect(() => new Kinto().collection())
        .to.Throw(Error, /missing collection name/);
    });

    it("should setup the Api cient using default server URL", () => {
      const db = new Kinto();
      const coll = db.collection("plop");

      expect(coll.api.remote).eql(`http://localhost:8888/${SPV}`);
    });

    it("should setup the Api cient using provided server URL", () => {
      const db = new Kinto({remote: `http://1.2.3.4:1234/${SPV}`});
      const coll = db.collection("plop");

      expect(coll.api.remote).eql(`http://1.2.3.4:1234/${SPV}`);
    });

    it("should pass option headers to the api", () => {
      const db = new Kinto({
        remote: `http://1.2.3.4:1234/${SPV}`,
        headers: {Authorization: "Basic plop"},
      });
      const coll = db.collection("plop");

      expect(coll.api.optionHeaders).eql({Authorization: "Basic plop"});
    });

    it("should create collection using an optional adapter", () => {
      const MyAdapter = class extends BaseAdapter {}
      const db = new Kinto({adapter: MyAdapter});
      const coll = db.collection("plop");

      expect(coll.db).to.be.an.instanceOf(MyAdapter);
    });
  });
});
