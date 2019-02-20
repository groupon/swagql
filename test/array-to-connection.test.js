'use strict';

const assert = require('assertive');

const {
  convertArrayToConnection,
  parseOffsetCursor,
  parseCursorOptions,
} = require('../lib/array-to-connection');

function assertConnectionEquals(expected, data, nodes, options = {}) {
  const result = convertArrayToConnection(data, nodes, options);
  assert.deepEqual(expected, result);
  return result;
}

describe('convertArrayToConnection', () => {
  describe('parseCursorOptions', () => {
    const cases = new Map([
      [
        '{first}',
        {
          options: { first: 20 },
          qs: { limit: 20 },
        },
      ],
      [
        '{after}',
        {
          options: { after: 'ARg=' }, // after allItems[24]
          qs: { offset: 25 },
        },
      ],
      [
        '{first, after}',
        {
          options: { first: 20, after: 'ARg=' }, // after allItems[24]
          qs: { limit: 20, offset: 25 },
        },
      ],
      [
        '{last, before}',
        {
          options: { last: 2, before: 'ARc=' }, // before allItems[23]
          // the last 2 before [23] are [21] and [22]
          qs: { limit: 2, offset: 21 },
        },
      ],
      [
        // Not supported
        '{last}',
        {
          options: { last: 20 },
          qs: {},
        },
      ],
      [
        // Not supported
        '{before}',
        {
          options: { before: 'ARc=' },
          qs: {},
        },
      ],
    ]);

    for (const [name, { options, qs }] of cases) {
      it(`parses ${name}`, () => {
        assert.deepEqual(qs, parseCursorOptions(options));
      });
    }
  });

  describe('w/ .pagination', () => {
    describe('empty result', () => {
      it('has neither previous nor next one', () => {
        assertConnectionEquals(
          {
            totalCount: 0,
            nodes: [],
            edges: [],
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: null,
            },
            pagination: undefined,
          },
          {
            pagination: {
              count: 0,
              offset: 0,
            },
          },
          []
        );
      });
    });

    describe('1st page', () => {
      it('has no previous page but a next one', () => {
        const connection = assertConnectionEquals(
          {
            totalCount: 1042,
            nodes: ['x', 'y'],
            edges: [
              { cursor: 'AQA=', node: 'x' },
              { cursor: 'AQE=', node: 'y' },
            ],
            pageInfo: {
              endCursor: 'AQE=',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'AQA=',
            },
            pagination: undefined,
          },
          {
            pagination: { count: 1042, offset: 0 },
          },
          ['x', 'y']
        );
        assert.equal(0, parseOffsetCursor(connection.pageInfo.startCursor));
        assert.equal(1, parseOffsetCursor(connection.pageInfo.endCursor));
      });
    });

    describe('middle page', () => {
      it('has next and previous cursor', () => {
        const connection = assertConnectionEquals(
          {
            totalCount: 1042,
            nodes: ['x', 'y'],
            edges: [
              { cursor: 'ARc=', node: 'x' },
              { cursor: 'ARg=', node: 'y' },
            ],
            pageInfo: {
              endCursor: 'ARg=',
              hasNextPage: true,
              hasPreviousPage: true,
              startCursor: 'ARc=',
            },
            pagination: undefined,
          },
          {
            pagination: { count: 1042, offset: 23 },
          },
          ['x', 'y']
        );
        assert.equal(23, parseOffsetCursor(connection.pageInfo.startCursor));
        assert.equal(24, parseOffsetCursor(connection.pageInfo.endCursor));
      });

      it('handles offset > 255 (0xff)', () => {
        const connection = convertArrayToConnection(
          {
            pagination: { count: 1024, offset: 300 },
          },
          ['x', 'y']
        );
        assert.equal(300, parseOffsetCursor(connection.pageInfo.startCursor));
        assert.equal(301, parseOffsetCursor(connection.pageInfo.endCursor));
        assert.equal('AQEs', connection.pageInfo.startCursor);
        assert.equal('AQEt', connection.pageInfo.endCursor);
      });

      it('handles offset > 65535 (0xffff)', () => {
        const connection = convertArrayToConnection(
          {
            pagination: { count: 200000, offset: 123456 },
          },
          ['x', 'y']
        );
        assert.equal(
          123456,
          parseOffsetCursor(connection.pageInfo.startCursor)
        );
        assert.equal(123457, parseOffsetCursor(connection.pageInfo.endCursor));
        assert.equal('AQAB4kA=', connection.pageInfo.startCursor);
        assert.equal('AQAB4kE=', connection.pageInfo.endCursor);
      });
    });

    describe('last page', () => {
      it('has previous but no next cursor', () => {
        const connection = assertConnectionEquals(
          {
            totalCount: 1042,
            nodes: ['x', 'y', 'z'],
            edges: [
              { cursor: 'AQQP', node: 'x' },
              { cursor: 'AQQQ', node: 'y' },
              { cursor: 'AQQR', node: 'z' },
            ],
            pageInfo: {
              endCursor: 'AQQR',
              hasNextPage: false,
              hasPreviousPage: true,
              startCursor: 'AQQP',
            },
            pagination: undefined,
          },
          {
            pagination: { count: 1042, offset: 1039 },
          },
          ['x', 'y', 'z']
        );
        assert.equal(1039, parseOffsetCursor(connection.pageInfo.startCursor));
        assert.equal(1041, parseOffsetCursor(connection.pageInfo.endCursor));
      });
    });
  });
});
