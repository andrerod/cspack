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
var path = require('path');
var util = require('util');
var wrench = require('wrench');

var Package = require('./package');
var utils = require('./util/utils');
var constants = require('./util/constants');
var opc = require('./opc');
var async = require('async');

var TEMPORARY_PACKAGE_PATH = 'package';
var TEMPLATE_PACKAGE_DIRECTORY = 'pkg';

var SDKPaths = {
  SDKVersion: '1.8.31004.1351'
};

function CsPack(options) {
  this.inputDirectory = options.inputDirectory;
  this.outputRoot = options.outputDirectory;
  this.temporaryPackagePath = path.join(this.outputRoot, TEMPORARY_PACKAGE_PATH);
  this.basePackagePath = path.join(__dirname, 'pkg');
  this.serviceDefinitionFile = options.serviceDefinitionFile;
  this.packageFileName = options.packageFileName;
  this.package = new Package(SDKPaths.SDKVersion, this.temporaryPackagePath);

  this.roles = {};
}

CsPack.package = function (options, callback) {
  var csPack = new CsPack(options);
  csPack.execute(callback);
};

_.extend(CsPack.prototype, {
  execute: function (callback) {
    var self = this;

    // TODO: use async module here
    self.initializeTemporaryPackageDirectory(function (err) {
      if (err) { return callback(err); }

      self.readServiceDefinitionFile(function (err) {
        if (err) { return callback(err); }

        self.addLocalContents(function (err) {
          if (err) { return callback(err); }

          self.addNamedStreams(function (err) {
            if (err) { return callback(err); }

            self.addServiceDefinitions(function (err) {
              if (err) { return callback(err); }

              self.createPackage(callback);
            });
          });
        });
      });
    });
  },

  initializeTemporaryPackageDirectory: function (callback) {
    if (fs.existsSync(this.temporaryPackagePath)) {
      wrench.rmdirSyncRecursive(this.temporaryPackagePath);
    }

    fs.mkdir(this.temporaryPackagePath, callback);
  },

  // TODO: remove this and figure out how to properly populate this (if this evens happens in cspack)
  populateEnvironmentVariables: function (role) {
    if (role.Startup && role.Startup.Task) {
      var tasks = role.Startup.Task;
      if (!_.isArray(tasks)) {
        tasks = [ tasks ];
      }

      tasks.forEach(function (task) {
        if (task.Environment && task.Environment.Variable) {
          var variables = task.Environment.Variable;
          if (!_.isArray(variables)) {
            variables = [ variables ];
          }

          variables.forEach(function (variable) {
            if (variable['$'].name === 'RUNTIMEURL' && !variable['$'].value) {
              variable['$'].value = 'http://nodertncu.blob.core.windows.net/node/0.6.20.exe';
            }
          });
        }
      });
    }
  },

  readServiceDefinitionFile: function (callback) {
    var self = this;
    utils.parseXmlFile(self.serviceDefinitionFile, function (err, serviceDefinitionModel) {
      self.serviceDefinitionModel = serviceDefinitionModel.ServiceDefinition;

      var workerRoles = serviceDefinitionModel.ServiceDefinition.WorkerRole;
      if (!_.isArray(workerRoles)) {
        workerRoles = [ workerRoles ];
      }

      self.serviceName = serviceDefinitionModel.ServiceDefinition['$'].name;
      self.roles = {};

      workerRoles.forEach(function (workerRole) {
        if (self.roles[workerRole['$'].name]) {
          return callback(new Error(util.format('Duplicate role %s', workerRole['$'].name)));
        }

        self.populateEnvironmentVariables(workerRole);

        workerRole.type = constants.RoleTypes.Worker;
        workerRole.sdkVersion = SDKPaths.SDKVersion;
        workerRole.runtimeModel = {
          netFxVersion: 'v3.5',
          runtimeExecutionContext: 'limited',
          protocolVersion: '2011-03-08',
          supportedFrameworks: {
            'v4.0': 'v4.0',
            'v4.5': 'v4.0'
          }
        };

        self.roles[workerRole['$'].name] = workerRole;
      });

      callback(err, serviceDefinitionModel);
    });
  },

  getApplicationOutputPath: function () {
    return 'approot';
  },

  getSiteOutputPath: function () {
    return 'siteroot';
  },

  addLocalContents: function (callback) {
    var self = this;

    function createRole(roleName, cb) {
      var layoutDefinitionName = util.format('Roles/%s', roleName);
      self.package.addLayout(layoutDefinitionName);

      function addBaseFile(file, done) {
        var fullPath = null;
        if (!_.isObject(file)) {
          fullPath = path.join(__dirname, TEMPLATE_PACKAGE_DIRECTORY, file);
        }

        self.package.addFileDefinition(layoutDefinitionName, file, fullPath, done);
      }

      function addApplicationFile(file, done) {
        self.package.addFileDefinition(layoutDefinitionName,
          path.join(self.getApplicationOutputPath(), file),
          path.join(self.inputDirectory, roleName, file),
          done);
      }

      // Get base layout for role
      var baseFiles = Package.getLayout(self.roles[roleName].type);
      async.eachSeries(baseFiles, addBaseFile, function () {

        // Get user application files for role
        utils.getFilesDirectory(path.join(self.inputDirectory, roleName), function (err, files) {
          if (err) {
            return callback(err);
          } else {
            async.eachSeries(files, addApplicationFile, function () {

              // Generate additional files from templates
              switch (self.roles[roleName].type) {
              case constants.RoleTypes.Worker:
                var roleData = { role: self.roles[roleName] };
                self.processTemplate(layoutDefinitionName, 'LocalContent', 'Cloud.uar', 'Roles/WorkerRole/Cloud.uar.csman.handlebars', roleData, false, function () {
                  self.processTemplate(layoutDefinitionName, 'LocalContent', 'RoleModel.xml', 'Roles/WorkerRole/RoleModel.xml.handlebars', roleData, false, function () {
                    self.processTemplate(layoutDefinitionName, 'LocalContent', 'RuntimeSetup.Manifest', 'Roles/WorkerRole/RuntimeSetup.Manifest.handlebars', roleData, false, function () {

                      cb();
                    });
                  });
                });
                break;
              default:
                throw new Error('Only worker roles are supported for now');
              }
            });
          }
        });
      });
    }

    // Locate and/or generate each of the files necessary for each role
    async.each(Object.keys(self.roles), createRole, callback);
  },

  processTemplate: function (layout, store, outputFile, templateFile, templateData, addBom, cb) {
    var self = this;
    var output = utils.processTemplate(path.join(store, templateFile), templateData, addBom);

    // TODO: ask the handle from the package and just do the right thing when storing the file to avoid deleting after
    var fullPath = path.join(self.temporaryPackagePath, store, outputFile);
    utils.mkdir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, output);

    if (layout) {
      self.package.addFileDefinition(layout, outputFile, fullPath, deleteIfRequired);
    } else {
      self.package.addContentDefinition(store, outputFile, fullPath, deleteIfRequired);
    }

    function deleteIfRequired(err, contentDefinition) {
      // TODO: should really detect better than this. improve.
      if (layout) {
        fs.unlinkSync(fullPath);
      }

      cb(null, contentDefinition);
    }
  },

  addServiceDefinitions: function (callback) {
    var self = this;

    self.processTemplate(null, 'ServiceDefinition', 'ServiceDefinition.csdef', 'ServiceDefinition.csdef.handlebars', self.serviceDefinitionModel, true, function () {
      self.processTemplate(null, 'ServiceDefinition', 'ServiceDefinition.rd', 'ServiceDefinition.rd.handlebars', self.serviceDefinitionModel, false, function () {
        self.processTemplate(null, 'ServiceDefinition', 'ServiceDefinition.rdsc', 'ServiceDefinition.rdsc.handlebars', self.serviceDefinitionModel, true, function () {

          callback();
        });
      });
    });
  },

  addNamedStreams: function (callback) {
    var self = this;

    self.addRequiredFeaturesToPackage(function () {
      self.addSupportedOsToPackage(function () {
        self.addSupportDataToPackage(callback);
      });
    });
  },

  addRequiredFeaturesToPackage: function (callback) {
    var self = this;

    function addRequiredRoleFeatures (roleName, cb) {
      var requiredFeatures = self.getRequiredFeatures(self.roles[roleName]);

      var features = Object.keys(requiredFeatures).map(function (feature) {
        return { name: feature, version: requiredFeatures[feature] };
      });

      var streamName = path.join('RequiredFeatures', roleName, '1.0');
      self.processTemplate(null, 'NamedStreams', streamName, 'RequiredFeatures/WorkerRole/1.0.handlebars', features, true, cb);
    }

    async.eachSeries(Object.keys(self.roles), addRequiredRoleFeatures, callback);
  },

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
      }
    }

    return features;
  },

  addSupportedOsToPackage: function (callback) {
    var self = this;

    function addSupportedRoleOs (roleName, cb) {
      var supportedOSes = self.getSupportedOSes(self.roles[roleName]);

      var oSes = Object.keys(supportedOSes).map(function (os) {
        return { name: os, version: supportedOSes[os] };
      });

      var streamName = path.join('SupportedOSes', roleName, '1.0');
      self.processTemplate(null, 'NamedStreams', streamName, 'SupportedOsFamilies/WorkerRole/1.0.handlebars', oSes, true, cb);
    }

    async.eachSeries(Object.keys(self.roles), addSupportedRoleOs, callback);
  },

  getSupportedOSes: function () {
    return { '3': '0' };
  },

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

      var supportData = {
        SDKVersion: SDKPaths.SDKVersion,
        TargetFrameworkVersion: netFxVersion,
        HasElevatedEntrypoint: entryPointElevated.toString(),
        HasElevatedStartupTaskInCsdef: startupTaskElevated.toString()
      };

      var streamName = path.join('SupportData', roleName, '1.0');
      self.processTemplate(null, 'NamedStreams', streamName, 'SupportData/WorkerRole/1.0.handlebars', supportData, true, cb);
    }

    async.eachSeries(Object.keys(self.roles), addSupportRoleData, callback);
  },

  createPackage: function (callback) {
    var self = this;

    // Generate and write package manifest
    self.package.generateManifest(self.temporaryPackagePath, constants.PackageFile);

    // Create OPC package
    opc.createPackageFile(self.outputRoot, self.temporaryPackagePath, self.packageFileName, callback);
  }
});

module.exports = CsPack;