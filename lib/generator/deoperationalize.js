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

const t = require('babel-types');
const template = require('babel-template');
const camelCase = require('lodash/camelCase');

const parser = require('@babel/parser');
const pick = require('lodash').pick;
const get = require('lodash/get');
const includes = require('lodash/includes');
const { isValidName, makeUniqueValidName } = require('./valid-name');

function normalizeOperationId(operationId) {
  return camelCase(operationId).replace(/^get(.)/, (m, nextChar) =>
    nextChar.toLowerCase()
  );
}

const RESOLVE_FETCH = `context[FETCH](FETCH_URL, {
  method: FETCH_METHOD,
  endpointName: OPERATION_ID,
  qs: QUERY_OPTIONS,
  pathParams: PATH_OPTIONS,
  headers: HEADER_OPTIONS,
  json: BODY_OPTION,
}).BODY_READER()`;

const buildSimpleResolveFunction = template(`\
async function resolve(parent, options, context, info) {

  if (context[VERIFY_AUTH_STATUS]) {
    const securityConfig = SECURITY_CONFIG;
    context[VERIFY_AUTH_STATUS](securityConfig);
  }

  const data = await ${RESOLVE_FETCH};
  return data;
}`);

const buildEmptyResponseResolveFunction = template(`\
async function resolve(parent, options, context, info) {

  if (context[VERIFY_AUTH_STATUS]) {
    const securityConfig = SECURITY_CONFIG;
    context[VERIFY_AUTH_STATUS](securityConfig);
  }

  const data = await ${RESOLVE_FETCH};
  return {
    rawResponseBody: data,
    rawInputOptions: options
  };
}`);

const buildMapFieldsResolveFunction = template(`\
async function resolve(parent, options, context, info) {

  if (context[VERIFY_AUTH_STATUS]) {
    const securityConfig = SECURITY_CONFIG;
    context[VERIFY_AUTH_STATUS](securityConfig);
  }

  const mapFields = MAP_FIELDS;

  function getValue(object, keys) {
    return keys.split('.').reduce(function (o, k) {
      return (o || {})[k];
    }, object);
  }

  if (mapFields && mapFields.length) {
    mapFields.reverse().forEach(({
      name,
      originalName,
      path
    }) => {
      let obj = getValue(options, path);
      if (obj) {
        const value = obj[name];
        obj[originalName] = value;
        delete obj[name];
      }
    });
  }

  const data = await ${RESOLVE_FETCH};
  return {
    rawResponseBody: data,
    rawInputOptions: options
  };
}`);

const buildRootPropertyNodeResolveFunction = template(`\
async function resolve(parent, options, context, info) {

  if (context[VERIFY_AUTH_STATUS]) {
    const securityConfig = SECURITY_CONFIG;
    context[VERIFY_AUTH_STATUS](securityConfig);
  }

  const data = await ${RESOLVE_FETCH};
  return data.ROOT_PROPERTY;
}`);

const buildConnectionResolveFunction = template(`\
async function resolve(parent, options, context, info) {

  if (context[VERIFY_AUTH_STATUS]) {
    const securityConfig = SECURITY_CONFIG;
    context[VERIFY_AUTH_STATUS](securityConfig);
  }

  const data = await ${RESOLVE_FETCH};
  return convertArrayToConnection(null, data, options);
}`);

const buildRootPropertyConnectionResolveFunction = template(`\
async function resolve(parent, options, context, info) {

  if (context[VERIFY_AUTH_STATUS]) {
    const securityConfig = SECURITY_CONFIG;
    context[VERIFY_AUTH_STATUS](securityConfig);
  }

  const data = await ${RESOLVE_FETCH};
  const nodes = data.ROOT_PROPERTY;
  return convertArrayToConnection(data, nodes, options);
}`);

function toObjectMethod(fn) {
  return Object.assign(
    t.objectMethod('method', fn.id, fn.params, fn.body, false),
    {
      async: fn.async,
    }
  );
}

