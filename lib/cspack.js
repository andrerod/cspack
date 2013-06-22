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
var async = require('async');

var HashedPackage = require('./hashedpackage');
var ZipDataStore = require('./store/zipdatastore');
var OpcPackage = require('./opcpackage');

var HandlebarsView = require('./handlebarsview');
var SDKPackage = require('./sdkpackage');

var utils = require('./util/utils');
var constants = require('./util/constants');

function CsPack(options) {
  utils.validateArgs('CsPack', function (v) {
    v.object(options, 'options');
  });

  this.inputDirectory = options.inputDirectory;
  this.outputFile = options.outputFile;
  this.serviceDefinitionFile = options.serviceDefinitionFile;

  this.roles = {};
}

_.extend(CsPack.prototype, {
  execute: function (callback) {
    var self = this;

    _.bindAll(this);
    async.parallel([
      self.initializePackage,
      self.readServiceDefinitionFile
    ], function (err) {
      if (err) { return callback(err); }

      async.parallel([
        self.addLocalContents,
        self.addNamedStreams,
        self.addServiceDefinitions
      ], function (err) {
        if (err) { return callback(err); }

        self.pack(callback);
      });
    });
  },

  /**
  * Initializes a new cspack package.
  *
  * @param {function} callback The callback function.
  */
  initializePackage: function (callback) {
    var self = this;

    var cachePath = path.join(utils.getUserHome(), '.azure/sdkcache');
    utils.mkdirRecursive(cachePath, function (err) {
      if (err) { return callback(err); }

      self.sdkPackage = new SDKPackage({ cachePath: cachePath });
      self.viewEngine = new HandlebarsView();
      self.sdkPackage.getVersion(function (err, version) {
        if (err) { return callback(err); }

        self.pkg = new OpcPackage({
          pkg: new HashedPackage({
            productVersion: version,
            dataStore: new ZipDataStore(),
            viewEngine: self.viewEngine
          }),
          viewEngine: self.viewEngine,
          outputFile: self.outputFile
        });

        callback(null);
      });
    });
  },

  /**
  * Reads and parses a service definition file.
  *
  * @param {function} callback The callback function.
  */
  readServiceDefinitionFile: function (callback) {
    var self = this;
    utils.parseXmlFile(self.serviceDefinitionFile, function (err, serviceDefinitionModel) {
      if (err) { return callback(err); }

      self.serviceDefinitionModel = serviceDefinitionModel.ServiceDefinition;

      function processRole(role, type) {
        if (self.roles[role['$'].name]) {
          return callback(new Error(util.format('Duplicate role %s', role['$'].name)));
        }

        role[type] = true;
        role.type = type;
        role.runtimeModel = {
          netFxVersion: 'v3.5',
          protocolVersion: '2011-03-08'
        };

        self.roles[role['$'].name] = role;
      }

      self.roles = {};

      if (serviceDefinitionModel.ServiceDefinition.WorkerRole) {
        var workerRoles = serviceDefinitionModel.ServiceDefinition.WorkerRole;
        if (!_.isArray(workerRoles)) {
          workerRoles = [ workerRoles ];
        }

        workerRoles.forEach(function (role) {
          processRole(role, constants.RoleTypes.Worker);
        });
      }

      if (serviceDefinitionModel.ServiceDefinition.WebRole) {
        var webRoles = serviceDefinitionModel.ServiceDefinition.WebRole;
        if (!_.isArray(webRoles)) {
          webRoles = [ webRoles ];
        }

        webRoles.forEach(function (role) {
          processRole(role, constants.RoleTypes.Web);
        });
      }

      callback(err, serviceDefinitionModel);
    });
  },

  getApplicationOutputPath: function () {
    return 'approot';
  },

  getSiteOutputPath: function () {
    return 'siteroot';
  },

  /**
  * Adds the required local contents to the package. These are usually the SDK related binaries plus the roles' application files.
  *
  * @param {function} callback The callback function.
  */
  addLocalContents: function (callback) {
    var self = this;

    function createRole(roleName, cb) {
      var layoutDefinitionName = util.format('Roles/%s', roleName);
      self.pkg.addLayoutDefinition(layoutDefinitionName, function (err) {
        if (err) { return cb(err); }

        async.parallel([
          function (done) {
            self.addRoleSDKFiles(roleName, layoutDefinitionName, done);
          },
          function (done) {
            self.addRoleApplicationFiles(roleName, layoutDefinitionName, done);
          }
        ], cb);
      });
    }

    // Locate and/or generate each of the files necessary for each role
    async.each(Object.keys(self.roles), createRole, callback);
  },

  /**
  * Adds the SDK files required for a role.
  *
  * @param {string} roleName             The role name.
  * @param {string} layoutDefinitionName The name of the layout for the role.
  * @param {function} callback The callback function.
  */
  addRoleSDKFiles: function(roleName, layoutDefinitionName, callback) {
    var self = this;

    function addRoleFile(file, done) {
      self.sdkPackage.getFile(file.linksTo || file.name, function (err, content) {
        if (err) { return done(err); }

        self.pkg.addFileDefinition(layoutDefinitionName, file.name, { content: content }, done);
      });
    }

    self.sdkPackage.getFiles(function (err, roleFiles) {
      if (err) { return callback(err); }

      async.eachSeries(roleFiles, addRoleFile, function (err) {
        if (err) { return callback(err); }

        var roleData = { role: self.roles[roleName] };
        self.sdkPackage.getVersion(function (err, sdkVersion) {
          roleData.role.sdkVersion = sdkVersion;

          self.processTemplate(layoutDefinitionName, constants.PackagePaths.LocalContent, 'RoleModel.xml', 'Roles/RoleModel.xml.handlebars', roleData, false, function () {
            self.processTemplate(layoutDefinitionName, constants.PackagePaths.LocalContent, 'RuntimeSetup.Manifest', 'Roles/RuntimeSetup.Manifest.handlebars', roleData, false, function () {

              callback();
            });
          });
        });
      });
    });
  },

  /**
  * Adds the role applicaton files.
  *
  * @param {string} roleName             The role name.
  * @param {string} layoutDefinitionName The name of the layout for the role.
  * @param {function} callback The callback function.
  */
  addRoleApplicationFiles: function (roleName, layoutDefinitionName, callback) {
    var self = this;

    function addApplicationFile(file, done) {
      self.pkg.addFileDefinition(layoutDefinitionName,
        path.join(self.getApplicationOutputPath(), file),
        { filePath: path.join(self.inputDirectory, roleName, file) },
        done);
    }

    utils.getFilesDirectoryRecursive(path.join(self.inputDirectory, roleName), function (err, files) {
      if (err) { return callback(err); }

      async.eachSeries(files, addApplicationFile, callback);
    });
  },

  /**
  * Generates the service definition for the roles.
  *
  * @param {function} callback The callback function.
  */
  addServiceDefinitions: function (callback) {
    var self = this;

    self.processTemplate(null, constants.PackagePaths.ServiceDefinition, 'ServiceDefinition.csdef', 'ServiceDefinition.csdef.handlebars', self.serviceDefinitionModel, true, function () {
      self.processTemplate(null, constants.PackagePaths.ServiceDefinition, 'ServiceDefinition.rd', 'ServiceDefinition.rd.handlebars', self.serviceDefinitionModel, false, function () {
        self.processTemplate(null, constants.PackagePaths.ServiceDefinition, 'ServiceDefinition.rdsc', 'ServiceDefinition.rdsc.handlebars', self.serviceDefinitionModel, true, function () {

          callback();
        });
      });
    });
  },

  /**
  * Adds the named streams part of the package.
  *
  * @param {function} callback The callback function.
  */
  addNamedStreams: function (callback) {
    var self = this;

    async.parallel([
      self.addRequiredFeaturesToPackage,
      self.addSupportedOsToPackage,
      self.addSupportDataToPackage
    ], callback);
  },

  /**
  * Adds the requried features to the package.
  *
  * @param {function} callback The callback function.
  */
  addRequiredFeaturesToPackage: function (callback) {
    var self = this;

    function addRequiredRoleFeatures (roleName, cb) {
      var requiredFeatures = self.getRequiredFeatures(self.roles[roleName]);

      var features = Object.keys(requiredFeatures).map(function (feature) {
        return { name: feature, version: requiredFeatures[feature] };
      });

      var streamName = path.join('RequiredFeatures', roleName, '1.0');
      self.processTemplate(null, constants.PackagePaths.NamedStreams, streamName, 'RequiredFeatures/1.0.handlebars', features, true, cb);
    }

    async.eachSeries(Object.keys(self.roles), addRequiredRoleFeatures, callback);
  },

  /**
  * Derives the required features from the role definition.
  *
  * @param {object} role The role which features should be obtained.
  * @param {function} callback The callback function.
  */
  getRequiredFeatures: function (role) {
    var features = {};

    var fxVersion = role.runtimeModel.netFxVersion;
    if (fxVersion) {
      switch (fxVersion) {
      case 'v4.5':
        features['NetFx45'] = '0';
        break;
      case 'v4.0':
        features['NetFx40'] = '0';
        break;
      case 'v3.5':
        features['NetFx35'] = '0';
        break;
      default:
        throw new Error('Invalid .NET FX version');
      }
    }

    return features;
  },

  /**
  * Adds the supported OSes to the package.
  *
  * @param {function} callback The callback function.
  */
  addSupportedOsToPackage: function (callback) {
    var self = this;

    function addSupportedRoleOs (roleName, cb) {
      var supportedOSes = self.getSupportedOSes(self.roles[roleName]);

      var oSes = Object.keys(supportedOSes).map(function (os) {
        return { name: os, version: supportedOSes[os] };
      });

      var streamName = path.join('SupportedOSes', roleName, '1.0');
      self.processTemplate(null, constants.PackagePaths.NamedStreams, streamName, 'SupportedOsFamilies/1.0.handlebars', oSes, true, cb);
    }

    async.eachSeries(Object.keys(self.roles), addSupportedRoleOs, callback);
  },

  /**
  * Obtains the supported OSes.
  *
  * @param {function} callback The callback function.
  */
  getSupportedOSes: function () {
    return { '3': '0' };
  },

  /**
  * Adds the support data to the package.
  *
  * @param {function} callback The callback function.
  */
  addSupportDataToPackage: function (callback) {
    var self = this;

    function addSupportRoleData (roleName, cb) {
      var role = self.roles[roleName];

      var netFxVersion = role.runtimeModel.netFxVersion;
      var entryPointElevated = false;
      var startupTaskElevated = false;

      if (role.Startup && role.Startup.Task) {
        var tasks = role.Startup.Task;
        if (!_.isArray(tasks)) {
          tasks = [ tasks ];
        }

        startupTaskElevated = tasks.some(function (t) {
          return t['$']['executionContext'] === 'elevated';
        });
      }

      self.sdkPackage.getVersion(function (err, sdkVersion) {
        var supportData = {
          SDKVersion: sdkVersion,
          TargetFrameworkVersion: netFxVersion,
          HasElevatedEntrypoint: entryPointElevated.toString(),
          HasElevatedStartupTaskInCsdef: startupTaskElevated.toString()
        };

        var streamName = path.join('SupportData', roleName, '1.0');
        self.processTemplate(null, constants.PackagePaths.NamedStreams, streamName, 'SupportData/1.0.handlebars', supportData, true, cb);
      });
    }

    async.eachSeries(Object.keys(self.roles), addSupportRoleData, callback);
  },

  /**
  * Packs the package into a cspkg file as specified in the outputFile parameter.
  *
  * @param {function} callback The callback function.
  */
  pack: function (callback) {
    var self = this;

    // Create OPC package
    self.pkg.save(callback);
  },

  /**
  * Generates a package file from a template adding it to the package definition.
  *
  * @param {string} [layout]     The name of the layout to which the resulting file belongs.
  * @param {string} store        The store for the file.
  * @param {string} templateFile The template file from where to generate the file.
  * @param {object} templateData The template data used to generate the file.
  * @param {bool}   addBom       Boolean value indicating if a byte order mark should be added to the result.
  * @param {function} cb The callback function.
  */
  processTemplate: function (layout, store, outputFile, templateFile, templateData, addBom, cb) {
    var self = this;
    var output = self.viewEngine.render(path.join(__dirname, 'templates', store, templateFile), templateData, addBom, false);

    if (layout) {
      self.pkg.addFileDefinition(layout, outputFile, { content: output }, cb);
    } else {
      self.pkg.addContentDefinition(store, outputFile, { content: output }, cb);
    }
  }
});

module.exports = CsPack;