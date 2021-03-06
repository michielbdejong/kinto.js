"use strict";

import sinon from "sinon";

import IDB from "../../src/adapters/IDB.js";
import { adapterTestSuite } from "./common";

describe("adapter.IDB", () => {
  adapterTestSuite(() => new IDB("test/foo"));

  describe("IDB specific tests", () => {
    var sandbox, db;

    beforeEach(() => {
      sandbox = sinon.sandbox.create();
      db = new IDB("test/foo");
      return db.clear();
    });

    afterEach(() => sandbox.restore());

    describe("#create", () => {
      it("should reject on transaction error", () => {
        sandbox.stub(db, "prepare").returns({
          store: {add() {}},
          transaction: {
            get onerror() {},
            set onerror(onerror) {
              onerror({target: {error: "transaction error"}});
            }
          }
        });
        return db.create({foo: "bar"})
          .should.be.rejectedWith(Error, "transaction error");
      });

      it("should prefix error encountered", () => {
        sandbox.stub(db, "open").returns(Promise.reject("error"));
        return db.create().should.be.rejectedWith(Error, /^Error: create/);
      });
    });

    describe("#update", () => {
      it("should reject on transaction error", () => {
        sandbox.stub(db, "get").returns(Promise.resolve());
        sandbox.stub(db, "prepare").returns({
          store: {get() {}, put() {}},
          transaction: {
            get onerror() {},
            set onerror(onerror) {
              onerror({target: {error: "transaction error"}});
            }
          }
        });
        return db.update({id: 42, foo: "bar"})
          .should.be.rejectedWith(Error, "transaction error");
      });

      it("should prefix error encountered", () => {
        sandbox.stub(db, "open").returns(Promise.reject("error"));
        return db.update().should.be.rejectedWith(Error, /^Error: update/);
      });
    });

    describe("#get", () => {
      beforeEach(() => {
        return db.create({id: 1, foo: "bar"});
      });

      it("should return undefined when record is not found", () => {
        return db.get(999)
          .should.eventually.eql(undefined);
      });
    });

    describe("#delete", () => {
      beforeEach(() => {
        return db.create({id: 1, foo: "bar"});
      });

      it("should reject on transaction error", () => {
        sandbox.stub(db, "prepare").returns({
          store: {get() {}},
          transaction: {
            get onerror() {},
            set onerror(onerror) {
              onerror({target: {error: "transaction error"}});
            }
          }
        });
        return db.get(42)
          .should.be.rejectedWith(Error, "transaction error");
      });

      it("should prefix error encountered", () => {
        sandbox.stub(db, "open").returns(Promise.reject("error"));
        return db.delete().should.be.rejectedWith(Error, /^Error: delete/);
      });
    });

    describe("#list", () => {
      it("should prefix error encountered", () => {
        sandbox.stub(db, "open").returns(Promise.reject("error"));
        return db.list().should.be.rejectedWith(Error, /^Error: list/);
      });

      it("should reject on transaction error", () => {
        sandbox.stub(db, "prepare").returns({
          store: {openCursor() {return {};}},
          transaction: {
            get onerror() {},
            set onerror(onerror) {
              onerror({target: {error: "transaction error"}});
            }
          }
        });
        return db.list({})
          .should.be.rejectedWith(Error, "transaction error");
      });
    });
  });
});