function createEmptyResponseType() {
  return {
    type: 'object',
    properties: {
      rawResponseBody: { type: 'string' },
      // Scalar, no value in making this properly query-able.
      // This is mostly useful to extend this node with additional fields.
      rawInputOptions: { type: 'object' },
    },
  };
}

/**
 * security example:
 * [{"petstore_auth":["write:pets","read:pets"], "oauth": []}, {"petstore_auth": ["read:pets"]}];
 */
function buildSecurityConfig(opSecurity, defaultSecurity, securityDefinitions) {
  let securityConfig = {};
  const security = opSecurity || defaultSecurity;

  if (security && security.length) {
    const auths = new Set();
    security.forEach(schemas =>
      Object.keys(schemas).forEach(auth => auths.add(auth))
    );
    securityConfig = {
      security,
      definitions: pick(securityDefinitions, Array.from(auths)),
    };
  }

  return parser.parseExpression(JSON.stringify(securityConfig));
}

/**
 * Take operation, turn into field.
 */
function deoperationalize(
  op,
  inputTypes,
  outputTypes,
  connections,
  defaultSecurity,
  securityDefinitions,
  namePrefix = ''
) {
  const id = op.operationId;
  const normalizedId = normalizeOperationId(id);
  const httpMethod = op.method;

  const securityConfig = buildSecurityConfig(
    op.security,
    defaultSecurity,
    securityDefinitions
  );

  const successResponse =
    op.responses[200] || op.responses[201] || op.responses[204];
  const rootReturnType = successResponse ? successResponse.schema : null;

  const rootPropertyName = op['x-root-property'];
  const returnType = rootPropertyName
    ? rootReturnType.properties[rootPropertyName]
    : rootReturnType;

  const params = op.parameters || [];
  const gqlParamNames = new Map();

  let bodyParam = null;
  const pathParams = [];
  const queryParams = [];
  const headerParams = [];
  const formParams = [];

  for (const param of params) {
    const gqlParamName = camelCase(param.name);
    gqlParamNames.set(param, gqlParamName);

    const getOption = t.memberExpression(
      t.identifier('options'),
      t.identifier(gqlParamName)
    );

    switch (param.in) {
      case 'path':
        pathParams.push(
          t.objectProperty(t.stringLiteral(param.name), getOption)
        );
        break;

      case 'query':
        queryParams.push(
          t.objectProperty(t.stringLiteral(param.name), getOption)
        );
        break;

      case 'header':
        headerParams.push(
          t.objectProperty(t.stringLiteral(param.name), getOption)
        );
        break;

      case 'formData':
        formParams.push(
          t.objectProperty(t.stringLiteral(param.name), getOption)
        );
        break;

      case 'body':
        bodyParam = getOption;
        break;

      default:
        throw new Error(`TODO: Implement ${param.in}-param ${param.name}`);
    }
  }

  if (formParams.length) bodyParam = t.objectExpression(formParams);

  const args = params.map(param => {
    const paramType = inputTypes.ref(param.schema || param, param.required);
    return t.objectProperty(
      t.identifier(gqlParamNames.get(param)),
      t.objectExpression([t.objectProperty(t.identifier('type'), paramType)])
    );
  });

  const isBody = includes(['POST', 'PUT'], httpMethod);
  const mapFields = [];

  if (isBody) {
    params.forEach(param => {
      if (param.in === 'body') {
        const properties = get(param, 'schema.properties', []);
        buildMapFields(properties, param.name);
      }
    });
  }

  function buildMapFields(obj, objPath) {
    const usedNames = new Set(Object.keys(obj));
    Object.keys(obj).forEach(key => {
      let pathName = key;
      if (!isValidName(key)) {
        const name = makeUniqueValidName(key, usedNames);
        pathName = name;
        mapFields.push(
          t.objectExpression([
            t.objectProperty(t.identifier('name'), t.stringLiteral(name)),
            t.objectProperty(
              t.identifier('originalName'),
              t.stringLiteral(key)
            ),
            t.objectProperty(t.identifier('path'), t.stringLiteral(objPath)),
          ])
        );
      }
      if (typeof obj[key] === 'object') {
        const properties = get(obj[key], 'properties', false);
        if (properties) {
          const childPath = `${objPath}.${pathName}`;
          buildMapFields(properties, childPath);
        }
      }
    });
  }

  const isEmptyResponse = !returnType;
  let resolvedType = outputTypes.ref(
    isEmptyResponse ? createEmptyResponseType() : returnType,
    false,
    { apiName: normalizedId },
    'Response'
  );

  let resolveMethod;
  const resolveOptions = {
    FETCH_URL: t.stringLiteral(op.path),
    FETCH_METHOD: t.stringLiteral(httpMethod),
    OPERATION_ID: t.stringLiteral(id),
    QUERY_OPTIONS: queryParams.length
      ? t.objectExpression(queryParams)
      : t.identifier('undefined'),
    HEADER_OPTIONS: headerParams.length
      ? t.objectExpression(headerParams)
      : t.identifier('undefined'),
    PATH_OPTIONS: pathParams.length
      ? t.objectExpression(pathParams)
      : t.identifier('undefined'),
    BODY_OPTION: bodyParam || t.identifier('undefined'),
    MAP_FIELDS: mapFields.length
      ? t.arrayExpression(mapFields)
      : t.identifier('undefined'),
    ROOT_PROPERTY: t.identifier(rootPropertyName),
    BODY_READER: isEmptyResponse ? t.identifier('text') : t.identifier('json'),
    SECURITY_CONFIG: securityConfig,
  };

  if (isBody && mapFields.length) {
    resolveMethod = toObjectMethod(
      buildMapFieldsResolveFunction(resolveOptions)
    );
  } else if (isEmptyResponse) {
    resolveMethod = toObjectMethod(
      buildEmptyResponseResolveFunction(resolveOptions)
    );
  } else if (returnType && returnType.type === 'array') {
    // TODO: Move to transform (?)
    resolvedType = connections.get(rootReturnType, rootPropertyName);

    const cursorArgs = [
      ['first', 'integer'],
      ['after', 'string'],
      ['last', 'integer'],
      ['before', 'string'],
    ];
    for (const [name, type] of cursorArgs) {
      args.push(
        t.objectProperty(
          t.identifier(name),
          t.objectExpression([
            t.objectProperty(t.identifier('type'), outputTypes.ref({ type })),
          ])
        )
      );
    }

    if (!t.isObjectExpression(resolveOptions.QUERY_OPTIONS)) {
      resolveOptions.QUERY_OPTIONS = t.objectExpression([]);
    }
    resolveOptions.QUERY_OPTIONS.properties.push(
      t.spreadProperty(
        t.callExpression(t.identifier('parseCursorOptions'), [
          t.identifier('options'),
        ])
      )
    );

    // TODO: Move to transform (?)
    if (rootPropertyName) {
      resolveMethod = toObjectMethod(
        buildRootPropertyConnectionResolveFunction(resolveOptions)
      );
    } else {
      resolveMethod = toObjectMethod(
        buildConnectionResolveFunction(resolveOptions)
      );
    }
  } else if (rootPropertyName) {
    // TODO: Move to transform (?)
    resolveMethod = toObjectMethod(
      buildRootPropertyNodeResolveFunction(resolveOptions)
    );
  } else {
    resolveMethod = toObjectMethod(buildSimpleResolveFunction(resolveOptions));
  }

  const operationNode = t.objectProperty(
    t.identifier(namePrefix + normalizedId),
    t.objectExpression([
      t.objectProperty(t.identifier('type'), resolvedType),
      t.objectProperty(t.identifier('args'), t.objectExpression(args)),
      resolveMethod,
    ])
  );
  Object.defineProperty(operationNode, 'operation', { value: op });
  return operationNode;
}
module.exports = deoperationalize;
