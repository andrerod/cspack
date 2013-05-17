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

var path = require('path');
var fs = require('fs');
var js2xml = require('node-js2xml');

var constants = require('../util/constants');

function Package() {
  this.metadata = null;
  this.contents = null;
  this.layouts = null;

  this.initDefaults();
}

Package.prototype.initDefaults = function () {
  this.metadata = [
    {
      Key: 'http://schemas.microsoft.com/windowsazure/ProductVersion/',
      Value: '1.8.31004.1351'
    }
  ];
};

Package.prototype.addContentDefinition = function (filePath, originalFullPath) {
  if (!this.contents) {
    this.contents = [];
  }

  this.contents.push({
    filePath: filePath,
    originalFullPath: originalFullPath
  });
};

Package.prototype.addFileDefinition = function (layout, filePath, originalFullPath) {
  if (!this.layouts || !this.layouts[layout]) {
    throw new Error('Invalid layout');
  }

  this.layouts[layout].push({
    filePath: filePath,
    originalFullPath: originalFullPath
  });

  // TODO: this should not be here. It can be optimized to avoid file repetition
  this.addContentDefinition(path.join(layout, filePath), originalFullPath);
};

Package.prototype.addLayout = function (layoutName) {
  if (!this.layout) {
    this.layouts = {};
  }

  this.layouts[layoutName] = [];
};

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
      'base/x64/Microsoft.WindowsAzure.ServiceRuntime.dll',
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
      'base/x86/WaHostBootstrapper.exe.config',
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

Package.prototype.generateManifest = function () {
  var pkg = {
    PackageDefinition: {
      '$': {
        xmlns : 'http://schemas.microsoft.com/windowsazure',
        'xmlns:i': 'http://www.w3.org/2001/XMLSchema-instance'
      }
    }
  };

  if (this.metadata && this.metadata.length > 0) {
    pkg.PackageDefinition.PackageMetaData = {
      KeyValuePair: this.metadata
    };
  }

  if (this.contents && this.contents.length > 0) {
    pkg.PackageDefinition.PackageContents = {
      ContentDefinition: []
    };

    this.contents.forEach(function (content) {
      pkg.PackageDefinition.PackageContents.ContentDefinition.push({
        Name: content.filePath,
        ContentDescription: {
          LengthInBytes: fs.statSync(content.originalFullPath).size,
          IntegrityCheckHashAlgortihm: 'None',
          IntegrityCheckHash: {},
          DataStorePath: content.filePath
        }
      });
    });
  }

  if (this.layouts && this.layouts.length > 0) {
    pkg.PackageDefinition.PackageLayouts = {
      LayoutDefinition: []
    };

    Object.keys(this.layouts).forEach(function (layoutName) {
      pkg.PackageDefinition.PackageLayouts.LayoutDefinition = {
        Name: layoutName
      };

      if (this.layouts[layoutName] && this.layouts[layoutName].length > 0) {
        pkg.PackageDefinition.PackageLayouts.LayoutDefinition.FileDefinition = [];
        this.layouts[layoutName].forEach(function (fileDefinition) {
          pkg.PackageDefinition.PackageLayouts.LayoutDefinition.FileDefinition.push({
            FilePath: fileDefinition.filePath,
            FileDescription: {
              DataContentReference: fileDefinition.filePath,
              CreatedTimeUtc: new Date().toISOString(),
              ModifiedTimeUtc: new Date().toISOString(),
              ReadOnly: 'false'
            }
          });
        });
      }
    });
  }

  return js2xml.serialize(pkg);
};

module.exports = Package;