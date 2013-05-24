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

    _.bindAll(this);
    async.parallel([
        self.readServiceDefinitionFile,
        self.initializeTemporaryPackageDirectory
      ], function (err) {
        if (err) { return callback(err); }

        async.parallel([
          self.addLocalContents,
          self.addNamedStreams,
          self.addServiceDefinitions
        ], function (err) {
          if (err) { return callback(err); }

          self.createPackage(callback);
        });
      });
  },

  initializeTemporaryPackageDirectory: function (callback) {
    var self = this;

    fs.exists(self.temporaryPackagePath, function (exists) {
      if (exists) {
        wrench.rmdirRecursive(self.temporaryPackagePath, true, function (err) {
          if (err) { return callback(err); }

          fs.mkdir(self.temporaryPackagePath, callback);
        });
      } else {
        fs.mkdir(self.temporaryPackagePath, callback);
      }
    });
  },

  readServiceDefinitionFile: function (callback) {
    var self = this;
    utils.parseXmlFile(self.serviceDefinitionFile, function (err, serviceDefinitionModel) {
      self.serviceDefinitionModel = serviceDefinitionModel.ServiceDefinition;

      function processRole(role, type) {
        if (self.roles[role['$'].name]) {
          return callback(new Error(util.format('Duplicate role %s', role['$'].name)));
        }

        role[type] = true;
        role.type = type;
        role.sdkVersion = SDKPaths.SDKVersion;
        role.runtimeModel = {
          netFxVersion: 'v3.5',
          runtimeExecutionContext: 'limited',
          protocolVersion: '2011-03-08',
          supportedFrameworks: {
            'v4.0': 'v4.0',
            'v4.5': 'v4.0'
          }
        };

        // TODO: remove this populate
        populateEnvironmentVariables(role);
        self.roles[role['$'].name] = role;
      }

      self.serviceName = serviceDefinitionModel.ServiceDefinition['$'].name;
      self.roles = {};

      var workerRoles = serviceDefinitionModel.ServiceDefinition.WorkerRole;
      if (!_.isArray(workerRoles)) {
        workerRoles = [ workerRoles ];
      }

      workerRoles.forEach(function (role) {
        processRole(role, constants.RoleTypes.Worker);
      });

      var webRoles = serviceDefinitionModel.ServiceDefinition.WebRole;
      if (!_.isArray(webRoles)) {
        webRoles = [ webRoles ];
      }

      webRoles.forEach(function (role) {
        processRole(role, constants.RoleTypes.Web);
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

      function addRoleFiles(done) {
        function addRoleFile(file, done) {
          var fullPath = null;
          if (!_.isObject(file)) {
            fullPath = path.join(__dirname, TEMPLATE_PACKAGE_DIRECTORY, file);
          } else {
            var linkedFile = self.package.getFileDefinition(layoutDefinitionName, file.linksTo);
            fullPath = path.join(self.temporaryPackagePath, linkedFile.FileDescription.DataContentReference);
            file = file.name;
          }

          self.package.addFileDefinition(layoutDefinitionName, file, fullPath, done);
        }

        var roleFiles = getLayout(self.roles[roleName].type);
        async.eachSeries(roleFiles, addRoleFile, function (err) {
          if (err) { return done(err); }

          var roleData = { role: self.roles[roleName] };
          self.processTemplate(layoutDefinitionName, 'LocalContent', 'Cloud.uar.csman', 'Roles/WorkerRole/Cloud.uar.csman.handlebars', roleData, false, function () {
            self.processTemplate(layoutDefinitionName, 'LocalContent', 'RoleModel.xml', 'Roles/WorkerRole/RoleModel.xml.handlebars', roleData, false, function () {
              self.processTemplate(layoutDefinitionName, 'LocalContent', 'RuntimeSetup.Manifest', 'Roles/WorkerRole/RuntimeSetup.Manifest.handlebars', roleData, false, function () {

                done();
              });
            });
          });
        });
      }

      function addApplicationFiles(done) {
        function addApplicationFile(file, done) {
          self.package.addFileDefinition(layoutDefinitionName,
            path.join(self.getApplicationOutputPath(), file),
            path.join(self.inputDirectory, roleName, file),
            done);
        }

        utils.getFilesDirectory(path.join(self.inputDirectory, roleName), function (err, files) {
          if (err) { return done(err); }

          async.eachSeries(files, addApplicationFile, done);
        });
      }

      async.parallel([ addRoleFiles, addApplicationFiles ], cb);
    }

    // Locate and/or generate each of the files necessary for each role
    async.eachSeries(Object.keys(self.roles), createRole, callback);
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
  }
});

// TODO: remove this and figure out how to properly populate this (if this evens happens in cspack)
function populateEnvironmentVariables(role) {
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
            if (role.type === constants.RoleTypes.Worker) {
              variable['$'].value = 'http://nodertncu.blob.core.windows.net/node/0.6.20.exe';
            } else {
              variable['$'].value = 'http://nodertncu.blob.core.windows.net/node/0.6.20.exe;http://nodertncu.blob.core.windows.net/iisnode/0.1.21.exe';
            }
          }
        });
      }
    });
  }
}

