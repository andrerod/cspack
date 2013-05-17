#!/usr/bin/env node
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

function OpcContainer () {
  this.parts = [];
}

OpcContainer.prototype.insertPart = function (container, name) {
  throw new Error('Not yet implemented', container, name);
};

OpcContainer.prototype.deletePart = function (container, name) {
  throw new Error('Not yet implemented', container, name);
};

OpcContainer.prototype.deletePartRelations = function (container, part) {
  throw new Error('Not yet implemented', container, part);
};

OpcContainer.prototype.insertRelationshipPrefix = function (container, relationshipPrefix) {
  throw new Error('Not yet implemented', container, relationshipPrefix);
};

OpcContainer.prototype.getRelationshiPrefix = function (container, relationshipPrefix) {
  throw new Error('Not yet implemented', container, relationshipPrefix);
};

OpcContainer.prototype.insertExtension = function (container, extension) {
  throw new Error('Not yet implemented', container, extension);
};

module.exports = OpcContainer;