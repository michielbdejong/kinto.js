insertLudbud = function() {
  function getUserDataCredentials(callback) {
    var harvest = Ludbud.fromWindowLocation();
    if (harvest) {
      console.log('setting harvest into localforage, then reloading page', harvest);
      localforage.setItem('userDataCredentials', harvest, function(err) {
        Ludbud.restoreWindowLocation();
        //now the page will be reloaded, after which harvest will be undefined
      });
    } else {
      localforage.getItem('userDataCredentials', callback);
    }
  }

  function go(err, userDataCredentials) {
    if (err) {
      console.log('error getting user data credentials', err);
    } else if (userDataCredentials) {
      window.ludbud = new Ludbud(userDataCredentials);
      console.log('now we can use the ludbud object to access the user\'s data');
    } else {
      console.log('No user data credentials yet. Please click one of the buttons');
    }
  }
  function reset() {
    localforage.clear(function() {
      window.location = window.location.href;
    });
  }

  function keyToPath(key) {
    return '/storage-sync/localhost:8080/' + key;
  }

  function removeQuotes(str) {
    return str.replace(/"/g, '');
  }

  //... on page load:
  getUserDataCredentials(go);

  return {
    bucket(bucketName) {
      console.log('creating bucket', bucketName);
      return {
        collection(collName) {
          console.log('creating collection', bucketName, collName);
          return {
            /**
             * Lists records from the current collection.
             *
             * Sorting is done by passing a `sort` string option:
             *
             * - The field to order the results by, prefixed with `-` for descending.
             * Default: `-last_modified`.
             *
             * @see http://kinto.readthedocs.org/en/latest/api/1.x/cliquet/resource.html#sorting
             *
             * Filtering is done by passing a `filters` option object:
             *
             * - `{fieldname: "value"}`
             * - `{min_fieldname: 4000}`
             * - `{in_fieldname: "1,2,3"}`
             * - `{not_fieldname: 0}`
             * - `{exclude_fieldname: "0,1"}`
             *
             * @see http://kinto.readthedocs.org/en/latest/api/1.x/cliquet/resource.html#filtering
             *
             * Paginating is done by passing a `limit` option, then calling the `next()`
             * method from the resolved result object to fetch the next page, if any.
             *
             * @param  {Object}   options         The options object.
             * @param  {Object}   options.headers The headers object option.
             * @param  {Object}   options.filters The filters object.
             * @param  {String}   options.sort    The sort field.
             * @param  {String}   options.limit   The limit field.
             * @param  {String}   options.pages   The number of result pages to aggregate.
             * @param  {Number}   options.since   Only retrieve records modified since the
             * provided timestamp.
             * @return {Promise<Object, Error>}
             */

            listRecords: (options) => {
              console.log('listing records', options);
              return new Promise((resolve, reject) => {
                ludbud.getFolder('/storage-sync/localhost:8080/', function(err, data) {
                  console.log(err, data);
                  let records = [];
                  let promises = [];

                  for (key in data.items) {
                    promises.push(new Promise((resolve2, reject2) => {
                      ludbud.getDocument('/storage-sync/localhost:8080/'+key, function(err2, data2) {
                        if (err2) {
                          console.log('got error', err2);
                          reject2(err2);
                        } else {
                          console.log('fetched', err2, data2);
                          var str = "";
                          var buf = new Uint8Array(data2.body);
                          for (var i = 0; i < buf.byteLength; i++) {
                            str += String.fromCharCode(buf[i]);
                          }
                          let record = JSON.parse(str);
                          record.last_modified = removeQuotes(data2.info.ETag);
                          records.push(record);
                          resolve2('Fetched data for ' + key);
                        }
                      });
                    }));
                  }
                  console.log('running promises');
                  Promise.all(promises).then(promiseResults => {
                    console.log('done', promiseResults, records);
                    resolve({data: records, last_modified: data.etag});
                  }).catch(e => {
                    console.error('promises error', e);
                    reject(e);
                  });
                });
              });
            },

            /**
             * Performs batch operations at the current collection level.
             *
             * @param  {Function} fn                 The batch operation function.
             * @param  {Object}   options            The options object.
             * @param  {Object}   options.headers    The headers object option.
             * @param  {Boolean}  options.safe       The safe option.
             * @param  {Boolean}  options.aggregate  Produces a grouped result object.
             * @return {Promise<Object, Error>}
             */
            batch: (fn, options) => {
              let promises = [];
              let results = {
                ok:           true,
                lastModified: null,
                errors:       [],
                created:      [],
                updated:      [],
                deleted:      [],
                published:    [],
                conflicts:    [],
                skipped:      [],
                resolved:     [],
              };
              console.log('executing batch', fn, options);
              fn({
                createRecord(r) {
                  console.log('creating record', r);
                  promises.push(new Promise((resolve, reject) => {
                    window.ludbud.create(keyToPath(r.id), JSON.stringify(r), 'application/json',
                      function(err, data) {
                        console.log(err, data);
                        if (err) {
                          reject(err);
                        } else {
                          results.created.push(r);
                          resolve(data);
                        }
                      });
                  }));
                },
                updateRecord(r) {
                  console.log('updating record', r);
                  promises.push(new Promise((resolve, reject) => {
                    window.ludbud.update(keyToPath(r.id), JSON.stringify(r), 'application/json',
                      r.last_modified,
                      function(err, data) {
                        console.log(err, data);
                        if (err) {
                          reject(err);
                        } else {
                          results.updated.push(r);
                          resolve(data);
                        }
                      });
                  }));
                },
                deleteRecord(r) {
                  console.log('deleting record', r);
                  promises.push(new Promise((resolve, reject) => {
                    window.ludbud.remove(keyToPath(r.id),
                      r.last_modified,
                      function(err, data) {
                        console.log(err, data);
                        if (err) {
                          reject(err);
                        } else {
                          results.deleted.push(r);
                          resolve(data);
                        }
                      });
                  }));
                },
              });
              console.log('executed');
              return Promise.all(promises).then(promiseResults => {
                console.log('batch results', promiseResults, results);
                return results;
              });
            },
          };
        },
      };
    },
  };
};
