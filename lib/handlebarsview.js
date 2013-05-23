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

var fs = require('fs');

var _ = require('underscore');
var Handlebars = require('handlebars');

var utils = require('./util/utils');

/**
* Creates a new handlebars view engine.
*
* @constructor
*
* @param {object} options                  The rendering options.
* @param {string} options.templateFilePath The path to the template file.
* @param {bool}   options.addBOM           Specifies if a byte order mark should be added to the resulting file.
*/
function HandlebarsView(options) {
  utils.validateArgs('Package', function (v) {
    v.object(options, 'options');
    v.string(options.templateFilePath, 'options.templateFilePath');
  });

  this.templateFilePath = options.templateFilePath;
  this.addBOM = options.addBOM || false;
}

_.extend(HandlebarsView.prototype, {
  render: function (templateData) {
    var self = this;

    // TODO: the replace is a temporary hack that needs to be removed in the future.
    var content = Handlebars.compile(
      fs.readFileSync(self.templateFilePath).toString()
    )(templateData).replace(/\&\#92;/g, '\\');

    if (self.addBOM) {
      content = utils.addBOM(content);
    }

    return content;
  }
});

module.exports = HandlebarsView;