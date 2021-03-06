# API documentation

## The `Kinto` constructor

```js
const db = new Kinto(options);
```

`options` is an object defining the following option values:

- `remote`: The remote Kinto server endpoint root URL (eg. `"https://server/v1"`). Not that you *must* define a URL matching the version of the protocol the client supports, otherwise you'll get an error;
- `headers`: The default headers to pass for every HTTP request performed to the Cliquet server (eg. `{"Authorization": "Basic bWF0Og=="}`);
- `adapter`: The persistence layer adapter to use for saving data locally (default: `Kinto.adapters.IDB`); alternatively, a `Kinto.adapters.LocalStorage` adapter is also provided; last, if you plan on writing your own adapter, you can read more about how to do so in the [Extending Kinto.js](extending.md) section.
- `requestMode`: The HTTP [CORS](https://fetch.spec.whatwg.org/#concept-request-mode) mode. Default: `cors`.

## Collections

By default, collections are persisted locally in IndexedDB.

#### Notes

> A `localStorage` adapter is also available, though we suggest to stick with IndexedDB whenever you can, as it's faster, more reliable and accepts greater data quotas withouth requiring specific configuration.

Selecting a collection is done by calling the `collection()` method, passing it the resource name:

```js
const articles = db.collection("articles");
```

The collection object has the following (read-only) attribute:

* **lastModified**: last synchronization timestamp, `null` if never sync'ed.

> #### Notes
>
> - A single dedicated database and store are created per collection.
> - All transactional operations are asynchronous and rely on [Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

## Creating a record

```js
articles.create({title: "foo"})
  .then(console.log.bind(console))
  .catch(console.error.bind(console));
```

Result is:

```js
// result
{
  data: {
    id: "2dcd0e65-468c-4655-8015-30c8b3a1c8f8",
    title: "foo",
  }
}
```

> #### Notes
>
> - Records identifiers are generated locally using [UUID v4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_.28random.29).

## Retrieving a single record

```js
articles.get("2dcd0e65-468c-4655-8015-30c8b3a1c8f8")
  .then(console.log.bind(console))
  .catch(console.error.bind(console));
```

Result:

```js
{
  data: [
    {
      id: "2dcd0e65-468c-4655-8015-30c8b3a1c8f8",
      title: "bar"
    }
  ]
}
```

> #### Notes
>
> - The promise will be rejected if no record is found for that id.

## Updating a record

```js
var existing = {
  id: "2dcd0e65-468c-4655-8015-30c8b3a1c8f8",
  title: "bar"
};

var updated = Object.assign(existing, {
  title: "baz"
});

articles.update(updated)
  .then(console.log.bind(console));
```

Result is:

```js
{
  data: {
    id: "2dcd0e65-468c-4655-8015-30c8b3a1c8f8",
    title: "baz",
    last_modified: 1432222889337
  }
}
```

> #### Notes
>
> - An id is required, otherwise the promise will be rejected.

## Deleting records

By default, local deletion is performed *virtually*, until the collection is actually synced to the remote server.

```js
articles.delete("2dcd0e65-468c-4655-8015-30c8b3a1c8f8")
  .then(console.log.bind(console));
```

Result:

```js
{
  data: [
    {
      id: "2dcd0e65-468c-4655-8015-30c8b3a1c8f8",
      title: "foo",
      _status: "deleted"
    }
  ]
}
```

> #### Notes
>
> - An id is required, otherwise the promise will be rejected;
> - Virtual deletions aren't retrieved when calling `#get()` and `#list()`.

## Listing records

```js
articles.list()
  .then(console.log.bind(console));
```

Result is:

```js
{
  data: [
    {
      id: "705b17be-e957-4c14-8f4c-86f8eaac29c0",
      title: "foo"
    },
    {
      id: "68e63131-3859-40cc-a4f7-b237ca179329",
      last_modified: 1432222889336,
      title: "Web page"
    },
  ]
}
```

> #### Notes
>
> - Records with `last_modified` attribute were sync'ed on a server.

### Filtering

Records can be filtered using the `filters` parameter mentioning field names and their expected value:

```js
articles.list({filters: {unread: true}})
  .then(console.log.bind(console));
```

> #### Notes
>
> - If several fields are specified, an implicit *and* is used.
> - As mentioned in the [limitations](limitations.md) section, until [local DB indices are implemented](https://github.com/Kinto/kinto.js/issues/66), the filter is performed in memory.


### Sorting

Records can be sorted using the `sort` parameter:

```js
articles.list({sort: "-title"})
  .then(console.log.bind(console));
```

> #### Notes
>
> - Prefix field name with `-` for descending order.
> - By default, the records are sorted on `last_modified` in descending order.
> - As mentioned in the [limitations](limitations.md) section, the sort is performed in memory.


## Clearing the collection

This will remove all existing records from the collection:

```js
articles.clear()
  .then(console.log.bind(console));
```

Result:

```js
{
  data: [],
  permissions: {}
}
```

## Fetching and publishing changes

Synchronizing local data with remote ones is performed by calling the `#sync()` method.

![](images/sync-flow.png)

Synopsis:

1. Fetch remote changes since last synchronization;
2. Fail on any conflict encountered;
    - The developer has to handle them manually using [`#resolve()`](#resolving-conflicts), and call `#sync()` again when done;
3. If everything went fine, publish local changes;
    - Fail on any publication conflict detected;
        * If `strategy` is set to `Collection.strategy.SERVER_WINS`, no remote data override will be performed by the server;
        * If `strategy` is set to `Collection.strategy.CLIENT_WINS`, conflicting server records will be overriden with local changes;
        * If `strategy` is set to `Collection.strategy.MANUAL`, conflicts will be reported in a dedicated array.

```js
articles.sync()
  .then(console.log.bind(console))
  .catch(console.error.bind(console));
```

### Synchronization strategies

The `sync()` method accepts a `strategy` option, which itself accepts the following values:

- `Collection.strategy.MANUAL` (default): Conflicts are reflected in a `conflicts` array as a result, and need to be resolved manually.
- `Collection.strategy.SERVER_WINS`: Server data will be preserved;
- `Collection.strategy.CLIENT_WINS`: Client data will be preserved.

You can override default options by passing `#sync()` a new `options` object; Kinto will merge these new values with the default ones:

```js
articles.sync({
  strategy: Collection.strategy.CLIENT_WINS,
  headers: {Authorization: "Basic bWF0Og=="}
})
  .then(console.log.bind(console));
  .catch(console.error.bind(console));
```

Sample result:

```js
{
  ok: true,
  lastModified: 1434270764485,
  errors:    [], // Errors encountered, if any
  created:   [], // Created locally
  updated:   [], // Updated locally
  deleted:   [], // Deleted locally
  conflicts: [], // Import conflicts
  skipped:   [], // Skipped imports
  published: []  // Successfully published
}
```

If conflicts occured, they're listed in the `conflicts` property; they must be resolved locally and `sync()` called again.

The `conflicts` array is in this form:

```js
{
  // …
  conflicts: [
    {
      type: "incoming", // can also be "outgoing"
      local: {
        _status: "created",
        id: "233a018a-fd2b-4d39-ba85-8bf3e13d73ec",
        title: "local title",
      },
      remote: {
        id: "233a018a-fd2b-4d39-ba85-8bf3e13d73ec",
        title: "remote title",
      }
    }
  ]
}
```

## Resolving conflicts

Conflict resolution is achieved using the `#resolve()` method:

```js
articles.sync()
  .then(res => {
    if (!conflicts.length)
      return res;
    return Promise.all(conflicts.map(conflict => {
      return articles.resolve(conflict, conflict.remote);
    }));
  })
  .then(_ => articles.sync())
  .catch(console.error.bind(console));
```

Here we're solving encountered conflicts by picking all remote versions. After conflicts being properly addressed, we're syncing the collection again.

## Handling server backoff

If the Kinto server instance is under heavy load or maintenance, their admins can [send a Backoff header](http://cliquet.readthedocs.org/en/latest/api/backoff.html) and it's the responsibily for clients to hold on performing more requests for a given amount of time, expressed in seconds.

When this happens, Kinto.js will reject calls to `#sync()` with an appropriate error message specifying the number of seconds you need to wait before calling it again.

While not necessarily recommended, if you ever want to bypass this restriction, you can pass the `ignoreBackoff` option set to `true`:

```js
articles.sync({ignoreBackoff: true})
  .then(…)
```

## Events

The `Kinto` instance and its other dependencies expose an `events` property you can subscribe public events from. That `events` property implements nodejs' [EventEmitter interface](https://nodejs.org/api/events.html#events_class_events_eventemitter).

### The `backoff` event

Triggered when a `Backoff` HTTP header has been received from the last received response from the server, meaning clients should hold on performing further requests during a given amount of time.

The `backoff` event notifies what's the backoff release timestamp you should wait until before performing another `#sync()` call:

```js
const kinto = new Kinto();

kinto.events.on("backoff", function(releaseTime) {
  const releaseDate = new Date(releaseTime).toLocaleString();
  alert(`Backed off; wait until ${releaseDate} to retry`);
});
```

### The `deprecated` event

Triggered when an `Alert` HTTP header is received from the server, meaning that a feature has been deprecated; the `event` argument received by the event listener contains the following deprecation information:

- `type`: The type of deprecation, which in ou case is always `soft-eol` (`hard-eol` alerts trigger an `HTTP 410 Gone` error);
- `message`: The deprecation alert message;
- `url`: The URL you can get information about the related deprecation policy.

```js
const kinto = new Kinto();

kinto.events.on("deprecated", function(event) {
  console.log(event.message);
});
```

## Transformers

Transformers are basically hooks for encoding and decoding records.

### Remote transformers

Remote transformers aim at encoding records before pushing them to the remote server, and decoding them back when pulling changes. Remote transformers are registered by calling the `Collection#use()` method, which accepts a `Kinto.transformers.RemoteTransformer`-derived object instance:

```js
import Kinto from "kinto";

function update(obj1, obj2) {
  return Object.assign({}, obj1, obj2);
}

class MyRemoteTransformer extends Kinto.transformers.RemoteTransformer {
  encode(record) {
    return update(record, {title: record.title + "!"});
  }

  decode(record) {
    return update(record, {title: record.title.slice(0, -1)});
  }
}

const kinto = new Kinto({remote: "https://my.server.tld/v1"});
coll = kinto.collection("articles");
coll.use(new MyRemoteTransformer());
```

Notice that the `decode` method should be the strict reverse version of `encode`. Calling `coll.sync()` here will store encoded records on the server; when pulling for changes, the client will decode remote data before importing them, so you're always guaranteed to have the local database containing data in clear:

```js
coll.create({title: "foo"}).then(_ => coll.sync())
// remotely saved:
// {id: "125b3bff-e80f-4823-8b8f-bfae10bfc3e8", title: "foo!"}
// locally saved:
// {id: "125b3bff-e80f-4823-8b8f-bfae10bfc3e8", title: "foo"}
```

#### Notes

> *This mechanism is especially useful for implementing a cryptographic layer, to ensure remote data are stored in a secure fashion. Kinto.js will provide one in a near future.*

### Local transformers

In a near future, Kinto.js will provide transfomers aimed at providing facilities to encode and decode records when persisted locally; you'll have to extend from `LocalTransformer` though.

### Async transformers

Transformers can also work asynchronously by returning a Promise:

```js
class MyAsyncRemoteTransformer extends Kinto.transformers.RemoteTransformer {
  encode(record) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(update(record, {title: record.title + "!"}));
      }, 10);
    });
  }

  decode(record) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(update(record, {title: record.title.slice(0, -1)}));
      }, 10);
    });
  }
}

coll.use(new MyAsyncRemoteTransformer());
```

### Multiple transformers

Transformers are stacked when `#use()` is called multiple times, in the order of the calls; that means you can chain multiple encoding operations, with the decoding ones being processed in the reverse order:

```js
class TitleCharTransformer extends Kinto.transformers.RemoteTransformer {
  constructor(char) {
    super();
    this.char = char;
  }

  encode(record) {
    return update(record, {title: record.title + this.char});
  }

  decode(record) {
    return update(record, {title: record.title.slice(0, -1)});
  }
}

coll.use(new TitleCharTransformer("!"));
coll.use(new TitleCharTransformer("?"));

coll.create({title: "foo"}).then(_ => coll.sync())
// remotely saved:
// {id: "125b3bff-e80f-4823-8b8f-bfae10bfc3e8", title: "foo!?"}
// locally saved:
// {id: "125b3bff-e80f-4823-8b8f-bfae10bfc3e8", title: "foo"}
```

### Limitations

There's currently no way to deal with adding tranformers to an already filled remote database; that would mean remote data migrations, and both Kinto and Kinto.js don't provide this feature just yet.

**As a rule of thumb, you should only start using transformers on an empty remote collection.**
