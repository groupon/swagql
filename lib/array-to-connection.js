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

const CURSOR_TYPE_NOOP = 0;
const CURSOR_TYPE_OFFSET = 1;

const NOOP_CURSOR = new Buffer([CURSOR_TYPE_NOOP]).toString('base64');

function createOffsetCursor(offset) {
  if (offset <= 0xff) {
    return new Buffer([CURSOR_TYPE_OFFSET, offset]).toString('base64');
  } else if (offset <= 0xffff) {
    const cursor = Buffer.alloc(3);
    cursor[0] = CURSOR_TYPE_OFFSET;
    cursor.writeUInt16BE(offset, 1);
    return cursor.toString('base64');
  }
  const cursor = Buffer.alloc(5);
  cursor[0] = CURSOR_TYPE_OFFSET;
  cursor.writeUInt32BE(offset, 1);
  return cursor.toString('base64');
}

function parseOffsetCursor(cursor) {
  const buffer = new Buffer(cursor, 'base64');
  if (buffer[0] !== CURSOR_TYPE_OFFSET) {
    throw new Error(`Invalid cursor ${cursor}`);
  }

  switch (buffer.length) {
    case 2:
      return buffer[1];

    case 3:
      return buffer.readUInt16BE(1);

    case 5:
      return buffer.readUInt32BE(1);

    default:
      throw new TypeError(`Invalid cursor ${cursor}`);
  }
}
exports.parseOffsetCursor = parseOffsetCursor;

function parseCursorOptions(options) {
  const qs = {};

  if (typeof options.after === 'string') {
    qs.offset = parseOffsetCursor(options.after) + 1;
  }

  if (typeof options.first === 'number') {
    qs.limit = options.first;
  } else if (
    typeof options.last === 'number' &&
    typeof options.before === 'string'
  ) {
    qs.limit = options.last;
    qs.offset = parseOffsetCursor(options.before) - qs.limit;
  }

  return qs;
}
exports.parseCursorOptions = parseCursorOptions;

function fromPaginationResult(data, nodes) {
  const { pagination } = data;
  const edges = nodes.map((node, idx) => ({
    node,
    cursor: createOffsetCursor(pagination.offset + idx),
  }));
  const nodeCount = nodes.length;
  return Object.assign({}, data, {
    nodes,
    edges,
    totalCount: pagination.count,
    pageInfo: {
      endCursor: nodeCount === 0 ? null : edges[nodeCount - 1].cursor,
      hasNextPage: pagination.offset + nodeCount < pagination.count,
      hasPreviousPage: pagination.offset > 0,
      startCursor: nodeCount === 0 ? null : edges[0].cursor,
    },
    pagination: undefined,
  });
}

function convertArrayToConnection(data, nodes) {
  if (data.pagination) return fromPaginationResult(data, nodes);
  const connection = Object.assign({}, data, {
    nodes,
    totalCount: nodes.length,
    pageInfo: {
      endCursor: null,
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
    },
    edges: nodes.map(node => ({ node, cursor: NOOP_CURSOR })),
  });
  return connection;
}
exports.convertArrayToConnection = convertArrayToConnection;
