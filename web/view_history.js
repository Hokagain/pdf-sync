/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const DEFAULT_VIEW_HISTORY_CACHE_SIZE = 20;
import {
  config
} from '../config';
import md5 from '../node_modules/blueimp-md5/js/md5.js'
//import md5 from '../node_modules/js-md5/src/md5.js';
import PouchDB from './../node_modules/pouchdb/dist/pouchdb.js';
import PouchdbAuthentication from '../node_modules/pouchdb-authentication/dist/pouchdb.authentication.js';
PouchDB.plugin(PouchdbAuthentication);



// import PouchDB from 'pouch// console.log(databaseStr);

// electron or gulp server
// let url = new URL(window.location.href);
// '/db' for gulp proxy
// let origin = url.protocol == 'file:' ? config.server_origin : url.origin + '/db';
let origin = config.server_origin;
let db = new PouchDB(origin + '/pdf-sync');
db.logIn(config.server_admin, config.server_passwd, function (err, res) {
  if (err) {
    console.log(err);
  } else {
    console.log('haved login.');
  }
});
/**
 * View History - This is a utility for saving various view parameters for
 *                recently opened files.
 *
 * The way that the view parameters are stored depends on how PDF.js is built,
 * for 'gulp <flag>' the following cases exist:
 *  - FIREFOX or MOZCENTRAL - uses sessionStorage.
 *  - GENERIC or CHROME     - uses localStorage, if it is available.
 */
class ViewHistory {
  constructor(fingerprint, cacheSize = DEFAULT_VIEW_HISTORY_CACHE_SIZE) {
    this.fingerprint = fingerprint;
    this.cacheSize = cacheSize;
    this._initializedPromise = this._readFromStorage().then((databaseStr) => {
      let database = JSON.parse(databaseStr || '{}');
      if (!('files' in database)) {
        database.files = [];
      } else {
        while (database.files.length >= this.cacheSize) {
          database.files.shift();
        }
      }
      let index = -1;
      for (let i = 0, length = database.files.length; i < length; i++) {
        let branch = database.files[i];
        if (branch.fingerprint === this.fingerprint) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        index = database.files.push({
          fingerprint: this.fingerprint,
        }) - 1;
      }
      this.file = database.files[index];
      this.database = database;
    });
  }

  async _writeToStorage() {
    let databaseStr = JSON.stringify(this.database);
    let username = localStorage.getItem('pdf-sync.username') ? localStorage.getItem(
      'pdf-sync.username') : 'guest';
    let passwd = localStorage.getItem('pdf-sync.passwd') ? localStorage.getItem(
      'pdf-sync.passwd') : md5('******');
    if (typeof PDFJSDev !== 'undefined' &&
      PDFJSDev.test('FIREFOX || MOZCENTRAL')) {
      sessionStorage.setItem('pdfjs.history', databaseStr);
      return;
    }

    try {
      let doc = await db.get(username);
      try {
        let res = await db.put({
          _id: username,
          username,
          passwd,
          databaseStr,
          _rev: doc._rev,
        });
        console.log(res);
      } catch (err) {
        console.log(err);
      }
    } catch (err) {
      console.log(err);
      try {
        let res = await db.put({
          _id: username,
          username,
          passwd,
          databaseStr,
        });
        console.log(res);
      } catch (err) {
        console.log(err);
      }
    }
    localStorage.setItem('pdfjs.history', databaseStr);
  }

  async _readFromStorage() {
    let username = localStorage.getItem('pdf-sync.username') ? localStorage.getItem(
      'pdf-sync.username') : 'guest';
    let passwd = localStorage.getItem('pdf-sync.passwd') ? localStorage.getItem(
      'pdf-sync.passwd') : md5('******');
    if (typeof PDFJSDev !== 'undefined' &&
      PDFJSDev.test('FIREFOX || MOZCENTRAL')) {
      return sessionStorage.getItem('pdfjs.history');
    }
    // console.log(databaseStr);

    try {
      let doc = await db.get(username);
      console.log(doc);
      return doc['databaseStr'];
    } catch (err) {
      console.log(err);
      return localStorage.getItem('pdfjs.history');
    }
    //

  }

  async set(name, val) {
    await this._initializedPromise;
    this.file[name] = val;
    return this._writeToStorage();
  }

  async setMultiple(properties) {
    await this._initializedPromise;
    for (let name in properties) {
      this.file[name] = properties[name];
    }
    return this._writeToStorage();
  }

  async get(name, defaultValue) {
    await this._initializedPromise;
    let val = this.file[name];
    return val !== undefined ? val : defaultValue;
  }

  async getMultiple(properties) {
    await this._initializedPromise;
    let values = Object.create(null);

    for (let name in properties) {
      let val = this.file[name];
      values[name] = val !== undefined ? val : properties[name];
    }
    return values;
  }
}

export {
  ViewHistory,
};
