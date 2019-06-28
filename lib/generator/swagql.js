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

const template = require('babel-template');
const t = require('babel-types');
const SwaggerParser = require('swagger-parser');

const BuiltInTypes = require('./built-in');
const Connectionator = require('./connectionator');
const deoperationalize = require('./deoperationalize');
const TypeMap = require('./type-map');

const DEFAULT_PARSE_OPTIONS = {
  resolve: {
    external: false,
  },
  validate: {
    schema: false,
    spec: false,
  },
};

const buildPrefix = template(`\
const {
  convertArrayToConnection,
  parseCursorOptions,
} = require('./array-to-connection');

const FETCH = Symbol(GRAPHQL_FETCH_SYMBOL_NAME);
const VERIFY_AUTH_STATUS = Symbol(GRAPHQL_VERIFY_AUTH_STATUS_SYMBOL_NAME)`);

const buildPostfix = template(`\
const Query = new GraphQLObjectType({
  name: 'Query',
  fields: QUERY_FIELDS,
});

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: MUTATION_FIELDS,
});

module.exports = {
  FETCH: FETCH,
  VERIFY_AUTH_STATUS: VERIFY_AUTH_STATUS,
  schema: new GraphQLSchema({
    query: Query,
    mutation: Mutation,
  }),
};
`);

const HTTP_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

function* getOperations(api) {
  for (const urlPath of Object.keys(api.paths)) {
    const byMethod = api.paths[urlPath];
    for (const httpMethod of Object.keys(byMethod)) {
      if (!HTTP_METHODS.has(httpMethod)) continue;
      yield {
        ...byMethod[httpMethod],
        method: httpMethod.toUpperCase(),
        path: urlPath,
      };
    }
  }
}

class SwagQL {
  constructor(api, namePrefix) {
    this.api = api;
    this.namePrefix = namePrefix;
    this.queryFields = new Map();
    this.mutationFields = new Map();
    this.builtins = new BuiltInTypes();

    this.outputTypes = new TypeMap(this.builtins, false, namePrefix);
    this.inputTypes = new TypeMap(this.builtins, true, namePrefix);

    if (api.definitions) {
      for (const [apiName, apiType] of Object.entries(api.definitions)) {
        this.outputTypes.addSwaggerDefinition(apiType, apiName);
        this.inputTypes.addSwaggerDefinition(apiType, apiName);
      }

      this.connections = new Connectionator(this.outputTypes);
    }

    for (const op of getOperations(api)) {
      this.addOperation(op);
    }
  }

  addOperation(op) {
    const id = op.operationId;
    const fields = op.method === 'GET' ? this.queryFields : this.mutationFields;
    if (!id || fields.has(id)) {
      throw new Error(
        `Invalid or duplicate operation id '${id}' at ${op.method} ${op.path}`
      );
    }

    const operationNode = deoperationalize(
      op,
      this.inputTypes,
      this.outputTypes,
      this.connections,
      this.api.security,
      this.api.securityDefinitions,
      this.namePrefix
    );

    fields.set(operationNode.key.name, operationNode);
  }

  get ast() {
    const prefix = buildPrefix({
      GRAPHQL_FETCH_SYMBOL_NAME: t.stringLiteral(
        `${this.api.info.title || 'swagger'} fetch`
      ),
      GRAPHQL_VERIFY_AUTH_STATUS_SYMBOL_NAME: t.stringLiteral(
        `${this.api.info.title || 'swagger'} verify auth`
      ),
    });
    const postfix = buildPostfix({
      QUERY_FIELDS: t.objectExpression(Array.from(this.queryFields.values())),
      MUTATION_FIELDS: t.objectExpression(
        Array.from(this.mutationFields.values())
      ),
    });
    const body = [
      t.expressionStatement(t.stringLiteral('use strict')),
      this.builtins.ast,
      ...[].concat(prefix),
      ...this.inputTypes.astNodes,
      ...this.outputTypes.astNodes,
      ...[].concat(postfix),
    ];
    const program = t.program(body);
    program.leadingComments = [
      {
        type: 'CommentLine',
        value: ' Generated by SwagQL. Do not edit by hand.',
      },
    ];
    return program;
  }

  static async fromSwagger(spec, parseOptions, namePrefix) {
    // results in a swagger object without any $ref pointers
    const api = await SwaggerParser.dereference(
      spec,
      parseOptions || DEFAULT_PARSE_OPTIONS,
      undefined
    );

    return new SwagQL(api, namePrefix);
  }
}
module.exports = SwagQL;
