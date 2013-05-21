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

var _ = require('underscore');
var fs = require('fs');
var xml2js = require('xml2js');
var path = require('path');
var wrench = require('wrench');
var crypto = require('crypto');
var isBinaryFile = require('isbinaryfile');
var Handlebars = require('handlebars');

_.extend(exports, {
  mkdir: function (directoryPath, root) {
    var dirs = directoryPath.split(path.sep), dir = dirs.shift();

    root = (root || '') + dir + path.sep;

    try {
      fs.mkdirSync(root);
    } catch (e) {
      // dir wasn't made, something went wrong
      if(!fs.statSync(root).isDirectory()) throw new Error(e);
    }

    return !dirs.length || exports.mkdir(dirs.join(path.sep), root);
  },

  parseXmlFile: function (filePath, callback) {
    var content = fs.readFileSync(filePath);
    var cleanedString = content.toString().replace('\ufeff', '');

    // TODO: move this somewhere else
    var xml2jsSettings = _.clone(xml2js.defaults['0.2']);
    xml2jsSettings.normalize = false;
    xml2jsSettings.trim = false;
    xml2jsSettings.attrkey = '$';
    xml2jsSettings.charkey = '_';
    xml2jsSettings.explicitArray = false;

    var parser = new xml2js.Parser(xml2jsSettings);
    parser.parseString(cleanedString, callback);
  },

  getFilesDirectory: function (path, callback) {
    var files = [];
    wrench.readdirRecursive(path, function (error, curFiles) {
      if (error) {
        return callback(error);
      } else if (!curFiles) {
        return callback(null, files);
      } else {
        files = files.concat(curFiles);
      }
    });
  },

  copyFile: function (source, target, options, cb) {
    var cbCalled = false;

    function done(err) {
      if (!cbCalled) {
        cb(err);
        cbCalled = true;
      }
    }

    var isBinary = true;
    if (options) {
      if (options.carriageReturn) {
        isBinary = isBinaryFile(source);
      }

      if (options.createBasepath) {
        exports.mkdir(path.dirname(target));
      }
    }

    if (isBinary) {
      var rd = fs.createReadStream(source);

      rd.on('error', function (err) {
        done(err);
      });

      var wr = fs.createWriteStream(target);
      wr.on('error', function (err) {
        done(err);
      });

      wr.on('close', function () {
        done();
      });

      rd.pipe(wr);
    } else {
      var content = fs.readFileSync(source).toString();
      if (content.indexOf('\r\n') === -1) {
        content = content.replace(/\n/g, '\r\n');
      }

      fs.writeFileSync(target, content);
      cb(null);
    }
  },

  filesChecksum: function (outputRoot, files, callback, processed) {
    if (files.length > 0) {
      var file = files.pop();

      var currentFile = file;
      var currentLink = currentFile;
      if (_.isObject(file)) {
        currentFile = file.name;
        currentLink = file.linksTo;
      }

      exports.fileChecksum(path.join(outputRoot, currentFile), function (err, checksum) {
        if (!processed) {
          processed = [];
        }

        processed.push({
          name: '\\' + currentLink.replace(/\//g, '\\'),
          hash: checksum.toUpperCase(),
          uri: '/' + currentLink.replace(/\\/g, '/')
        });

        exports.filesChecksum(outputRoot, files, callback, processed);
      });
    } else {
      callback(null, processed);
    }
  },

  fileChecksum: function (filename, callback) {
    var algo = 'sha256';
    var shasum = crypto.createHash(algo);

    var s = fs.ReadStream(filename);
    s.on('data', function(d) { shasum.update(d); });
    s.on('end', function() {
      callback(null, shasum.digest('hex'));
    });
  },

  addBOM: function (content) {
    return '\ufeff' + content;
  },

  processTemplate: function (templatePath, templateData, addBOM) {
    var content = Handlebars.compile(
      fs.readFileSync(path.join(__dirname, '../templates/', templatePath)).toString()
    )(templateData).replace(/\&\#92;/g, '\\');

    if (addBOM) {
      content = exports.addBOM(content);
    }

    return content;
  }
});