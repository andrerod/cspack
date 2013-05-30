/**
* Copyright (c) Microsoft.  All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

var path = require('path');
var fs = require('fs');

var zip = new require('node-zip');
var isBinaryFile = require('isbinaryfile');
var _ = require('underscore');

/**
* Creates a new zip store object.
*
* @constructor
*
* @param {object} [options]             The package options.
* @param {object} [options.archiveFile] The optional original archive.
*/
function ZipDataStore(options) {
  if (options && options.archiveFile) {
    this.archive = new zip(fs.readFileSync(options.archiveFile).toString('base64'), { base64: true });
  } else {
    this.archive = new zip();
  }
}

_.extend(ZipDataStore.prototype, {
  /**
  * Retrieves the stats about a file.
  *
  * @param {string} dataStorePath The data store path.
  * @param {function(err, stat)} callback The callback function.
  */
  getContentStat: function (dataStorePath, callback) {
    var self = this;

    self.getContent(dataStorePath, function (err, content) {
      if (err) { return callback(err); }

      var zipFile = self.archive.file(getOpcFilename(dataStorePath));

      var size;
      if (Buffer.isBuffer(content)) {
        // Buffer contents
        if (content.encoding === 'base64') {
          size = content.toString('base64').length;
        } else {
          size = content.toString('binary').length;
        }
      } else {
        // Pure string contents
        size = content.toString().length;
      }

      callback(null, {
        size: size,
        ctime: zipFile.options.date,
        mtime: zipFile.options.date
      });
    });
  },

  /**
  * Retrieves the content of a file.
  *
  * @param {string} dataStorePath The data store path.
  * @param {function(err, stat)} callback The callback function.
  */
  getContent: function (dataStorePath, callback) {
    var self = this;

    dataStorePath = getOpcFilename(dataStorePath);
    if (!self.archive.file(dataStorePath)) {
      return callback(new Error('Invalid data store path'));
    }

    var zipFile = self.archive.file(dataStorePath);

    var content = null;
    if (zipFile.options.base64) {
      content = new Buffer(zipFile.data, 'base64');
      content.encoding = 'base64';
    } else if (zipFile.options.binary) {
      content = new Buffer(zipFile.data, 'binary');
      content.encoding = 'binary';
    } else {
      content = new Buffer(zipFile.data);
    }

    callback(null, content);
  },

  /**
  * Retrieves the name of the contents stored.
  *
  * @param {function(err, contentNames)} callback The callback function.
  */
  getContents: function (callback) {
    var self = this;

    var contents = Object.keys(self.archive.files);
    contents = contents.filter(function (c) {
      return self.archive.file(c) &&
        !self.archive.file(c).options.dir;
    });

    callback(null, contents);
  },

  /**
  * Adds content to the data store from a file.
  *
  * @param {string} name   The name of the content to add.
  * @param {object} origin The origin of the content to add.
  * @param {string} origin.filePath The origin file path.
  * @param {string} origin.content  The origin content.
  * @param {function(err, stat)} callback The callback function.
  */
  addContent: function (name, origin, callback) {
    var self = this;

    if (origin.filePath) {
      self.addContentFromFile(name, origin.filePath, callback);
    } else {
      self.addContentFromBuffer(name, origin.content, callback);
    }
  },

  /**
  * Adds content to the data store from a file.
  *
  * @param {string} name         The name of the content to add.
  * @param {string} fileFullPath The path to the file to add.
  * @param {function(err, stat)} callback The callback function.
  */
  addContentFromFile: function (name, fileFullPath, callback) {
    var self = this;

    self.addFoldersIfNotExist(path.dirname(name), function (err) {
      if (err) { return callback(err); }

      var isBinary = isBinaryFile(fileFullPath);
      if (isBinary) {
        fs.readFile(fileFullPath, 'binary', function (err, content) {
          if (err) { return callback(err); }

          self.archive.file(getOpcFilename(name), content.toString('binary'), { binary: true });
          callback(null);
        });
      } else {
        fs.readFile(fileFullPath, 'base64', function (err, content) {
          if (err) { return callback(err); }

          self.archive.file(getOpcFilename(name), content.toString('base64'), { base64: true });
          callback(null);
        });
      }
    });
  },

  /**
  * Adds content to the data store from a string.
  *
  * @param {string} name      The name of the content to add.
  * @param {string} content   The content to add.
  * @param {function(err, stat)} callback The callback function.
  */
  addContentFromBuffer: function (name, content, callback) {
    var self = this;

    self.addFoldersIfNotExist(path.dirname(name), function (err) {
      if (err) { return callback(err); }

      if (!Buffer.isBuffer(content)) {
        content = new Buffer(content);
      }

      if (content.encoding === 'binary') {
        self.archive.file(getOpcFilename(name), content.toString('binary'), { binary: true });
      } else {
        self.archive.file(getOpcFilename(name), content.toString('base64'), { base64: true });
      }

      callback(null);
    });
  },

  addFoldersIfNotExist: function (directoryPath, callback) {
    var self = this;
    var dirPaths = directoryPath.split(path.sep);

    function execute(dirs, root) {
      if (!dirs.length) {
        return callback();
      }

      var dir = dirs.shift();

      if (dir[0] !== '.') {
        root = (root || '') + dir + path.sep;
        self.archive.folder(root);
      }

      execute(dirs, root);
    }

    execute(dirPaths, undefined);
  },

  /**
  * Save the data store.
  *
  * @param {function(err)} callback The callback function.
  */
  save: function (callback) {
    var data = this.archive.generate({ base64: false, compression: 'DEFLATE' });
    callback(null, data);
  }
});

function getOpcFilename(file) {
  return file.replace(/\\/g, '/');
}

module.exports = ZipDataStore;