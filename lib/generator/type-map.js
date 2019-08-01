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
const camelCase = require('lodash/camelCase');
const upperFirst = require('lodash/upperFirst');
const { isValidName, makeUniqueValidName } = require('./valid-name');

function normalizeTypeName(typeName) {
  return upperFirst(camelCase(typeName));
}

function generateListReference(typeMap, apiType) {
  const ofType = typeMap.ref(apiType.items, false);
  return t.newExpression(typeMap.listTypeRef, [ofType]);
}

function generateListAST(typeMap, type) {
  const { graphqlName, apiType } = type;

  const ofType = typeMap.ref(apiType.items, false);

  return t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(graphqlName),
      t.newExpression(typeMap.listTypeRef, [ofType])
    ),
  ]);
}

function generateScalarFallbackAST(typeMap, type) {
  const { graphqlName } = type;

  return t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(graphqlName),
      t.newExpression(typeMap.scalarTypeRef, [
        t.objectExpression([
          t.objectProperty(t.identifier('name'), t.stringLiteral(graphqlName)),
          t.objectMethod(
            'method',
            t.identifier('serialize'),
            [t.identifier('value')],
            t.blockStatement([t.returnStatement(t.identifier('value'))])
          ),
        ]),
      ])
    ),
  ]);
}

function generateTypeAST(typeMap, type) {
  const { graphqlName, apiType } = type;
  const { isInput } = typeMap;

  if (apiType.type === 'array') return generateListAST(typeMap, type);

  const props = apiType.properties || {};

  if (apiType.additionalProperties || !Object.keys(props).length) {
    // bail-out since we won't be able to fully represent this type
    return generateScalarFallbackAST(typeMap, type);
  }

  const requiredProps = apiType.required || [];
  const usedNames = new Set(Object.keys(props));

  const fields = Object.keys(props).map(propKey => {
    return generateFieldAST(propKey);
  });

  if (!fields.length) {
    fields.push(
      t.objectProperty(
        t.identifier('unknownShape'),
        t.objectExpression([
          t.objectProperty(
            t.identifier('type'),
            typeMap.ref({ type: 'boolean' }, false)
          ),
        ])
      )
    );
  }
  const node = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(graphqlName),
      t.newExpression(typeMap.objectTypeRef, [
        t.objectExpression([
          t.objectProperty(t.identifier('name'), t.stringLiteral(graphqlName)),
          t.objectProperty(
            t.identifier('fields'),
            // arrow expression to deal with recursion
            t.arrowFunctionExpression([], t.objectExpression(fields))
          ),
        ]),
      ])
    ),
  ]);

  function generateFieldAST(propKey) {
    const isValid = isValidName(propKey);
    const properties = [];
    properties.push(
      t.objectProperty(
        t.identifier('type'),
        typeMap.ref(
          props[propKey],
          requiredProps.includes(propKey),
          type,
          propKey
        )
      )
    );
    if (!isValid && !isInput) {
      properties.push(
        t.objectProperty(
          t.identifier('resolve'),
          t.arrowFunctionExpression(
            [t.identifier('obj')],
            t.memberExpression(
              t.identifier('obj'),
              t.stringLiteral(propKey),
              true
            )
          )
        )
      );
    }
    const name = isValid ? propKey : makeUniqueValidName(propKey, usedNames);
    return t.objectProperty(t.identifier(name), t.objectExpression(properties));
  }

  return node;
}

function byRefOrder(t1, t2) {
  return t2.refOrder - t1.refOrder;
}

class Type {
  constructor(typeMap, apiType, apiName, namePrefix = '') {
    this.typeMap = typeMap;
    this.apiName = apiName;
    this.apiType = apiType;
    this.graphqlName = typeMap.registerUniqueTypeName(
      `${namePrefix}${normalizeTypeName(apiName)}${typeMap.postfix}`
    );
    this.ast = null;
    this.refOrder = null;
  }

  ref() {
    if (this.apiType.type === 'array') {
      return generateListReference(this.typeMap, this.apiType);
    }

    if (this.ast === null) {
      this.refOrder = this.typeMap.getNextRefOrderIndex();
      this.ast = true; // prevent recursion
      this.ast = generateTypeAST(this.typeMap, this);
      this.ast.swagqlType = this; // to ease debugging
    }
    return t.identifier(this.graphqlName);
  }
}

class TypeMap {
  constructor(builtInTypes, isInput = false, namePrefix = '') {
    this.builtInTypes = builtInTypes;
    this.isInput = isInput;
    this.namePrefix = namePrefix;

    this.bySwaggerName = new Map();
    this.bySwaggerDefinition = new Map();
    this.allTypes = [];
    this.nextRefOrderIndex = 0;
    this.knownTypeNames = new Set();

    this.nextGeneratedTypeId = 1;
  }

  get objectTypeRef() {
    return this.builtInTypes.ref(`GraphQL${this.postfix}ObjectType`);
  }

  get listTypeRef() {
    return this.builtInTypes.ref('GraphQLList');
  }

  get scalarTypeRef() {
    return this.builtInTypes.ref('GraphQLScalarType');
  }

  get postfix() {
    return this.isInput ? 'Input' : '';
  }

  registerUniqueTypeName(name) {
    let uniqIdx = 2;
    let finalName = name;
    while (this.knownTypeNames.has(finalName)) {
      finalName = `${name}${uniqIdx++}`;
    }
    this.knownTypeNames.add(finalName);
    return finalName;
  }

  getNextRefOrderIndex() {
    return this.nextRefOrderIndex++;
  }

  nonNullableRef(ofTypeRef) {
    return t.callExpression(this.builtInTypes.ref('GraphQLNonNull'), [
      ofTypeRef,
    ]);
  }

  _baseRef(apiType, parentType = null, nameHint = '') {
    const schemaType = apiType.schema || apiType;

    const knownType = this.getBySwaggerType(schemaType);
    if (!knownType) {
      const builtin = this.builtInTypes.resolveSwagger(schemaType);
      if (builtin) return builtin;

      return this.generateAnonymousType(schemaType, parentType, nameHint);
    }
    return knownType.ref();
  }

  ref(apiType, required = false, parentType = null, nameHint = '') {
    const resolved = this._baseRef(apiType, parentType, nameHint);
    return required ? this.nonNullableRef(resolved) : resolved;
  }

  getBySwaggerName(apiName) {
    return this.bySwaggerName.get(apiName);
  }

  getBySwaggerType(apiType) {
    return this.bySwaggerDefinition.get(apiType);
  }

  add(type) {
    this.bySwaggerDefinition.set(type.apiType, type);
    this.bySwaggerName.set(type.apiName, type);
    this.allTypes.push(type);
  }

  addSwaggerDefinition(apiType, apiName) {
    this.add(new Type(this, apiType, apiName, this.namePrefix));
  }

  createImplicitType(apiName, apiType) {
    if (!this.bySwaggerName.has(apiName)) {
      const type = new Type(this, apiType, apiName, this.namePrefix);
      this.add(type);
    }
    return this.getBySwaggerName(apiName);
  }

  generateAnonymousType(apiType, parentType = null, nameHint = '') {
    // TODO: Better name generation based on context
    const name =
      parentType && nameHint
        ? `${parentType.apiName}_${nameHint}`
        : `UnknownType${this.nextGeneratedTypeId++}`;
    return this.createImplicitType(name, apiType).ref();
  }

  get astNodes() {
    const astFragments = this.allTypes
      .filter(type => type.ast !== null)
      .sort(byRefOrder)
      .map(type => type.ast);
    return astFragments;
  }
}
module.exports = TypeMap;
