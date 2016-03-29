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
      ludbud = new Ludbud(userDataCredentials);
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

  //... on page load:
  var ludbud;
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
              return Promise.resolve({data: [], last_modified: '"0"'});
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
              console.log('executing batch', fn, options);
              fn({
                createRecord(r) {
                  console.log('creating record', r);
                },
                updateRecord(r) {
                  console.log('updating record', r);
                },
                deleteRecord(r) {
                  console.log('deleting record', r);
                },
              });
              console.log('executed');
              return Promise.resolve({
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
              });
            },
          };
        },
      };
    },
  };
};
