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

function extractListType(connectingType, listKey) {
  if (listKey === null) {
    return { listType: connectingType, metaProperties: {} };
  }

  const metaProperties = Object.assign({}, connectingType.properties);
  delete metaProperties[listKey];

  return { listType: connectingType.properties[listKey], metaProperties };
}

class Connectionator {
  constructor(typeMap) {
    this.typeMap = typeMap;
    this.connectionTypes = new Map();
  }

  ensurePageInfo() {
    return this.typeMap.createImplicitType('PageInfo', {
      type: 'object',
      properties: {
        endCursor: { type: 'string' },
        hasNextPage: { type: 'boolean' },
        hasPreviousPage: { type: 'boolean' },
        startCursor: { type: 'string' },
      },
    }).apiType;
  }

  get(connectingType, listKey = null) {
    const { listType, metaProperties } = extractListType(
      connectingType,
      listKey
    );
    const itemType = this.typeMap.ref(listType.items, false);
    const baseName = itemType.name;
    if (!this.connectionTypes.has(baseName)) {
      const pageInfo = this.ensurePageInfo();

      const edge = this.typeMap.createImplicitType(`${baseName}Edge`, {
        type: 'object',
        properties: {
          cursor: { type: 'string' },
          node: listType.items,
        },
        required: ['cursor'],
      }).apiType;

      const connectionType = this.typeMap.createImplicitType(
        `${baseName}Connection`,
        {
          type: 'object',
          properties: Object.assign({}, metaProperties, {
            nodes: listType,
            edges: { type: 'array', items: edge },
            pageInfo: pageInfo,
            totalCount: { type: 'integer' },
          }),
          required: ['pageInfo', 'totalCount'],
        }
      );

      this.connectionTypes.set(baseName, connectionType.ref());
    }
    return this.connectionTypes.get(baseName);
  }
}
module.exports = Connectionator;
