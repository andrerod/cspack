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

// var Package = require('./hashedpackage');

var utils = require('./util/utils');
var constants = require('./util/constants');

var TEMPORARY_PACKAGE_PATH = 'package';

function CsPack(options) {
  utils.validateArgs('CsPack', function (v) {
    v.object(options, 'options');
  });

  this.inputDirectory = options.inputDirectory;
  this.outputRoot = options.outputDirectory;
  this.temporaryPackagePath = path.join(this.outputRoot, TEMPORARY_PACKAGE_PATH);
  this.basePackagePath = path.join(__dirname, 'pkg');
  this.serviceDefinitionFile = options.serviceDefinitionFile;
  this.packageFileName = options.packageFileName;
  this.pkg = null;

  this.roles = {};
}

_.extend(CsPack.prototype, {
  execute: function (callback) {
    var self = this;

    _.bindAll(this);
    async.parallel([
      self.fetchBasePackage,
      self.readServiceDefinitionFile
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
        role.runtimeModel = {
          netFxVersion: 'v3.5',
          runtimeExecutionContext: 'limited',
          protocolVersion: '2011-03-08',
          supportedFrameworks: {
            'v4.0': 'v4.0',
            'v4.5': 'v4.0'
          }
        };

        self.roles[role['$'].name] = role;
      }

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
      self.pkg.addLayout(layoutDefinitionName);

      function addRoleFiles(done) {
        function addRoleFile(file, done) {
          var fullPath = null;
          if (file.linksTo) {
            fullPath = path.join(self.temporaryPackagePath, file.linksTo);
          } else {
            fullPath = path.join(self.temporaryPackagePath, file.Name);
          }

          self.pkg.addFileDefinition(layoutDefinitionName, file.Name, fullPath, done);
        }

        var roleFiles = self.getLayout(self.roles[roleName].type);
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
          self.pkg.addFileDefinition(layoutDefinitionName,
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

    async.parallel([
      self.addRequiredFeaturesToPackage,
      self.addSupportedOsToPackage,
      self.addSupportDataToPackage
    ], callback);
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
        SDKVersion: self.getSDKVersion(),
        TargetFrameworkVersion: netFxVersion,
        HasElevatedEntrypoint: entryPointElevated.toString(),
        HasElevatedStartupTaskInCsdef: startupTaskElevated.toString()
      };

      var streamName = path.join('SupportData', roleName, '1.0');
      self.processTemplate(null, 'NamedStreams', streamName, 'SupportData/WorkerRole/1.0.handlebars', supportData, true, cb);
    }

    async.eachSeries(Object.keys(self.roles), addSupportRoleData, callback);
  }
});

module.exports = CsPack;