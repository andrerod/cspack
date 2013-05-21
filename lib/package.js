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

var constants = require('./util/constants');
var utils = require('./util/utils');

function Package(version, temporaryPackagePath) {
  this.temporaryPackagePath = temporaryPackagePath;
  this.pkg = {};

  this.initDefaults(version);
}

Package.getLayout = function (type) {
  switch (type) {
  case constants.RoleTypes.Worker:
    return [
      'base/Microsoft.WindowsAzure.ServiceRuntime.config',
      'base/Microsoft.WindowsAzure.ServiceRuntime.dll',
      'base/policy.1.0.Microsoft.WindowsAzure.ServiceRuntime.dll',
      'base/x64/Diagnostics.dll',
      'base/x64/IISConfigurator.exe',
      'base/x64/Microsoft.WindowsAzure.Internal.RuntimeServer.dll',
      {
        name: 'base/Microsoft.WindowsAzure.ServiceRuntime.dll',
        linksTo: 'base/x64/Microsoft.WindowsAzure.ServiceRuntime.dll'
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
        name: 'base/x64/WaHostBootstrapper.exe.config',
        linksTo: 'base/x86/WaHostBootstrapper.exe.config'
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
  default:
    throw new Error('Only worker roles are supported for now');
  }
};

_.extend(Package.prototype, {
  initDefaults: function (version) {
    this.pkg.PackageMetaData = {
      KeyValuePair: [{
        Key: 'http://schemas.microsoft.com/windowsazure/ProductVersion/',
        Value: version
      }]
    };
  },

  addContentDefinition: function (store, filePath, originalFullPath, callback) {
    var self = this;

    function addLengthInBytes (contentDefinition) {
      contentDefinition.ContentDescription.LengthInBytes = fs.statSync(path.join(self.temporaryPackagePath, contentDefinition.Name)).size;
      self.pkg.PackageContents.ContentDefinition.push(contentDefinition);

      callback(null, contentDefinition);
    }

    if (!self.pkg.PackageContents) {
      self.pkg.PackageContents = {
        ContentDefinition: []
      };
    }

    var contentDefinition;
    if (_.isObject(filePath)) {
      contentDefinition = self.pkg.PackageContents.ContentDefinition.filter(function (content) {
        console.log(content.RawName);
        console.log(filePath.name);
        return content.RawName === filePath.name;
      })[0];

      contentDefinition = _.clone(contentDefinition);
      contentDefinition.Name = ('/' + filePath.linksTo).replace(/\//g, '\\');

      callback(null, contentDefinition);
    } else {
      var dataStorePath = null;
      if (store === 'LocalContent') {
        var hash = uuid.v4().replace(/-/g, '');
        dataStorePath = hash;
      } else {
        dataStorePath = filePath;
      }

      contentDefinition = {
        RawName: filePath, // TOOD: get rid of this once there is hash mapping
        Name: path.join(store, dataStorePath).replace(/\\/g, '/'),
        ContentDescription: {
          IntegrityCheckHashAlgortihm: 'None',
          IntegrityCheckHash: {},
          DataStorePath: path.join(store, dataStorePath).replace(/\\/g, '/')
        }
      };

      if (originalFullPath && originalFullPath.substr(0, self.temporaryPackagePath.length) !== self.temporaryPackagePath) {
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
  },

  addFileDefinition: function (layout, filePath, originalFullPath, callback) {
    var self = this;
    if (!self.pkg.PackageLayouts) {
      return callback(new Error(util.format('Invalid layout "%s"', layout)));
    }

    var layoutDefinition = self.pkg.PackageLayouts.LayoutDefinition.filter(function (l) { return l.Name === layout; })[0];
    if (!layoutDefinition) {
      return callback(new Error(util.format('Invalid layout "%s"', layout)));
    }

    self.addContentDefinition('LocalContent', filePath, originalFullPath, function (err, contentDefinition) {
      if (!layoutDefinition.LayoutDescription) {
        layoutDefinition.LayoutDescription = {
          FileDefinition: []
        };
      }

      var fileStat = fs.statSync(path.join(self.temporaryPackagePath, contentDefinition.ContentDescription.DataStorePath));
      var fileDefinition = {
        FilePath: filePath,
        FileDescription: {
          DataContentReference: contentDefinition.ContentDescription.dataStorePath,
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

    var packageContent = utils.processTemplate('package.xml.handlebars', self.pkg, false);
    fs.writeFileSync(path.join(tempPackagePath, packageFilename), packageContent);
  }
});

module.exports = Package;