function getLayout() {
  return [
    'base/Microsoft.WindowsAzure.ServiceRuntime.config',
    'base/Microsoft.WindowsAzure.ServiceRuntime.dll',
    'base/policy.1.0.Microsoft.WindowsAzure.ServiceRuntime.dll',
    'base/x64/Diagnostics.dll',
    'base/x64/IISConfigurator.exe',
    'base/x64/Microsoft.WindowsAzure.Internal.RuntimeServer.dll',
    {
      linksTo: 'base/Microsoft.WindowsAzure.ServiceRuntime.dll',
      name: 'base/x64/Microsoft.WindowsAzure.ServiceRuntime.dll'
    },
    'base/x64/msshrtmi.dll',
    'base/x64/mswasr.dll',
    'base/x64/mswasri.dll',
    'base/x64/WaHostBootstrapper.exe',
    'base/x64/WaHostBootstrapper.exe.config',
    'base/x64/WaIISHost.exe',
    'base/x64/WaRuntimeProxy.dll',
    'base/x64/WaWebHost.exe',
    'base/x64/WaWorkerHost.exe',
    'base/x86/Diagnostics.dll',
    'base/x86/IISConfigurator.exe',
    'base/x86/Microsoft.WindowsAzure.Internal.RuntimeServer.dll',
    'base/x86/Microsoft.WindowsAzure.ServiceRuntime.dll',
    'base/x86/msshrtmi.dll',
    'base/x86/mswasr.dll',
    'base/x86/mswasri.dll',
    'base/x86/WaHostBootstrapper.exe',
    {
      linksTo: 'base/x64/WaHostBootstrapper.exe.config',
      name: 'base/x86/WaHostBootstrapper.exe.config'
    },
    'base/x86/WaIISHost.exe',
    'base/x86/WaRuntimeProxy.dll',
    'base/x86/WaWebHost.exe',
    'base/x86/WaWorkerHost.exe',
    'diagnostics/x64/monitor/FileListener.dll',
    'diagnostics/x64/monitor/MonAgent.dll',
    'diagnostics/x64/monitor/MonAgentHost.exe',
    'diagnostics/x64/monitor/MonConfig.dll',
    'diagnostics/x64/monitor/MonDiagnostics.dll',
    'diagnostics/x64/monitor/MonEvents.dll',
    'diagnostics/x64/monitor/MonNetTransport.dll',
    'diagnostics/x64/monitor/MonQuery.dll',
    'diagnostics/x64/monitor/MonTables.dll',
    'diagnostics/x64/monitor/secutil.dll',
    'diagnostics/x64/monitor/SysCounterListener.dll',
    'diagnostics/x64/monitor/SystemEventsListener.dll',
    'diagnostics/x64/monitor/schema/1.0/ma.xsd',
    'diagnostics/x64/monitor/schema/1.0/maStatic.xsd',
    'diagnostics/x64/monitor/schema/1.0/query.xsd',
    'diagnostics/x64/monitor/schema/1.0/shared.xsd',
    'storage/cloud/x64/mswacdmi.dll'
  ];
}

module.exports = CsPack;