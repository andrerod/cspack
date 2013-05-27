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
var util = require('util');

var _ = require('underscore');
var uuid = require('node-uuid');

var utils = require('./util/utils');
var constants = require('./util/constants');

/**
* Creates a new Package object.
*
* http://msdn.microsoft.com/en-us/library/windowsazure/jj151528.aspx
*
* @constructor
*
* @param {object} options                The package options.
* @param {string} options.productVersion The package version.
* @param {string} options.dataStore      The data store.
*/
function Package(options) {
  utils.validateArgs('Package', function (v) {
    v.object(options, 'options');
    v.string(options.productVersion, 'options.productVersion');
    v.object(options.dataStore, 'option.dataStore');
    v.object(options.viewEngine, 'option.viewEngine');
  });

  this.dataStore = options.dataStore;
  this.productVersion = options.productVersion;
  this.viewEngine = options.viewEngine;
  this.pkg = {};
}

_.extend(Package.prototype, {
  /**
  * Creates a new content name. Typically, a guid.
  *
  * @return {string} The new content name.
  */
  generateContentName: function () {
    return uuid.v4().replace(/-/g, '');
  },

  /**
  * Normalizes a content definition name.
  *
  * The content definition name is the unique identifier
  * for a resource stored in the package.
  *
  * @param {string} path The content path to normalize.
  * @return {string} The normalized content name.
  */
  normalizeContentName: function (path) {
    return path.replace(/\\/g, '/');
  },

  /**
  * Normalizes a file definition file path.
  * 
  * The file definition file path represents
  * the path the file will assume when deployed within
  * the targeted layout (role).
  *
  * @param {string} path The file path to normalize.
  * @return {string} The normalized file path.
  */
  normalizeFilePath: function (path) {
    return '\\' + path.replace(/\//g, '\\');
  },

  /**
  * Adds a content to the package data store.
  *
  * @param {string} store            The store where to add (i.e. LocalContent, NamedStreams, etc).
  * @param {string} [name]           The name of the content definition. If null, a guid will be used instead.
  * @param {object} origin           The content definition origin.
  * @param {string} origin.filePath  The origin file path.
  * @param {string} origin.content   The origin content.
  * @param {function(err, contentDefinition)} callback The callback function.
  */
  addContentDefinition: function (store, name, origin, callback) {
    var self = this;

    utils.validateArgs('addContentDefinition', function (v) {
      v.string(store, 'store');
      v.object(origin, 'origin');
      v.callback(callback, 'callback');
    });

    var dataStorePath = self.normalizeContentName(path.join(store, name || self.generateContentName()));
    self.dataStore.addContent(dataStorePath, origin, function (err) {
      if (err) { return callback(err); }

      self.dataStore.getContentStat(dataStorePath, function (err, stat) {
        if (err) { return callback(err); }

        var contentDefinition = {
          Name: dataStorePath,
          ContentDescription: {
            LengthInBytes: stat.size,
            IntegrityCheckHashAlgortihm: 'None',
            DataStorePath: dataStorePath
          }
        };

        if (!self.pkg.PackageContents) {
          self.pkg.PackageContents = { ContentDefinition: [ contentDefinition ] };
        } else {
          self.pkg.PackageContents.ContentDefinition.push(contentDefinition);
        }

        return callback(null, contentDefinition);
      });
    });
  },

  /**
  * Gets a content definition from the package.
  *
  * @param {string} name The name of the content to get.
  * @return {object} The content definition or null if not found.
  */
  getContentDefinition: function (name) {
    if (this.pkg.PackageContents && this.pkg.PackageContents.ContentDefinition) {
      return this.pkg.PackageContents.ContentDefinition.filter(function (content) {
        return content.Name === name;
      })[0] || null;
    }

    return null;
  },

  /**
  * Adds a layout definition to the package.
  *
  * @param {string} layoutName The name of the layout to add.
  * @param {function(err, layoutDefinition)} callback The callback function.
  */
  addLayoutDefinition: function (layoutName, callback) {
    var self = this;

    utils.validateArgs('addLayoutDefinition', function (v) {
      v.string(layoutName, 'layoutName');
    });

    if (self.getLayoutDefinition(layoutName)) {
      return callback(new Error(util.format('Layout "%s" already exists', layoutName)));
    }

    if (!self.pkg.PackageLayouts) {
      self.pkg.PackageLayouts = {
        LayoutDefinition: []
      };
    }

    var layoutDefinition = { Name: layoutName };
    self.pkg.PackageLayouts.LayoutDefinition.push(layoutDefinition);
    return callback(null, layoutDefinition);
  },

  /**
  * Gets a layout definition from the package.
  *
  * @param {string} layoutName The name of the layout to get.
  * @return {object} The layout definition or null if not found.
  */
  getLayoutDefinition: function (layoutName) {
    var self = this;

    utils.validateArgs('addLayoutDefinition', function (v) {
      v.string(layoutName, 'layoutName');
    });

    if (!self.pkg.PackageLayouts) {
      return null;
    }

    return self.pkg.PackageLayouts.LayoutDefinition.filter(function (l) { return l.Name === layoutName; })[0] || null;
  },

  /**
  * Adds a file definition to the package.
  *
  * @param {string} layoutName      The name of the layout where the file is stored.
  * @param {string} rolePath        The path for the file within the role.
  * @param {object} origin          The content definition origin.
  * @param {string} origin.filePath The origin file path.
  * @param {string} origin.content  The origin content.
  * @param {function(err, fileDefinition)} callback The callback function.
  */
  addFileDefinition: function (layoutName, rolePath, origin, callback) {
    var self = this;

    utils.validateArgs('addFileDefinition', function (v) {
      v.string(layoutName, 'layoutName');
      v.string(rolePath, 'rolePath');
      v.object(origin, 'origin');
      v.callback(callback, 'callback');
    });

    var layoutDefinition = self.getLayoutDefinition(layoutName);
    if (!layoutDefinition) {
      return callback(new Error(util.format('Layout "%s" does not exists', layoutName)));
    }

    self.addContentDefinition(constants.PackagePaths.LocalContent, null, origin, function (err, contentDefinition) {
      if (err) { return callback(err); }

      self.dataStore.getContentStat(contentDefinition.ContentDescription.DataStorePath, function (err, fileStat) {
        if (err) { return callback(err); }

        var fileDefinition = {
          FilePath: self.normalizeFilePath(rolePath),
          FileDescription: {
            DataContentReference: contentDefinition.ContentDescription.DataStorePath,
            CreatedTimeUtc: fileStat.ctime.toISOString(),
            ModifiedTimeUtc: fileStat.mtime.toISOString(),
            ReadOnly: 'false'
          }
        };

        if (!layoutDefinition.LayoutDescription) {
          layoutDefinition.LayoutDescription = { FileDefinition: [ fileDefinition ] };
        } else {
          layoutDefinition.LayoutDescription.FileDefinition.push(fileDefinition);
        }

        return callback(null, fileDefinition);
      });
    });
  },

  /**
  * Gets a file definition from the package.
  *
  * @param {string} layoutName The name of the layout where the file is stored.
  * @param {string} rolePath   The path for the file within the role.
  * @return {object} The file definition or null if not found.
  */
  getFileDefinition: function (layoutName, rolePath) {
    var self = this;

    utils.validateArgs('addFileDefinition', function (v) {
      v.string(layoutName, 'layoutName');
      v.string(rolePath, 'rolePath');
    });

    var layoutDefinition = self.getLayoutDefinition(layoutName);
    if (!layoutDefinition) {
      throw new Error(util.format('Layout "%s" does not exist', layoutName));
    }

    return layoutDefinition.LayoutDescription.FileDefinition.filter(function (f) {
      return f.FilePath === self.normalizeFilePath(rolePath);
    })[0] || null;
  },

  /**
  * Generates the package manifest.
  *
  * @param {function(err)} callback The callback function.
  */
  generateManifest: function (callback) {
    var self = this;

    if (!self.pkg.PackageMetaData) {
      self.pkg.PackageMetaData = {
        KeyValuePair: [{
          Key: 'http://schemas.microsoft.com/windowsazure/ProductVersion/',
          Value: self.productVersion
        }]
      };
    }

    self.dataStore.addContentFromString(constants.PackagePaths.PackageManifest,
      self.viewEngine.render(self.pkg),
      callback);
  }
});

module.exports = Package;