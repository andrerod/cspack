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

var _ = require('underscore');

var utils = require('./util/utils');
var constants = require('./util/constants');

function OpcPackage(options) {
  utils.validateArgs('OpcPackage', function (v) {
    v.object(options, 'options');
    v.object(options.pkg, 'option.pkg');
    v.object(options.viewEngine, 'option.viewEngine');
    v.string(options.outputFile, 'option.outputFile');
  });

  this.pkg = options.pkg;
  this.viewEngine = options.viewEngine;
  this.outputFile = options.outputFile;
}

_.extend(OpcPackage.prototype, {
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
    return this.pkg.addContentDefinition(store, name, origin, callback);
  },

  /**
  * Gets a content definition from the package.
  *
  * @param {string} name The name of the content to get.
  * @return {object} The content definition or null if not found.
  */
  getContentDefinition: function (name) {
    return this.pkg.getContentDefinition(name);
  },

  /**
  * Adds a layout definition to the package.
  *
  * @param {string} layoutName The name of the layout to add.
  * @param {function(err, layoutDefinition)} callback The callback function.
  */
  addLayoutDefinition: function (layoutName, callback) {
    return this.pkg.addLayoutDefinition(layoutName, callback);
  },

  /**
  * Gets a layout definition from the package.
  *
  * @param {string} layoutName The name of the layout to get.
  * @return {object} The layout definition or null if not found.
  */
  getLayoutDefinition: function (layoutName) {
    return this.pkg.getLayoutDefinition(layoutName);
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
    return this.pkg.addFileDefinition(layoutName, rolePath, origin, callback);
  },

  /**
  * Gets a file definition from the package.
  *
  * @param {string} layoutName The name of the layout where the file is stored.
  * @param {string} rolePath   The path for the file within the role.
  * @return {object} The file definition or null if not found.
  */
  getFileDefinition: function (layoutName, rolePath) {
    return this.pkg.getFileDefinition(layoutName, rolePath);
  },

  /**
  * Retrieves the stats about a file.
  *
  * @param {string} dataStorePath The data store path.
  * @param {function(err, stat)} callback The callback function.
  */
  getContentStat: function (dataStorePath, callback) {
    return this.pkg.getContentStat(dataStorePath, callback);
  },

  /**
  * Retrieves the content of a file.
  *
  * @param {string} dataStorePath The data store path.
  * @param {function(err, stat)} callback The callback function.
  */
  getContent: function (dataStorePath, callback) {
    return this.pkg.getContents(dataStorePath, callback);
  },

  /**
  * Retrieves the name of the contents stored.
  *
  * @param {function(err, contentNames)} callback The callback function.
  */
  getContents: function (callback) {
    return this.pkg.getContents(callback);
  },

  /**
  * Adds content to the data store from a file.
  *
  * @param {string} name   The name of the content to add.
  * @param {object} origin The origin of the content to add.
  * @param {function(err, stat)} callback The callback function.
  */
  addContent: function (name, origin, callback) {
    return this.pkg.addContent(name, origin, callback);
  },

  /*
  * Generates the OPC specific files ([Content_types].xml and res/.rels) and the final cspkg file.
  *
  * As described in: // http://msdn.microsoft.com/en-us/library/windowsazure/jj151531.aspx.
  */
  save: function (callback) {
    var self = this;

    self.pkg.getContents(function (err, files) {
      var contentTypes = [];

      function addContentType(name, contentType) {
        contentTypes.push({
          PartName: name,
          ContentType: contentType
        });
      }

      files.forEach(function (file) {
        if (file.substr(0, constants.PackagePaths.LocalContent.length) === constants.PackagePaths.LocalContent) {
          addContentType('/' + file, 'application/octet-stream');
        }
      });

      // Add content types file
      var contentTypesContent = self.viewEngine.render(path.join(__dirname, 'templates/[Content_Types].xml.handlebars'), contentTypes, true);
      self.pkg.addContent('[Content_Types].xml', { content: contentTypesContent }, function (err) {
        if (err) { return callback(err); }

        // Add .rels file
        var relsContent = self.viewEngine.render(path.join(__dirname, 'templates/_rels/.rels.handlebars'), {}, true);
        self.pkg.addContent('_rels/.rels', { content: relsContent }, function (err) {
          if (err) { return callback(err); }

          self.pkg.save(function (err, data) {
            if (err) { return callback(err); }

            fs.writeFile(self.outputFile, data, 'binary', callback);
          });
        });
      });
    });
  }
});

module.exports = OpcPackage;