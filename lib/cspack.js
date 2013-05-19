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

var Package = require('./models/package');
var utils = require('./util/utils');
var constants = require('./util/constants');
var opc = require('./opc');
var async = require('async');

var TEMPORARY_PACKAGE_PATH = '.package';
var TEMPLATE_PACKAGE_DIRECTORY = 'pkg';

var SDKPaths = {
  SDKVersion: '1.8.31004.1351'
};

function CsPack(options) {
  this.inputDirectory = options.inputDirectory;
  this.outputRoot = options.outputDirectory;
  this.tempPackagePath = path.join(this.outputRoot, TEMPORARY_PACKAGE_PATH);
  this.serviceDefinitionFile = options.serviceDefinitionFile;
  this.packageFileName = options.packageFileName;
  this.package = new Package();

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
    self.initializeTemporaryPackageDirectory(function () {
      self.serviceDefinitionModelFromFile(function () {
        self.addRoles(function () {
          self.addNamedStreams(function () {
            self.addServiceDefinitions(function () {
              self.createPackage(function () {
                callback();
              });
            });
          });
        });
      });
    });
  },

  initializeTemporaryPackageDirectory: function (callback) {
    if (fs.existsSync(this.tempPackagePath)) {
      wrench.rmdirSyncRecursive(this.tempPackagePath);
    }

    fs.mkdir(this.tempPackagePath, callback);
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
          throw new Error(util.format('Duplicate role %s', workerRole['$'].name));
        }

        workerRole.type = constants.RoleTypes.Worker;
        workerRole.runtimeModel = {
          importedModules: {},
          netFxVersion: 'v3.5',
          startupTasksByPriority: {},
          runtimeEnvironment: {},
          configSettings: [],
          roleProperties: {},
          runtimeExecutionContext: 'limited',
          protocolVersion: '2011-03-08',
          supportedFrameworks: {
            'v4.0': 'v4.0',
            'v4.5': 'v4.0'
          }
        };

        if (workerRole.Startup && workerRole.Startup.Task) {
          workerRole.runtimeModel.tasks = workerRole.Startup.Task;
          if (!_.isArray(workerRole.runtimeModel.tasks)) {
            workerRole.runtimeModel.tasks = [ workerRole.runtimeModel.tasks ];
          }
        }

        self.roles[workerRole['$'].name] = workerRole;
      });

      callback(err, serviceDefinitionModel);
    });
  },

  getApplicationOutputPath: function (role, roleOutputPath) {
    return 'approot';
  },

  addRoles: function (callback) {
    var self = this;

    function createRole(roleName, callback) {
      var layoutDefinitionName = path.join('Roles', roleName);
      self.package.addLayout(layoutDefinitionName);

      // Get base layout for role
      var baseFiles = Package.getLayout(self.roles[roleName].type);

      // Add base files to the role files
      baseFiles.forEach(function (f) {
        self.package.addFileDefinition(layoutDefinitionName,
          f,
          path.join(__dirname, TEMPLATE_PACKAGE_DIRECTORY, f));
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

          var processWorkerRoleTemplate = function (templateFile, roleData) {
            var output = Handlebars.compile(
              fs.readFileSync(path.join(__dirname, 'templates/LocalContent/Roles/WorkerRole', templateFile)).toString()
            )(roleData);

            var contentDefinition = self.package.addFileDefinition(
              layoutDefinitionName,
              templateFile
            );

            var fullName = path.join(self.tempPackagePath, contentDefinition.dataStorePath);
            utils.mkdir(path.dirname(fullName));
            fs.writeFileSync(fullName, utils.addBOM(output));
          };

          // Generate additional files from templates
          switch (self.roles[roleName].type) {
          case constants.RoleTypes.Worker:
            processWorkerRoleTemplate('Cloud.uar.csman');
            processWorkerRoleTemplate('RoleModel.xml');
            processWorkerRoleTemplate('RuntimeSetup.Manifest');

            break;
          default:
            throw new Error('Only worker roles are supported for now');
          }

          callback(null);
        }
      });
    }

    // Locate and/or generate each of the files necessary for each role
    async.each(Object.keys(self.roles), createRole, callback);
  },

  addServiceDefinitions: function (callback) {
    var self = this;
    var servideDefinitionsPath = path.join(self.tempPackagePath, 'ServiceDefinition');
    utils.mkdir(servideDefinitionsPath);

    var processTemplate = function (templateFile) {
      var output = Handlebars.compile(fs.readFileSync(path.join(__dirname, 'templates', templateFile)).toString())({
        serviceDefinition: self.serviceDefinitionModel,
        serviceName: self.serviceName,
        workerRoles: Object.keys(self.roles)
          .filter(function (r) { return self.roles[r].type === constants.RoleTypes.Worker; })
          .map(function (r) { return { name: r }; })
      });

      fs.writeFileSync(path.join(self.tempPackagePath, templateFile), utils.addBOM(output));

      self.package.addContentDefinition(templateFile, path.join(self.tempPackagePath, templateFile));
    };

    processTemplate('ServiceDefinition/ServiceDefinition.csdef');
    processTemplate('ServiceDefinition/ServiceDefinition.rd');
    processTemplate('ServiceDefinition/ServiceDefinition.rdsc');

    callback();
  },

  addNamedStreams: function (callback) {
    var self = this;
    var namedStreams = {};

    self.addRequiredFeaturesToPackage(namedStreams);
    self.addSupportedOsToPackage(namedStreams);
    self.addSupportDataToPackage(namedStreams);

    Object.keys(namedStreams).forEach(function (namedStream) {
      var namedStreamPath = path.join(self.tempPackagePath, 'NamedStreams', namedStream);

      utils.mkdir(path.dirname(namedStreamPath));
      fs.writeFileSync(namedStreamPath, utils.addBOM(namedStreams[namedStream].toString()));

      self.package.addContentDefinition(path.join('NamedStreams', namedStream), namedStreamPath);
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
        'RequiredFeatures': {}
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
        'SupportedOsFamilies': {}
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

      if (role.runtimeModel) {
        // Note: not fully processing general runtimeModel
        startupTaskElevated = role.runtimeModel.tasks.some(function (t) {
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

    var filesToCopy = [];

    // process contents
    if (self.package.contents) {
      self.package.contents.forEach(function (content) {
        if (content.originalFullPath && content.originalFullPath.substr(0, self.tempPackagePath.length) !== self.tempPackagePath) {
          filesToCopy.push({
            from: content.originalFullPath,
            to: path.join(self.tempPackagePath, content.dataStorePath)
          });
        }
      });
    }

    function copyFiles(files, callback) {
      if (files.length > 0) {
        var file = files.pop();

        utils.mkdir(path.dirname(file.to));
        utils.copyFile(file.from, file.to, function (err) {
          if (err) {
            callback(err);
          } else {
            copyFiles(files, callback);
          }
        });
      } else {
        callback();
      }
    }

    copyFiles(filesToCopy, function () {
      // Write updated package manifest
      fs.writeFileSync(path.join(self.tempPackagePath, constants.PackageFile), utils.addBOM(self.package.generateManifest(self.tempPackagePath)));

      opc.createPackageFile(self.outputRoot, self.tempPackagePath, self.packageFileName, callback);
    });
  }
});

module.exports = CsPack;