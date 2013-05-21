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
var js2xml = require('node-js2xml');
var wrench = require('wrench');
var js2xml = require('node-js2xml');
var Handlebars = require('handlebars');

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
  this.package = new Package(SDKPaths.SDKVersion);

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

      self.serviceDefinitionModelFromFile(function (err) {
        if (err) { return callback(err); }

        self.addRoles(function (err) {
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

  serviceDefinitionModelFromFile: function (callback) {
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

  addRoles: function (callback) {
    var self = this;

    function createRole(roleName, cb) {
      var layoutDefinitionName = util.format('Roles/%s', roleName);
      self.package.addLayout(layoutDefinitionName);

      // Get base layout for role
      var baseFiles = Package.getLayout(self.roles[roleName].type);

      // Add base files to the role files
      baseFiles.forEach(function (f) {
        var fullPath = null;
        if (!_.isObject(f)) {
          fullPath = path.join(__dirname, TEMPLATE_PACKAGE_DIRECTORY, f);
        }

        self.package.addFileDefinition(layoutDefinitionName,
          f,
          fullPath);
      });

      utils.getFilesDirectory(path.join(self.inputDirectory, roleName), function (err, files) {
        if (err) {
          return callback(err);
        } else {
          files.forEach(function (f) {
            self.package.addFileDefinition(
              layoutDefinitionName,
              path.join(self.getApplicationOutputPath(), f),
              path.join(self.inputDirectory, roleName, f)
            );
          });

          var processWorkerRoleTemplate = function (templateFile, roleData, addBom, cb) {
            var output = Handlebars.compile(
              fs.readFileSync(path.join(__dirname, 'templates/LocalContent/Roles/WorkerRole', templateFile)).toString()
            )(roleData);

            self.package.addFileDefinition(
              layoutDefinitionName,
              path.basename(templateFile, '.handlebars'),
              null,
              function (err, contentDefinition) {

              var fullName = path.join(self.temporaryPackagePath, contentDefinition.ContentDescription.DataStorePath);
              utils.mkdir(path.dirname(fullName));

              if (addBom) {
                output = utils.addBOM(output);
              }

              fs.writeFileSync(fullName, output);
              cb();
            });
          };

          // Generate additional files from templates
          switch (self.roles[roleName].type) {
          case constants.RoleTypes.Worker:
            var roleData = { role: self.roles[roleName] };
            processWorkerRoleTemplates('LocalContent', 'Roles/WorkerRole/Cloud.uar.csman.handlebars', roleData, false, function () {
              processWorkerRoleTemplates('LocalContent', 'Roles/WorkerRole/RoleModel.xml.handlebars', roleData, false, function () {
                processWorkerRoleTemplates('LocalContent', 'Roles/WorkerRole/RuntimeSetup.Manifest.handlebars', roleData, false, function () {

                  cb();
                });
              });
            });
          default:
            throw new Error('Only worker roles are supported for now');
          }
        }
      });
    }

    // Locate and/or generate each of the files necessary for each role
    async.each(Object.keys(self.roles), createRole, callback);
  },

  addServiceDefinitions: function (callback) {
    var self = this;

    // TODO: move this somewhere better
    function processTemplate (store, templateFile, addBom, cb) {
      var self = this;
      var output = utils.processTemplate(path.join(store, templateFile), self.serviceDefinitionModel, addBom);

      self.package.addContentDefinition(store, path.basename(templateFile, '.handlebars'), null, function (err, contentDefinition) {
        var fullPath = path.join(self.temporaryPackagePath, contentDefinition.ContentDescription.DataStorePath);

        utils.mkdir(path.dirname(fullPath));
        fs.writeFileSync(fullPath, output);

        cb();
      });
    }

    processTemplate('ServiceDefinition', 'ServiceDefinition.csdef.handlebars', true, function () {
      processTemplate('ServiceDefinition', 'ServiceDefinition.rd.handlebars', false, function () {
        processTemplate('ServiceDefinition', 'ServiceDefinition.rdsc.handlebars', true, function () {

          callback();
        });
      });
    });
  },

  addNamedStreams: function (callback) {
    var self = this;
    var namedStreams = {};

    self.addRequiredFeaturesToPackage(namedStreams);
    self.addSupportedOsToPackage(namedStreams);
    self.addSupportDataToPackage(namedStreams);

    Object.keys(namedStreams).forEach(function (namedStream) {
      var namedStreamPath = path.join(self.temporaryPackagePath, 'NamedStreams', namedStream);

      utils.mkdir(path.dirname(namedStreamPath));
      fs.writeFileSync(namedStreamPath, utils.addBOM(namedStreams[namedStream].toString()));

      self.package.addContentDefinition('NamedStreams', namedStream, namedStreamPath);
    });

    callback();
  },

  addRequiredFeaturesToPackage: function (namedStreams) {
    var self = this;

    Object.keys(self.roles).forEach(function (roleName) {
      var requiredFeatures = self.getRequiredFeatures(self.roles[roleName]);

      var requiredFeaturesXml = [];
      Object.keys(requiredFeatures).forEach(function (feature) {
        requiredFeaturesXml.push({
          '$': {
            name: feature,
            version: requiredFeatures[feature]
          }
        });
      });

      var streamName = 'RequiredFeatures/' + roleName + '/1.0';
      var namedStreamsXml = {
        'RequiredFeatures': {
          '$': { version: '1.0' }
        }
      };

      if (requiredFeaturesXml.length > 0) {
        namedStreamsXml['RequiredFeatures']['Feature'] = requiredFeaturesXml;
      }

      namedStreams[streamName] = js2xml.serialize(namedStreamsXml);
    });
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

  addSupportedOsToPackage: function (namedStreams) {
    var self = this;

    Object.keys(self.roles).forEach(function (roleName) {
      var oSes = self.getSupportedOSes(self.roles[roleName]);

      var oSesXml = [];
      Object.keys(oSes).forEach(function (os) {
        oSesXml.push({
          '$': {
            name: os,
            version: oSes[os]
          }
        });
      });

      var streamName = 'SupportedOSes/' + roleName + '/1.0';
      var namedStreamsXml = {
        'SupportedOsFamilies': {
          '$': { version: '1.0' }
        }
      };

      if (oSesXml.length > 0) {
        namedStreamsXml['SupportedOsFamilies']['OsFamily'] = oSesXml;
      }

      namedStreams[streamName] = js2xml.serialize(namedStreamsXml);
    });
  },

  getSupportedOSes: function () {
    return {
      '3': '0'
    };
  },

  addSupportDataToPackage: function (namedStreams) {
    var self = this;

    Object.keys(self.roles).forEach(function (roleName) {
      var role = self.roles[roleName];

      var netFxVersion = role.runtimeModel.netFxVersion;
      var entryPointElevated = false;
      var startupTaskElevated = false;

      if (role.Startup && role.Startup.Task) {
        var tasks = role.Startup.Task;
        if (!_.isArray(tasks)) {
          tasks = [ tasks ];
        }

        // Note: not fully processing general runtimeModel
        startupTaskElevated = tasks.some(function (t) {
          return t['$']['executionContext'] === 'elevated';
        });
      }

      var supportDataXml = {
        'SupportData': {
          '$': {
            'version': '1.0'
          },
          'SDKVersion': SDKPaths.SDKVersion,
          'TargetFrameworkVersion': netFxVersion,
          'HasElevatedEntrypoint': entryPointElevated.toString(),
          'HasElevatedStartupTaskInCsdef':startupTaskElevated.toString(),
          'Imports': {}
        }
      };

      var streamName = 'SupportData/' + roleName + '/1.0';
      namedStreams[streamName] = js2xml.serialize(supportDataXml);
    });
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