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
var util = require('util');
var path = require('path');
var fs = require('fs');
var uuid = require('node-uuid');

var utils = require('./util/utils');

function Package(version, temporaryPackagePath) {
  this.temporaryPackagePath = temporaryPackagePath;
  this.integrityHash = true;
  this.pkg = {};

  this.initDefaults(version);
}

_.extend(Package.prototype, {
  initDefaults: function (version) {
    this.pkg.PackageMetaData = {
      KeyValuePair: [{
        Key: 'http://schemas.microsoft.com/windowsazure/ProductVersion/',
        Value: version
      }]
    };
  },

  generateDataStoreHash: function () {
    return uuid.v4().replace(/-/g, '');
  },

  normalizeDataStorePath: function (path) {
    return path.replace(/\\/g, '/');
  },

  normalizeFilePath: function (path) {
    return '\\' + path.replace(/\//g, '\\');
  },

  /*
  * Adds a content to the package data store.
  *
  * @param {string}   store              The store where to add (i.e. LocalContent, NamedStreams, etc).
  * @param {string}   filePath           The name of the file when in a layout. TODO: remove once it's possible to match based on checksum
  * @param {string}   originalFullPath   The file to add to the store.
  * @param {function} callback           The callback function.
  */
  addContentDefinition: function (store, filePath, originalFullPath, callback) {
    var self = this;

    function addLengthInBytes (contentDefinition) {
      contentDefinition.ContentDescription.LengthInBytes = fs.statSync(path.join(self.temporaryPackagePath, contentDefinition.Name)).size;

      self.pkg.PackageContents.ContentDefinition.push(contentDefinition);

      callback(null, contentDefinition);
    }

    function processFile(err, sha) {
      if (err) { return callback(err); }

      if (!self.pkg.PackageContents) {
        self.pkg.PackageContents = {
          ContentDefinition: []
        };
      }

      var dataStorePath = null;
      if (store === 'LocalContent') {
        var hash = self.generateDataStoreHash();
        dataStorePath = hash;
      } else {
        dataStorePath = filePath;
      }

      dataStorePath = self.normalizeDataStorePath(path.join(store, dataStorePath));

      var linksTo;
      var contentPath;
      if (_.isObject(filePath)) {
        linksTo = filePath.linksTo;
        contentPath = filePath.name;
      } else {
        linksTo = null;
        contentPath = filePath;
      }

      var contentDefinition = self.pkg.PackageContents.ContentDefinition.filter(function (content) {
        return content.UnhashedName === linksTo || content.ContentDescription.IntegrityCheckHash === sha;
      })[0];

      if (contentDefinition) {
        contentDefinition = _.clone(contentDefinition);
        contentDefinition.Name = dataStorePath;
        contentDefinition.UnhashedName = contentPath;

        callback(null, contentDefinition);
      } else {
        contentDefinition = {
          UnhashedName: contentPath,
          Name: dataStorePath,
          ContentDescription: {
            IntegrityCheckHashAlgortihm: 'None',
            DataStorePath: dataStorePath
          }
        };

        if (self.integrityHash) {
          contentDefinition.ContentDescription.IntegrityCheckHashAlgortihm = 'Sha256';
          contentDefinition.ContentDescription.IntegrityCheckHash = sha;
        }

        if (originalFullPath && originalFullPath !== path.join(self.temporaryPackagePath, contentDefinition.Name)) {
          utils.copyFile(
            originalFullPath,
            path.join(self.temporaryPackagePath, contentDefinition.Name),
            { carriageReturn: true, createBasepath: true },
            function (err) {
              if (err) {
                callback(err);
              } else {
                addLengthInBytes(contentDefinition);
              }
            });
        } else {
          addLengthInBytes(contentDefinition);
        }
      }
    }

    if (originalFullPath) {
      utils.fileChecksum(originalFullPath, processFile);
    } else {
      processFile();
    }
  },

  addFileDefinition: function (layout, rolePath, fileFullPath, callback) {
    var self = this;
    if (!self.pkg.PackageLayouts) {
      return callback(new Error(util.format('Invalid layout "%s"', layout)));
    }

    var layoutDefinition = self.pkg.PackageLayouts.LayoutDefinition.filter(function (l) { return l.Name === layout; })[0];
    if (!layoutDefinition) {
      return callback(new Error(util.format('Invalid layout "%s"', layout)));
    }

    self.addContentDefinition('LocalContent', rolePath, fileFullPath, function (err, contentDefinition) {
      if (!layoutDefinition.LayoutDescription) {
        layoutDefinition.LayoutDescription = {
          FileDefinition: []
        };
      }

      var fileStat = fs.statSync(path.join(self.temporaryPackagePath, contentDefinition.ContentDescription.DataStorePath));
      var fileDefinition = {
        FilePath: self.normalizeFilePath(contentDefinition.UnhashedName),
        FileDescription: {
          DataContentReference: contentDefinition.ContentDescription.DataStorePath,
          CreatedTimeUtc: fileStat.ctime.toISOString(),
          ModifiedTimeUtc: fileStat.mtime.toISOString(),
          ReadOnly: 'false'
        }
      };

      layoutDefinition.LayoutDescription.FileDefinition.push(fileDefinition);
      callback(null, fileDefinition);
    });
  },

  addLayout: function (layoutName) {
    var self = this;

    if (!self.pkg.PackageLayouts) {
      self.pkg.PackageLayouts = {
        LayoutDefinition: []
      };
    }

    self.pkg.PackageLayouts.LayoutDefinition.push({
      Name: layoutName
    });
  },

  generateManifest: function (tempPackagePath, packageFilename) {
    var self = this;

    var packageContent = utils.processTemplate('package.xml.handlebars', self.pkg, true);
    fs.writeFileSync(path.join(tempPackagePath, packageFilename), packageContent);
  }
});

module.exports = Package;