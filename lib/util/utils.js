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

exports.mkdir = function (path, root) {
  var dirs = path.split('/'), dir = dirs.shift();

  root = (root||'')+dir+'/';

  try { fs.mkdirSync(root); }
  catch (e) {
    //dir wasn't made, something went wrong
    if(!fs.statSync(root).isDirectory()) throw new Error(e);
  }

  return !dirs.length || exports.mkdir(dirs.join('/'), root);
};

exports.parseXmlFile = function (filePath, callback) {
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
};

exports.getFilesDirectory = function (path, callback) {
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
};

exports.copyFiles = function (files, target, cb) {
  if (files.length > 0) {
    var currentFile = files.pop();

    exports.copyFile(currentFile, path.join(target, path.basename(currentFile)), function (err) {
      if (err) {
        cb(err);
      } else {
        exports.copyFiles(files, target, cb);
      }
    });
  } else {
    cb();
  }
};

exports.copyFile = function (source, target, cb) {
  var cbCalled = false;

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

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
};