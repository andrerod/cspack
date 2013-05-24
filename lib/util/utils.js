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

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var _ = require('underscore');
var wrench = require('wrench');
var xml2js = require('xml2js');

_.extend(exports, {
  /**
  * Copies a file accross two paths.
  *
  * @param {string} source  The source path.
  * @param {string} target  The target path.
  * @param {string} options The copy options.
  * @param {function(err)} callback The callback.
  */
  copyFile: function (source, target, options, callback) {
    var cbCalled = false;

    function done(err) {
      if (!cbCalled) {
        callback(err);
        cbCalled = true;
      }
    }

    function execute() {
      var readStream = fs.createReadStream(source);
      readStream.on('error', done);

      var writeStream = fs.createWriteStream(target);
      writeStream.on('close', done);
      writeStream.on('error', done);

      readStream.pipe(writeStream);
    }

    if (options && options.createBasepath) {
      exports.mkdirRecursive(path.dirname(target), execute);
    } else {
      execute();
    }
  },

  /**
  * Removes a directory recursively.
  *
  * @param {string} path The path of the directory to remove.
  * @param {function(err)} callback The callback.
  */
  rmDirRecursive: function (path, callback) {
    if (fs.exists(path, function (exists) {
      if (!exists) { return callback(); }
      wrench.rmdirRecursive(path, true, callback);
    }));
  },

  /**
  * Creates a directory recursively.
  *
  * @param {string} directoryPath The full path of the directory(s) to create.
  */
  mkdirRecursive: function (directoryPath, callback, root) {
    var dirs = directoryPath.split(path.sep);

    if (!dirs.length) {
      return callback();
    }

    var dir = dirs.shift();
    root = (root || '') + dir + path.sep;

    fs.mkdir(root, function (err1) {
      if (err1) {
        fs.stat(root, function (err2, stat) {
          if (err2) { return callback(err2); }

          if (!stat.isDirectory()) {
            return callback(err1);
          }

          exports.mkdirRecursive(dirs.join(path.sep), callback, root);
        });
      } else {
        exports.mkdirRecursive(dirs.join(path.sep), callback, root);
      }
    });
  },

  /**
  * Calculates the checksum of a file.
  *
  * @param {string} filename         The file name.
  * @param {string} hashingAlgorithm The hashing algorithm (e.g. sha256)
  * @param {function(err, checksum)} callback The file checksum.
  */
  calculateFileChecksum: function (filename, hashingAlgorithm, callback) {
    var shasum = crypto.createHash(hashingAlgorithm);

    var readStream = fs.ReadStream(filename);
    readStream.on('data', function(chunk) { shasum.update(chunk); });
    readStream.on('end', function() {
      callback(null, shasum.digest('hex'));
    });
  },

  /**
  * Adds a UTF8 byte order mark to a string.
  *
  * @param {string} content The string where to add the BOM.
  * @return {string} The content with a BOM.
  */
  addBOM: function (content) {
    return '\ufeff' + content;
  },

  /**
  * Parses a XML file to JSON using xml2js.
  *
  * @param {string} filePath The path of the file to parse.
  * @param {function(err, object)} callback The callback function.
  */
  parseXmlFile: function (filePath, callback) {
    var content = fs.readFileSync(filePath);
    var cleanedString = content.toString().replace('\ufeff', '');

    exports.parseXmlString(cleanedString, callback);
  },

  /**
  * Parses a XML string to JSON using xml2js.
  *
  * @param {string} filePath The path of the file to parse.
  * @param {function(err, object)} callback The callback function.
  */
  parseXml: function (content, callback) {
    var xml2jsSettings = _.clone(xml2js.defaults['0.2']);
    xml2jsSettings.normalize = false;
    xml2jsSettings.trim = false;
    xml2jsSettings.attrkey = '$';
    xml2jsSettings.charkey = '_';
    xml2jsSettings.explicitArray = false;

    var parser = new xml2js.Parser(xml2jsSettings);
    parser.parseString(content, callback);
  },

  /**
  * Validates a function's arguments.
  *
  * @param {string}   functionName    The name of the function to validate the arguments for.
  * @param {function} validationRules The validation rules.
  */
  validateArgs: function (functionName, validationRules) {
    var validator = new ArgumentValidator(functionName);
    validationRules(validator);
  }
});

// common functions for validating arguments

function throwMissingArgument(name, func) {
  throw new Error('Required argument ' + name + ' for function ' + func + ' is not defined');
}

function ArgumentValidator(functionName) {
  this.func = functionName;
}

_.extend(ArgumentValidator.prototype, {
  string: function (val, name) {
    if (typeof val != 'string' || val.length === 0) {
      throwMissingArgument(name, this.func);
    }
  },
  object: function (val, name) {
    if (!val) {
      throwMissingArgument(name, this.func);
    }
  },
  value: function (val, name) {
    if (!val) {
      throwMissingArgument(name, this.func);
    }
  },
  callback: function (val) {
    this.object(val, 'callback');
  }
});