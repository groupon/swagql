/*
 * Copyright (c) 2019, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of GROUPON nor the names of its contributors may be
 * used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const t = require('@babel/types');
const template = require('@babel/template').default;
const graphql = require('graphql');

const createImport = template(`const GRAPHQL_IMPORTS = require('graphql');`);

const USED = Symbol('graphqlTypesUsed');

function isUUID(swaggerType) {
  return swaggerType.format === 'uuid';
}

/**
 * Manages the built-in features of graphql inside of the file. Code generation
 * should use builtIn.ref('<name>') to generate identifiers that refer to these.
 *
 * Finally builtIn.ast can be used to generate a require line that extracts the
 * properties that have been referenced somewhere.
 */
class BuiltInTypes {
  constructor() {
    this[USED] = new Set(['GraphQLObjectType', 'GraphQLSchema']);
  }

  resolveSwagger(swaggerType) {
    switch (swaggerType.type) {
      case 'boolean':
        return this.ref('GraphQLBoolean');

      case 'string':
        return isUUID(swaggerType)
          ? this.ref('GraphQLID')
          : this.ref('GraphQLString');

      case 'number':
        return this.ref('GraphQLFloat');

      case 'integer':
        return this.ref('GraphQLInt');
    }
    return this.ref(swaggerType);
  }

  ref(name) {
    if (!(name in graphql)) return null;
    this[USED].add(name);
    return t.identifier(name);
  }

  get usedTypes() {
    return Array.from(this[USED].values());
  }

  get ast() {
    return createImport({
      GRAPHQL_IMPORTS: t.objectPattern(
        this.usedTypes.map(typeUsed =>
          t.objectProperty(
            t.identifier(typeUsed),
            t.identifier(typeUsed),
            false,
            true
          )
        )
      ),
    });
  }
}
module.exports = BuiltInTypes;
